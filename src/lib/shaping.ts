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
import { t, type TKey } from "../i18n";

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

// Supplément « réveillon » inclus dans le tarif = ligne(s) TVA 8,5 % du breakdown Mews
// (repas/gala de fin d'année, TVA « normale » Martinique). Vérifié : Créole normal → 8,5 %
// vaut 0 €, réveillon St-Sylvestre → 300 €. L'API Distributor ne nomme PAS le produit → on
// détecte le supplément par ce taux, et on le nomme via les dates côté récap. null si absent.
function reveillonSupplementGross(amount: unknown): number | null {
  const items = (
    amount as { EUR?: { Breakdown?: { Items?: { TaxRateCode?: string; NetValue?: number; TaxValue?: number }[] } } } | null
  )?.EUR?.Breakdown?.Items;
  if (!Array.isArray(items)) return null;
  const gross = items
    .filter((i) => typeof i?.TaxRateCode === "string" && /-8\.5%$/.test(i.TaxRateCode))
    .reduce((s, i) => s + (i.NetValue ?? 0) + (i.TaxValue ?? 0), 0);
  return gross > 0 ? +gross.toFixed(2) : null;
}

// Tarifs NON réservables depuis ce booking engine (ex. « Tarif Partenaires Actif
// (CSE,COS,Asso.) », réservé à un canal dédié) → exclus des résultats.
const EXCLUDED_RATE = /\bcse\b|partenaire|\bcos\b/i;
export const isBookingExcludedRate = (name: string): boolean => EXCLUDED_RATE.test(name);

// Bungalow Harmonie : chambres réservées aux voyageurs de 12 ans et + (déjà indiqué dans le
// nom Mews « 12 ans et + »). Règle EN DUR par nom → masquée dès qu'il y a un mineur dans la
// recherche (enfant 4-12 ou bébé <4), l'app ne connaissant que des tranches, pas l'âge exact.
const AGE_12_PLUS_ONLY = /harmonie/i;
export const isAgeRestrictedRoom = (name: string): boolean => AGE_12_PLUS_ONLY.test(name);

// Repas déjà INCLUS dans le tarif, par hébergement (→ tags « inclus » sur la carte et le
// détail chambre) :
//  • Hôtel Bambou   : demi-pension → petit-déjeuner + dîner
//  • Culture Créole : petit-déjeuner
//  • Villas         : rien d'inclus
export function includedMeals(room: { property?: string | null }): ("breakfast" | "dinner")[] {
  if (room.property === "hotel") return ["breakfast", "dinner"];
  if (room.property === "creole") return ["breakfast"];
  return [];
}

