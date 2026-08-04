import { mewsJson, readJson, bad, json, type Env } from "./_lib";

interface Body {
  reservationGroupId?: string;
}

// reservationGroups/get — vérifie le paiement au retour de la page Payment Request.
// States PaymentRequests : Pending | Completed | Canceled | Expired
// States Payments        : Pending | Verifying | Charged | Canceled | Failed
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const b = await readJson<Body>(request);
  if (typeof b.reservationGroupId !== "string" || !b.reservationGroupId) return bad("missing_reservation_group_id");

  const res = await mewsJson<any>(env, "reservationGroups/get", {
    HotelId: env.MEWS_HOTEL_ID,
    ReservationGroupId: b.reservationGroupId,
    Extent: { PaymentRequests: true, Payments: true },
  });
  if (!res.ok || !res.data) return json({ error: "status_failed", status: res.status }, 502);

  const d = res.data;
  const paymentRequests = (d.PaymentRequests ?? []).map((p: any) => ({ id: p.Id, state: p.State }));
  const payments = (d.Payments ?? []).map((p: any) => ({ id: p.Id, state: p.State }));

  const paid =
    payments.some((p: any) => p.state === "Charged") ||
    paymentRequests.some((p: any) => p.state === "Completed");
  const finalFailure =
    !paid &&
    (paymentRequests.some((p: any) => ["Canceled", "Expired"].includes(p.state)) ||
      payments.some((p: any) => ["Failed", "Canceled"].includes(p.state)));

  const reservations = (d.Reservations ?? []).map((r: any) => ({ number: r.Number }));

  // Le suivi « paiement validé » part du front (track → WEBHOOK_EVENTS) à la confirmation.
  return json({
    id: d.Id,
    paid,
    finalFailure,
    paymentRequests,
    payments,
    reservations,
  });
};
