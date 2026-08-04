// Helper partagé du Worker.
// Toute requête Mews passe par ici : le `Client` et les IDs établissement sont injectés
// côté serveur (jamais exposés au front), avec un timeout dur.

export interface Env {
  // Binding Static Assets : sert le front buildé (dist/) + fallback SPA.
  ASSETS: Fetcher;
  MEWS_BASE_URL: string;
  MEWS_APP_BASE_URL: string;
  MEWS_CLIENT: string;
  MEWS_HOTEL_ID: string;
  MEWS_CONFIG_ID: string;
  MEWS_ADULT_AGE_CATEGORY_ID?: string;
  MEWS_CHILD_AGE_CATEGORY_ID?: string;
  // ★ UNIQUE endpoint de suivi → n8n → Supabase : reçoit TOUS les events du funnel
  // (chaque étape + paiement initié/validé). C'est LE endpoint du back-office.
  WEBHOOK_EVENTS?: string;
}

// POST best-effort d'un JSON vers une URL de webhook. No-op si l'URL est absente/invalide.
// N'échoue JAMAIS l'appel principal (à envelopper dans ctx.waitUntil côté handler).
export async function postWebhook(url: string | undefined, payload: unknown): Promise<void> {
  if (!url || !/^https?:\/\//.test(url)) return;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 8_000);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
  } catch {
    // best-effort : on ne casse jamais la réservation à cause du webhook
  } finally {
    clearTimeout(to);
  }
}

// Catégories d'âge de l'entreprise Bambou Resort (vérifiées en live) — fallback si les
// vars ne sont pas définies. Surchargeables via MEWS_ADULT/CHILD_AGE_CATEGORY_ID.
const AGE_FALLBACK = {
  adult: "3b9bdb28-d9e1-4fac-904f-b2cf00febb8f",
  child: "5cd331e0-0069-4f46-a20f-b2cf00febb8f",
};

// ── Hébergements (Booking Engine configs) — setup Bambou Resort ────────────────
// Non secret (comme MEWS_CONFIG_ID, déjà public). Chaque hébergement = 1 config Mews
// + SES catégories d'âge (adulte/enfant). IDs vérifiés en live via configuration/get.
export interface Property {
  key: string; // "hotel" | "creole" | "villas"
  label: string;
  configId: string;
  adultAgeCategoryId: string;
  childAgeCategoryId: string | null; // null = pas d'enfants (ex. Culture Créole)
}
export const PROPERTIES: Property[] = [
  { key: "hotel", label: "Hôtel Bambou", configId: "43ec5bf8-09e2-4ae8-83d2-b39900e86b9b", adultAgeCategoryId: "3b9bdb28-d9e1-4fac-904f-b2cf00febb8f", childAgeCategoryId: "5cd331e0-0069-4f46-a20f-b2cf00febb8f" },
  { key: "creole", label: "Culture Créole", configId: "14625406-8090-43ca-b671-b39900ec4c4a", adultAgeCategoryId: "5e456326-2b0f-49ff-9a2f-b2cf00febb8e", childAgeCategoryId: null },
  { key: "villas", label: "Villas", configId: "ff229529-717c-4b37-9c0f-b2cf00febe21", adultAgeCategoryId: "663eebb6-9663-4916-96d2-b2cf00febb8f", childAgeCategoryId: "2232f4de-28c3-445b-9aaa-b2cf00febb8f" },
];
export const propertyByKey = (key: unknown): Property | undefined =>
  typeof key === "string" ? PROPERTIES.find((p) => p.key === key) : undefined;
export const propertyByConfig = (configId: string): Property | undefined => PROPERTIES.find((p) => p.configId === configId);

// OccupancyData Mews pour UN hébergement (utilise SES catégories d'âge).
export function occupancyForProperty(prop: Property, adults: number, children = 0) {
  const out: { AgeCategoryId: string; PersonCount: number }[] = [];
  if (adults > 0) out.push({ AgeCategoryId: prop.adultAgeCategoryId, PersonCount: adults });
  if (children > 0 && prop.childAgeCategoryId) out.push({ AgeCategoryId: prop.childAgeCategoryId, PersonCount: children });
  return out;
}

const TIMEOUT_MS = 12_000;

/** POST Mews → renvoie une Response JSON (passthrough). Le front shape la réponse brute. */
export async function mews(
  env: Env,
  path: string,
  body: Record<string, unknown>,
  opts: { cacheControl?: string } = {},
): Promise<Response> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${env.MEWS_BASE_URL}/api/distributor/v1/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Client: env.MEWS_CLIENT, ...body }),
      signal: ctrl.signal,
    });
    const text = await r.text();
    return new Response(text, {
      status: r.ok ? 200 : r.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": opts.cacheControl ?? "no-store",
      },
    });
  } catch (e) {
    const reason = e instanceof Error && e.name === "AbortError" ? "mews_timeout" : "mews_unreachable";
    return json({ error: reason }, 502);
  } finally {
    clearTimeout(to);
  }
}

/** Variante qui renvoie l'objet parsé — pour les Functions qui doivent CURER la réponse. */
export async function mewsJson<T = unknown>(
  env: Env,
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${env.MEWS_BASE_URL}/api/distributor/v1/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Client: env.MEWS_CLIENT, ...body }),
      signal: ctrl.signal,
    });
    const text = await r.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    return { ok: r.ok, status: r.status, data: data as T };
  } catch {
    return { ok: false, status: 502, data: null };
  } finally {
    clearTimeout(to);
  }
}

export const json = (data: unknown, status = 200, cacheControl = "no-store"): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": cacheControl },
  });

export const bad = (error: string, status = 400): Response => json({ error }, status);

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

/** Construit l'OccupancyData Mews à partir de simples compteurs (côté serveur). */
export function occupancyData(env: Env, adults: number, children = 0) {
  const adultId = env.MEWS_ADULT_AGE_CATEGORY_ID || AGE_FALLBACK.adult;
  const childId = env.MEWS_CHILD_AGE_CATEGORY_ID || AGE_FALLBACK.child;
  const out: { AgeCategoryId: string; PersonCount: number }[] = [];
  if (adults > 0) out.push({ AgeCategoryId: adultId, PersonCount: adults });
  if (children > 0) out.push({ AgeCategoryId: childId, PersonCount: children });
  return out;
}

// ── Garde-fous d'entrée ────────────────────────────────────────────────────
export const isIsoDate = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(s);

// Normalise une entrée de langue (clé `fr|en` OU code `fr-FR|en-GB|en-US`) vers un
// LanguageCode Mews valide. Défaut strict : fr-FR. Utilisé par tous les endpoints
// qui renvoient du contenu localisé (config, dispo, pricing) et par la création
// (langue de la page de paiement + e-mails Mews).
export const mewsLang = (v: unknown): "fr-FR" | "en-GB" => {
  const s = String(v ?? "").toLowerCase();
  return s === "en" || s === "en-gb" || s === "en-us" ? "en-GB" : "fr-FR";
};

export const clampInt = (v: unknown, min: number, max: number, dflt: number): number => {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, Math.trunc(n)));
};

/** Extrait { gross, net } EUR d'un objet Amount Mews { EUR: { GrossValue, NetValue } }. */
export const eurAmount = (
  amount: unknown,
): { currency: "EUR"; gross: number | null; net: number | null } | null => {
  const e = (amount as { EUR?: { GrossValue?: number; NetValue?: number } } | null)?.EUR;
  if (!e) return null;
  return { currency: "EUR", gross: e.GrossValue ?? null, net: e.NetValue ?? null };
};
