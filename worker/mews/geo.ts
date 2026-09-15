import { json, type Env } from "./_lib";

// Détection best-effort du pays du visiteur via son IP — fournie GRATUITEMENT par
// Cloudflare (`request.cf.country`, code ISO-3166-1 alpha-2). Aucune API externe, aucune
// clé, aucune donnée stockée. Sert côté front à : (1) pré-sélectionner l'indicatif
// téléphonique, (2) proposer des presets (navette + forfait boisson) aux visiteurs US/CA.
//
// En dev local (`wrangler dev`), `request.cf` est souvent absent → `country: null`. Un
// override `?cc=XX` est accepté UNIQUEMENT depuis localhost (test), jamais en prod.
export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  const url = new URL(request.url);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const cf = (request as unknown as { cf?: { country?: string; regionCode?: string } }).cf;
  const raw = ((isLocal && url.searchParams.get("cc")) || cf?.country || "").toString().toUpperCase();
  // Écarte les codes non exploitables : XX (inconnu), T1 (Tor), AP (Anonymous Proxy).
  const country = /^[A-Z]{2}$/.test(raw) && !["XX", "T1", "AP", "A1", "A2"].includes(raw) ? raw : null;
  // Région (subdivision ISO-3166-2, ex. « QC » pour le Québec) → appellations locales.
  // Override localhost `?region=QC` pour tester ; sinon `request.cf.regionCode` (Cloudflare).
  const rawRegion = ((isLocal && url.searchParams.get("region")) || cf?.regionCode || "").toString().toUpperCase();
  const region = /^[A-Z0-9]{1,3}$/.test(rawRegion) ? rawRegion : null;
  return json({ country, region }, 200, "no-store");
};
