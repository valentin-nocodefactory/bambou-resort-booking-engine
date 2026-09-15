import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

// Client Supabase du back-office.
// - persistSession   : la session est gardée en localStorage → on RESTE connecté entre
//                      les visites et après fermeture du navigateur (même appareil).
// - autoRefreshToken : le token d'accès (court) est rafraîchi en tâche de fond, donc la
//                      session reste valide tant que le refresh token l'est.
// - detectSessionInUrl : capte la session au retour du lien magique (#access_token=…).
// ⚠️ La DURÉE de connexion (ex. 90 jours) se règle CÔTÉ SUPABASE (Auth → Sessions) :
//    inactivity timeout = 0 (jamais) + time-box = 90 jours. Le code ne fait que persister.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const isConfigured = SUPABASE_ANON_KEY.startsWith("ey"); // une clé JWT commence par "ey"
