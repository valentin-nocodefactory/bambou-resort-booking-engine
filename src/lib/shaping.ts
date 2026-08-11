// Shaping des réponses Mews en objets prêts pour l'UI.
// Règles clés (vérifiées sur la demo) :
//  • Groupement par RoomCategoryId.
//  • Prix « à partir de » = min des GrossValue NON-NULL (certains combos → null).
//  • Tarifs triés prix croissant ; le moins cher = « Meilleur prix ».
//  • MaxPrice = prix barré (avant remise) éventuel.

import type {
  AvailabilityResponse,
  HotelConfig,
  Product,
  RateGroup,
  ShapedProduct,
  ShapedRate,
  ShapedRoom,
} from "../types/mews";
import { loc } from "./format";
import { getLang } from "./lang";
import { t } from "../i18n";

const grossOf = (a: { EUR?: { GrossValue: number | null } } | undefined | null): number | null => {
  const g = a?.EUR?.GrossValue;
  return typeof g === "number" ? g : null;
};

// Taxe de séjour incluse dans le tarif = ligne(s) à TVA 0 % du breakdown Mews (vérifié :
// Hôtel 1,20 € / Créole 1,70 € par adulte/nuit). TVA 0 % → gross = net. Renvoyée telle
// quelle par Mews (jamais « en dur ») pour l'occupation recherchée. null si absente.
function taxeSejourGross(amount: unknown): number | null {
  const items = (
    amount as { EUR?: { Breakdown?: { Items?: { TaxRateCode?: string; NetValue?: number; TaxValue?: number }[] } } } | null
  )?.EUR?.Breakdown?.Items;
  if (!Array.isArray(items)) return null;
  const gross = items
    .filter((i) => typeof i?.TaxRateCode === "string" && /-0%$/.test(i.TaxRateCode))
    .reduce((s, i) => s + (i.NetValue ?? 0) + (i.TaxValue ?? 0), 0);
  return gross > 0 ? +gross.toFixed(2) : null;
}

// Tarifs NON réservables depuis ce booking engine (ex. « Tarif Partenaires Actif
// (CSE,COS,Asso.) », réservé à un canal dédié) → exclus des résultats.
const EXCLUDED_RATE = /\bcse\b|partenaire|\bcos\b/i;
export const isBookingExcludedRate = (name: string): boolean => EXCLUDED_RATE.test(name);

