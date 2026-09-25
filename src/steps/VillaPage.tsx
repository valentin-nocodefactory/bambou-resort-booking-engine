import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Brand } from "../components/Brand";
import { DateRangePicker } from "../components/DateRangePicker";
import { IconArrowRight, IconCheck, IconChevron, IconClose, IconExpand, IconMinus, IconPlus, IconUsers } from "../components/icons";
import { EMAIL_RE, villaImg } from "../lib/format";
import { getLang } from "../lib/lang";
import { api } from "../lib/api";
import type { Villa } from "../lib/villas";
import { t } from "../i18n";

// Code-split : libphonenumber-js (~38 Ko gzip) n'est chargé qu'ici.
const PhoneInput = lazy(() => import("../components/PhoneInput").then((m) => ({ default: m.PhoneInput })));

// Page /villa — DEMANDE de villa privée (lead), hors moteur Mews : aucun blocage de dates,
// aucune dispo temps réel. Rendue hors BookingProvider (cf. App) → autonome. La destination
// des données reste à définir (cf. TODO dans submit) ; le catalogue de villas vient de
// lib/villas.ts (destiné à devenir éditable depuis le back-office).
type VillaForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  phoneValid: boolean;
  checkIn: string;
  checkOut: string;
  flexible: boolean;
  people: number;
  baby: boolean;
  villaId: string;
  message: string;
};

const EMPTY: VillaForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  phoneValid: true,
  checkIn: "",
  checkOut: "",
  flexible: false,
  people: 2,
  baby: false,
  villaId: "",
  message: "",
};

