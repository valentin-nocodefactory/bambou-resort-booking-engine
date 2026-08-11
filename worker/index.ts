// Worker entrypoint (modèle Workers + Static Assets).
//
//  • Les requêtes /api/mews/*  → routées vers les handlers Mews (proxy serveur :
//    le Client & les IDs établissement restent ici, jamais dans le front).
//  • Tout le reste            → servi par le binding ASSETS (front buildé dans dist/),
//    avec fallback SPA (not_found_handling = "single-page-application") pour les
//    routes client comme /confirmation.
//
// Déployé via `wrangler deploy` (compatible Cloudflare Workers Builds / Git).

import type { Env } from "./mews/_lib";
import { onRequestGet as hotelGet, onRequestPost as hotelPost } from "./mews/hotel";
import { onRequestPost as availability } from "./mews/availability";
import { onRequestPost as pricing } from "./mews/pricing";
import { onRequestPost as reservation } from "./mews/reservation";
import { onRequestPost as reservationStatus } from "./mews/reservation-status";
import { onRequestPost as paymentLink } from "./mews/payment-link";
import { onRequestPost as voucher } from "./mews/voucher";
import { onRequestPost as track } from "./mews/track";
import { onRequestGet as geo } from "./mews/geo";

// Les handlers gardent la signature Pages ({ request, env, waitUntil }) — on les adapte ici.
// waitUntil permet de lancer les webhooks en tâche de fond sans bloquer la réponse.
type Ctx = { request: Request; env: Env; waitUntil: (p: Promise<unknown>) => void };
type Handler = (ctx: Ctx) => Response | Promise<Response>;
const h = (fn: unknown) => fn as Handler;

const ROUTES: Record<string, Partial<Record<string, Handler>>> = {
  hotel: { GET: h(hotelGet), POST: h(hotelPost) },
  availability: { POST: h(availability) },
  pricing: { POST: h(pricing) },
  reservation: { POST: h(reservation) },
  "reservation-status": { POST: h(reservationStatus) },
  "payment-link": { POST: h(paymentLink) },
  voucher: { POST: h(voucher) },
  track: { POST: h(track) },
  geo: { GET: h(geo) },
};

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/api\/mews\/([a-z-]+)\/?$/);
    if (match) {
      const handler = ROUTES[match[1]]?.[request.method.toUpperCase()];
      if (!handler) return json({ error: "not_found" }, 404);
      return handler({ request, env, waitUntil: (p) => ctx.waitUntil(p) });
    }
    // Front statique + fallback SPA (géré par le binding ASSETS).
    return env.ASSETS.fetch(request);
  },
};