export function buildRooms(avail: AvailabilityResponse, hotel: HotelConfig | null, lang = "fr-FR"): ShapedRoom[] {
  const rateById = new Map(avail.Rates.map((r) => [r.Id, r]));
  const groupById = new Map<string, RateGroup>(avail.RateGroups.map((g) => [g.Id, g]));
  const categoryById = new Map((hotel?.RoomCategories ?? []).map((c) => [c.Id, c]));

  const rooms: ShapedRoom[] = [];

  for (const rca of avail.RoomCategoryAvailabilities) {
    // Meilleur prix par tarif (min sur toutes les occupations renvoyées).
    const byRate = new Map<
      string,
      { total: number | null; perNight: number | null; max: number | null; citySejour: number | null }
    >();

    for (const occ of rca.RoomOccupancyAvailabilities ?? []) {
      for (const p of occ.Pricing ?? []) {
        const total = grossOf(p.Price?.TotalAmount);
        if (total == null) continue; // ⚠️ ignorer les GrossValue null
        const perNight = grossOf(p.Price?.AverageAmountPerNight);
        const max = grossOf(p.MaxPrice?.TotalAmount);
        const citySejour = taxeSejourGross(p.Price?.TotalAmount);
        const prev = byRate.get(p.RateId);
        if (!prev || (prev.total != null && total < prev.total)) {
          byRate.set(p.RateId, { total, perNight, max, citySejour });
        }
      }
    }

    const rates: ShapedRate[] = [];
    for (const [rateId, price] of byRate) {
      const rate = rateById.get(rateId);
      const name = loc(rate?.Name, "Tarif");
      if (isBookingExcludedRate(name)) continue; // tarif CSE/partenaires : non réservable ici
      const group = rate ? groupById.get(rate.RateGroupId) : undefined;
      rates.push({
        rateId,
        rateGroupId: rate?.RateGroupId ?? "",
        name,
        description: loc(rate?.Description ?? null, ""),
        isPrivate: rate?.IsPrivate ?? false,
        totalGross: price.total,
        perNightGross: price.perNight,
        // n'afficher le prix barré que s'il est strictement supérieur au prix réel
        maxGross: price.max != null && price.total != null && price.max > price.total ? price.max : null,
        citySejour: price.citySejour,
        settlement: {
          type: group?.SettlementType ?? "Automatic",
          action: group?.SettlementAction ?? "ChargeCreditCard",
          isAutomatic: (group?.SettlementType ?? "Automatic") === "Automatic",
        },
      });
    }

    // On ne propose QUE des tarifs payables EN LIGNE : règlement `Automatic`
    // (→ Mews renvoie un PaymentRequestId → redirection carte). Les tarifs en
    // règlement `Manual` (« paiement à l'arrivée ») sont exclus : pas de résa sans paiement.
    const payableRates = rates.filter((r) => r.settlement.isAutomatic);
    if (!payableRates.length) continue; // aucun tarif payable en ligne → chambre non proposée

    payableRates.sort((a, b) => (a.totalGross ?? Infinity) - (b.totalGross ?? Infinity));
    const fromGross = payableRates[0]?.totalGross ?? null;

    const cat = categoryById.get(rca.RoomCategoryId);
    // Catégorie renvoyée par getAvailability mais ABSENTE du catalogue configuration/get
    // (catégorie masquée / edge Mews) → aucune donnée présentable (nom, photo,
    // hébergement) → on l'ignore plutôt que d'afficher une carte « Hébergement » vide.
    if (!cat) continue;
    rooms.push({
      categoryId: rca.RoomCategoryId,
      name: loc(cat.Name, "Hébergement"),
      description: loc(cat.Description ?? null, ""),
      imageIds: cat?.ImageIds ?? [],
      normalBedCount: cat?.NormalBedCount ?? 0,
      extraBedCount: cat?.ExtraBedCount ?? 0,
      spaceType: cat?.SpaceType ?? "Room",
      availableRoomCount: rca.AvailableRoomCount,
      capacity: (cat?.NormalBedCount ?? 0) + (cat?.ExtraBedCount ?? 0),
      rates: payableRates,
      fromGross,
      property: cat?.Property ?? null,
    });
  }

  // Cartes triées « à partir de » croissant (les sans-prix en dernier).
  rooms.sort((a, b) => (a.fromGross ?? Infinity) - (b.fromGross ?? Infinity));
  return rooms;
}

// Chambres proposées en surclassement : plus chères que le total courant, triées,
// limitées aux 4 meilleures. (Différentiel = room.fromGross - currentTotal.)
export function upgradeRooms(rooms: ShapedRoom[], current: ShapedRoom | null, currentTotal: number): ShapedRoom[] {
  if (!current) return [];
  return rooms
    .filter((r) => r.categoryId !== current.categoryId && r.fromGross != null && r.fromGross > currentTotal + 0.5)
    .sort((a, b) => (a.fromGross ?? 0) - (b.fromGross ?? 0))
    .slice(0, 4);
}

// Bénéfices d'un surclassement vs la chambre courante (chips localisées).
export function upgradeBenefits(from: ShapedRoom, to: ShapedRoom): string[] {
  const out: string[] = [];
  const SPACE_RANK: Record<string, number> = { Bed: 0, Room: 1, Suite: 2, Apartment: 3, Villa: 4 };
  if ((SPACE_RANK[to.spaceType] ?? 1) > (SPACE_RANK[from.spaceType] ?? 1))
    out.push(t("upgradeBenefit.space", { label: spaceLabel(to.spaceType) }));
  const capDelta = to.capacity - from.capacity;
  if (capDelta > 0) out.push(t("upgradeBenefit.capacity", { count: to.capacity, delta: capDelta }));
  const bedDelta = to.normalBedCount + to.extraBedCount - (from.normalBedCount + from.extraBedCount);
  if (bedDelta > 0) out.push(t("upgradeBenefit.beds", { count: bedDelta }));
  if (!out.length) out.push(t("upgradeBenefit.comfort"));
  return out.slice(0, 3);
}

// Libellés localisés (FR/EN) des types d'espace Mews.
const SPACE_LABELS: Record<string, { fr: string; en: string }> = {
  Room: { fr: "Chambre", en: "Room" },
  Apartment: { fr: "Appartement", en: "Apartment" },
  Villa: { fr: "Villa", en: "Villa" },
  Bed: { fr: "Lit", en: "Bed" },
  Dorm: { fr: "Dortoir", en: "Dorm" },
  Suite: { fr: "Suite", en: "Suite" },
};
export const spaceLabel = (s: string) => SPACE_LABELS[s]?.[getLang()] ?? s;

