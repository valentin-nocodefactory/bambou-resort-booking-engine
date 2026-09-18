import { json, type Env } from "./_lib";

// Taux de change EUR→USD/CAD pour l'AFFICHAGE approximatif (switcher de devise côté front).
// ⚠️ La transaction Mews reste TOUJOURS en EUR — ces taux ne servent QUE l'affichage.
// Source : Frankfurter (données BCE, sans clé), mise en cache ~12 h au bord Cloudflare.
// Repli statique si l'API est indisponible → l'UI dégrade proprement (prix « approximatifs »).
const FALLBACK = { EUR: 1, USD: 1.08, CAD: 1.48 };

export const onRequestGet: PagesFunction<Env> = async () => {
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD,CAD", {
      // Cache au bord Cloudflare (12 h) : un seul appel amont par ~demi-journée, tous visiteurs.
      cf: { cacheTtl: 43200, cacheEverything: true },
    } as RequestInit);
    if (r.ok) {
      const d = (await r.json()) as { rates?: { USD?: number; CAD?: number } };
      const USD = d.rates?.USD;
      const CAD = d.rates?.CAD;
      if (typeof USD === "number" && USD > 0 && typeof CAD === "number" && CAD > 0) {
        return json({ EUR: 1, USD, CAD }, 200, "public, max-age=43200");
      }
    }
  } catch {
    /* repli statique ci-dessous */
  }
  return json(FALLBACK, 200, "public, max-age=3600");
};
