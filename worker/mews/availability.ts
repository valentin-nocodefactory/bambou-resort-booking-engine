import {
  mewsJson,
  readJson,
  bad,
  json,
  occupancyForProperty,
  propertyByKey,
  PROPERTIES,
  isIsoDate,
  clampInt,
  mewsLang,
  type Env,
} from "./_lib";

interface Body {
  startUtc?: string;
  endUtc?: string;
  adults?: number;
  children?: number;
  properties?: string[]; // clés d'hébergements (hotel/creole/villas). Vide/absent = tous.
  voucherCode?: string;
  languageCode?: string; // fr-FR | en-GB — localise noms/descriptions de chambres & tarifs.
}

// hotels/getAvailability — dispo + prix EUR, interrogée PAR hébergement sélectionné
// (chacun a sa config + ses catégories d'âge, côté serveur) puis FUSIONNÉE. Le front
// n'envoie que dates + occupants + hébergements cochés.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const b = await readJson<Body>(request);
  if (!isIsoDate(b.startUtc) || !isIsoDate(b.endUtc)) return bad("missing_or_invalid_dates");
  if (b.endUtc <= b.startUtc) return bad("end_before_start");

  const adults = clampInt(b.adults, 1, 30, 2);
  const children = clampInt(b.children, 0, 20, 0);

  // Hébergements demandés (whitelist stricte). Vide/absent → tous.
  const requested =
    Array.isArray(b.properties) && b.properties.length
      ? b.properties.map(propertyByKey).filter((p): p is NonNullable<typeof p> => !!p)
      : PROPERTIES;
  // Un hébergement sans catégorie enfant ne peut pas accueillir d'enfants → écarté si children > 0.
  const selected = requested.filter((p) => children === 0 || p.childAgeCategoryId);
  const empty = { RateGroups: [], Rates: [], RoomCategoryAvailabilities: [], ViolatedRestrictions: [] };
  if (!selected.length) return json(empty);

  const voucher = typeof b.voucherCode === "string" && b.voucherCode ? b.voucherCode : undefined;
  const LanguageCode = mewsLang(b.languageCode);

  const results = await Promise.all(
    selected.map((prop) =>
      mewsJson<any>(env, "hotels/getAvailability", {
        ConfigurationId: prop.configId,
        HotelId: env.MEWS_HOTEL_ID,
        StartUtc: b.startUtc,
        EndUtc: b.endUtc,
        CurrencyCode: "EUR",
        LanguageCode,
        OccupancyData: occupancyForProperty(prop, adults, children),
        ...(voucher ? { VoucherCode: voucher } : {}),
      }),
    ),
  );

  // Fusion : concat des dispos (dédup par RoomCategoryId), dédup Rates/RateGroups par Id.
  const rca: any[] = [];
  const seenCat = new Set<string>();
  const rateById = new Map<string, any>();
  const groupById = new Map<string, any>();
  const restrictions: any[] = [];
  for (const r of results) {
    if (!r.ok || !r.data) continue;
    for (const x of r.data.RoomCategoryAvailabilities ?? []) {
      if (x?.RoomCategoryId && !seenCat.has(x.RoomCategoryId)) {
        seenCat.add(x.RoomCategoryId);
        rca.push(x);
      }
    }
    for (const x of r.data.Rates ?? []) if (x?.Id && !rateById.has(x.Id)) rateById.set(x.Id, x);
    for (const x of r.data.RateGroups ?? []) if (x?.Id && !groupById.has(x.Id)) groupById.set(x.Id, x);
    for (const x of r.data.ViolatedRestrictions ?? []) restrictions.push(x);
  }

  return json({
    RateGroups: [...groupById.values()],
    Rates: [...rateById.values()],
    RoomCategoryAvailabilities: rca,
    ViolatedRestrictions: restrictions,
  });
};
