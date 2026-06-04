import { mewsJson, readJson, bad, json, type Env } from "./_lib";

interface Body {
  reservationGroupId?: string;
  returnUrl?: string; // origine + chemin de retour fournis par le front
}

// Reconstruit l'URL de paiement Mews pour un PaymentRequest encore en attente
// (bouton « Reprendre le paiement » sur l'écran de confirmation).
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const b = await readJson<Body>(request);
  if (typeof b.reservationGroupId !== "string" || !b.reservationGroupId) return bad("missing_reservation_group_id");
  const returnUrl = typeof b.returnUrl === "string" && /^https?:\/\//.test(b.returnUrl) ? b.returnUrl : null;
  if (!returnUrl) return bad("missing_return_url");

  const res = await mewsJson<any>(env, "reservationGroups/get", {
    HotelId: env.MEWS_HOTEL_ID,
    ReservationGroupId: b.reservationGroupId,
    Extent: { PaymentRequests: true, Payments: true },
  });
  if (!res.ok || !res.data) return json({ error: "status_failed", status: res.status }, 502);

  const d = res.data;
  const paid =
    (d.Payments ?? []).some((p: any) => p.State === "Charged") ||
    (d.PaymentRequests ?? []).some((p: any) => p.State === "Completed");
  const pending = (d.PaymentRequests ?? []).find((p: any) => p.State === "Pending");

  if (paid || !pending) return json({ paymentUrl: null, paid });

  const sep = returnUrl.includes("?") ? "&" : "?";
  const finalReturn = `${returnUrl}${sep}rgid=${b.reservationGroupId}`;
  const paymentUrl = `${env.MEWS_APP_BASE_URL}/navigator/payment-requests/detail/${pending.Id}?returnUrl=${encodeURIComponent(
    btoa(finalReturn),
  )}`;
  return json({ paymentUrl, paid: false });
};
