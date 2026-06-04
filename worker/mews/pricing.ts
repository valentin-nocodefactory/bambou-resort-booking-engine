import { mewsJson, readJson, bad, json, occupancyData, isIsoDate, clampInt, eurAmount, type Env } from "./_lib";

interface Body {
  startUtc?: string;
  endUtc?: string;
  roomCategoryId?: string;
  adults?: number;
  children?: number;
  productIds?: string[];
  voucherCode?: string;
}

// reservations/getPricing — devis exact pour un type précis selon l'occupation.
// La réponse Mews brute contient ~80 devises (≈ 380 Ko) → on CURE en EUR-only.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const b = await readJson<Body>(request);
  if (!isIsoDate(b.startUtc) || !isIsoDate(b.endUtc)) return bad("missing_or_invalid_dates");
  if (typeof b.roomCategoryId !== "string" || !b.roomCategoryId) return bad("missing_room_category");

  const occupancy = occupancyData(env, clampInt(b.adults, 1, 30, 2), clampInt(b.children, 0, 20, 0));
  const productIds = Array.isArray(b.productIds) ? b.productIds.filter((x) => typeof x === "string") : undefined;

  const res = await mewsJson<{ OccupancyPrices?: unknown[] }>(env, "reservations/getPricing", {
    HotelId: env.MEWS_HOTEL_ID,
    StartUtc: b.startUtc,
    EndUtc: b.endUtc,
    RoomCategoryId: b.roomCategoryId,
    Occupancies: [{ OccupancyData: occupancy }],
    ...(productIds && productIds.length ? { ProductIds: productIds } : {}),
    ...(typeof b.voucherCode === "string" && b.voucherCode ? { VoucherCode: b.voucherCode } : {}),
  });

  if (!res.ok || !res.data) return json({ error: "pricing_failed", status: res.status }, 502);

  const occupancyPrices = (res.data.OccupancyPrices ?? []).map((op: any) => ({
    occupancy: op.OccupancyData ?? null,
    pricing: (op.Pricing ?? []).map((p: any) => ({
      rateId: p.RateId,
      total: eurAmount(p.Price?.TotalAmount),
      perNight: eurAmount(p.Price?.AverageAmountPerNight),
      max: p.MaxPrice ? eurAmount(p.MaxPrice.TotalAmount) : null,
    })),
  }));
  return json({ occupancyPrices });
};
