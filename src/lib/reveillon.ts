import { stayCoversNight } from "./shaping";

// Produits Mews « Dédoublonnage dîner réveillon » (Culture Créole) : −38 € PAR PERSONNE,
// un par nuit de réveillon (Noël 24/12, Saint-Sylvestre 31/12). Envoyés EN COULISSES à la
// création de réservation pour annuler le dîner de demi-pension des nuits de réveillon (déjà
// inclus dans la résa) → plus de double-facturation. MASQUÉS de l'UI : le client ne les voit
// jamais dans notre moteur (ils sont « proposés aux clients » côté Mews, donc visibles sur
// les autres moteurs — compromis assumé). cf. mémoire reveillon-rules.
export const REVEILLON_REMISE = {
  noel: "e5deb68e-b1c1-4a28-bf87-b4da00c5ae19", // couvre la nuit du 24/12
  sylvestre: "bbc4a089-cd50-43cb-b741-b4da00c56a63", // couvre la nuit du 31/12
} as const;

export const REVEILLON_REMISE_IDS: string[] = [REVEILLON_REMISE.noel, REVEILLON_REMISE.sylvestre];

// IDs de remise à AJOUTER à une réservation : seulement Culture Créole, seulement si le dîner
// demi-pension est pris (sinon on offrirait de l'argent sans dîner à annuler), et une remise
// par nuit de réveillon couverte. PerPerson → Mews applique −38 € × occupants de la résa.
export function reveillonRemiseIds(opts: {
  property: string | null | undefined;
  checkIn: string;
  checkOut: string;
  hasDinner: boolean;
}): string[] {
  if (opts.property !== "creole" || !opts.hasDinner) return [];
  const ids: string[] = [];
  if (stayCoversNight(opts.checkIn, opts.checkOut, 12, 24)) ids.push(REVEILLON_REMISE.noel);
  if (stayCoversNight(opts.checkIn, opts.checkOut, 12, 31)) ids.push(REVEILLON_REMISE.sylvestre);
  return ids;
}

// Le dîner de demi-pension est-il dans la sélection ? (même règle que StayBreakdown.)
export function hasDemiPensionDinner(selectedProducts: { name: string }[]): boolean {
  return selectedProducts.some((p) => /demi[-\s]?pension/i.test(p.name));
}
