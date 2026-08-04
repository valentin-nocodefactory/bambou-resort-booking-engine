import { useEffect, useRef, useState } from "react";
import { useBooking, DEFAULT_PROPERTIES } from "../state/booking";
import { nights } from "../lib/format";
import { t, type TKey } from "../i18n";
import { DateRangePicker } from "../components/DateRangePicker";
import { RatingPill } from "../components/conversion";
import {
  IconArrowRight,
  IconCheck,
  IconLeaf,
  IconMapPin,
  IconMinus,
  IconPalm,
  IconPlus,
  IconUsers,
  IconWave,
} from "../components/icons";

// Hébergements sélectionnables (libellé + accroche + photo, reprise de bambouresort.com).
// `desc` = clé i18n résolue AU RENDU via t() (pas au niveau module, sinon figée en fr
// avant initLang()). `label` = nom propre, non traduit.
type PropertyOption = { key: string; label: string; desc: TKey; image: string };
const PROPERTY_OPTIONS: PropertyOption[] = [
  { key: "hotel", label: "Hôtel Bambou", desc: "dates.propHotelDesc", image: "/img/properties/hotel.webp" },
  { key: "creole", label: "Culture Créole", desc: "dates.propCreoleDesc", image: "/img/properties/creole.webp" },
  { key: "villas", label: "Villas", desc: "dates.propVillasDesc", image: "/img/properties/villas.webp" },
];

// Écran de recherche STANDALONE (pas de hero) — moteur de réservation seul,
// entouré d'éléments de réassurance / conversion. Style Airbnb.
export function Dates() {
  const { checkIn, checkOut, adults, children, properties, setSearch, goTo } = useBooking();
  const [form, setForm] = useState({
    checkIn: checkIn || "",
    checkOut: checkOut || "",
    adults: adults || 2,
    children: children || 0,
    properties: properties?.length ? properties : DEFAULT_PROPERTIES,
  });
  const [error, setError] = useState("");

  const n = nights(form.checkIn, form.checkOut);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.checkIn || !form.checkOut) return setError(t("dates.errorSelectDates"));
    if (form.checkOut <= form.checkIn) return setError(t("dates.errorCheckoutAfter"));
    setError("");
    setSearch({
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      adults: form.adults,
      children: form.children,
      voucherCode: "",
      properties: form.properties,
    });
    goTo("results");
  }

  return (
    <div className="relative">
      <div className="mx-auto max-w-5xl px-5 pb-16 pt-10 sm:pt-16">
        {/* En-tête éditorial compact */}
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl leading-[1.07] text-ink text-balance sm:text-5xl">
            {t("dates.title")}
          </h1>
          <p className="mt-3 text-lg leading-snug text-ink/70 sm:text-xl">
            {t("dates.subtitle")}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <RatingPill />
            <span className="inline-flex items-center gap-1.5 text-sm text-teal-deep">
              <IconLeaf className="h-4 w-4 text-turquoise" /> {t("dates.directBooking")}
            </span>
          </div>
        </div>

        {/* Moteur de recherche */}
        <form onSubmit={submit} className="relative z-20 mt-8 rounded-3xl border border-ink/10 bg-white/90 p-3 shadow-float backdrop-blur sm:p-4">
          <div className="grid gap-3 lg:grid-cols-[1.1fr_1.6fr_1fr_auto] lg:items-stretch">
            {/* Hébergements (multi-sélection : 1, 2 ou 3) → filtre les logements */}
            <PropertiesField
              options={PROPERTY_OPTIONS}
              selected={form.properties}
              onChange={(props) => setForm((f) => ({ ...f, properties: props }))}
            />

            {/* Dates (range picker) */}
            <DateRangePicker
              checkIn={form.checkIn}
              checkOut={form.checkOut}
              onChange={(ci, co) => setForm((f) => ({ ...f, checkIn: ci, checkOut: co }))}
            />

            {/* Voyageurs */}
            <GuestsField
              adults={form.adults}
              children={form.children}
              onChange={(a, c) => setForm((f) => ({ ...f, adults: a, children: c }))}
            />

            {/* Rechercher */}
            <button type="submit" className="btn-primary h-full min-h-[3.4rem] w-full px-6 lg:w-auto">
              {t("dates.search")} <IconArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 px-1 text-xs text-ink/55">
            {n > 0 ? (
              <span>{t("dates.nightsGuests", { nights: n, guests: form.adults + form.children })}</span>
            ) : (
              <span>{t("dates.pickDatesHint")}</span>
            )}
          </div>

          {error && <p className="mt-2 px-1 text-sm font-medium text-red-600">{error}</p>}
        </form>

        {/* Nos promesses — arguments de marque repris de bambouresort.com */}
        <div className="mt-14">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-corail">
            {t("dates.artDeVivre")}
          </p>
          <div className="mx-auto mt-8 grid max-w-4xl gap-10 sm:grid-cols-3">
            <PromiseCard
              icon={<IconWave className="h-6 w-6" />}
              title={t("dates.promise1Title")}
              text={t("dates.promise1Text")}
            />
            <PromiseCard
              icon={<IconMapPin className="h-6 w-6" />}
              title={t("dates.promise2Title")}
              text={t("dates.promise2Text")}
            />
            <PromiseCard
              icon={<IconPalm className="h-6 w-6" />}
              title={t("dates.promise3Title")}
              text={t("dates.promise3Text")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Argument de marque — style « Nos promesses » du site : cercle corail fin + icône centrée.
function PromiseCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full border border-corail/40 text-corail">
        {icon}
      </span>
      <p className="mt-4 font-semibold text-marine">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-marine/60">{text}</p>
    </div>
  );
}

