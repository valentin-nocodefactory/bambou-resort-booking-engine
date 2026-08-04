import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

// Client Supabase du back-office. La session (login) est persistée en localStorage
// par le client → l'utilisateur reste connecté entre les visites.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const isConfigured = SUPABASE_ANON_KEY.startsWith("ey"); // une clé JWT commence par "ey"
