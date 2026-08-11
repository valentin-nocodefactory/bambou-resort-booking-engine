import { useBooking, productLineTotal } from "../state/booking";
import { eur } from "../lib/format";
import { citySejourTax } from "../lib/tax";
import { t } from "../i18n";

// Détail du prix (récap). Pour l'Hôtel Bambou (demi-pension incluse) : hébergement +
// petit-déjeuner buffet + dîner buffet (inclus) + taxe de séjour. Le tarif Mews inclut
// déjà tout ; on le DÉCOMPOSE pour l'affichage — le total affiché reste celui de Mews
// (hébergement = tarif − taxe de séjour). Ailleurs : hébergement + extras + total.
export function StayBreakdown() {
  const { selectedRoom, selectedRate, adults, nightsCount, guestsCount, selectedProducts, roomTotal, grandTotal } =
    useBooking();
  if (!selectedRoom || !selectedRate) return null;

  const isHotel = selectedRoom.property === "hotel";
  const taxe = isHotel ? citySejourTax(adults, nightsCount) : 0;
  const accommodation = Math.max(0, roomTotal - taxe);

  return (
    <dl className="space-y-1.5 text-sm">
      <Row label={t("breakdown.accommodation", { nights: nightsCount })} value={eur(accommodation)} />
      {isHotel && (
        <>
          <Row label={t("breakdown.breakfast", { count: nightsCount })} note={t("breakdown.included")} />
          <Row label={t("breakdown.dinner", { count: nightsCount })} note={t("breakdown.included")} />
        </>
      )}
      {selectedProducts.map((p) => (
        <Row key={p.id} label={p.name} value={eur(productLineTotal(p, nightsCount, guestsCount))} />
      ))}
      {taxe > 0 && <Row label={t("breakdown.cityTax")} value={eur(taxe)} />}
      <div className="mt-1.5 border-t border-ink/10 pt-2.5">
        <Row label={t("breakdown.total")} value={eur(grandTotal)} strong />
      </div>
    </dl>
  );
}

function Row({ label, value, note, strong }: { label: string; value?: string; note?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "font-semibold text-ink" : "text-ink/70"}>{label}</dt>
      <dd
        className={`shrink-0 tabular-nums ${
          strong
            ? "font-display text-lg text-teal-deep"
            : note
              ? "text-xs font-semibold uppercase tracking-wide text-turquoise"
              : "font-medium text-ink"
        }`}
      >
        {value ?? note}
      </dd>
    </div>
  );
}