// Pré-remplissage depuis l'étape 1 (dates + voyageurs passés dans l'URL) → évite la double
// saisie. `people` = adultes + enfants (4 ans et +) ; `baby` = au moins un bébé (<4 ans).
function initialForm(): VillaForm {
  try {
    const p = new URLSearchParams(window.location.search);
    const num = (k: string) => {
      const n = parseInt(p.get(k) ?? "", 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    };
    const people = num("adults") + num("children");
    return {
      ...EMPTY,
      checkIn: p.get("in") ?? "",
      checkOut: p.get("out") ?? "",
      people: people > 0 ? people : EMPTY.people,
      baby: num("babies") > 0,
    };
  } catch {
    return EMPTY;
  }
}

// Identifiant de session (stable le temps de l'onglet) pour relier la « vue » et la
// « demande » et dédupliquer les vues côté funnel.
function villaSessionId(): string {
  try {
    const k = "bambou_villa_sid";
    let s = sessionStorage.getItem(k);
    if (!s) {
      s = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(k, s);
    }
    return s;
  } catch {
    return `${Date.now()}`;
  }
}

export function VillaPage() {
  const [geoCountry, setGeoCountry] = useState<string | undefined>();
  const [villas, setVillas] = useState<Villa[]>([]);
  const [form, setForm] = useState<VillaForm>(initialForm);
  const [openVilla, setOpenVilla] = useState<Villa | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const set = (patch: Partial<VillaForm>) => setForm((f) => ({ ...f, ...patch }));

  // Retour accueil en conservant ?lang=/?cur=.
  const goHome = () => window.location.assign(`/${window.location.search}`);

  // Indicatif téléphone par défaut (IP) + catalogue des villas (back-office Supabase).
  useEffect(() => {
    let alive = true;
    void api.geo().then((r) => {
      if (alive && r?.country) setGeoCountry(r.country);
    });
    void api.villas().then((v) => {
      if (alive) setVillas(v);
    });
    // Étape 1 du funnel villa : « formulaire vu » (best-effort).
    void api.villaLead({ stage: "vue", sessionId: villaSessionId() });
    return () => {
      alive = false;
    };
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.firstName.trim() || !form.lastName.trim()) errs.name = t("villaForm.errName");
    if (!EMAIL_RE.test(form.email.trim())) errs.email = t("villaForm.errEmail");
    if (!form.flexible && (!form.checkIn || !form.checkOut)) errs.dates = t("villaForm.errDates");
    else if (form.checkIn && form.checkOut && form.checkOut <= form.checkIn) errs.dates = t("villaForm.errDatesOrder");
    if (form.people < 1) errs.people = t("villaForm.errPeople");
    if (form.phone && !form.phoneValid) errs.phone = t("villaForm.errPhone");
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone || null,
      checkIn: form.checkIn || null,
      checkOut: form.checkOut || null,
      flexibleDates: form.flexible,
      people: form.people,
      withBaby: form.baby,
      villaId: form.villaId || null,
      villaName: villas.find((v) => v.id === form.villaId)?.name ?? null,
      message: form.message.trim() || null,
      lang: getLang(),
      submittedAt: new Date().toISOString(),
    };
    // Étape 2 : envoi de la demande au back-office (table Supabase villa_leads) → dashboard.
    // Best-effort : on affiche « envoyé » quoi qu'il arrive (pas d'échec visible à l'utilisateur).
    void api.villaLead({ stage: "demande", sessionId: villaSessionId(), ...payload });
    setSent(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      {/* Bandeau photo + titre */}
      <header className="relative overflow-hidden bg-marine text-white">
        <img
          src="/img/properties/villas.webp"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-marine/70 via-marine/55 to-marine/85" />
        <div className="relative z-10 mx-auto w-full max-w-3xl px-5 py-6 sm:px-8 sm:py-7">
          <button type="button" onClick={goHome} aria-label={t("header.home")}>
            <Brand className="text-cream drop-shadow-[0_1px_12px_rgba(6,26,45,0.55)]" />
          </button>
          <div className="mt-7 max-w-xl">
            <h1 className="font-display text-4xl leading-tight text-white drop-shadow-[0_2px_20px_rgba(6,26,45,0.5)] sm:text-5xl">
              {t("villa.title")}
            </h1>
            <p className="mt-3 text-base leading-snug text-white/85 sm:text-lg">{t("villaForm.intro")}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8 sm:py-10">
        {sent ? (
          <SuccessCard onHome={goHome} />
        ) : (
          <form onSubmit={submit} noValidate className="card space-y-7 p-5 sm:p-7">
            {/* Vos coordonnées */}
            <Section title={t("villaForm.sectionYou")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("villaForm.firstName")} required error={errors.name}>
                  <input
                    className="field-input"
                    autoComplete="given-name"
                    value={form.firstName}
                    onChange={(e) => set({ firstName: e.target.value })}
                  />
                </Field>
                <Field label={t("villaForm.lastName")} required>
                  <input
                    className="field-input"
                    autoComplete="family-name"
                    value={form.lastName}
                    onChange={(e) => set({ lastName: e.target.value })}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("villaForm.email")} required error={errors.email}>
                  <input
                    type="email"
                    className="field-input"
                    autoComplete="email"
                    placeholder={t("villaForm.emailPlaceholder")}
                    value={form.email}
                    onChange={(e) => set({ email: e.target.value })}
                  />
                </Field>
                <Field label={t("villaForm.phone")} error={errors.phone}>
                  <Suspense fallback={<div className="field-input animate-pulse text-ink/30">…</div>}>
                    <PhoneInput
                      value={form.phone}
                      defaultCountry={geoCountry}
                      onChange={(val, valid) => set({ phone: val, phoneValid: valid })}
                    />
                  </Suspense>
                </Field>
              </div>
            </Section>

            {/* Votre séjour */}
            <Section title={t("villaForm.sectionStay")}>
              <Field label={t("villaForm.dates")} required error={errors.dates}>
                <DateRangePicker
                  checkIn={form.checkIn}
                  checkOut={form.checkOut}
                  onChange={(ci, co) => set({ checkIn: ci, checkOut: co })}
                  blockHolidayMin={false}
                />
                <Check checked={form.flexible} onChange={(v) => set({ flexible: v })} label={t("villaForm.flexible")} className="mt-3" />
              </Field>

              <Field label={t("villaForm.people")} required error={errors.people}>
                <div className="flex flex-wrap items-center gap-4">
                  <Stepper value={form.people} min={1} max={20} onChange={(v) => set({ people: v })} />
                  <span className="text-xs text-ink/50">{t("villaForm.peopleHint")}</span>
                </div>
                <Check checked={form.baby} onChange={(v) => set({ baby: v })} label={t("villaForm.baby")} className="mt-3" babyEmoji />
              </Field>
            </Section>

            {/* Villa souhaitée (catalogue du back-office ; masqué si indisponible) */}
            {villas.length > 0 && (
            <Section title={t("villaForm.villa")}>
              <p className="-mt-1.5 text-xs text-ink/50">{t("villaForm.villaHint")}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {villas.map((v) => {
                  const on = form.villaId === v.id;
                  const toggle = () => set({ villaId: on ? "" : v.id });
                  return (
                    <div
                      key={v.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={on}
                      aria-label={t("villaForm.villaSelectAria", { name: v.name })}
                      onClick={toggle}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggle();
                        }
                      }}
                      className={`group flex cursor-pointer flex-col overflow-hidden rounded-xl2 border text-left transition ${
                        on ? "border-corail ring-2 ring-corail" : "border-ink/12 hover:border-turquoise/60"
                      }`}
                    >
                      <div className="relative aspect-[3/2] w-full overflow-hidden">
                        <img src={villaImg(v.image, 640)} alt="" className="h-full w-full object-cover" />
                        {v.photos.length > 1 && (
                          <span className="absolute bottom-2 left-2 rounded-full bg-marine/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                            {t("roomCard.photos", { count: v.photos.length })}
                          </span>
                        )}
                        {/* Pastille de sélection (radio) : discrète si non choisie, corail si choisie. */}
                        <span
                          className={`absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full shadow-sm transition ${
                            on ? "bg-corail text-white" : "bg-white/85 text-marine/35 group-hover:text-marine/70"
                          }`}
                        >
                          <IconCheck className="h-4 w-4" />
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col p-3">
                        <span className="block font-semibold text-marine">{v.name}</span>
                        <span className="mt-0.5 block text-xs leading-snug text-ink/55">{v.tagline}</span>
                        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-medium">
                          <span className="inline-flex items-center gap-1 text-teal-deep/70">
                            <IconUsers className="h-3 w-3" /> {t("villaForm.villaCapacity", { count: v.capacity })}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenVilla(v);
                            }}
                            aria-label={t("villaForm.villaDetailsAria", { name: v.name })}
                            className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-corail transition hover:bg-corail/10"
                          >
                            {t("villaForm.villaDetails")} <IconArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
            )}

            {/* Demande particulière */}
            <Field label={t("villaForm.message")}>
              <textarea
                className="field-input min-h-[96px] resize-y"
                placeholder={t("villaForm.messagePlaceholder")}
                value={form.message}
                onChange={(e) => set({ message: e.target.value })}
              />
            </Field>

            <div className="flex justify-end pt-1">
              <button type="submit" className="btn-accent">
                {t("villaForm.submit")} <IconArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        )}
      </main>

      {/* Side panel : détails d'une villa (infos principales) */}
      {openVilla && !sent && (
        <VillaDetailDrawer
          key={openVilla.id}
          villa={openVilla}
          selected={form.villaId === openVilla.id}
          onToggle={() => {
            set({ villaId: form.villaId === openVilla.id ? "" : openVilla.id });
            setOpenVilla(null);
          }}
          onClose={() => setOpenVilla(null)}
        />
      )}
    </div>
  );
}

