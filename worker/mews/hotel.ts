import { mews, type Env } from "./_lib";

// hotels/get — config établissement (RoomCategories, Products, ImageBaseUrl,
// PaymentGateway, devises…). Aucun input front : HotelId injecté côté serveur.
// Caché 5 min (public) — la config bouge rarement.
const handler: PagesFunction<Env> = ({ env }) =>
  mews(env, "hotels/get", { HotelId: env.MEWS_HOTEL_ID }, { cacheControl: "public, max-age=300" });

export const onRequestGet = handler;
export const onRequestPost = handler;
