import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isConfigured } from "./supabase";

// ── Types (colonnes de la table `carts`) ────────────────────────────────────
type Cart = {
  cart_id: string;
  first_seen: string;
  last_seen: string;
  last_step: string | null;
  last_status: string | null;
  payment_initiated: boolean;
  paid: boolean;
  lang: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  adults: number | null;
  children: number | null;
  room_name: string | null;
  rate_name: string | null;
  total_grand: number | null;
  currency: string | null;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  reservation_group_id: string | null;
  payment_request_id: string | null;
  airport_transfer: boolean | null; // extra hors Mews → cible de relance post-paiement
  infants: number | null; // bébés en berceau → déclenche le « kit bébé »
};

// Statut dérivé (une demande) : payé > paiement lancé non abouti > abandonné.
type CartStatusKey = "paid" | "failed" | "abandoned";
function cartStatus(c: Cart): CartStatusKey {
  return c.paid ? "paid" : c.payment_initiated ? "failed" : "abandoned";
}
const STATUS_META: Record<CartStatusKey, { label: string; cls: string; rank: number }> = {
  paid: { label: "Payé", cls: "bg-emerald-100 text-emerald-700", rank: 3 },
  failed: { label: "Non abouti", cls: "bg-amber-100 text-amber-700", rank: 2 },
  abandoned: { label: "Abandonné", cls: "bg-ink/10 text-ink/60", rank: 1 },
};

// Colonnes triables de la table.
type SortKey =
  | "customer_name"
  | "status"
  | "last_step"
  | "check_in"
  | "total_grand"
  | "utm_source"
  | "infants"
  | "airport_transfer"
  | "last_seen";
function cartValue(c: Cart, key: SortKey): string | number {
  switch (key) {
    case "customer_name":
      return (c.customer_name || c.customer_email || "zzz").toLowerCase();
    case "status":
      return STATUS_META[cartStatus(c)].rank;
    case "last_step": {
      const i = STEP_ORDER.indexOf(c.last_step || "");
      return i < 0 ? 0 : i;
    }
    case "check_in":
      return c.check_in || "";
    case "total_grand":
      return c.total_grand ?? -1;
    case "utm_source":
      return (c.utm_source || "zzz").toLowerCase();
    case "infants":
      return c.infants ?? 0;
    case "airport_transfer":
      return c.airport_transfer ? 1 : 0;
    default:
      return c.last_seen;
  }
}
type FunnelRow = { step: string; carts: number };
type EventRow = {
  id: number;
  status: string;
  step: string | null;
  event_at: string | null;
  received_at: string;
  payload: {
    totals?: { grand?: number | null } | null;
    products?: { id?: string; name?: string; priceEur?: number | null }[] | null;
    geo?: { country?: string | null; region?: string | null; city?: string | null } | null;
  } | null;
};

const CART_COLS_BASE =
  "cart_id,first_seen,last_seen,last_step,last_status,payment_initiated,paid,lang," +
  "utm_source,utm_medium,utm_campaign,check_in,check_out,nights,adults,children," +
  "room_name,rate_name,total_grand,currency,customer_email,customer_name,customer_phone," +
  "reservation_group_id,payment_request_id";
// Colonnes optionnelles (migrations Supabase) ajoutées à part : si `infants` et/ou
// `airport_transfer` n'existent pas encore, la requête retombe progressivement (le
// dashboard reste fonctionnel, sans ces colonnes) au lieu de planter sur « column does
// not exist ». Repli géré dans load().
const CART_COLS = CART_COLS_BASE + ",airport_transfer,infants";

// Étapes du tunnel, dans l'ordre.
const STEPS: { key: string; label: string }[] = [
  { key: "dates", label: "Recherche" },
  { key: "results", label: "Résultats" },
  { key: "guest", label: "Coordonnées" },
  { key: "upgrade", label: "Surclassement" },
  { key: "extras", label: "Extras" },
  { key: "payment", label: "Paiement" },
  { key: "confirmation", label: "Confirmation" },
];

