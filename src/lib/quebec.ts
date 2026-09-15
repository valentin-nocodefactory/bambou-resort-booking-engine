// Appellations québécoises des repas — override selon la géolocalisation IP (région QC).
// Au Québec, les noms de repas sont DÉCALÉS par rapport au français de France :
//   • petit-déjeuner → « déjeuner »   (le matin)
//   • déjeuner (midi) → « dîner »
//   • dîner (soir)    → « souper »
// On substitue via des marqueurs internes pour éviter la double-substitution en cascade
// (sinon « petit-déjeuner » → « déjeuner » serait re-transformé en « dîner »).
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

// Marqueurs privés (zone Unicode à usage privé, U+E000..) — uniques, jamais dans un texte.
const MB = String.fromCharCode(0xe000); // petit-déjeuner
const MB_ABBR = String.fromCharCode(0xe001); // petit-déj (abrégé)
const ML = String.fromCharCode(0xe002); // déjeuner (midi)
const MD = String.fromCharCode(0xe003); // dîner (soir)
const logged = new Set<string>();

export function qcMeal(text: string | null | undefined): string {
  const src = text ?? "";
  if (!QUEBEC || !src) return src;
  let s = src;
  // 1) Poser les marqueurs (ordre : « petit-déjeuner » AVANT « déjeuner » ; puis l'abrégé
  //    « petit-déj », puis « déjeuner » seul (midi), puis « dîner » (soir)).
  s = s.replace(/petit[-\s]?d[ée]jeuner/gi, (m) => MB + (isUpper(m) ? "U" : "l"));
  s = s.replace(/petit[-\s]?d[ée]j(?![a-zà-ÿ])/gi, (m) => MB_ABBR + (isUpper(m) ? "U" : "l"));
  s = s.replace(/\bd[ée]jeuner\b/gi, (m) => ML + (isUpper(m) ? "U" : "l"));
  s = s.replace(/\bd[îi]ner\b/gi, (m) => MD + (isUpper(m) ? "U" : "l"));
  // 2) Résoudre les marqueurs vers les appellations québécoises.
  s = s.replace(new RegExp(MB + "([Ul])", "g"), (_m, c) => cased("déjeuner", c === "U"));
  s = s.replace(new RegExp(MB_ABBR + "([Ul])", "g"), (_m, c) => cased("déj", c === "U"));
  s = s.replace(new RegExp(ML + "([Ul])", "g"), (_m, c) => cased("dîner", c === "U"));
  s = s.replace(new RegExp(MD + "([Ul])", "g"), (_m, c) => cased("souper", c === "U"));
  if (s !== src && !logged.has(src)) {
    logged.add(src);
    // eslint-disable-next-line no-console
    console.log(`[QC] « ${src} » → « ${s} »`);
  }
  return s;
}
