// Devise d'AFFICHAGE (EUR par défaut). ⚠️ PUREMENT COSMÉTIQUE : la transaction Mews
// reste TOUJOURS en EUR — on ne convertit QUE l'affichage (prix « approximatifs »), et
// la step de paiement rappelle explicitement le montant réel en EUR. Mêmes conventions
// que lang.ts : ?cur= > localStorage > défaut. Module SANS React (aussi consommé par
// format.ts). Contrairement à la langue, changer de devise NE recharge PAS la page
// (aucun contenu Mews à re-localiser) → l'appelant force juste un re-render.
//
// Le taux EUR→devise vient de /api/mews/fx (BCE, rafraîchi ~quotidiennement) ; à défaut,
// un repli statique raisonnable est utilisé (l'affichage reste « approximatif »).

export type Currency = "EUR" | "USD" | "CAD";

// Symbole + position pour un rendu « C$289,70 » / « US$195,20 » / « 180,40 € ». Les deux
// dollars sont désambiguïsés (US$ / C$) ; l'EUR passe par eur() natif (Intl).
export const CURRENCIES: Record<
  Currency,
  { code: Currency; symbol: string; position: "prefix" | "suffix"; label: string }
> = {
  EUR: { code: "EUR", symbol: "€", position: "suffix", label: "EUR" },
  USD: { code: "USD", symbol: "US$", position: "prefix", label: "USD" },
  CAD: { code: "CAD", symbol: "C$", position: "prefix", label: "CAD" },
};

const LS_KEY = "bambou_currency";
const parse = (v: unknown): Currency | null => (v === "EUR" || v === "USD" || v === "CAD" ? v : null);

let current: Currency = "EUR";
let explicit = false; // l'utilisateur a-t-il choisi explicitement (URL / localStorage) ?
// Repli statique (ordre de grandeur) — écrasé par setRates() au boot via /api/mews/fx.
const rates: Record<Currency, number> = { EUR: 1, USD: 1.08, CAD: 1.48 };

// À appeler UNE fois au boot (main.tsx), AVANT le 1er rendu : ?cur= > localStorage > EUR.
// Un ?cur= explicite est mémorisé. Renvoie la devise résolue.
export function initCurrency(): Currency {
  try {
    const fromUrl = parse(new URLSearchParams(window.location.search).get("cur"));
    if (fromUrl) localStorage.setItem(LS_KEY, fromUrl);
    const chosen = fromUrl ?? parse(localStorage.getItem(LS_KEY));
    if (chosen) {
      current = chosen;
      explicit = true;
    }
  } catch {
    /* best-effort */
  }
  return current;
}

export const getCurrency = (): Currency => current;
export const isExplicitCurrency = (): boolean => explicit;

// Choix manuel (switcher) : mémorise + reflète dans l'URL (?cur=), SANS recharger la page
// (affichage only). L'appelant force le re-render React.
export function setCurrency(next: Currency): void {
  current = next;
  explicit = true;
  try {
    localStorage.setItem(LS_KEY, next);
    const url = new URL(window.location.href);
    url.searchParams.set("cur", next);
    window.history.replaceState(null, "", url.toString());
  } catch {
    /* best-effort */
  }
}

// Défaut géo (US → USD, CA → CAD, sinon EUR) — appliqué UNIQUEMENT si l'utilisateur n'a
// rien choisi explicitement, et NON mémorisé (un choix manuel ultérieur reste prioritaire ;
// un visiteur canadien re-obtient CAD par la géo au prochain passage). Renvoie true si la
// devise a changé → l'appelant force le re-render.
export function setCurrencyByCountry(country: string | null | undefined): boolean {
  if (explicit || !country) return false;
  const next: Currency = country === "US" ? "USD" : country === "CA" ? "CAD" : "EUR";
  if (next === current) return false;
  current = next;
  return true;
}

export function setRates(next: Partial<Record<Currency, number>> | null | undefined): void {
  if (!next) return;
  for (const k of ["USD", "CAD"] as const) {
    const v = next[k];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) rates[k] = v;
  }
}

export const rateOf = (c: Currency = current): number => rates[c] ?? 1;
export const convert = (eurValue: number, c: Currency = current): number => eurValue * rateOf(c);
