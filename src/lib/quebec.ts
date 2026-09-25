// Appellations canadiennes (québécoises) des repas — override selon la géolocalisation IP.
// Règle (demande client), appliquée UNIQUEMENT au texte français, pour une IP canadienne :
//   • « petit-déjeuner » / « petit-déj » (matin) → « déjeuner » / « déj »
//   • « déjeuner »                        (midi)  → « dîner »
//   • « dîner »                           (soir)  → « souper »
// ⚠️ Substitution EN UN SEUL PASSAGE : le cycle FR→CA (déjeuner→dîner, dîner→souper) exige
// que chaque terme soit remplacé une seule fois, sans que le résultat soit re-balayé (sinon
// « petit-déjeuner » → « déjeuner » → « dîner » → « souper »…). D'où une SEULE regex à
// alternatives, « petit-déjeuner » AVANT « déjeuner » (match le plus long d'abord).
// Purement front (affichage) : ne touche NI les prix, NI les IDs, NI la logique Mews.
// Hors IP canadienne (ou texte anglais) → no-op. Chaque texte remplacé est journalisé 1 fois.

let QUEBEC = false;
export function setQuebecLocale(on: boolean) {
  QUEBEC = on;
}
export function isQuebecLocale() {
  return QUEBEC;
}

const isUpper = (s: string) => !!s && s[0] !== s[0].toLowerCase();
const logged = new Set<string>();

// « petit-déjeuner(s) » | « petit-déj » | « déjeuner(s) » | « dîner(s) » (accents & casse tolérés).
const MEAL_RE = /petit[-\s]?d[ée]jeuners?|petit[-\s]?d[ée]j(?![a-zà-ÿ])|d[ée]jeuners?|d[îi]ners?/gi;

function target(match: string): string {
  const low = match.toLowerCase();
  const plural = low.endsWith("s") ? "s" : "";
  let base: string;
  if (low.startsWith("petit")) {
    base = low.includes("jeuner") ? "déjeuner" : "déj"; // matin → déjeuner / déj
  } else if (low.includes("jeuner")) {
    base = "dîner"; // midi (FR déjeuner) → dîner
  } else {
    base = "souper"; // soir (FR dîner) → souper
  }
  const out = base === "déj" ? "déj" : base + plural; // « déj » abrégé : pas de pluriel
  return isUpper(match) ? out[0].toUpperCase() + out.slice(1) : out;
}

export function qcMeal(text: string | null | undefined): string {
  const src = text ?? "";
  if (!QUEBEC || !src) return src;
  const s = src.replace(MEAL_RE, target);
  if (s !== src && !logged.has(src)) {
    logged.add(src);
    // eslint-disable-next-line no-console
    console.log(`[QC] « ${src} » → « ${s} »`);
  }
  return s;
}
