import type { ReactNode } from "react";
import { useBooking, productLineTotal } from "../state/booking";
import { eur } from "../lib/format";
import { includedMeals, stayCoversNight } from "../lib/shaping";
import { qcMeal } from "../lib/quebec";
import { IconCloche, IconCroissant, IconSparkles } from "./icons";
import { t } from "../i18n";

// Détail du prix (récap). Pour l'Hôtel Bambou (demi-pension incluse) : hébergement +
// petit-déjeuner buffet + dîner buffet (inclus). La TAXE DE SÉJOUR est lue directement
// dans le tarif Mews (ligne TVA 0 %, portée par ShapedRate.citySejour) — jamais « en dur »,
// elle s'adapte à chaque hébergement (Hôtel 1,20 € / Créole 1,70 €/adulte/nuit…). Le total
// affiché reste STRICTEMENT celui de Mews (hébergement = tarif − taxe de séjour).
export function StayBreakdown() {
  const { selectedRoom, selectedRate, checkIn, checkOut, nightsCount, guestsCount, selectedProducts, roomTotal, grandTotal } =
    useBooking();
  if (!selectedRoom || !selectedRate) return null;

  const meals = includedMeals(selectedRoom); // repas inclus dans le tarif (Hôtel: petit-déj + dîner ; Créole: petit-déj)
  const taxe = selectedRate.citySejour ?? 0;
  // Supplément réveillon inclus dans le tarif (ligne TVA 8,5 %) → itemisé, et nommé selon la
  // nuit couverte (l'API Distributor ne renvoie pas le nom du produit inclus).
  const reveillon = selectedRate.reveillonGross ?? 0;
  const reveillonKey = stayCoversNight(checkIn, checkOut, 12, 24)
    ? "breakdown.reveillonNoel"
    : stayCoversNight(checkIn, checkOut, 12, 31)
      ? "breakdown.reveillonSylvestre"
      : "breakdown.reveillon";
  const accommodation = Math.max(0, roomTotal - taxe - reveillon);

  return (
    <dl className="space-y-1.5 text-sm">
      <Row label={t("breakdown.accommodation", { nights: nightsCount })} value={eur(accommodation)} />
      {meals.includes("breakfast") && (
        <Row
          icon={<IconCroissant className="h-4 w-4" />}
          label={qcMeal(t("breakdown.breakfast", { count: nightsCount }))}
          note={t("breakdown.included")}
        />
      )}
      {meals.includes("dinner") && (
        <Row
          icon={<IconCloche className="h-4 w-4" />}
          label={qcMeal(t("breakdown.dinner", { count: nightsCount }))}
          note={t("breakdown.included")}
        />
      )}
      {reveillon > 0 && (
        <Row icon={<IconSparkles className="h-4 w-4" />} label={t(reveillonKey)} value={eur(reveillon)} />
      )}
      {selectedProducts.map((p) => (
        <Row key={p.id} label={qcMeal(p.name)} value={eur(productLineTotal(p, nightsCount, guestsCount))} />
      ))}
      {taxe > 0 && <Row label={t("breakdown.cityTax")} value={eur(taxe)} />}
      <div className="mt-1.5 border-t border-ink/10 pt-2.5">
        <Row label={t("breakdown.total")} value={eur(grandTotal)} strong />
      </div>
    </dl>
  );
}

function Row({
  label,
  value,
  note,
  strong,
  icon,
}: {
  label: string;
  value?: string;
  note?: string;
  strong?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={`flex items-center gap-1.5 ${strong ? "font-semibold text-ink" : "text-ink/70"}`}>
        {icon && <span className="shrink-0 text-teal-deep">{icon}</span>}
        <span>{label}</span>
      </dt>
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
