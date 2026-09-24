import type { ReactNode } from "react";
import { useBooking, productLineTotal } from "../state/booking";
import { money } from "../lib/format";
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
  // Réveillon (24/12 Noël, 31/12 St-Sylvestre) : ligne « inclus » SANS montant (Mews ne
  // détaille pas le supplément), affichée DÈS QUE le séjour couvre la nuit — une ligne par
  // réveillon couvert (les deux si le séjour les couvre tous les deux). Le LIBELLÉ dépend de
  // la présence d'un dîner :
  //  • « Supplément réveillon… » si un dîner est déjà là → Hôtel Bambou (demi-pension incluse)
  //    OU Culture Créole avec le « Dîner de demi-pension » ajouté au panier ;
  //  • sinon « Dîner de… » (Créole sans dîner) → devient « Souper de… » en canadien (qcMeal).
  const coversNoel = stayCoversNight(checkIn, checkOut, 12, 24);
  const coversSylvestre = stayCoversNight(checkIn, checkOut, 12, 31);
  const hasDinner =
    meals.includes("dinner") || selectedProducts.some((p) => /demi[-\s]?pension/i.test(p.name));
  const accommodation = Math.max(0, roomTotal - taxe);

  return (
    <dl className="space-y-1.5 text-sm">
      <Row label={t("breakdown.accommodation", { nights: nightsCount })} value={money(accommodation)} />
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
      {coversNoel && (
        <Row
          icon={<IconSparkles className="h-4 w-4" />}
          label={qcMeal(t(hasDinner ? "breakdown.reveillonSupplementNoel" : "breakdown.reveillonDinnerNoel"))}
          note={t("breakdown.included")}
        />
      )}
      {coversSylvestre && (
        <Row
          icon={<IconSparkles className="h-4 w-4" />}
          label={qcMeal(t(hasDinner ? "breakdown.reveillonSupplementSylvestre" : "breakdown.reveillonDinnerSylvestre"))}
          note={t("breakdown.included")}
        />
      )}
      {selectedProducts.map((p) => (
        <Row key={p.id} label={qcMeal(p.name)} value={money(productLineTotal(p, nightsCount, guestsCount))} />
      ))}
      {taxe > 0 && <Row label={t("breakdown.cityTax")} value={money(taxe)} />}
      <div className="mt-1.5 border-t border-ink/10 pt-2.5">
        <Row label={t("breakdown.total")} value={money(grandTotal)} strong />
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