// Produits → upsells. On retient les extras optionnels avec un prix EUR.
export function shapeProducts(hotel: HotelConfig | null, lang = "fr-FR"): ShapedProduct[] {
  if (!hotel?.Products) return [];
  return hotel.Products.filter((p: Product) => !p.AlwaysIncluded && typeof p.Prices?.EUR === "number" && p.Prices.EUR > 0)
    .map((p) => ({
      id: p.Id,
      name: loc(p.Name, "Extra").trim(),
      description: loc(p.Description ?? null, ""),
      priceEur: p.Prices.EUR,
      chargingMode: p.ChargingMode ?? "",
      imageId: p.ImageId,
      property: p.Property ?? null,
    }))
    // dédup par (hébergement + nom) : un même extra existe dans plusieurs configs avec
    // des Id distincts → on garde une entrée PAR hébergement (sinon on mélange les configs).
    .filter(
      (p, i, arr) =>
        arr.findIndex((q) => q.property === p.property && q.name.toLowerCase() === p.name.toLowerCase()) === i,
    )
    .sort((a, b) => a.priceEur - b.priceEur);
}

// Catégorisation heuristique des extras par mots-clés (Mews n'expose pas les noms
// de catégories de produits). Robuste pour la demo comme pour la prod.
const PRODUCT_CATEGORIES: { key: string; label: string; test: RegExp }[] = [
  {
    key: "food",
    label: "Restauration",
    test: /breakfast|petit.?d[ée]j|d[ée]jeuner|d[îi]ner|dinner|repas|food|beverage|boisson|burger|beer|bi[èe]re|brunch|pension|menu|caf[ée]|wine|vin|champagne|snack|fr[üu]hst[üu]ck/i,
  },
  {
    key: "wellness",
    label: "Bien-être & Spa",
    test: /spa|massage|soin|wellness|sauna|hammam|jacuzzi|beaut[ée]|fitness|yoga|d[ée]tente/i,
  },
  {
    key: "activities",
    label: "Activités & Excursions",
    test: /tour|excursion|ticket|billet|disney|visite|activit|plong[ée]e|catamaran|snorkel|kayak|jet.?ski|randonn[ée]e|ski|golf|cours|exp[ée]rience/i,
  },
  {
    key: "transfer",
    label: "Transferts & Mobilité",
    test: /transfer|transfert|navette|shuttle|taxi|a[ée]roport|airport|voiture|parking/i,
  },
  {
    key: "services",
    label: "Services & Confort",
    test: /housekeeping|m[ée]nage|nettoyage|cleaning|pet|animal|linge|lin(?:n)?en|laundry|blanchisserie|membership|conciergerie|lit b[ée]b[ée]|baby|crib|check|wifi|bed/i,
  },
];

// Forfait boisson « 1er prix » d'un hébergement : le plus petit crédit boisson dispo
// (pré-sélectionné pour les visiteurs US/Canada). null si l'hébergement n'en propose pas.
export function cheapestDrinkProduct(products: ShapedProduct[], property: string | null): ShapedProduct | null {
  return (
    products
      .filter(
        (p) =>
          (!p.property || p.property === property) &&
          /boisson|drink|beverage|forfait|cr[ée]dit/i.test(`${p.name} ${p.description}`),
      )
      .sort((a, b) => a.priceEur - b.priceEur)[0] ?? null
  );
}

// Repas déjà « inclus » à l'Hôtel Bambou : la demi-pension y comprend le petit-déjeuner
// ET le dîner → ces extras STANDARD sont redondants et MASQUÉS quand la chambre choisie
// appartient à l'Hôtel Bambou. Exceptions GARDÉES (expériences premium, pas un simple
// repas) : petit-déjeuner FLOTTANT en mer et dîner SUR LA PLAGE. Le déjeuner / pension
// complète (midi) N'est PAS inclus → conservé. Culture Créole & Villas (demi-pension NON
// incluse) montrent tous les extras.
const MEAL_KEEP = /flottant|floating|plage|beach/i; // expériences premium : gardées même à l'Hôtel
const BREAKFAST_OR_DINNER = /petit.?d[ée]j|breakfast|fr[üu]hst[üu]ck|d[îi]ner|dinner/i;

