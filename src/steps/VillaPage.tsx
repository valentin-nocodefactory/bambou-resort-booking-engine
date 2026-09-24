import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Brand } from "../components/Brand";
import { IconArrowRight, IconCheck, IconMinus, IconPlus, IconUsers } from "../components/icons";
import { EMAIL_RE, isoDay } from "../lib/format";
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

export function VillaPage() {
  const [geoCountry, setGeoCountry] = useState<string | undefined>();
  const [villas, setVillas] = useState<Villa[]>([]);
  const [form, setForm] = useState<VillaForm>(EMPTY);
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
    // TODO(villa-lead) : brancher l'ENVOI réel (destination à définir avec le client :
    // webhook n8n / e-mail / table Supabase). Pour l'instant on journalise le payload.
    // eslint-disable-next-line no-console
    console.log("[villa-lead]", payload);
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="date"
                    className="field-input"
                    aria-label={t("villaForm.checkIn")}
                    min={isoDay(0)}
                    value={form.checkIn}
                    onChange={(e) => set({ checkIn: e.target.value })}
                  />
                  <input
                    type="date"
                    className="field-input"
                    aria-label={t("villaForm.checkOut")}
                    min={form.checkIn || isoDay(0)}
                    value={form.checkOut}
                    onChange={(e) => set({ checkOut: e.target.value })}
                  />
                </div>
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
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => set({ villaId: on ? "" : v.id })}
                      aria-pressed={on}
                      className={`overflow-hidden rounded-xl2 border text-left transition ${
                        on ? "border-corail ring-1 ring-corail" : "border-ink/12 hover:border-turquoise/60"
                      }`}
                    >
                      <span className="relative block h-24 w-full">
                        <img src={v.image} alt="" className="h-full w-full object-cover" />
                        {on && (
                          <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-corail text-white shadow-sm">
                            <IconCheck className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </span>
                      <span className="block p-3">
                        <span className="block font-semibold text-marine">{v.name}</span>
                        <span className="mt-0.5 block text-xs leading-snug text-ink/55">{v.tagline}</span>
                        <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-teal-deep/70">
                          <IconUsers className="h-3 w-3" /> {t("villaForm.villaCapacity", { count: v.capacity })}
                        </span>
                      </span>
                    </button>
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
