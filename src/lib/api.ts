// FRONTIÈRE RÉSEAU UNIQUE du front. Aucun composant n'appelle Mews directement :
// tout passe par /api/mews/* (Pages Functions, même origine). Le front ne connaît
// ni le `Client`, ni les UUID établissement.
//
// Chaque appel est journalisé (apiLog) avec une explication « pourquoi » → Dev Panel.

import type {
  AvailabilityResponse,
  HotelConfig,
  PricingResult,
  ReservationCreateResult,
  ReservationStatusResult,
} from "../types/mews";
import { toUtc } from "./format";
import { getLang, mewsLang } from "./lang";
import { t } from "../i18n";
import { apiLog } from "./apiLog";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(code: string, status: number, details?: unknown) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface Meta {
  label: string;
  why: string;
  request?: unknown;
}

async function call<T>(path: string, init: RequestInit | undefined, meta: Meta): Promise<T> {
  const id = apiLog.start(init?.method ?? "GET", path, meta.label, meta.why, meta.request);
  const t0 = performance.now();
  const ms = () => Math.round(performance.now() - t0);

  let res: Response;
  try {
    res = await fetch(`/api/mews/${path}`, init);
  } catch {
    apiLog.finish(id, { ok: false, error: "network_error", durationMs: ms() });
    throw new ApiError("network_error", 0);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const code = (data as { error?: string } | null)?.error ?? `http_${res.status}`;
    apiLog.finish(id, { ok: false, status: res.status, durationMs: ms(), error: code, response: data });
    throw new ApiError(code, res.status, data);
  }

  apiLog.finish(id, { ok: true, status: res.status, durationMs: ms(), response: data });
  return data as T;
}

const post = <T>(path: string, body: unknown, meta: Omit<Meta, "request">) =>
  call<T>(
    path,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    { ...meta, request: body },
  );

export interface SearchParams {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  infants: number; // bébés en berceau — gratuits + non décomptés
  voucherCode?: string;
  properties?: string[]; // hébergements cochés (hotel/creole/villas)
}

export interface GuestPayload {
  email: string;
  firstName: string;
  lastName: string;
  telephone?: string;
  nationalityCode?: string;
  sendMarketingEmails?: boolean;
}

export interface ReservationLine {
  roomCategoryId: string;
  startUtc: string;
  endUtc: string;
  rateId: string;
  adults: number;
  children: number;
  infants?: number; // bébés en berceau — non décomptés, consignés en note à la résa
  productIds?: string[];
  voucherCode?: string;
  notes?: string;
}

export const api = {
  hotel: () =>
    call<HotelConfig>(`hotel?lang=${getLang()}`, undefined, {
      label: "Configuration de l'hôtel",
      why: "Charge la config de l'établissement (catégories de chambres, photos, produits/extras, devise, conditions, passerelle de paiement) dans la langue courante. Appelé une seule fois au démarrage. Mis en cache 5 min côté serveur.",
    }),

  availability: (p: SearchParams) =>
    post<AvailabilityResponse>(
      "availability",
      {
        startUtc: toUtc(p.checkIn),
        endUtc: toUtc(p.checkOut),
        adults: p.adults,
        children: p.children,
        infants: p.infants,
        languageCode: mewsLang(),
        ...(p.voucherCode ? { voucherCode: p.voucherCode } : {}),
        ...(p.properties?.length ? { properties: p.properties } : {}),
      },
      {
        label: "Disponibilités & prix",
        why: "Le cœur du moteur : interroge Mews pour les chambres disponibles et leurs tarifs en EUR, pour vos dates et occupants. Le front les groupe par type de chambre (prix « à partir de »).",
      },
    ),

  pricing: (p: {
    checkIn: string;
    checkOut: string;
    roomCategoryId: string;
    adults: number;
    children: number;
    productIds?: string[];
    voucherCode?: string;
  }) =>
    post<PricingResult>(
      "pricing",
      {
        startUtc: toUtc(p.checkIn),
        endUtc: toUtc(p.checkOut),
        roomCategoryId: p.roomCategoryId,
        adults: p.adults,
        children: p.children,
        languageCode: mewsLang(),
        ...(p.productIds?.length ? { productIds: p.productIds } : {}),
        ...(p.voucherCode ? { voucherCode: p.voucherCode } : {}),
      },
      {
        label: "Prix exact du type de chambre",
        why: "À l'ouverture du panneau détail : confirme le prix précis de ce type de chambre selon l'occupation choisie. La réponse Mews (~80 devises) est curée en EUR par le serveur.",
      },
    ),

  createReservation: (payload: {
    customer: GuestPayload;
    booker?: GuestPayload;
    property?: string; // hébergement de la chambre choisie → config Mews côté serveur
    reservations: ReservationLine[];
    returnUrl?: string;
  }) =>
    post<ReservationCreateResult>("reservation", { ...payload, languageCode: mewsLang() }, {
      label: "Création de la réservation",
      why: "Écrit la réservation dans Mews (reservationGroups/create) et prépare le paiement : Mews renvoie un PaymentRequestId, le serveur construit l'URL de paiement sécurisée (Voie A).",
    }),

  reservationStatus: (reservationGroupId: string) =>
    post<ReservationStatusResult>("reservation-status", { reservationGroupId }, {
      label: "Vérification du paiement",
      why: "Au retour de la page de paiement : vérifie via reservationGroups/get que le règlement est bien passé (PaymentRequests/Payments). Re-sondé tant que non finalisé.",
    }),

  paymentLink: (reservationGroupId: string, returnUrl: string) =>
    post<{ paymentUrl: string | null; paid: boolean }>("payment-link", { reservationGroupId, returnUrl }, {
      label: "Reprise du paiement",
      why: "Reconstruit le lien de paiement Mews pour un règlement encore en attente (bouton « Reprendre le paiement »).",
    }),

  validateVoucher: (voucherCode: string) =>
    post<unknown>("voucher", { voucherCode }, {
      label: "Validation du code promo",
      why: "Vérifie la validité d'un code promotionnel ; une nouvelle recherche avec ce code débloque les tarifs privés.",
    }),

  // Suivi de panier (funnel) → n8n via le Worker. Best-effort : n'échoue jamais l'UI.
  track: (payload: unknown): Promise<{ ok: boolean }> =>
    post<{ ok: boolean }>("track", payload, {
      label: "Suivi panier → n8n",
      why: "Pousse l'état du panier (statut, sélection, contact) vers n8n à chaque étape à partir des infos client, pour alimenter la base des paniers (abandonné / paiement initié / validé).",
    }).catch(() => ({ ok: false })),
};

// Messages d'erreur lisibles (localisés) à partir des codes renvoyés par les Functions.
export function errorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return t("err.unexpected");
  switch (err.code) {
    case "network_error":
      return t("err.network");
    case "mews_timeout":
      return t("err.timeout");
    case "mews_unreachable":
      return t("err.unreachable");
    case "missing_or_invalid_dates":
      return t("err.dates");
    case "end_before_start":
      return t("err.endBeforeStart");
    case "invalid_customer":
      return t("err.customer");
    case "no_valid_reservations":
      return t("err.noReservations");
    case "exceeding_availability":
      return t("err.exceeding");
    default:
      if (err.status === 401) return t("err.unauthorized");
      return t("err.generic");
  }
}