export function isHotelIncludedMeal(p: ShapedProduct): boolean {
  const hay = `${p.name} ${p.description}`;
  if (MEAL_KEEP.test(hay)) return false;
  return BREAKFAST_OR_DINNER.test(hay);
}

// ── Réveillons obligatoires selon les dates ─────────────────────────────────
// Le réveillon de Noël (soir du 24/12) et de la Saint-Sylvestre (soir du 31/12) ne sont
// proposés que si le séjour couvre la nuit concernée — et alors ils sont AUTO-inclus &
// non décochables. Hors de ces dates : masqués et retirés. Rattachés à un hébergement.
const REVEILLON_NOEL = /r[ée]veillon.*no[eë]l/i;
const REVEILLON_SYLVESTRE = /r[ée]veillon.*sylvestre/i;
export const isReveillonProduct = (p: ShapedProduct): boolean =>
  REVEILLON_NOEL.test(p.name) || REVEILLON_SYLVESTRE.test(p.name);

// La nuit du (mois/jour) est-elle passée sur place ? Vrai si cette date fait partie des
// nuits du séjour [checkIn, checkOut) — c.-à-d. qu'on est présent CE soir-là.
export function stayCoversNight(checkIn: string, checkOut: string, month: number, day: number): boolean {
  if (!/^\d{4}-\d{2}-\d{2}/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}/.test(checkOut)) return false;
  const end = new Date(`${checkOut}T00:00:00`);
  const d = new Date(`${checkIn}T00:00:00`);
  for (let i = 0; i < 400 && d < end; i++) {
    if (d.getMonth() + 1 === month && d.getDate() === day) return true;
    d.setDate(d.getDate() + 1);
  }
  return false;
}

// Produit réveillon OBLIGATOIRE pour ce séjour + hébergement, ou null si les dates ne
// couvrent pas la soirée (24/12 pour Noël, 31/12 pour la Saint-Sylvestre).
export function mandatoryReveillon(
  products: ShapedProduct[],
  property: string | null,
  kind: "noel" | "sylvestre",
  checkIn: string,
  checkOut: string,
): ShapedProduct | null {
  if (!stayCoversNight(checkIn, checkOut, 12, kind === "noel" ? 24 : 31)) return null;
  const re = kind === "noel" ? REVEILLON_NOEL : REVEILLON_SYLVESTRE;
  return products.find((p) => (!p.property || p.property === property) && re.test(p.name)) ?? null;
}

export function productCategory(p: ShapedProduct): { key: string; label: string; order: number } {
  const hay = `${p.name} ${p.description}`;
  for (let i = 0; i < PRODUCT_CATEGORIES.length; i++) {
    if (PRODUCT_CATEGORIES[i].test.test(hay)) return { key: PRODUCT_CATEGORIES[i].key, label: PRODUCT_CATEGORIES[i].label, order: i };
  }
  return { key: "other", label: "Autres extras", order: 99 };
}

export function groupProducts(products: ShapedProduct[]): { key: string; label: string; items: ShapedProduct[] }[] {
  const map = new Map<string, { key: string; label: string; order: number; items: ShapedProduct[] }>();
  for (const p of products) {
    const c = productCategory(p);
    const g = map.get(c.key) ?? { ...c, items: [] };
    g.items.push(p);
    map.set(c.key, g);
  }
  return [...map.values()].sort((a, b) => a.order - b.order).map(({ key, label, items }) => ({ key, label, items }));
}

// Libellé localisé (FR/EN) du mode de facturation d'un produit.
const CHARGING_LABELS: Record<string, { fr: string; en: string }> = {
  Once: { fr: "une fois", en: "one-time" },
  PerPerson: { fr: "par personne", en: "per person" },
  PerNight: { fr: "par nuit", en: "per night" },
  PerTimeUnit: { fr: "par nuit", en: "per night" },
  PerPersonPerNight: { fr: "par personne / nuit", en: "per person / night" },
  PerNightPerPerson: { fr: "par personne / nuit", en: "per person / night" },
  PerPersonPerTimeUnit: { fr: "par personne / nuit", en: "per person / night" },
};
export const chargingLabel = (mode: string) => CHARGING_LABELS[mode]?.[getLang()] ?? "";
