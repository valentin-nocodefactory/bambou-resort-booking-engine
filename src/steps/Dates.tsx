import { useEffect, useRef, useState } from "react";
import { useBooking } from "../state/booking";
import { nights } from "../lib/format";
import { DateRangePicker } from "../components/DateRangePicker";
import { RatingPill, TrustRow } from "../components/conversion";
import {
  IconArrowRight,
  IconLeaf,
  IconMapPin,
  IconMinus,
  IconPlus,
  IconSun,
  IconUsers,
  IconWave,
} from "../components/icons";

// Écran de recherche STANDALONE (pas de hero) — moteur de réservation seul,
// entouré d'éléments de réassurance / conversion. Style Airbnb.
export function Dates() {
  const { checkIn, checkOut, adults, children, voucherCode, setSearch, goTo } = useBooking();
  const [form, setForm] = useState({
    checkIn: checkIn || "",
    checkOut: checkOut || "",
    adults: adults || 2,
    children: children || 0,
    voucher: voucherCode || "",
  });
  const [error, setError] = useState("");
  const [showVoucher, setShowVoucher] = useState(!!voucherCode);

  const n = nights(form.checkIn, form.checkOut);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.checkIn || !form.checkOut) return setError("Sélectionnez vos dates d'arrivée et de départ.");
    if (form.checkOut <= form.checkIn) return setError("La date de départ doit être postérieure à l'arrivée.");
    setError("");
    setSearch({
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      adults: form.adults,
      children: form.children,
      voucherCode: form.voucher.trim(),
    });
    goTo("results");
  }

  return (
    <div className="relative isolate overflow-hidden">
      {/* Atmosphère : dégradé doux tropical, pas de photo hero */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 -top-24 h-80 w-80 rounded-full bg-turquoise/15 blur-3xl" />
        <div className="absolute right-0 top-32 h-72 w-72 rounded-full bg-creole/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-turquoise-vivid/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-5xl px-5 pb-16 pt-10 sm:pt-16">
        {/* En-tête éditorial compact */}
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-teal-deep shadow-sm backdrop-blur">
            <IconMapPin className="h-3.5 w-3.5 text-turquoise" /> Réservation officielle · Martinique
          </span>
          <h1 className="mt-4 font-display text-4xl leading-[1.07] text-ink text-balance sm:text-5xl">
            Votre séjour les pieds dans l'eau, au <span className="italic text-creole">meilleur prix</span>
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <RatingPill />
            <span className="inline-flex items-center gap-1.5 text-sm text-teal-deep">
              <IconLeaf className="h-4 w-4 text-turquoise" /> Annulation gratuite · sans frais de réservation
            </span>
          </div>
        </div>

        {/* Moteur de recherche */}
        <form onSubmit={submit} className="relative z-20 mt-8 rounded-3xl border border-ink/10 bg-white/90 p-3 shadow-float backdrop-blur sm:p-4">
          <div className="grid gap-3 lg:grid-cols-[1.1fr_1.6fr_1fr_auto] lg:items-stretch">
            {/* Destination (fixe) */}
            <div className="flex items-center gap-2.5 rounded-2xl border border-ink/15 bg-white px-4 py-3">
              <IconMapPin className="h-4 w-4 shrink-0 text-turquoise" />
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-teal-deep/60">Destination</span>
                <span className="block truncate text-sm font-medium text-ink">Bambou Resort · Le Diamant</span>
              </span>
            </div>

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
              Rechercher <IconArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="text-xs text-ink/55">
              {n > 0 ? (
                <span>
                  {n} nuit{n > 1 ? "s" : ""} · {form.adults + form.children} voyageur
                  {form.adults + form.children > 1 ? "s" : ""}
                </span>
              ) : (
                <span>Choisissez vos dates pour voir les meilleurs tarifs en direct.</span>
              )}
            </div>
            {showVoucher ? (
              <input
                type="text"
                className="w-44 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm uppercase outline-none focus:border-turquoise"
                placeholder="Code promo"
                value={form.voucher}
                onChange={(e) => setForm((f) => ({ ...f, voucher: e.target.value }))}
              />
            ) : (
              <button type="button" onClick={() => setShowVoucher(true)} className="btn-link text-xs">
                + Ajouter un code promo
              </button>
            )}
          </div>

          {error && <p className="mt-2 px-1 text-sm font-medium text-red-600">{error}</p>}
        </form>

        {/* Réassurance */}
        <div className="mt-8 rounded-2xl border border-ink/5 bg-white/60 p-5 backdrop-blur">
          <TrustRow />
        </div>

        {/* Pourquoi réserver en direct */}
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          <Perk icon={<IconWave className="h-5 w-5" />} title="Tarif officiel garanti" text="Aucun intermédiaire, aucune commission : le meilleur prix, directement auprès du resort." />
          <Perk icon={<IconSun className="h-5 w-5" />} title="Confirmation immédiate" text="Disponibilités et prix en temps réel, réservation confirmée à l'instant." />
          <Perk icon={<IconLeaf className="h-5 w-5" />} title="Flexibilité totale" text="Annulation gratuite jusqu'à 3 jours avant l'arrivée sur la plupart des tarifs." />
        </div>
      </div>
    </div>
  );
}

function Perk({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-turquoise/10 text-turquoise">
        {icon}
      </span>
      <div>
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-ink/60">{text}</p>
      </div>
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
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-teal-deep/60">Voyageurs</span>
          <span className="block truncate text-sm font-medium text-ink">
            {total} voyageur{total > 1 ? "s" : ""}
          </span>
        </span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 animate-scale-in rounded-2xl border border-ink/10 bg-white p-4 shadow-float">
          <Stepper label="Adultes" sub="13 ans et +" value={adults} min={1} max={12} onChange={(v) => onChange(v, children)} />
          <div className="my-3 h-px bg-ink/10" />
          <Stepper label="Enfants" sub="0 à 12 ans" value={children} min={0} max={10} onChange={(v) => onChange(adults, v)} />
          <button type="button" onClick={() => setOpen(false)} className="btn-primary mt-4 w-full py-2 text-sm">
            OK
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
        <StepBtn label={`Moins de ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          <IconMinus className="h-4 w-4" />
        </StepBtn>
        <span className="w-5 text-center font-semibold tabular-nums text-ink">{value}</span>
        <StepBtn label={`Plus de ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
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