const RANGES: { key: string; label: string; days: number | null }[] = [
  { key: "7", label: "7 jours", days: 7 },
  { key: "30", label: "30 jours", days: 30 },
  { key: "90", label: "90 jours", days: 90 },
  { key: "all", label: "Tout", days: null },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
// Prix EXACTS (pas d'arrondi) : 0 décimale si entier, sinon 2 (comme le front).
const eur = (n: number | null | undefined) => {
  const v = n ?? 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(v);
};

// Drapeau emoji d'un code pays ISO-3166-1 alpha-2 (ex. « CA » → 🇨🇦). "" si invalide.
function countryFlag(cc: string | null | undefined): string {
  const c = (cc || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "";
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}
const pct = (n: number) => `${Math.round(n * 100)}%`;

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

const STEP_LABEL = new Map(STEPS.map((s) => [s.key, s.label]));
const STEP_ORDER = STEPS.map((s) => s.key);
const stepLabel = (key: string | null) => (key ? STEP_LABEL.get(key) ?? key : "—");
const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00`));
const fmtRange = (ci: string, co: string | null) => (co ? `${fmtDay(ci)} → ${fmtDay(co)}` : fmtDay(ci));
const fmtClock = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(iso));
const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
// Libellé + couleur d'un événement de la timeline.
function eventMeta(status: string, step: string | null): { label: string; dot: string } {
  if (status === "paiement_valide") return { label: "Paiement validé", dot: "bg-emerald-500" };
  if (status === "paiement_initie") return { label: "Paiement lancé", dot: "bg-amber-500" };
  return { label: `Étape · ${stepLabel(step)}`, dot: "bg-turquoise" };
}

// ── Export CSV (séparateur « ; » + BOM UTF-8 → accents OK dans Excel FR) ──────
const CSV_COLS: { label: string; get: (c: Cart) => string | number }[] = [
  { label: "Client", get: (c) => c.customer_name || "" },
  { label: "E-mail", get: (c) => c.customer_email || "" },
  { label: "Téléphone", get: (c) => c.customer_phone || "" },
  { label: "Statut", get: (c) => STATUS_META[cartStatus(c)].label },
  { label: "Étape", get: (c) => stepLabel(c.last_step) },
  { label: "Arrivée", get: (c) => c.check_in || "" },
  { label: "Départ", get: (c) => c.check_out || "" },
  { label: "Nuits", get: (c) => c.nights ?? "" },
  { label: "Adultes", get: (c) => c.adults ?? "" },
  { label: "Enfants", get: (c) => c.children ?? "" },
  { label: "Bébés", get: (c) => c.infants ?? 0 },
  { label: "Kit bébé", get: (c) => ((c.infants ?? 0) > 0 ? "Oui" : "Non") },
  { label: "Chambre", get: (c) => c.room_name || "" },
  { label: "Tarif", get: (c) => c.rate_name || "" },
  { label: "Total", get: (c) => c.total_grand ?? "" },
  { label: "Devise", get: (c) => c.currency || "" },
  { label: "Transfert aéroport", get: (c) => (c.airport_transfer ? "Oui" : "Non") },
  { label: "Source", get: (c) => c.utm_source || "Direct" },
  { label: "Medium", get: (c) => c.utm_medium || "" },
  { label: "Campagne", get: (c) => c.utm_campaign || "" },
  { label: "Langue", get: (c) => (c.lang || "").toUpperCase() },
  { label: "Résa Mews", get: (c) => c.reservation_group_id || "" },
  { label: "Première visite", get: (c) => c.first_seen },
  { label: "Dernière visite", get: (c) => c.last_seen },
];
const csvCell = (v: string | number): string => {
  const s = String(v ?? "");
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function exportCartsCsv(rows: Cart[]) {
  const head = CSV_COLS.map((c) => csvCell(c.label)).join(";");
  const body = rows.map((c) => CSV_COLS.map((col) => csvCell(col.get(c))).join(";")).join("\r\n");
  const csv = String.fromCharCode(0xfeff) + head + "\r\n" + body;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `demandes-bambou-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════════════════════════════
// Racine : gère l'auth et route vers Login ou le Panel.
// ══════════════════════════════════════════════════════════════════════════
export function Dashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isConfigured) return <ConfigNeeded />;
  if (!ready) return <Splash />;
  if (!session) return <Login />;
  return <Panel email={session.user.email ?? ""} />;
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-cream">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-turquoise/25 border-t-turquoise" />
    </div>
  );
}

function ConfigNeeded() {
  return (
    <div className="grid min-h-dvh place-items-center bg-cream px-6 text-center">
      <div className="max-w-md">
        <h1 className="font-display text-2xl text-ink">Dashboard à configurer</h1>
        <p className="mt-3 text-sm text-ink/70">
          Ajoute ta clé <b>anon public</b> Supabase dans <code>src/dashboard/config.ts</code>
          (Supabase → Project Settings → API), puis recharge.
        </p>
      </div>
    </div>
  );
}

