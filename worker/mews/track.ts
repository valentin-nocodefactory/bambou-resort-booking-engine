import { readJson, bad, json, postWebhook, type Env } from "./_lib";

// Events du funnel acceptés (cf. front src/state/booking.tsx).
const VALID_EVENTS = new Set(["etape", "paiement_initie", "paiement_valide"]);

const str = (v: unknown, max = 200): string | null => (typeof v === "string" && v ? v.slice(0, max) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Attribution marketing : whitelist stricte des clés connues (jamais de forward brut).
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];
const utmObject = (v: unknown): Record<string, string> | null => {
  if (!v || typeof v !== "object") return null;
  const src = v as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const val = str(src[k], 200);
    if (val) out[k] = val;
  }
  return Object.keys(out).length ? out : null;
};

// /api/mews/track — SUIVI FUNNEL. Le front pousse l'état du panier à CHAQUE étape.
// On reconstruit un payload whitelisté (jamais de forward brut, aucun secret) et on
// le relaie vers n8n → Supabase (WEBHOOK_EVENTS), en tâche de fond. No-op si non défini.
export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const b = await readJson<Record<string, any>>(request);
  if (!str(b.cartId, 80)) return bad("missing_cart_id");
  if (typeof b.status !== "string" || !VALID_EVENTS.has(b.status)) return bad("invalid_status");

  const s = b.stay && typeof b.stay === "object" ? b.stay : {};
  const payload = {
    event: `cart.${b.status}`, // cart.etape | cart.paiement_initie | cart.paiement_valide
    status: b.status,
    timestamp: new Date().toISOString(),
    cartId: str(b.cartId, 80),
    step: str(b.step, 40),
    stay: {
      checkIn: str(s.checkIn, 10),
      checkOut: str(s.checkOut, 10),
      nights: num(s.nights),
      adults: num(s.adults),
      children: num(s.children),
    },
    room:
      b.room && typeof b.room === "object"
        ? { categoryId: str(b.room.categoryId, 60), name: str(b.room.name, 200) }
        : null,
    rate:
      b.rate && typeof b.rate === "object"
        ? { rateId: str(b.rate.rateId, 60), name: str(b.rate.name, 200), totalGross: num(b.rate.totalGross) }
        : null,
    products: Array.isArray(b.products)
      ? b.products.slice(0, 30).map((p: any) => ({ id: str(p?.id, 60), name: str(p?.name, 200), priceEur: num(p?.priceEur) }))
      : [],
    totals:
      b.totals && typeof b.totals === "object"
        ? { room: num(b.totals.room), products: num(b.totals.products), grand: num(b.totals.grand), currency: "EUR" }
        : null,
    customer:
      b.customer && typeof b.customer === "object"
        ? {
            firstName: str(b.customer.firstName, 100),
            lastName: str(b.customer.lastName, 100),
            email: str(b.customer.email, 200),
            telephone: str(b.customer.telephone, 40),
            nationalityCode: str(b.customer.nationalityCode, 2),
          }
        : null,
    // Clé de corrélation avec Mews : permet à n8n de VALIDER le paiement
    // (POST /api/mews/reservation-status { reservationGroupId }).
    reservationGroupId: str(b.reservationGroupId, 60),
    paymentRequestId: str(b.paymentRequestId, 60),
    // Langue de la session (fr|en).
    lang: str(b.lang, 5),
    // Attribution marketing (utm_*, gclid, fbclid) capturée à l'arrivée. Whitelist stricte.
    utm: utmObject(b.utm),
  };

  // Flux analytics unique → n8n → Supabase (tous les events du funnel).
  waitUntil(postWebhook(env.WEBHOOK_EVENTS, payload));
  return json({ ok: true });
};
