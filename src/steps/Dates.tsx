import { useState } from "react";
import { useBooking } from "../state/booking";
import { isoDay, nights } from "../lib/format";
import { ASSETS } from "../lib/assets";
import { Hero } from "../components/Hero";
import { Photo } from "../components/Photo";
import { IconArrowRight, IconCalendar, IconLeaf, IconMinus, IconPlus, IconUsers, IconWave } from "../components/icons";

export function Dates() {
  const { checkIn, checkOut, adults, children, voucherCode, setSearch, goTo } = useBooking();
  const [form, setForm] = useState({
    checkIn: checkIn || isoDay(30),
    checkOut: checkOut || isoDay(33),
    adults: adults || 2,
    children: children || 0,
    voucher: voucherCode || "",
  });
  const [error, setError] = useState("");

  const today = isoDay(0);
  const minOut = form.checkIn ? isoDay0Plus(form.checkIn, 1) : today;
  const n = nights(form.checkIn, form.checkOut);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.checkIn || !form.checkOut) return setError("Merci de choisir vos dates d'arrivée et de départ.");
    if (form.checkIn < today) return setError("La date d'arrivée ne peut pas être dans le passé.");
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
    <div>
      <Hero />

      {/* Carte de recherche flottante */}
      <div className="mx-auto -mt-12 max-w-5xl px-5 sm:-mt-16">
        <form onSubmit={submit} className="card animate-fade-in p-5 sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Arrivée" icon={<IconCalendar className="h-4 w-4" />}>
              <input
                type="date"
                className="field-input"
                min={today}
                value={form.checkIn}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    checkIn: e.target.value,
                    checkOut: f.checkOut && f.checkOut <= e.target.value ? isoDay0Plus(e.target.value, 3) : f.checkOut,
                  }))
                }
              />
            </Field>
            <Field label="Départ" icon={<IconCalendar className="h-4 w-4" />}>
              <input
                type="date"
                className="field-input"
                min={minOut}
                value={form.checkOut}
                onChange={(e) => setForm((f) => ({ ...f, checkOut: e.target.value }))}
              />
            </Field>
            <Counter
              label="Adultes"
              icon={<IconUsers className="h-4 w-4" />}
              value={form.adults}
              min={1}
              max={12}
              onChange={(v) => setForm((f) => ({ ...f, adults: v }))}
            />
            <Counter
              label="Enfants"
              icon={<IconUsers className="h-4 w-4" />}
              value={form.children}
              min={0}
              max={10}
              onChange={(v) => setForm((f) => ({ ...f, children: v }))}
            />
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="sm:max-w-xs">
              <label className="field-label">Code promo (optionnel)</label>
              <input
                type="text"
                className="field-input uppercase"
                placeholder="Ex. BAMBOU2026"
                value={form.voucher}
                onChange={(e) => setForm((f) => ({ ...f, voucher: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-4">
              {n > 0 && (
                <p className="hidden text-sm text-ink/55 sm:block">
                  {n} nuit{n > 1 ? "s" : ""} · {form.adults + form.children} voyageur
                  {form.adults + form.children > 1 ? "s" : ""}
                </p>
              )}
              <button type="submit" className="btn-primary w-full sm:w-auto">
                Rechercher les disponibilités <IconArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
        </form>
      </div>

      {/* Bande éditoriale */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="accent text-lg">L'art de vivre caribéen</span>
            <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">
              Un refuge tropical, pensé dans le moindre détail
            </h2>
            <p className="mt-4 leading-relaxed text-ink/70">
              Bungalows les pieds dans l'eau, lagon turquoise et cuisine créole&nbsp;: chaque séjour au Bambou
              Resort est une parenthèse hors du temps. Réservez en direct, au meilleur tarif.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Feature icon={<IconWave className="h-5 w-5" />} title="Les pieds dans l'eau" text="Accès direct au lagon" />
              <Feature icon={<IconLeaf className="h-5 w-5" />} title="Nature préservée" text="Jardins & palmeraie" />
              <Feature icon={<IconUsers className="h-5 w-5" />} title="Service sur-mesure" text="Conciergerie créole" />
            </div>
          </div>
          <div className="overflow-hidden rounded-xl2 shadow-card">
            <Photo
              src={ASSETS.pool}
              alt="Piscine à débordement turquoise du Bambou Resort"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function isoDay0Plus(date: string, days: number): string {
  const t = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(t)) return date;
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label inline-flex items-center gap-1.5">
        <span className="text-turquoise">{icon}</span>
        {label}
      </label>
      {children}
    </div>
  );
}

function Counter({
  label,
  icon,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="field-label inline-flex items-center gap-1.5">
        <span className="text-turquoise">{icon}</span>
        {label}
      </label>
      <div className="flex items-center justify-between rounded-xl border border-ink/15 bg-white px-2 py-1.5 shadow-sm">
        <CounterBtn label={`Moins de ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          <IconMinus className="h-4 w-4" />
        </CounterBtn>
        <span className="min-w-8 text-center font-semibold text-ink">{value}</span>
        <CounterBtn label={`Plus de ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          <IconPlus className="h-4 w-4" />
        </CounterBtn>
      </div>
    </div>
  );
}

function CounterBtn({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-8 place-items-center rounded-lg text-teal-deep transition hover:bg-turquoise/10 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-turquoise/10 text-turquoise">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-xs text-ink/55">{text}</p>
      </div>
    </div>
  );
}
