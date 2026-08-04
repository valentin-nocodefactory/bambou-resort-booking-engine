// Langue de l'interface & du contenu Mews. Source de vérité : le param `?lang=`
// (fr|en), sinon localStorage, sinon `fr` par défaut. La langue est FIXE pour un
// chargement de page — le switcher (footer) met à jour `?lang=` puis RECHARGE, ce
// qui re-localise proprement tout : chaînes UI (t()), formats Intl et surtout le
// contenu Mews (chambres, tarifs, CGV) + la page de paiement hébergée par Mews.
//
// Ce module est volontairement SANS React : il est aussi consommé par la couche
// réseau (api.ts) et le formatage (format.ts).

export type Lang = "fr" | "en";

// Correspondance vers les LanguageCode Mews. `en-GB` colle à l'ordre de repli de
// loc()/locStr (contenu Mews anglais authoré en en-GB pour cet établissement).
export const MEWS_LANG: Record<Lang, string> = { fr: "fr-FR", en: "en-GB" };
export const LOCALE: Record<Lang, string> = { fr: "fr-FR", en: "en-GB" };

const LS_KEY = "bambou_lang";

const parse = (v: string | null | undefined): Lang | null =>
  v === "fr" || v === "en" ? v : null;

let active: Lang = "fr";

// À appeler UNE fois au boot (main.tsx), avant tout rendu ou appel réseau.
// Priorité : ?lang= > localStorage > défaut fr. Un ?lang= explicite est mémorisé.
export function initLang(): Lang {
  try {
    const fromUrl = parse(new URLSearchParams(window.location.search).get("lang"));
    if (fromUrl) localStorage.setItem(LS_KEY, fromUrl);
    active = fromUrl ?? parse(localStorage.getItem(LS_KEY)) ?? "fr";
    document.documentElement.lang = active;
  } catch {
    active = "fr";
  }
  return active;
}

export const getLang = (): Lang => active;
export const isEn = (): boolean => active === "en";

// LanguageCode Mews de la langue courante (pour la couche réseau).
export const mewsLang = (): string => MEWS_LANG[active];

// Switcher : mémorise, force ?lang= dans l'URL et recharge la page.
export function setLangAndReload(next: Lang): void {
  if (next === active) return;
  try {
    localStorage.setItem(LS_KEY, next);
  } catch {
    /* best-effort */
  }
  const url = new URL(window.location.href);
  url.searchParams.set("lang", next);
  window.location.assign(url.toString());
}
