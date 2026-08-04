import { mewsJson, readJson, bad, json, isIsoDate, clampInt, eurAmount, propertyByKey, mewsLang, type Env } from "./_lib";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InCustomer {
  email?: string;
  firstName?: string;
  lastName?: string;
  telephone?: string;
  nationalityCode?: string;
  sendMarketingEmails?: boolean;
}
interface InReservation {
  roomCategoryId?: string;
  startUtc?: string;
  endUtc?: string;
  rateId?: string;
  adults?: number;
  children?: number;
  productIds?: string[];
  voucherCode?: string;
  notes?: string;
}
interface Body {
  customer?: InCustomer;
  booker?: InCustomer;
  // Hébergement de la chambre choisie (hotel/creole/villas) → détermine la config Mews.
  property?: string;
  reservations?: InReservation[];
  // URL absolue de retour (origine + chemin) fournie par le front — sert à
  // construire la redirection Payment Request (Voie A). Jamais l'app base url côté front.
  returnUrl?: string;
  // Langue (fr-FR | en-GB) : fixe la langue de la page de paiement Mews + e-mails.
  languageCode?: string;
}

// Construit l'URL de la page de paiement hébergée par Mews (Voie A).
// returnUrl encodé en Base64 (exigé par Mews). `language` = indice de langue sur la
// page hébergée (best-effort ; le levier principal reste LanguageCode à la création).
function buildPaymentUrl(
  appBaseUrl: string,
  paymentRequestId: string,
  returnUrl: string,
  rgid: string,
  language: string,
): string {
  const sep = returnUrl.includes("?") ? "&" : "?";
  const finalReturn = `${returnUrl}${sep}rgid=${rgid}`;
  const b64 = btoa(finalReturn);
  return `${appBaseUrl}/navigator/payment-requests/detail/${paymentRequestId}?returnUrl=${encodeURIComponent(
    b64,
  )}&language=${encodeURIComponent(language)}`;
}

function cleanCustomer(c: InCustomer | undefined) {
  if (!c || !c.email || !EMAIL_RE.test(c.email) || !c.firstName?.trim() || !c.lastName?.trim()) return null;
  return {
    Email: c.email.trim(),
    FirstName: c.firstName.trim(),
    LastName: c.lastName.trim(),
    ...(c.telephone ? { Telephone: String(c.telephone).trim() } : {}),
    ...(c.nationalityCode ? { NationalityCode: String(c.nationalityCode).trim().toUpperCase() } : {}),
    ...(typeof c.sendMarketingEmails === "boolean" ? { SendMarketingEmails: c.sendMarketingEmails } : {}),
  };
}

// reservationGroups/create — ÉCRIT dans Mews. On reconstruit entièrement le payload
// à partir de champs whitelistés ; jamais de forward du body brut. Renvoie au front
// une réponse curée (Id, PaymentRequestId, numéros de confirmation, total EUR).
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const b = await readJson<Body>(request);

  const Customer = cleanCustomer(b.customer);
  if (!Customer) return bad("invalid_customer");

  const Reservations = (Array.isArray(b.reservations) ? b.reservations : [])
    .filter(
      (r) =>
        r &&
        typeof r.roomCategoryId === "string" &&
        typeof r.rateId === "string" &&
        isIsoDate(r.startUtc) &&
        isIsoDate(r.endUtc) &&
        (r.endUtc as string) > (r.startUtc as string),
    )
    .map((r) => ({
      RoomCategoryId: r.roomCategoryId,
      StartUtc: r.startUtc,
      EndUtc: r.endUtc,
      RateId: r.rateId,
      AdultCount: clampInt(r.adults, 1, 30, 2),
      ChildCount: clampInt(r.children, 0, 20, 0),
      ...(Array.isArray(r.productIds) && r.productIds.length
        ? { ProductIds: r.productIds.filter((x) => typeof x === "string") }
        : {}),
      ...(r.voucherCode ? { VoucherCode: String(r.voucherCode) } : {}),
      ...(r.notes ? { Notes: String(r.notes).slice(0, 1000) } : {}),
    }));
  if (!Reservations.length) return bad("no_valid_reservations");

  const Booker = cleanCustomer(b.booker);
  const LanguageCode = mewsLang(b.languageCode);

  const res = await mewsJson<any>(env, "reservationGroups/create", {
    // Config de l'hébergement choisi (Bambou/Créole/Villas) ; défaut = config primaire.
    ConfigurationId: propertyByKey(b.property)?.configId ?? env.MEWS_CONFIG_ID,
    HotelId: env.MEWS_HOTEL_ID,
    // Fixe la langue de la page de paiement hébergée + des e-mails de confirmation Mews.
    LanguageCode,
    Customer,
    ...(Booker ? { Booker } : {}),
    Reservations,
  });

  if (!res.ok || !res.data) {
    return json(
      { error: "reservation_failed", status: res.status, details: res.data },
      res.status >= 400 ? res.status : 502,
    );
  }

  const d = res.data;
  // Indispo partielle : Mews répond 200 mais signale les index en trop.
  if (Array.isArray(d.ExceedingReservationIndexes) && d.ExceedingReservationIndexes.length) {
    return json({ error: "exceeding_availability", exceedingIndexes: d.ExceedingReservationIndexes }, 409);
  }

  // Voie A : si un PaymentRequestId est renvoyé (RateGroup en settlement automatique),
  // on construit l'URL de paiement hébergée par Mews. Sinon → paiement à l'arrivée.
  const returnUrl = typeof b.returnUrl === "string" && /^https?:\/\//.test(b.returnUrl) ? b.returnUrl : null;
  const paymentUrl =
    d.PaymentRequestId && returnUrl
      ? buildPaymentUrl(env.MEWS_APP_BASE_URL, d.PaymentRequestId, returnUrl, d.Id, LanguageCode)
      : null;

  // Le suivi « paiement initié » part du front (track → WEBHOOK_EVENTS) avec le
  // reservationGroupId → n8n valide ensuite le paiement via Mews. Pas de webhook serveur.

  return json({
    id: d.Id,
    customerId: d.CustomerId,
    paymentRequestId: d.PaymentRequestId ?? null,
    paymentUrl,
    creditCardAvailable: d.CreditCardAvailable ?? null,
    totalAmount: eurAmount(d.TotalAmount),
    reservations: (d.Reservations ?? []).map((r: any) => ({
      id: r.Id,
      number: r.Number,
      roomCategoryId: r.RoomCategoryId,
      rateId: r.RateId,
      startUtc: r.StartUtc,
      endUtc: r.EndUtc,
      adultCount: r.AdultCount,
      childCount: r.ChildCount,
      amount:
        eurAmount(r.Amount) ??
        (typeof r.Cost?.EUR === "number" ? { currency: "EUR", gross: r.Cost.EUR, net: null } : null),
    })),
  });
};
