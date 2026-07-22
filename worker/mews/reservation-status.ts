import { mewsJson, readJson, bad, json, notify, type Env } from "./_lib";

interface Body {
  reservationGroupId?: string;
}

// reservationGroups/get — vérifie le paiement au retour de la page Payment Request.
// States PaymentRequests : Pending | Completed | Canceled | Expired
// States Payments        : Pending | Verifying | Charged | Canceled | Failed
export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
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

  // Webhook « réservation payée ». Se déclenche quand le front (écran confirmation)
  // sonde le statut et voit le paiement encaissé. ⚠️ Le consommateur doit dédupliquer
  // par reservationGroupId (peut se répéter si l'utilisateur recharge la page).
  if (paid) {
    waitUntil(
      notify(env, "reservation.paid", {
        reservationGroupId: d.Id,
        confirmationNumbers: reservations.map((r: any) => r.number).filter(Boolean),
        payments,
      }),
    );
  }

  return json({
    id: d.Id,
    paid,
    finalFailure,
    paymentRequests,
    payments,
    reservations,
  });
};
