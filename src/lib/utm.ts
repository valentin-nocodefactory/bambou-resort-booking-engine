// Attribution marketing. Capture les paramètres utm_* (+ gclid/fbclid) présents
// dans l'URL À L'ARRIVÉE, AVANT que l'app ne réécrive l'URL (writeUrl reconstruit
// les params à zéro → ils seraient perdus). Mémorisés en sessionStorage pour être
// joints à CHAQUE call de suivi n8n durant toute la session, même après nettoyage
// de l'URL ou navigation interne.
//
// NB : ils ne sont volontairement PAS réécrits dans l'URL → un lien partagé ne
// propage pas l'attribution du partageur.

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
] as const;

const SS_KEY = "bambou_utms";

let utms: Record<string, string> = {};

// À appeler UNE fois au boot (main.tsx), avant le rendu.
export function initUtm(): void {
  try {
    const q = new URLSearchParams(window.location.search);
    const fromUrl: Record<string, string> = {};
    for (const k of UTM_KEYS) {
      const v = q.get(k);
      if (v) fromUrl[k] = v.slice(0, 200);
    }
    if (Object.keys(fromUrl).length) {
      utms = fromUrl;
      sessionStorage.setItem(SS_KEY, JSON.stringify(fromUrl));
    } else {
      const stored = sessionStorage.getItem(SS_KEY);
      utms = stored ? (JSON.parse(stored) as Record<string, string>) : {};
    }
  } catch {
    utms = {};
  }
}

// Renvoie les UTM capturés (objet vide si aucun). Null si vide → payload plus propre.
export const getUtms = (): Record<string, string> | null =>
  Object.keys(utms).length ? utms : null;
