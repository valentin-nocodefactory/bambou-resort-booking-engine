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
}

// Catégories d'âge (demo, vérifiées en live) — fallback si les vars ne sont pas définies.
// En prod : surcharger via MEWS_ADULT_AGE_CATEGORY_ID / MEWS_CHILD_AGE_CATEGORY_ID.
const AGE_FALLBACK = {
  adult: "5485e2f3-4034-4ca1-8a8f-ade30114c61f",
  child: "fece4b6b-39fa-4ccd-9909-afba0092eeb1",
};

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