// Panneau latéral (droite) : photo + infos principales de la villa + choix.
function VillaDetailDrawer({
  villa,
  selected,
  onToggle,
  onClose,
}: {
  villa: Villa;
  selected: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const [shown, setShown] = useState(false);
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null); // index photo en visionneuse plein écran
  const photos = villa.photos.length ? villa.photos : villa.image ? [villa.image] : [];
  useEffect(() => {
    setShown(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={villa.name}>
      <button
        type="button"
        aria-label={t("villaForm.close")}
        onClick={onClose}
        className={`absolute inset-0 bg-marine/50 backdrop-blur-sm transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-cream shadow-float transition-transform duration-300 ${
          shown ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="relative aspect-[3/2] w-full shrink-0 overflow-hidden bg-marine/5">
          {/* Photo principale — clic = visionneuse plein écran. */}
          <button
            type="button"
            onClick={() => setZoom(active)}
            aria-label={t("villaForm.photoZoomAria")}
            className="absolute inset-0 h-full w-full cursor-zoom-in"
          >
            <img src={villaImg(photos[active] ?? villa.image, 1280)} alt={villa.name} className="h-full w-full object-cover" />
            <span className="absolute inset-0 bg-gradient-to-t from-marine/40 via-transparent to-transparent" />
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-marine/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              <IconExpand className="h-3.5 w-3.5" /> {t("villaForm.photoZoomHint")}
            </span>
          </button>
          <button
            type="button"
            aria-label={t("villaForm.close")}
            onClick={onClose}
            className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-marine shadow-card transition hover:bg-white"
          >
            <IconClose className="h-4 w-4" />
          </button>
          {/* Miniatures en overlay (même principe que le détail chambre hôtel). */}
          {photos.length > 1 && (
            <div className="absolute inset-x-0 bottom-0 z-10 p-3">
              <div className="no-scrollbar flex gap-2 overflow-x-auto px-1 py-1">
                {photos.map((url, i) => (
                  <button
                    key={`${url}-${i}`}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={t("roomDetail.photoAria", { n: i + 1 })}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded-md transition ${
                      i === active ? "ring-[3px] ring-white" : "ring-1 ring-white/40 hover:ring-white/80"
                    }`}
                  >
                    <img src={villaImg(url, 160)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <h2 className="font-display text-2xl leading-tight text-teal-deep">{villa.name}</h2>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-teal-deep/70">
            <IconUsers className="h-4 w-4 text-turquoise" /> {t("villaForm.villaCapacity", { count: villa.capacity })}
          </p>
          {villa.description && (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink/75">{villa.description}</p>
          )}
          <div className="mt-auto pt-6">
            <button type="button" onClick={onToggle} className={selected ? "btn-ghost w-full" : "btn-accent w-full"}>
              {selected ? (
                <>
                  <IconCheck className="h-4 w-4" /> {t("villaForm.villaRemove")}
                </>
              ) : (
                <>
                  {t("villaForm.villaChoose")} <IconCheck className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      {zoom !== null && (
        <PhotoLightbox
          photos={photos}
          index={zoom}
          onIndex={(i) => {
            setZoom(i);
            setActive(i);
          }}
          onClose={() => setZoom(null)}
        />
      )}
    </div>
  );
}

// Visionneuse plein écran : photo en grand + navigation ‹ › (au-dessus du panneau).
function PhotoLightbox({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: string[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const go = (dir: -1 | 1) => onIndex((index + dir + photos.length) % photos.length);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-marine/95" role="dialog" aria-modal="true" aria-label={t("villaForm.photoZoomAria")}>
      <button type="button" aria-label={t("villaForm.close")} onClick={onClose} className="absolute inset-0 h-full w-full cursor-zoom-out" />
      <img src={villaImg(photos[index], 1600)} alt="" className="relative max-h-[88vh] max-w-[92vw] rounded-lg object-contain shadow-float" />
      <button
        type="button"
        aria-label={t("villaForm.close")}
        onClick={onClose}
        className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
      >
        <IconClose className="h-5 w-5" />
      </button>
      {photos.length > 1 && (
        <>
          <button
            type="button"
            aria-label={t("villaForm.lightboxPrev")}
            onClick={() => go(-1)}
            className="absolute left-3 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 sm:left-6"
          >
            <IconChevron className="h-6 w-6 rotate-180" />
          </button>
          <button
            type="button"
            aria-label={t("villaForm.lightboxNext")}
            onClick={() => go(1)}
            className="absolute right-3 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 sm:right-6"
          >
            <IconChevron className="h-6 w-6" />
          </button>
          <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-marine/70 px-3 py-1 text-sm font-medium text-white backdrop-blur">
            {index + 1} / {photos.length}
          </span>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="h-5 w-1 rounded-full bg-corail" />
        <h2 className="font-display text-lg text-teal-deep">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="field-label">
        {label} {required && <span className="text-creole">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

function Check({
  checked,
  onChange,
  label,
  className = "",
  babyEmoji,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  className?: string;
  babyEmoji?: boolean;
}) {
  return (
    <label className={`flex cursor-pointer items-center gap-2.5 text-sm text-ink/80 ${className}`}>
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
          checked ? "border-turquoise bg-turquoise text-white" : "border-ink/25 text-transparent"
        }`}
      >
        <IconCheck className="h-3.5 w-3.5" />
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="inline-flex items-center gap-1.5">
        {babyEmoji && <span aria-hidden>👶</span>}
        {label}
      </span>
    </label>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const label = t("villaForm.people").toLowerCase();
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-ink/15 bg-white px-2 py-1.5">
      <span className="pl-1 text-turquoise" aria-hidden>
        <IconUsers className="h-4 w-4" />
      </span>
      <button
        type="button"
        aria-label={t("dates.decrease", { label })}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="grid h-7 w-7 place-items-center rounded-full border border-ink/20 text-teal-deep transition hover:border-turquoise disabled:opacity-30"
      >
        <IconMinus className="h-4 w-4" />
      </button>
      <span className="w-5 text-center font-semibold tabular-nums text-ink">{value}</span>
      <button
        type="button"
        aria-label={t("dates.increase", { label })}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="grid h-7 w-7 place-items-center rounded-full border border-ink/20 text-teal-deep transition hover:border-turquoise disabled:opacity-30"
      >
        <IconPlus className="h-4 w-4" />
      </button>
    </div>
  );
}

function SuccessCard({ onHome }: { onHome: () => void }) {
  return (
    <div className="card p-8 text-center sm:p-10">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-turquoise/10 text-turquoise">
        <IconCheck className="h-7 w-7" />
      </span>
      <h2 className="mt-5 font-display text-2xl text-teal-deep">{t("villaForm.successTitle")}</h2>
      <p className="mx-auto mt-3 max-w-md text-ink/70">{t("villaForm.successBody")}</p>
      <button type="button" onClick={onHome} className="btn-primary mt-7">
        {t("villa.back")} <IconArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