// ── Login classique e-mail + mot de passe ───────────────────────────────────
// signInWithPassword : pas d'e-mail envoyé (ni rate limit ni config Site URL/SMTP).
// Les comptes sont créés À LA MAIN dans Supabase (Auth → Users) ; l'inscription en ligne
// doit être désactivée côté Supabase (Providers → Email → Enable signups: off).
// Message d'erreur générique (anti-énumération) : on ne dit pas si l'e-mail existe.
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setError(
        /invalid login credentials/i.test(error.message)
          ? "E-mail ou mot de passe incorrect."
          : /rate limit/i.test(error.message)
            ? "Trop de tentatives. Patientez quelques minutes."
            : "Connexion impossible pour le moment. Réessayez.",
      );
    }
    // Succès → onAuthStateChange (Dashboard) bascule automatiquement sur le Panel.
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-cream px-5">
      <form onSubmit={submit} className="card w-full max-w-sm p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-corail">Bambou · Back-office</p>
        <h1 className="mt-1 font-display text-2xl text-ink">Dashboard funnel</h1>
        <p className="mt-1 text-sm text-ink/60">Accès réservé — connectez-vous.</p>

        <label className="mt-5 block text-sm font-medium text-ink/80">
          E-mail
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input mt-1"
            placeholder="toi@hotelbambou.fr"
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-ink/80">
          Mot de passe
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input mt-1"
            placeholder="••••••••"
          />
        </label>

        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

        <button type="submit" disabled={busy} className="btn-primary mt-5 w-full">
          {busy ? "Connexion…" : "Se connecter"}
        </button>
        <p className="mt-3 text-xs leading-relaxed text-ink/45">
          Accès strictement réservé. Les comptes sont créés manuellement — pas d'inscription en ligne.
        </p>
      </form>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Le dashboard (données live).
