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

const grossOf = (a: { EUR?: { GrossValue: number | null } } | undefined | null): number | null => {
  const g = a?.EUR?.GrossValue;
  return typeof g === "number" ? g : null;
};

export function buildRooms(avail: AvailabilityResponse, hotel: HotelConfig | null, lang = "fr-FR"): ShapedRoom[] {
  const rateById = new Map(avail.Rates.map((r) => [r.Id, r]));
  const groupById = new Map<string, RateGroup>(avail.RateGroups.map((g) => [g.Id, g]));
  const categoryById = new Map((hotel?.RoomCategories ?? []).map((c) => [c.Id, c]));

  const rooms: ShapedRoom[] = [];

  for (const rca of avail.RoomCategoryAvailabilities) {
    // Meilleur prix par tarif (min sur toutes les occupations renvoyées).
    const byRate = new Map<string, { total: number | null; perNight: number | null; max: number | null }>();

    for (const occ of rca.RoomOccupancyAvailabilities ?? []) {
      for (const p of occ.Pricing ?? []) {
        const total = grossOf(p.Price?.TotalAmount);
        if (total == null) continue; // ⚠️ ignorer les GrossValue null
        const perNight = grossOf(p.Price?.AverageAmountPerNight);
        const max = grossOf(p.MaxPrice?.TotalAmount);
        const prev = byRate.get(p.RateId);
        if (!prev || (prev.total != null && total < prev.total)) {
          byRate.set(p.RateId, { total, perNight, max });
        }
      }
    }

    const rates: ShapedRate[] = [];
    for (const [rateId, price] of byRate) {
      const rate = rateById.get(rateId);
      const group = rate ? groupById.get(rate.RateGroupId) : undefined;
      rates.push({
        rateId,
        rateGroupId: rate?.RateGroupId ?? "",
        name: loc(rate?.Name, "Tarif"),
        description: loc(rate?.Description ?? null, ""),
        isPrivate: rate?.IsPrivate ?? false,
        totalGross: price.total,
        perNightGross: price.perNight,
        // n'afficher le prix barré que s'il est strictement supérieur au prix réel
        maxGross: price.max != null && price.total != null && price.max > price.total ? price.max : null,
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
    rooms.push({
      categoryId: rca.RoomCategoryId,
      name: loc(cat?.Name, "Hébergement"),
      description: loc(cat?.Description ?? null, ""),
      imageIds: cat?.ImageIds ?? [],
      normalBedCount: cat?.NormalBedCount ?? 0,
      extraBedCount: cat?.ExtraBedCount ?? 0,
      spaceType: cat?.SpaceType ?? "Room",
      availableRoomCount: rca.AvailableRoomCount,
      capacity: (cat?.NormalBedCount ?? 0) + (cat?.ExtraBedCount ?? 0),
      rates: payableRates,
      fromGross,
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

// Bénéfices d'un surclassement vs la chambre courante (chips FR).
export function upgradeBenefits(from: ShapedRoom, to: ShapedRoom): string[] {
  const out: string[] = [];
  const SPACE_RANK: Record<string, number> = { Bed: 0, Room: 1, Suite: 2, Apartment: 3, Villa: 4 };
  if ((SPACE_RANK[to.spaceType] ?? 1) > (SPACE_RANK[from.spaceType] ?? 1)) out.push(`Surclassement en ${spaceLabel(to.spaceType)}`);
  const capDelta = to.capacity - from.capacity;
  if (capDelta > 0) out.push(`Jusqu'à ${to.capacity} personnes (+${capDelta})`);
  const bedDelta = to.normalBedCount + to.extraBedCount - (from.normalBedCount + from.extraBedCount);
  if (bedDelta > 0) out.push(`+${bedDelta} couchage${bedDelta > 1 ? "s" : ""}`);
  if (!out.length) out.push("Plus d'espace et de confort");
  return out.slice(0, 3);
}

// Traduit FR des libellés de type d'espace Mews.
const SPACE_LABELS: Record<string, string> = {
  Room: "Chambre",
  Apartment: "Appartement",
  Villa: "Villa",
  Bed: "Lit",
  Dorm: "Dortoir",
  Suite: "Suite",
};
export const spaceLabel = (s: string) => SPACE_LABELS[s] ?? s;

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
    }))
    // dédup par nom (la demo contient des doublons proches)
    .filter((p, i, arr) => arr.findIndex((q) => q.name.toLowerCase() === p.name.toLowerCase()) === i)
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

// Libellé FR du mode de facturation d'un produit.
const CHARGING_LABELS: Record<string, string> = {
  Once: "une fois",
  PerPerson: "par personne",
  PerNight: "par nuit",
  PerTimeUnit: "par nuit",
  PerPersonPerNight: "par personne / nuit",
  PerNightPerPerson: "par personne / nuit",
  PerPersonPerTimeUnit: "par personne / nuit",
};
export const chargingLabel = (mode: string) => CHARGING_LABELS[mode] ?? "";
