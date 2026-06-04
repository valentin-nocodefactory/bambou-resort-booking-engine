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

    if (!rates.length) continue; // rien de réservable pour ces dates

    rates.sort((a, b) => (a.totalGross ?? Infinity) - (b.totalGross ?? Infinity));
    const fromGross = rates[0]?.totalGross ?? null;

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
      rates,
      fromGross,
    });
  }

  // Cartes triées « à partir de » croissant (les sans-prix en dernier).
  rooms.sort((a, b) => (a.fromGross ?? Infinity) - (b.fromGross ?? Infinity));
  return rooms;
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

// Libellé FR du mode de facturation d'un produit.
const CHARGING_LABELS: Record<string, string> = {
  Once: "une fois",
  PerPerson: "par personne",
  PerNight: "par nuit",
  PerPersonPerNight: "par personne / nuit",
  PerNightPerPerson: "par personne / nuit",
};
export const chargingLabel = (mode: string) => CHARGING_LABELS[mode] ?? "";