// Sélecteur d'hébergements (popover multi-sélection ; au moins 1 coché).
function PropertiesField({
  options,
  selected,
  onChange,
}: {
  options: PropertyOption[];
  selected: string[];
  onChange: (keys: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const count = selected.length;
  const summary =
    count >= options.length
      ? t("dates.allProperties")
      : options
          .filter((o) => selected.includes(o.key))
          .map((o) => o.label)
          .join(", ");

  function toggle(key: string) {
    const has = selected.includes(key);
    if (has && selected.length === 1) return; // garder au moins un hébergement
    onChange(has ? selected.filter((k) => k !== key) : [...selected, key]);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-2xl border border-ink/15 bg-white px-4 py-3 text-left transition hover:border-turquoise"
      >
        <IconMapPin className="h-4 w-4 shrink-0 text-turquoise" />
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-teal-deep/60">{t("dates.propertyLabel")}</span>
          <span className="block truncate text-sm font-medium text-ink">{summary}</span>
        </span>
      </button>
      {open && (
        <div className="absolute left-0 z-50 mt-2 w-80 max-w-[calc(100vw-2.5rem)] animate-scale-in rounded-2xl border border-ink/10 bg-white p-1.5 shadow-float">
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-marine/40">
            {t("dates.yourProperties")}
          </p>
          {options.map((o) => {
            const on = selected.includes(o.key);
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => toggle(o.key)}
                aria-pressed={on}
                className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition ${
                  on ? "bg-corail/10" : "hover:bg-cream"
                }`}
              >
                <span
                  className={`h-12 w-12 shrink-0 overflow-hidden rounded-xl ring-2 transition ${
                    on ? "ring-corail" : "ring-black/5"
                  }`}
                >
                  <img src={o.image} alt="" className="h-full w-full object-cover" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-marine">{o.label}</span>
                  <span className="block truncate text-xs text-marine/55">{t(o.desc)}</span>
                </span>
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                    on ? "border-corail bg-corail text-white" : "border-marine/25 text-transparent"
                  }`}
                >
                  <IconCheck className="h-3.5 w-3.5" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Sélecteur de voyageurs (popover avec compteurs).
function GuestsField({
  adults,
  children,
  onChange,
}: {
  adults: number;
  children: number;
  onChange: (adults: number, children: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const total = adults + children;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-2xl border border-ink/15 bg-white px-4 py-3 text-left transition hover:border-turquoise"
      >
        <IconUsers className="h-4 w-4 shrink-0 text-turquoise" />
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-teal-deep/60">{t("dates.guests")}</span>
          <span className="block truncate text-sm font-medium text-ink">
            {t("dates.guestsCount", { count: total })}
          </span>
        </span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 animate-scale-in rounded-2xl border border-ink/10 bg-white p-4 shadow-float">
          <Stepper label={t("dates.adults")} sub={t("dates.adultsSub")} value={adults} min={1} max={12} onChange={(v) => onChange(v, children)} />
          <div className="my-3 h-px bg-ink/10" />
          <Stepper label={t("dates.children")} sub={t("dates.childrenSub")} value={children} min={0} max={10} onChange={(v) => onChange(adults, v)} />
          <button type="button" onClick={() => setOpen(false)} className="btn-primary mt-4 w-full py-2 text-sm">
            {t("dates.guestsDone")}
          </button>
        </div>
      )}
    </div>
  );
}

function Stepper({
  label,
  sub,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  sub: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-ink">{label}</p>
        <p className="text-xs text-ink/50">{sub}</p>
      </div>
      <div className="flex items-center gap-3">
        <StepBtn label={t("dates.decrease", { label: label.toLowerCase() })} disabled={value <= min} onClick={() => onChange(value - 1)}>
          <IconMinus className="h-4 w-4" />
        </StepBtn>
        <span className="w-5 text-center font-semibold tabular-nums text-ink">{value}</span>
        <StepBtn label={t("dates.increase", { label: label.toLowerCase() })} disabled={value >= max} onClick={() => onChange(value + 1)}>
          <IconPlus className="h-4 w-4" />
        </StepBtn>
      </div>
    </div>
  );
}

function StepBtn({ children, onClick, disabled, label }: { children: React.ReactNode; onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-8 place-items-center rounded-full border border-ink/20 text-teal-deep transition hover:border-turquoise hover:text-turquoise disabled:opacity-30"
    >
      {children}
    </button>
  );
}
