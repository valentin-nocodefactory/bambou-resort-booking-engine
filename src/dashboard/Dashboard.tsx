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
};
type FunnelRow = { step: string; carts: number };
type EventRow = { id: number; status: string; step: string | null; event_at: string | null; received_at: string };

const CART_COLS =
  "cart_id,first_seen,last_seen,last_step,last_status,payment_initiated,paid,lang," +
  "utm_source,utm_medium,utm_campaign,check_in,check_out,nights,adults,children," +
  "room_name,rate_name,total_grand,currency,customer_email,customer_name,customer_phone," +
  "reservation_group_id,payment_request_id";

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
const eur = (n: number | null | undefined) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n ?? 0);
const pct = (n: number) => `${Math.round(n * 100)}%`;

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

const STEP_LABEL = new Map(STEPS.map((s) => [s.key, s.label]));
const stepLabel = (key: string | null) => (key ? STEP_LABEL.get(key) ?? key : "—");
const statusColor = (c: { paid: boolean; payment_initiated: boolean }) =>
  c.paid ? "bg-emerald-400" : c.payment_initiated ? "bg-amber-400" : "bg-ink/20";
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

// ── Login (email / mot de passe) ────────────────────────────────────────────
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
    if (error) setError(error.message);
    setBusy(false);
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-cream px-5">
      <form onSubmit={submit} className="card w-full max-w-sm p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-corail">Bambou · Back-office</p>
        <h1 className="mt-1 font-display text-2xl text-ink">Dashboard funnel</h1>
        <p className="mt-1 text-sm text-ink/60">Connecte-toi pour piloter le tunnel.</p>

        <label className="mt-5 block text-sm font-medium text-ink/80">
          E-mail
          <input
            type="email"
            required
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
  // Recherche + drawer de détail (historique de comportement d'un panier).
  const [query, setQuery] = useState("");
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
    let cartsQ = supabase.from("carts").select(CART_COLS).order("last_seen", { ascending: false }).limit(5000);
    if (since) cartsQ = cartsQ.gte("first_seen", since);

    const [cartsRes, funnelRes] = await Promise.all([
      cartsQ,
      supabase.rpc("dashboard_funnel", { since }),
    ]);

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
      .select("id,status,step,event_at,received_at")
      .eq("cart_id", openCart.cart_id)
      .order("received_at", { ascending: true })
      .limit(500)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setEventsErr(error.message);
        else setEvents((data ?? []) as EventRow[]);
      });
    return () => {
      alive = false;
    };
  }, [openCart]);

  // Liste filtrée par la recherche (nom / e-mail / chambre).
  const filteredCarts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return carts;
    return carts.filter((c) =>
      [c.customer_name, c.customer_email, c.room_name, c.utm_source].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [carts, query]);

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

  const sources = useMemo(() => {
    const map = new Map<string, { source: string; carts: number; paid: number }>();
    for (const c of carts) {
      const key = c.utm_source || "Direct";
      const e = map.get(key) ?? { source: key, carts: 0, paid: 0 };
      e.carts++;
      if (c.paid) e.paid++;
      map.set(key, e);
    }
    return [...map.values()].sort((a, b) => b.carts - a.carts).slice(0, 8);
  }, [carts]);

  return (
    <div className="min-h-dvh bg-cream text-ink">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-cream/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
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

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-6">
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

        <div className="space-y-6">
          {/* Sources */}
          <section className="card p-5">
            <h2 className="font-display text-lg text-ink">Sources d'acquisition</h2>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink/45">
                  <th className="pb-2 font-medium">Source</th>
                  <th className="pb-2 text-right font-medium">Paniers</th>
                  <th className="pb-2 text-right font-medium">Résa</th>
                  <th className="pb-2 text-right font-medium">Taux</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.source} className="border-t border-ink/5">
                    <td className="py-2 font-medium text-ink">{s.source}</td>
                    <td className="py-2 text-right text-ink/70">{s.carts}</td>
                    <td className="py-2 text-right text-ink/70">{s.paid}</td>
                    <td className="py-2 text-right font-semibold text-teal-deep">
                      {pct(s.carts ? s.paid / s.carts : 0)}
                    </td>
                  </tr>
                ))}
                {sources.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-3 text-ink/45">
                      —
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {/* Paniers — liste enrichie, recherchable, cliquable */}
          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg text-ink">
                Paniers <span className="text-sm font-normal text-ink/45">· {filteredCarts.length}</span>
              </h2>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher (nom, e-mail, chambre…)"
                className="field-input w-full max-w-xs text-sm"
              />
            </div>
            <p className="mt-1 text-xs text-ink/45">Clique un panier pour voir son historique de comportement.</p>
            <div className="mt-3 max-h-[560px] divide-y divide-ink/5 overflow-y-auto">
              {filteredCarts.map((c) => (
                <button
                  key={c.cart_id}
                  onClick={() => setOpenCart(c)}
                  className="group flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition hover:bg-cream/70"
                >
                  <span className={`h-9 w-1 shrink-0 rounded-full ${statusColor(c)}`} aria-hidden></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {c.customer_name || c.customer_email || "Anonyme"}
                    </p>
                    <p className="truncate text-xs text-ink/50">
                      {c.room_name || "—"}
                      {c.check_in ? ` · ${fmtRange(c.check_in, c.check_out)}` : ""} · {c.utm_source || "Direct"}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-sm font-semibold tabular-nums text-ink">{c.total_grand ? eur(c.total_grand) : "—"}</p>
                    <p className="text-[11px] text-ink/45">
                      {stepLabel(c.last_step)} · {timeAgo(c.last_seen)}
                    </p>
                  </div>
                  <StatusBadge cart={c} />
                  <span className="shrink-0 text-lg text-ink/25 transition group-hover:translate-x-0.5 group-hover:text-ink/45">›</span>
                </button>
              ))}
              {filteredCarts.length === 0 && (
                <p className="py-4 text-sm text-ink/45">
                  {carts.length ? "Aucun panier ne correspond à la recherche." : "Aucun panier sur cette période."}
                </p>
              )}
            </div>
          </section>
        </div>

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
  const [label, cls] = cart.paid
    ? ["Payé", "bg-emerald-100 text-emerald-700"]
    : cart.payment_initiated
      ? ["Non abouti", "bg-amber-100 text-amber-700"]
      : ["Abandonné", "bg-ink/10 text-ink/60"];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>;
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
  const durationMin =
    events && events.length > 1
      ? Math.round(
          (new Date(events[events.length - 1].received_at).getTime() - new Date(events[0].received_at).getTime()) /
            60000,
        )
      : null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Panier — ${name}`}>
      <div
        onClick={close}
        className={`absolute inset-0 bg-ink/50 transition-opacity duration-300 ${entered ? "opacity-100" : "opacity-0"}`}
      ></div>
      <div
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-cream shadow-float transition-transform duration-300 ease-out ${
          entered ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-3 bg-teal-deep px-5 py-4 text-cream">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cream/60">Panier</p>
            <h2 className="truncate font-display text-xl">{name}</h2>
            {cart.customer_email && cart.customer_name && (
              <p className="truncate text-xs text-cream/70">{cart.customer_email}</p>
            )}
          </div>
          <button
            onClick={close}
            aria-label="Fermer"
            className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-cream/70 transition hover:bg-cream/10 hover:text-cream"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4">
            <StatusBadge cart={cart} />
          </div>

          <dl className="grid grid-cols-1 gap-y-2.5 text-sm">
            <Fact
              label="Séjour"
              value={
                cart.check_in
                  ? `${fmtRange(cart.check_in, cart.check_out)}${cart.nights ? ` · ${cart.nights} nuit${cart.nights > 1 ? "s" : ""}` : ""}`
                  : "—"
              }
            />
            <Fact
              label="Voyageurs"
              value={
                cart.adults
                  ? `${cart.adults} adulte${cart.adults > 1 ? "s" : ""}${cart.children ? `, ${cart.children} enfant${cart.children > 1 ? "s" : ""}` : ""}`
                  : "—"
              }
            />
            <Fact label="Chambre" value={cart.room_name || "—"} />
            <Fact label="Tarif" value={cart.rate_name || "—"} />
            <Fact label="Total" value={cart.total_grand ? eur(cart.total_grand) : "—"} strong />
            <Fact
              label="Source"
              value={[cart.utm_source || "Direct", cart.utm_medium, cart.utm_campaign].filter(Boolean).join(" · ")}
            />
            <Fact label="Langue" value={cart.lang ? cart.lang.toUpperCase() : "—"} />
            <Fact label="Contact" value={[cart.customer_email, cart.customer_phone].filter(Boolean).join(" · ") || "—"} />
            <Fact label="Vu" value={`${fmtDateTime(cart.first_seen)} → ${timeAgo(cart.last_seen)}`} />
            {cart.reservation_group_id && <Fact label="Résa Mews" value={cart.reservation_group_id} mono />}
          </dl>

          <div className="mt-6">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-lg text-ink">Comportement</h3>
              {durationMin != null && (
                <span className="text-xs text-ink/45">
                  {durationMin === 0 ? "< 1 min" : `${durationMin} min`} sur le site
                </span>
              )}
            </div>

            {error && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                Impossible de charger l'historique. Ajoute la policy de lecture sur <code>booking_events</code> (voir
                setup).
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
        </div>
      </div>
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
