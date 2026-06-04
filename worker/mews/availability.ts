import { mews, readJson, bad, occupancyData, isIsoDate, clampInt, type Env } from "./_lib";

interface Body {
  startUtc?: string;
  endUtc?: string;
  adults?: number;
  children?: number;
  // passthrough avancé (optionnel) — sinon adults/children suffisent
  occupancy?: { AgeCategoryId: string; PersonCount: number }[];
  categoryIds?: string[];
  voucherCode?: string;
}

// hotels/getAvailability — disponibilité + prix EUR. Le front n'envoie QUE
// dates + occupants ; ConfigurationId / HotelId viennent de l'env.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const b = await readJson<Body>(request);
  if (!isIsoDate(b.startUtc) || !isIsoDate(b.endUtc)) return bad("missing_or_invalid_dates");
  if (b.endUtc <= b.startUtc) return bad("end_before_start");

  // Occupation : OccupancyData passthrough whitelisté, sinon construit depuis adults/children.
  let occupancy = Array.isArray(b.occupancy)
    ? b.occupancy
        .filter((o) => o && typeof o.AgeCategoryId === "string" && Number.isFinite(o.PersonCount))
        .map((o) => ({ AgeCategoryId: o.AgeCategoryId, PersonCount: clampInt(o.PersonCount, 0, 30, 0) }))
        .filter((o) => o.PersonCount > 0)
    : occupancyData(env, clampInt(b.adults, 1, 30, 2), clampInt(b.children, 0, 20, 0));
  if (!occupancy.length) occupancy = occupancyData(env, 2, 0);

  const categoryIds = Array.isArray(b.categoryIds)
    ? b.categoryIds.filter((x) => typeof x === "string")
    : undefined;

  return mews(env, "hotels/getAvailability", {
    ConfigurationId: env.MEWS_CONFIG_ID,
    HotelId: env.MEWS_HOTEL_ID,
    StartUtc: b.startUtc,
    EndUtc: b.endUtc,
    CurrencyCode: "EUR",
    OccupancyData: occupancy,
    ...(categoryIds && categoryIds.length ? { CategoryIds: categoryIds } : {}),
    ...(typeof b.voucherCode === "string" && b.voucherCode ? { VoucherCode: b.voucherCode } : {}),
  });
};