// ══════════════════════════════════════════════════════════════════════════
function Panel({ email }: { email: string }) {
  const [range, setRange] = useState("30");
  const [carts, setCarts] = useState<Cart[]>([]);
  const [funnel, setFunnel] = useState<FunnelRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const rangeRef = useRef(range);
  rangeRef.current = range;
  // Recherche + filtres + tri de la table.
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CartStatusKey>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "last_seen", dir: "desc" });
  // Sélection de lignes (cart_id) → export CSV de la sélection.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleRow = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Drawer de détail (historique de comportement d'une demande).
  const [openCart, setOpenCart] = useState<Cart | null>(null);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [eventsErr, setEventsErr] = useState<string | null>(null);

  const sinceIso = useCallback(() => {
    const days = RANGES.find((r) => r.key === rangeRef.current)?.days ?? null;
    return days ? new Date(Date.now() - days * 86_400_000).toISOString() : null;
  }, []);

  const load = useCallback(async () => {
    setError(null);
    const since = sinceIso();
    const runCarts = (cols: string) => {
      let q = supabase.from("carts").select(cols).order("last_seen", { ascending: false }).limit(5000);
      if (since) q = q.gte("first_seen", since);
      return q;
    };

    const [cartsRes0, funnelRes] = await Promise.all([runCarts(CART_COLS), supabase.rpc("dashboard_funnel", { since })]);
    // Repli progressif si des colonnes optionnelles (migrations) manquent encore.
    let cartsRes = cartsRes0;
    if (cartsRes.error && /infants/.test(cartsRes.error.message || "")) {
      cartsRes = await runCarts(CART_COLS_BASE + ",airport_transfer");
    }
    if (cartsRes.error && /airport_transfer/.test(cartsRes.error.message || "")) {
      cartsRes = await runCarts(CART_COLS_BASE);
    }

    if (cartsRes.error) setError(cartsRes.error.message);
    else setCarts((cartsRes.data ?? []) as unknown as Cart[]);
    if (!funnelRes.error) setFunnel((funnelRes.data ?? []) as FunnelRow[]);
    setUpdatedAt(new Date());
    setLoading(false);
  }, [sinceIso]);

  // Chargement + rafraîchissement live toutes les 20 s.
  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load, range]);

  // Timeline d'un panier (booking_events) — chargée à l'ouverture du drawer.
  useEffect(() => {
    if (!openCart) return;
    setEvents(null);
    setEventsErr(null);
    let alive = true;
    supabase
      .from("booking_events")
      .select("id,status,step,event_at,received_at,payload")
      .eq("cart_id", openCart.cart_id)
      .order("received_at", { ascending: true })
      .limit(500)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setEventsErr(error.message);
        else setEvents((data ?? []) as unknown as EventRow[]);
      });
    return () => {
      alive = false;
    };
  }, [openCart]);

  // Demandes filtrées (statut + recherche) puis triées selon la colonne active.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = carts.filter((c) => {
      if (statusFilter !== "all" && cartStatus(c) !== statusFilter) return false;
      if (
        q &&
        ![c.customer_name, c.customer_email, c.room_name, c.utm_source].some((v) => v?.toLowerCase().includes(q))
      )
        return false;
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = cartValue(a, sort.key);
      const vb = cartValue(b, sort.key);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [carts, query, statusFilter, sort]);

  // Sélection : « tout sélectionner » agit sur les lignes VISIBLES (filtrées).
  const allVisibleSelected = rows.length > 0 && rows.every((c) => selected.has(c.cart_id));
  const someVisibleSelected = !allVisibleSelected && rows.some((c) => selected.has(c.cart_id));
  const toggleAll = () =>
    setSelected((s) => {
      const next = new Set(s);
      if (allVisibleSelected) rows.forEach((c) => next.delete(c.cart_id));
      else rows.forEach((c) => next.add(c.cart_id));
      return next;
    });
  // Lignes exportées : la sélection si non vide, sinon toutes les lignes filtrées.
  const selectedRows = rows.filter((c) => selected.has(c.cart_id));
  const exportRows = selectedRows.length ? selectedRows : rows;

  // ── Agrégats calculés depuis `carts` ──
  const kpi = useMemo(() => {
    const total = carts.length;
    const paid = carts.filter((c) => c.paid).length;
    const initiated = carts.filter((c) => c.payment_initiated).length;
    const failed = carts.filter((c) => c.payment_initiated && !c.paid).length;
    const abandoned = carts.filter((c) => !c.paid && !c.payment_initiated).length;
    const revenue = carts.filter((c) => c.paid).reduce((s, c) => s + (c.total_grand ?? 0), 0);
    return { total, paid, initiated, failed, abandoned, revenue, conv: total ? paid / total : 0 };
  }, [carts]);

  const funnelBars = useMemo(() => {
    const byStep = new Map(funnel.map((f) => [f.step, f.carts]));
    const rows = STEPS.map((s) => ({ ...s, count: byStep.get(s.key) ?? 0 }));
    const top = rows[0]?.count || Math.max(1, ...rows.map((r) => r.count));
    return rows.map((r, i) => ({
      ...r,
      shareOfTop: top ? r.count / top : 0,
      fromPrev: i > 0 && rows[i - 1].count ? r.count / rows[i - 1].count : 1,
    }));
  }, [funnel]);

  return (
    <div className="min-h-dvh bg-cream text-ink">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-cream/85 backdrop-blur">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-corail">Bambou · Back-office</p>
            <h1 className="font-display text-xl text-ink">Dashboard funnel</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-card">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    range === r.key ? "bg-teal-deep text-cream" : "text-ink/60 hover:text-ink"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-ink/50">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              {updatedAt ? `MàJ ${updatedAt.toLocaleTimeString("fr-FR")}` : "…"}
            </span>
            <button onClick={() => load()} className="btn-ghost text-sm">
              Rafraîchir
            </button>
            <button onClick={() => supabase.auth.signOut()} className="text-sm text-ink/55 hover:text-ink" title={email}>
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="w-full space-y-6 px-5 py-6 sm:px-8">
        {error && (
          <div className="rounded-xl2 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <b>Erreur de lecture :</b> {error}
            <p className="mt-1 text-red-600/80">
              Vérifie côté Supabase : la policy RLS de lecture sur <code>carts</code> et la fonction{" "}
              <code>dashboard_funnel</code>.
            </p>
          </div>
        )}

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Paniers" value={kpi.total} />
          <StatTile label="Réservations" value={kpi.paid} accent="emerald" />
          <StatTile label="Taux de conversion" value={pct(kpi.conv)} accent="teal" />
          <StatTile label="Chiffre d'affaires" value={eur(kpi.revenue)} accent="teal" />
          <StatTile label="Paiements non aboutis" value={kpi.failed} accent="amber" />
          <StatTile label="Paniers abandonnés" value={kpi.abandoned} accent="corail" />
        </section>

        {/* Funnel */}
        <section className="card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg text-ink">Funnel — paniers par étape</h2>
            <span className="text-xs text-ink/45">nombre de paniers distincts ayant atteint l'étape</span>
          </div>
          <div className="mt-4 space-y-2.5">
            {funnelBars.map((r, i) => (
              <div key={r.key} className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-right text-sm font-medium text-ink/70">{r.label}</div>
                <div className="relative h-8 flex-1 overflow-hidden rounded-lg bg-sand/60">
                  <div
                    className="flex h-full items-center rounded-lg bg-gradient-to-r from-teal-deep to-turquoise px-3 text-sm font-semibold text-cream transition-all"
                    style={{ width: `${Math.max(r.shareOfTop * 100, r.count > 0 ? 6 : 0)}%` }}
                  >
                    {r.count > 0 && <span>{r.count}</span>}
                  </div>
                </div>
                <div className="w-16 shrink-0 text-right text-xs text-ink/50">
                  {i > 0 && r.count > 0 ? pct(r.fromPrev) : ""}
                </div>
              </div>
            ))}
            {loading && funnel.length === 0 && <p className="text-sm text-ink/45">Chargement…</p>}
            {!loading && funnel.length === 0 && (
              <p className="text-sm text-ink/45">Aucune donnée sur cette période.</p>
            )}
          </div>
        </section>

        {/* ── Base des demandes : 1 ligne par demande, filtrable + triable ── */}
        <section className="card overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <h2 className="font-display text-lg text-ink">
              Demandes <span className="text-sm font-normal text-ink/45">· {rows.length}</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-full bg-cream p-1">
                {(
                  [
                    ["all", "Toutes"],
                    ["paid", "Payé"],
                    ["failed", "Non abouti"],
                    ["abandoned", "Abandonné"],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setStatusFilter(k)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                      statusFilter === k ? "bg-teal-deep text-cream" : "text-ink/55 hover:text-ink"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher (nom, e-mail, chambre, source…)"
                className="field-input w-52 text-sm sm:w-64"
              />
              {selected.size > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs text-ink/55">
                  {selected.size} sélectionnée{selected.size > 1 ? "s" : ""}
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="font-semibold text-corail hover:underline"
                  >
                    Effacer
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={() => exportCartsCsv(exportRows)}
                disabled={exportRows.length === 0}
                className="btn-primary text-sm disabled:opacity-40"
                title={selected.size ? "Exporter la sélection" : "Exporter toutes les lignes filtrées"}
              >
                Exporter CSV ({exportRows.length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="border-y border-ink/10 bg-cream/60 text-[11px] uppercase tracking-wide text-ink/50">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Tout sélectionner"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someVisibleSelected;
                      }}
                      onChange={toggleAll}
                      className="h-4 w-4 cursor-pointer accent-teal-deep align-middle"
                    />
                  </th>
                  <Th label="Client" k="customer_name" sort={sort} setSort={setSort} />
                  <Th label="Statut" k="status" sort={sort} setSort={setSort} />
                  <Th label="Étape" k="last_step" sort={sort} setSort={setSort} />
                  <Th label="Séjour" k="check_in" sort={sort} setSort={setSort} />
                  <Th label="Voyageurs" />
                  <Th label="Kit bébé" k="infants" sort={sort} setSort={setSort} align="center" />
                  <Th label="Transf." k="airport_transfer" sort={sort} setSort={setSort} align="center" />
                  <Th label="Chambre" />
                  <Th label="Total" k="total_grand" sort={sort} setSort={setSort} align="right" />
                  <Th label="Source" k="utm_source" sort={sort} setSort={setSort} />
                  <Th label="Vu" k="last_seen" sort={sort} setSort={setSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c.cart_id}
                    onClick={() => setOpenCart(c)}
                    className={`cursor-pointer border-b border-ink/5 transition last:border-0 hover:bg-cream/60 ${
                      selected.has(c.cart_id) ? "bg-teal-deep/[0.06]" : ""
                    }`}
                  >
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Sélectionner ${c.customer_name || c.customer_email || "la demande"}`}
                        checked={selected.has(c.cart_id)}
                        onChange={() => toggleRow(c.cart_id)}
                        className="h-4 w-4 cursor-pointer accent-teal-deep align-middle"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="max-w-[180px] truncate font-semibold text-ink">
                        {c.customer_name || c.customer_email || "Anonyme"}
                      </p>
                      {c.customer_name && c.customer_email && (
                        <p className="max-w-[180px] truncate text-[11px] text-ink/45">{c.customer_email}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge cart={c} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-ink/70">{stepLabel(c.last_step)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-ink/70">
                      {c.check_in ? fmtRange(c.check_in, c.check_out) : "—"}
                      {c.nights ? <span className="text-ink/40"> · {c.nights}n</span> : ""}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-ink/70">
                      {c.adults ? `${c.adults} ad.` : "—"}
                      {c.children ? ` · ${c.children} enf.` : ""}
                      {(c.infants ?? 0) > 0 && (
                        <span className="ml-1" title={`${c.infants} bébé(s) en berceau`}>
                          👶
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <CheckMark on={(c.infants ?? 0) > 0} title="Kit bébé requis (bébé en berceau)" />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <CheckMark on={!!c.airport_transfer} title="Transfert aéroport demandé" />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block max-w-[170px] truncate text-ink/70">{c.room_name || "—"}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-ink">
                      {c.total_grand ? eur(c.total_grand) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-ink/60">{c.utm_source || "Direct"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] text-ink/45">
                      {timeAgo(c.last_seen)}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-3 py-8 text-center text-ink/45">
                      {carts.length ? "Aucune demande ne correspond aux filtres." : "Aucune demande sur cette période."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-xs text-ink/45">
            Cliquez une ligne pour voir tous les événements de la demande (création, étapes, paiement).
          </p>
        </section>

        {openCart && (
          <CartDrawer cart={openCart} events={events} error={eventsErr} onClose={() => setOpenCart(null)} />
        )}
      </main>
    </div>
  );
}

// ── Petits composants ───────────────────────────────────────────────────────
const ACCENT: Record<string, string> = {
  ink: "text-ink",
  emerald: "text-emerald-600",
  teal: "text-teal-deep",
  amber: "text-amber-600",
  corail: "text-corail",
};

function StatTile({ label, value, accent = "ink" }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink/45">{label}</p>
      <p className={`mt-1 font-display text-2xl ${ACCENT[accent] ?? ACCENT.ink}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ cart }: { cart: Cart }) {
  const m = STATUS_META[cartStatus(cart)];
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}>
      {m.label}
    </span>
  );
}

// En-tête de colonne triable (clic = tri ; re-clic = inverse le sens).
type SortState = { key: SortKey; dir: "asc" | "desc" };
function Th({
  label,
  k,
  sort,
  setSort,
  align = "left",
}: {
  label: string;
  k?: SortKey;
  sort?: SortState;
  setSort?: React.Dispatch<React.SetStateAction<SortState>>;
  align?: "left" | "right" | "center";
}) {
  const alignCls = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  if (!k || !sort || !setSort) return <th className={`px-3 py-2.5 font-medium ${alignCls}`}>{label}</th>;
  const active = sort.key === k;
  return (
    <th className={`px-3 py-2.5 font-medium ${alignCls}`}>
      <button
        type="button"
        onClick={() => setSort((s) => ({ key: k, dir: s.key === k && s.dir === "desc" ? "asc" : "desc" }))}
        className={`inline-flex items-center gap-1 transition hover:text-ink ${active ? "text-ink" : ""}`}
      >
        {label}
        <span className={active ? "opacity-100" : "opacity-20"}>{active && sort.dir === "asc" ? "↑" : "↓"}</span>
      </button>
    </th>
  );
}

// Case à cocher (lecture seule) : cochée (turquoise) si `on`, sinon case vide.
// Utilisée pour « Kit bébé » et « Transfert » dans le tableau + le drawer.
function CheckMark({ on, title }: { on: boolean; title?: string }) {
  return on ? (
    <span
      title={title}
      className="inline-flex h-5 w-5 items-center justify-center rounded border border-turquoise bg-turquoise text-white"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m5 13 4 4L19 7" />
      </svg>
    </span>
  ) : (
    <span className="inline-block h-5 w-5 rounded border border-ink/15" aria-hidden />
  );
}

// ── Drawer : fiche panier + timeline de comportement ────────────────────────
function CartDrawer({
  cart,
  events,
  error,
  onClose,
}: {
  cart: Cart;
  events: EventRow[] | null;
  error: string | null;
  onClose: () => void;
}) {
  const [entered, setEntered] = useState(false);
  const [tab, setTab] = useState<"choix" | "marketing" | "historique">("choix");
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEntered(false);
        setTimeout(onClose, 240);
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  const close = () => {
    setEntered(false);
    setTimeout(onClose, 240);
  };

  const name = cart.customer_name || cart.customer_email || "Panier anonyme";
  const initial = (cart.customer_name || cart.customer_email || "?").trim().charAt(0).toUpperCase() || "?";
  const durationMin =
    events && events.length > 1
      ? Math.round(
          (new Date(events[events.length - 1].received_at).getTime() - new Date(events[0].received_at).getTime()) /
            60000,
        )
      : null;

  // Localisation IP (ville + région + pays) : dernier payload d'événement qui la porte.
  const geo = (() => {
    for (let i = (events?.length ?? 0) - 1; i >= 0; i--) {
      const g = events![i].payload?.geo;
      if (g && (g.country || g.region || g.city)) return g;
    }
    return null;
  })();
  const geoValue = geo
    ? `${countryFlag(geo.country)} ${[geo.city, geo.region, geo.country].filter(Boolean).join(" · ")}`.trim()
    : "—";

  // Extras choisis : derniers produits présents dans un payload d'événement.
  const products = (() => {
    for (let i = (events?.length ?? 0) - 1; i >= 0; i--) {
      const p = events![i].payload?.products;
      if (p && p.length) return p;
    }
    return [] as NonNullable<NonNullable<EventRow["payload"]>["products"]>;
  })();

  const voyageurs = cart.adults
    ? `${cart.adults} adulte${cart.adults > 1 ? "s" : ""}${cart.children ? `, ${cart.children} enfant${cart.children > 1 ? "s" : ""}` : ""}${(cart.infants ?? 0) > 0 ? `, ${cart.infants} bébé${(cart.infants ?? 0) > 1 ? "s" : ""}` : ""}`
    : "—";
  const tabs = [
    { key: "choix", label: "Choix" },
    { key: "marketing", label: "Marketing" },
    { key: "historique", label: "Historique" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Panier — ${name}`}>
      <div
        onClick={close}
        className={`absolute inset-0 bg-ink/50 transition-opacity duration-300 ${entered ? "opacity-100" : "opacity-0"}`}
      ></div>
      <div
        className={`absolute right-0 top-0 flex h-full w-full max-w-3xl flex-col bg-cream shadow-float transition-transform duration-300 ease-out ${
          entered ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ── Bloc UTILISATEUR — toujours visible ── */}
        <div className="bg-teal-deep px-6 py-5 text-cream">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cream/15 font-display text-lg">
                {initial}
              </span>
              <div className="min-w-0">
                <h2 className="truncate font-display text-xl leading-tight">{name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-cream/75">
                  {cart.customer_email && <span className="truncate">{cart.customer_email}</span>}
                  {cart.customer_phone && <span className="whitespace-nowrap">{cart.customer_phone}</span>}
                </div>
              </div>
            </div>
            <button
              onClick={close}
              aria-label="Fermer"
              className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-cream/70 transition hover:bg-cream/10 hover:text-cream"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-cream">
            <StatusBadge cart={cart} />
            {(cart.infants ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-cream/15 px-2 py-0.5 text-[11px] font-semibold">
                👶 Kit bébé
              </span>
            )}
            {cart.airport_transfer && (
              <span className="inline-flex items-center gap-1 rounded-full bg-cream/15 px-2 py-0.5 text-[11px] font-semibold">
                ✈️ Transfert
              </span>
            )}
            <span className="rounded-full bg-cream/15 px-2 py-0.5 text-[11px] font-semibold">
              {cart.lang ? cart.lang.toUpperCase() : "—"}
            </span>
            {geo && (
              <span className="rounded-full bg-cream/15 px-2 py-0.5 text-[11px] font-semibold">{geoValue}</span>
            )}
            <span className="text-xs text-cream/60">· vu {timeAgo(cart.last_seen)}</span>
          </div>
        </div>

        {/* ── Onglets (Choix / Marketing / Historique) ── */}
        <div className="flex gap-1 border-b border-ink/10 px-5">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold transition ${
                tab === tb.key ? "border-corail text-ink" : "border-transparent text-ink/45 hover:text-ink"
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* ── CHOIX ── */}
          {tab === "choix" && (
            <div className="space-y-5">
              <div className="flex items-baseline justify-between rounded-xl border border-ink/8 bg-white px-4 py-3 shadow-card">
                <span className="text-sm font-medium text-ink/60">Total</span>
                <span className="font-display text-2xl text-teal-deep">
                  {cart.total_grand ? eur(cart.total_grand) : "—"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Cell
                  label="Séjour"
                  value={cart.check_in ? `${fmtRange(cart.check_in, cart.check_out)}${cart.nights ? ` · ${cart.nights}n` : ""}` : "—"}
                />
                <Cell label="Voyageurs" value={voyageurs} />
                <Cell label="Chambre" value={cart.room_name || "—"} />
                <Cell label="Tarif" value={cart.rate_name || "—"} />
              </div>
              {((cart.infants ?? 0) > 0 || cart.airport_transfer) && (
                <div className="flex flex-wrap gap-2">
                  {(cart.infants ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-turquoise/10 px-3 py-1.5 text-xs font-semibold text-teal-deep">
                      <CheckMark on title="Kit bébé requis" /> Kit bébé requis
                    </span>
                  )}
                  {cart.airport_transfer && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-turquoise/10 px-3 py-1.5 text-xs font-semibold text-teal-deep">
                      ✈️ Transfert aéroport demandé
                    </span>
                  )}
                </div>
              )}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/45">Extras choisis</p>
                {products.length ? (
                  <ul className="mt-2 space-y-1.5">
                    {products.map((p, i) => (
                      <li
                        key={p.id || i}
                        className="flex items-center justify-between gap-3 rounded-lg border border-ink/8 bg-white px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate text-ink/80">{p.name || "Extra"}</span>
                        {typeof p.priceEur === "number" && (
                          <span className="shrink-0 tabular-nums text-ink/55">{eur(p.priceEur)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-ink/45">Aucun extra sélectionné.</p>
                )}
              </div>
              {cart.reservation_group_id && (
                <Fact label="Résa Mews" value={cart.reservation_group_id} mono />
              )}
            </div>
          )}

          {/* ── MARKETING ── */}
          {tab === "marketing" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Cell label="Source" value={cart.utm_source || "Direct"} />
                <Cell label="Canal" value={cart.utm_medium || "—"} />
                <Cell label="Campagne" value={cart.utm_campaign || "—"} />
                <Cell label="Localisation (IP)" value={geoValue} />
                <Cell label="Langue" value={cart.lang ? cart.lang.toUpperCase() : "—"} />
                <Cell
                  label="Durée de navigation"
                  value={durationMin == null ? "—" : durationMin === 0 ? "< 1 min" : `${durationMin} min`}
                />
              </div>
              <dl className="grid grid-cols-1 gap-y-2.5 text-sm">
                <Fact label="Première visite" value={fmtDateTime(cart.first_seen)} />
                <Fact label="Dernière activité" value={`${fmtDateTime(cart.last_seen)} · ${timeAgo(cart.last_seen)}`} />
              </dl>
            </div>
          )}

          {/* ── HISTORIQUE ── */}
          {tab === "historique" && (
            <div>
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-lg text-ink">Parcours</h3>
                {durationMin != null && (
                  <span className="text-xs text-ink/45">
                    {durationMin === 0 ? "< 1 min" : `${durationMin} min`} sur le site
                  </span>
                )}
              </div>
              {error && (
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                  Impossible de charger l'historique. Ajoute la policy de lecture sur <code>booking_events</code>.
                </div>
              )}
              {!error && events === null && <p className="mt-3 text-sm text-ink/45">Chargement…</p>}
              {!error && events?.length === 0 && <p className="mt-3 text-sm text-ink/45">Aucun événement enregistré.</p>}
              {events && events.length > 0 && (
                <ol className="mt-4">
                  {events.map((e, i) => {
                    const m = eventMeta(e.status, e.step);
                    const last = i === events.length - 1;
                    return (
                      <li key={e.id} className="relative flex gap-3 pb-4">
                        {!last && <span className="absolute left-[5px] top-3 h-full w-px bg-ink/12" aria-hidden></span>}
                        <span
                          className={`relative z-10 mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${m.dot} ring-4 ring-cream`}
                        ></span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink">{m.label}</p>
                          <p className="text-xs tabular-nums text-ink/45">{fmtClock(e.event_at || e.received_at)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Cellule d'info (label + valeur) pour les grilles des onglets du drawer.
function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink/8 bg-white px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink/45">{label}</p>
      <p className="mt-0.5 break-words font-medium text-ink">{value}</p>
    </div>
  );
}

function Fact({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ink/5 pb-2">
      <dt className="shrink-0 text-ink/50">{label}</dt>
      <dd
        className={`min-w-0 truncate text-right ${
          strong ? "font-display text-base text-teal-deep" : mono ? "font-mono text-xs text-ink/70" : "font-medium text-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
