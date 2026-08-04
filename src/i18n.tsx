// i18n de l'interface. La langue est FIXE par chargement de page (voir lib/lang.ts),
// donc `t()` est une simple fonction pure de la clé + langue courante — pas besoin de
// Context/hook ni de re-render. Le switcher (footer) change ?lang= puis recharge.
//
// Valeurs : soit une chaîne, soit une fonction (params) => string pour l'interpolation
// et les pluriels. Le dictionnaire est typé → `t("clé.inconnue")` échoue au build.

import { getLang } from "./lib/lang";

type Entry = string | ((p: Record<string, unknown>) => string);

// Pluriel simple : `n` + singulier/pluriel.
const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

const DICT = {
  // ── Header / global ──────────────────────────────────────────────────────
  "header.bestPrice": { fr: "Meilleur prix garanti en direct", en: "Best price guaranteed, direct" },
  "header.home": { fr: "Accueil Bambou Resort", en: "Bambou Resort home" },
  "hotelError.msg": { fr: "Impossible de charger la configuration de l'hôtel.", en: "Couldn't load the hotel configuration." },
  "common.retry": { fr: "Réessayer", en: "Try again" },

  // ── Footer ───────────────────────────────────────────────────────────────
  "footer.tagline": {
    fr: "Art de vivre caribéen, les pieds dans l'eau. Réservation en direct, au meilleur tarif.",
    en: "Caribbean living, steps from the water. Book direct, at the best rate.",
  },
  "footer.securePayment": { fr: "Paiement sécurisé", en: "Secure payment" },
  "footer.developedBy": { fr: "Développé par NocodeFactory.", en: "Built by NocodeFactory." },
  "footer.language": { fr: "Langue", en: "Language" },

  // ── Barre contact (appeler / partager / mail réception) ───────────────────
  "contact.open": { fr: "Aide & contact", en: "Help & contact" },
  "contact.title": { fr: "Besoin d'aide ?", en: "Need a hand?" },
  "contact.subtitle": {
    fr: "Notre réception vous répond directement.",
    en: "Our front desk answers you directly.",
  },
  "contact.call": { fr: "Appeler la réception", en: "Call the front desk" },
  "contact.email": { fr: "Écrire un e-mail", en: "Send an email" },
  "contact.share": { fr: "Partager ma sélection", en: "Share my selection" },
  "contact.copied": { fr: "Lien copié ✓", en: "Link copied ✓" },
  "contact.shareTitle": { fr: "Ma sélection — Bambou Resort", en: "My selection — Bambou Resort" },
  "contact.shareText": {
    fr: "Voici ma sélection de séjour au Bambou Resort :",
    en: "Here's my stay selection at Bambou Resort:",
  },
  "contact.close": { fr: "Fermer", en: "Close" },

  // ── Résultats : teaser des hébergements non cochés ────────────────────────
  "results.alsoAvailable": {
    fr: "Aussi disponibles sur vos dates",
    en: "Also available for your dates",
  },
  "results.addProperty": {
    fr: (p) => `Voir ${p.count} ${p.label}`,
    en: (p) => `See ${p.count} ${p.label}`,
  },
} satisfies Record<string, { fr: Entry; en: Entry }>;

export type TKey = keyof typeof DICT;

export function t(key: TKey, params?: Record<string, unknown>): string {
  const entry = DICT[key];
  const val = (entry[getLang()] ?? entry.fr) as Entry;
  return typeof val === "function" ? val(params ?? {}) : val;
}

// Helper pluriel exposé pour les libellés dynamiques inline (nuits, tarifs…).
export { plural };