export function buildRooms(
  avail: AvailabilityResponse,
  hotel: HotelConfig | null,
  occupancy: { children?: number; infants?: number } = {},
): ShapedRoom[] {
  const rateById = new Map(avail.Rates.map((r) => [r.Id, r]));
  const groupById = new Map<string, RateGroup>(avail.RateGroups.map((g) => [g.Id, g]));
  const categoryById = new Map((hotel?.RoomCategories ?? []).map((c) => [c.Id, c]));

  const rooms: ShapedRoom[] = [];

  for (const rca of avail.RoomCategoryAvailabilities) {
    // Meilleur prix par tarif (min sur toutes les occupations renvoyées).
    const byRate = new Map<
      string,
      { total: number | null; perNight: number | null; max: number | null; citySejour: number | null; reveillon: number | null }
    >();

    for (const occ of rca.RoomOccupancyAvailabilities ?? []) {
      for (const p of occ.Pricing ?? []) {
        const total = grossOf(p.Price?.TotalAmount);
        if (total == null) continue; // ⚠️ ignorer les GrossValue null
        const perNight = grossOf(p.Price?.AverageAmountPerNight);
        const max = grossOf(p.MaxPrice?.TotalAmount);
        const citySejour = taxeSejourGross(p.Price?.TotalAmount);
        const reveillon = reveillonSupplementGross(p.Price?.TotalAmount);
        const prev = byRate.get(p.RateId);
        if (!prev || (prev.total != null && total < prev.total)) {
          byRate.set(p.RateId, { total, perNight, max, citySejour, reveillon });
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
        reveillonGross: price.reveillon,
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
    const name = loc(cat.Name, "Hébergement");
    // Bungalow Harmonie : réservé aux 12 ans et + → masqué dès qu'un mineur est dans la
    // recherche (enfant 4-12 ou bébé <4). Règle EN DUR, par nom (cf. isAgeRestrictedRoom).
    if (isAgeRestrictedRoom(name) && ((occupancy.children ?? 0) > 0 || (occupancy.infants ?? 0) > 0)) continue;
    rooms.push({
      categoryId: rca.RoomCategoryId,
      name,
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
    .filter(
      (r) =>
        r.categoryId !== current.categoryId &&
        // Surclassement DANS le même groupe (Hôtel Bambou / Culture Créole / Villas) — pas de croisement.
        r.property === current.property &&
        r.fromGross != null &&
        r.fromGross > currentTotal + 0.5,
    )
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

// Tags « bénéfice client » d'une chambre — RÈGLE EN DUR, basée sur le NOM de la chambre
// UNIQUEMENT (on n'en invente pas d'autres). Un bungalow = UN tag distinctif :
//   • nom contient « Panorama »               → Vue exceptionnelle (picto étincelles)
//   • nom contient « Infini »                 → Vue mer         (picto vagues)
//   • nom contient « Évasion »                → Vue jardin      (picto feuille)
//   • nom contient « Sérénité »               → Sans vis-à-vis  (picto feuille)
//   • nom contient « Harmonie »               → 1er étage       (picto escalier)
//   • nom contient « Découverte »/« Accessibilité » → Plain-pied (picto maison)
// Renvoie des clés → l'UI mappe libellé (i18n) + picto SVG.
export function roomBenefits(room: { name: string }): string[] {
  const name = room.name;
  const out: string[] = [];
  if (/panorama/i.test(name)) out.push("exceptional");
  if (/infini/i.test(name)) out.push("sea");
  if (/[ée]vasion/i.test(name)) out.push("garden");
  if (/s[ée]r[ée]nit[ée]/i.test(name)) out.push("quiet");
  if (/harmonie/i.test(name)) out.push("floor");
  if (/d[ée]couverte|accessibilit[ée]/i.test(name)) out.push("ground");
  return out;
}

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
// labelKey = clé i18n (résolue via t() À CHAQUE rendu, cf. productCategory) → libellés
// localisés FR/EN (les visiteurs EN voyaient auparavant des titres de section en français).
const PRODUCT_CATEGORIES: { key: string; labelKey: TKey; test: RegExp }[] = [
  {
    key: "food",
    labelKey: "prodCat.food",
    test: /breakfast|petit.?d[ée]j|d[ée]jeuner|d[îi]ner|dinner|repas|food|beverage|boisson|burger|beer|bi[èe]re|brunch|pension|menu|caf[ée]|wine|vin|champagne|snack|fr[üu]hst[üu]ck/i,
  },
  {
    key: "wellness",
    labelKey: "prodCat.wellness",
    test: /spa|massage|soin|wellness|sauna|hammam|jacuzzi|beaut[ée]|fitness|yoga|d[ée]tente/i,
  },
  {
    key: "activities",
    labelKey: "prodCat.activities",
    test: /tour|excursion|ticket|billet|disney|visite|activit|plong[ée]e|catamaran|snorkel|kayak|jet.?ski|randonn[ée]e|ski|golf|cours|exp[ée]rience/i,
  },
  {
    key: "transfer",
    labelKey: "prodCat.transfer",
    test: /transfer|transfert|navette|shuttle|taxi|a[ée]roport|airport|voiture|parking/i,
  },
  {
    key: "services",
    labelKey: "prodCat.services",
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
const MEAL_KEEP = /flottant|floating|plage|beach/i; // expériences premium : jamais masquées
const IS_BREAKFAST = /petit.?d[ée]j|breakfast|fr[üu]hst[üu]ck/i;
const IS_DINNER = /d[îi]ner|dinner/i;

// Un extra repas est-il REDONDANT car déjà inclus dans le tarif de l'hébergement (cf.
// includedMeals) → à masquer des extras ? Hôtel : petit-déj + dîner ; Culture Créole :
// petit-déj ; Villas : rien. Le déjeuner (midi) n'est jamais inclus → conservé. Exceptions
// premium (petit-déj flottant, dîner sur la plage) : toujours gardées.
export function isIncludedMealExtra(p: ShapedProduct, property: string | null | undefined): boolean {
  const hay = `${p.name} ${p.description}`;
  if (MEAL_KEEP.test(hay)) return false;
  const meals = includedMeals({ property });
  return (meals.includes("breakfast") && IS_BREAKFAST.test(hay)) || (meals.includes("dinner") && IS_DINNER.test(hay));
}

// ── Nuits de réveillon (Noël 24/12, Saint-Sylvestre 31/12) ──────────────────
// La nuit du (mois/jour) est-elle passée sur place ? Vrai si cette date fait partie des
// nuits du séjour [checkIn, checkOut) — c.-à-d. qu'on est présent CE soir-là. Sert au récap
// pour indiquer « dîner de réveillon inclus » (le supplément est inclus dans le tarif Mews).
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

export function productCategory(p: ShapedProduct): { key: string; label: string; order: number } {
  const hay = `${p.name} ${p.description}`;
  for (let i = 0; i < PRODUCT_CATEGORIES.length; i++) {
    if (PRODUCT_CATEGORIES[i].test.test(hay)) return { key: PRODUCT_CATEGORIES[i].key, label: t(PRODUCT_CATEGORIES[i].labelKey), order: i };
  }
  return { key: "other", label: t("prodCat.other"), order: 99 };
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

// ── Organisation des extras par hébergement (Restauration / Confort / Services) ──────────────
// ⭐ CONFIG À RÉORDONNER FACILEMENT : l'ordre d'affichage = l'ordre des sections PUIS des motifs
// ci-dessous → pour réordonner, il suffit de déplacer les lignes. Chaque motif (regex) repère un
// produit par son NOM Mews (le commentaire = produit visé). Un produit absent du catalogue est
// simplement ignoré ; un produit non prévu ici retombe sur le classement auto (en fin de liste).
const EXTRAS_LAYOUT: Record<string, { label: TKey; items: RegExp[] }[]> = {
  hotel: [
    { label: "prodCat.food", items: [
      /pension compl/i,            // Déjeuner de pension complète
      /flottant/i,                 // Supplément Petit déjeuner flottant en mer
      /plage/i,                    // Supplément Dîner sur la plage
    ] },
    { label: "prodCat.comfort", items: [
      /douce escale|romantique/i,  // Douce escale – Accueil romantique
      /champagne/i,                // Champagne Collet
      /anniversaire/i,             // Joyeux Séjour – Anniversaire (Enfant & Adulte)
    ] },
    { label: "prodCat.services", items: [
      /facilit/i,                  // Crédit boisson – Facilité (60 €)
      /libert/i,                   // Crédit boisson – Liberté (100 €)
    ] },
  ],
  creole: [
    { label: "prodCat.food", items: [
      /demi.?pension/i,            // Dîner de demi-pension
      /pension compl/i,            // Déjeuner de pension complète
      /flottant/i,                 // Supplément Petit déjeuner flottant en mer
      /plage/i,                    // Dîner sur la plage
    ] },
    { label: "prodCat.comfort", items: [
      /douce escale|romantique/i,  // Douce escale – Accueil romantique
      /champagne/i,                // Champagne Jacquart
      /anniversaire/i,             // Joyeux séjour – Anniversaire
    ] },
    { label: "prodCat.services", items: [
      /facilit/i,                  // Crédit boisson – Facilité (60 €)
      /libert/i,                   // Crédit boisson – Liberté (100 €)
    ] },
  ],
};

// Regroupe + ORDONNE les extras selon EXTRAS_LAYOUT de l'hébergement. Chaque motif prend TOUS les
// produits (encore libres) qui matchent, dans l'ordre du catalogue. Hébergement non listé (Villas)
// ou produits imprévus → repli sur le classement auto par mots-clés (groupProducts), en fin.
export function layoutProducts(
  products: ShapedProduct[],
  property: string | null | undefined,
): { key: string; label: string; items: ShapedProduct[] }[] {
  const layout = property ? EXTRAS_LAYOUT[property] : undefined;
  if (!layout) return groupProducts(products);
  const used = new Set<string>();
  const out: { key: string; label: string; items: ShapedProduct[] }[] = [];
  layout.forEach((sec, i) => {
    const items: ShapedProduct[] = [];
    for (const re of sec.items)
      for (const p of products) if (!used.has(p.id) && re.test(p.name)) { items.push(p); used.add(p.id); }
    if (items.length) out.push({ key: `${sec.label}-${i}`, label: t(sec.label), items });
  });
  const rest = products.filter((p) => !used.has(p.id));
  return rest.length ? [...out, ...groupProducts(rest)] : out;
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
