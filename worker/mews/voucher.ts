import { mewsJson, readJson, bad, json, type Env } from "./_lib";

interface Body {
  voucherCode?: string;
}

type Mapping = { config_id: string; property: string; label: string | null };

// Mapping voucher → booking engine (table Supabase `voucher_configs`, éditable depuis le
// dashboard). Lecture publique via la clé anon (RLS select true). Code normalisé en MAJUSCULES.
async function lookupConfig(env: Env, code: string): Promise<Mapping | null> {
  const base = env.SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY;
  if (!base || !key) return null;
  try {
    const url = `${base}/rest/v1/voucher_configs?select=config_id,property,label&active=eq.true&code=eq.${encodeURIComponent(code)}`;
    const r = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!r.ok) return null;
    const rows = (await r.json()) as Mapping[];
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch {
    return null;
  }
}

// vouchers/validate + résolution de la config associée.
// Renvoie { valid, config } : `valid` = voucher reconnu par Mews (débloque d'éventuels tarifs
// privés) ; `config` = { configId, property, label } si le code est mappé à un booking engine
// dans le back-office (→ le moteur bascule sur cette config), sinon null.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const b = await readJson<Body>(request);
  if (typeof b.voucherCode !== "string" || !b.voucherCode.trim()) return bad("missing_voucher_code");
  const code = b.voucherCode.trim().toUpperCase();

  const res = await mewsJson<{ IsValid?: boolean }>(env, "vouchers/validate", {
    HotelId: env.MEWS_HOTEL_ID,
    VoucherCode: code,
  });
  const valid = !!(res.ok && res.data && res.data.IsValid === true);

  const mapping = await lookupConfig(env, code);
  return json({
    valid,
    config: mapping
      ? { configId: mapping.config_id, property: mapping.property, label: mapping.label ?? code }
      : null,
  });
};
