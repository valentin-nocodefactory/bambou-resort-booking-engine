import { mews, readJson, bad, type Env } from "./_lib";

interface Body {
  voucherCode?: string;
}

// vouchers/validate — valide un code promo. Le front re-déclenche ensuite
// getAvailability avec VoucherCode pour débloquer les tarifs IsPrivate.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const b = await readJson<Body>(request);
  if (typeof b.voucherCode !== "string" || !b.voucherCode.trim()) return bad("missing_voucher_code");
  return mews(env, "vouchers/validate", { HotelId: env.MEWS_HOTEL_ID, VoucherCode: b.voucherCode.trim() });
};
