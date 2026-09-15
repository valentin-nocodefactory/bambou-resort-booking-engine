// Instantané de confirmation (robustesse écran de confirmation).
// Le paiement Mews se déroule sur une page HÉBERGÉE (redirection plein écran) : le retour
// sur /confirmation?rgid=… est donc un CHARGEMENT FRAIS de l'app → tout l'état React est
// perdu (dates, e-mail, total, intérêt navette). Comme SEULS les tarifs payables en ligne
// sont proposés (cf. shaping.buildRooms), c'est le chemin NORMAL de réservation.
// On persiste donc juste avant la redirection un petit résumé, corrélé au reservationGroupId
// (rgid), pour ré-afficher un écran complet et déclencher le CTA « navette aéroport ».
const KEY = "bambou_confirmation";

export interface ConfirmationSnapshot {
  rgid: string;
  checkIn: string;
  checkOut: string;
  email: string;
  total: number;
  airportTransfer: boolean;
  roomName: string;
}

export function saveConfirmationSnapshot(s: ConfirmationSnapshot): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* localStorage indispo (navigation privée) — l'écran de confirmation sera juste plus succinct */
  }
}

// Ne renvoie l'instantané que s'il correspond au reservationGroupId attendu (évite tout
// mélange avec une réservation précédente restée en localStorage).
export function loadConfirmationSnapshot(rgid: string | null): ConfirmationSnapshot | null {
  if (!rgid) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as ConfirmationSnapshot;
    return s && s.rgid === rgid ? s : null;
  } catch {
    return null;
  }
}
