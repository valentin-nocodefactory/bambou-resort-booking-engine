import { json, bad, readJson, clampInt, postWebhook, type Env } from "./_lib";

// Insert best-effort dans une table Supabase via l'API REST (clé anon + policy INSERT).
async function sbInsert(env: Env, table: string, row: Record<string, unknown>): Promise<boolean> {
  const base = env.SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY;
  if (!base || !key) return false;
  try {
    const r = await fetch(`${base}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
    return r.ok;
  } catch {
    return false;
  }
}

const str = (v: unknown, max = 500): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};
const isoDate = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Suivi du funnel villa + capture des demandes (formulaire /villa).
//  • stage = "vue"     → 1 ligne dans villa_events (étape 1 : formulaire vu).
//  • stage = "demande" → 1 ligne dans villa_leads  (étape 2 : demande envoyée, avec données).
// Best-effort : ne bloque jamais l'UX du formulaire (le front affiche « envoyé » quoi qu'il arrive).
export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const b = await readJson<Record<string, unknown>>(request);
  const sessionId = str(b.sessionId, 64);

  if (b.stage === "vue") {
    await sbInsert(env, "villa_events", { session_id: sessionId });
    return json({ ok: true });
  }

  if (b.stage === "demande") {
    const email = str(b.email, 200);
    if (!email || !EMAIL_RE.test(email)) return bad("invalid_email");
    const lead = {
      session_id: sessionId,
      first_name: str(b.firstName, 100),
      last_name: str(b.lastName, 100),
      email,
      phone: str(b.phone, 40),
      check_in: isoDate(b.checkIn),
      check_out: isoDate(b.checkOut),
      flexible_dates: !!b.flexibleDates,
      people: clampInt(b.people, 1, 99, 1),
      with_baby: !!b.withBaby,
      villa_id: str(b.villaId, 64),
      villa_name: str(b.villaName, 200),
      message: str(b.message, 4000),
      lang: str(b.lang, 8),
    };
    const ok = await sbInsert(env, "villa_leads", lead);
    // Notifie n8n (best-effort, en tâche de fond) : e-mail équipe / CRM. No-op si non défini.
    waitUntil(postWebhook(env.WEBHOOK_VILLA, { event: "villa.demande", timestamp: new Date().toISOString(), ...lead }));
    return json({ ok });
  }

  return bad("invalid_stage");
};
