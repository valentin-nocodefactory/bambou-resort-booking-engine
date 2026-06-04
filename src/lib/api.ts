// FRONTIÈRE RÉSEAU UNIQUE du front. Aucun composant n'appelle Mews directement :
// tout passe par /api/mews/* (Pages Functions, même origine). Le front ne connaît
// ni le `Client`, ni les UUID établissement.

import type {
  AvailabilityResponse,
  HotelConfig,
  PricingResult,
  ReservationCreateResult,
  ReservationStatusResult,
} from "../types/mews";
import { toUtc } from "./format";

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

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/mews/${path}`, init);
  } catch {
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
    throw new ApiError(code, res.status, data);
  }
  return data as T;
}

const post = <T>(path: string, body: unknown) =>
  call<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export interface SearchParams {
  checkIn: string; // yyyy-mm-dd
  checkOut: string;
  adults: number;
  children: number;
  voucherCode?: string;
  categoryIds?: string[];
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
  productIds?: string[];
  voucherCode?: string;
  notes?: string;
}

export const api = {
  hotel: () => call<HotelConfig>("hotel"),

  availability: (p: SearchParams) =>
    post<AvailabilityResponse>("availability", {
      startUtc: toUtc(p.checkIn),
      endUtc: toUtc(p.checkOut),
      adults: p.adults,
      children: p.children,
      ...(p.voucherCode ? { voucherCode: p.voucherCode } : {}),
      ...(p.categoryIds?.length ? { categoryIds: p.categoryIds } : {}),
    }),

  pricing: (p: {
    checkIn: string;
    checkOut: string;
    roomCategoryId: string;
    adults: number;
    children: number;
    productIds?: string[];
    voucherCode?: string;
  }) =>
    post<PricingResult>("pricing", {
      startUtc: toUtc(p.checkIn),
      endUtc: toUtc(p.checkOut),
      roomCategoryId: p.roomCategoryId,
      adults: p.adults,
      children: p.children,
      ...(p.productIds?.length ? { productIds: p.productIds } : {}),
      ...(p.voucherCode ? { voucherCode: p.voucherCode } : {}),
    }),

  createReservation: (payload: {
    customer: GuestPayload;
    booker?: GuestPayload;
    reservations: ReservationLine[];
    returnUrl?: string;
  }) => post<ReservationCreateResult>("reservation", payload),

  reservationStatus: (reservationGroupId: string) =>
    post<ReservationStatusResult>("reservation-status", { reservationGroupId }),

  paymentLink: (reservationGroupId: string, returnUrl: string) =>
    post<{ paymentUrl: string | null; paid: boolean }>("payment-link", { reservationGroupId, returnUrl }),

  validateVoucher: (voucherCode: string) => post<unknown>("voucher", { voucherCode }),
};

// Messages d'erreur lisibles (FR) à partir des codes renvoyés par les Functions.
export function errorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "Une erreur inattendue est survenue. Merci de réessayer.";
  switch (err.code) {
    case "network_error":
      return "Connexion impossible. Vérifiez votre réseau et réessayez.";
    case "mews_timeout":
      return "Le service de réservation met trop de temps à répondre. Réessayez dans un instant.";
    case "mews_unreachable":
      return "Le service de réservation est momentanément indisponible.";
    case "missing_or_invalid_dates":
      return "Merci de sélectionner des dates valides.";
    case "end_before_start":
      return "La date de départ doit être postérieure à l'arrivée.";
    case "invalid_customer":
      return "Merci de vérifier vos informations (nom, prénom, e-mail).";
    case "no_valid_reservations":
      return "Aucune chambre valide à réserver. Recommencez la sélection.";
    case "exceeding_availability":
      return "Cette chambre n'est plus disponible pour ces dates. Relancez une recherche.";
    default:
      if (err.status === 401) return "Service de réservation non autorisé (configuration Client). Contactez l'hôtel.";
      return "Le service de réservation a renvoyé une erreur. Merci de réessayer.";
  }
}
