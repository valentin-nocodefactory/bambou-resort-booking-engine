// Taxe de séjour — Hôtel Bambou (Les Trois-Îlets, Martinique).
//
// L'API Distributor NE détaille PAS les produits inclus (petit-déj / dîner buffet) : ils
// sont bundlés dans le tarif (TVA 2,1 %) et leurs prix ne sont pas exposés. Le SEUL montant
// exploitable est la taxe de séjour, qui remonte comme la ligne à TVA 0 %. Vérifié en live
// (reservationGroups/get + getPricing) : elle vaut exactement 1,20 €/adulte/nuit et scale
// pers × nuit. On l'affiche donc « en dur » dans le récap Hôtel Bambou, et l'hébergement
// = (tarif Mews − taxe) pour que le total reste STRICTEMENT celui de Mews.
export const TAXE_SEJOUR_PER_ADULT_NIGHT = 1.2;

export function citySejourTax(adults: number, nights: number): number {
  const a = Math.max(0, Math.floor(adults || 0));
  const n = Math.max(0, Math.floor(nights || 0));
  return +(a * n * TAXE_SEJOUR_PER_ADULT_NIGHT).toFixed(2);
}
