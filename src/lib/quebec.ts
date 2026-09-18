// Appellations québécoises des repas — override selon la géolocalisation IP (région QC).
// Règle (demande client) : au Québec, on renomme UNIQUEMENT
//   • « petit-déjeuner » / « petit-déj » (le matin) → « déjeuner » / « déj »
//   • « dîner » (le soir)                           → « souper »
// ⚠️ « déjeuner » (le midi) reste INCHANGÉ : on ne le remplace PAS par « dîner ».
// Ne touche QUE le texte français : hors Québec (ou texte anglais), c'est un no-op.
// Chaque texte réellement remplacé est journalisé UNE fois en console.

let QUEBEC = false;
export function setQuebecLocale(on: boolean) {
  QUEBEC = on;
}
export function isQuebecLocale() {
  return QUEBEC;
}

const isUpper = (s: string) => !!s && s[0] !== s[0].toLowerCase();
const cased = (base: string, upper: boolean) => (upper ? base[0].toUpperCase() + base.slice(1) : base);
const logged = new Set<string>();

export function qcMeal(text: string | null | undefined): string {
  const src = text ?? "";
  if (!QUEBEC || !src) return src;
  // Ordre : « petit-déjeuner » (complet), puis « petit-déj » (abrégé), puis « dîner ». Aucun
  // résultat ne re-matche une règle suivante (« déjeuner »/« déj » ne contiennent pas « dîner »,
  // « souper » ne contient pas « petit-déj ») → pas de double substitution. Et un « déjeuner »
  // (midi) déjà présent dans le texte n'est JAMAIS touché.
  let s = src;
  s = s.replace(/petit[-\s]?d[ée]jeuner/gi, (m) => cased("déjeuner", isUpper(m)));
  s = s.replace(/petit[-\s]?d[ée]j(?![a-zà-ÿ])/gi, (m) => cased("déj", isUpper(m)));
  s = s.replace(/\bd[îi]ner\b/gi, (m) => cased("souper", isUpper(m)));
  if (s !== src && !logged.has(src)) {
    logged.add(src);
    // eslint-disable-next-line no-console
    console.log(`[QC] « ${src} » → « ${s} »`);
  }
  return s;
}
