import type { Localized } from "../types/mews";

// Sélection de langue localisée : fr-FR || en-GB || en-US || 1ère clé dispo.
export function loc(value: Localized | null | undefined, fallback = ""): string {
  if (!value) return fallback;
  return (
    value["fr-FR"] ||
    value["fr"] ||
    value["en-GB"] ||
    value["en-US"] ||
    value["en"] ||
    Object.values(value)[0] ||
    fallback
  );
}

const eurFmt = (decimals: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

// Prix EUR. Par défaut : 0 décimale si entier (« à partir de 126 € »), sinon 2.
export function eur(value: number | null | undefined, opts?: { decimals?: 0 | 2 }): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const d = opts?.decimals ?? (Number.isInteger(value) ? 0 : 2);
  return eurFmt(d).format(value);
}

// Normalise une date (yyyy-mm-dd ou ISO) en ISO 8601 UTC minuit.
export function toUtc(date: string): string {
  if (!date) return date;
  return /T/.test(date) ? date : `${date}T00:00:00Z`;
}

// Nombre de nuits entre deux dates (calcul en UTC, robuste DST).
export function nights(start: string, end: string): number {
  const a = Date.parse(toUtc(start));
  const b = Date.parse(toUtc(end));
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const dateFmtLong = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export function fmtDate(date: string): string {
  const t = Date.parse(toUtc(date));
  return Number.isNaN(t) ? date : dateFmt.format(new Date(t));
}
export function fmtDateLong(date: string): string {
  const t = Date.parse(toUtc(date));
  return Number.isNaN(t) ? date : dateFmtLong.format(new Date(t));
}

// URL d'image Mews : `${ImageBaseUrl}/{imageId}?width=…`. Renvoie null si pas d'id.
// ⚠️ Le CDN Mews attend `width` (et non `w`) : avec `w`, le prod sert l'image pleine
// résolution TRONQUÉE à 1 Mio (illisible → image cassée). `width` renvoie une image
// complète ET redimensionnée (prod + demo).
export function imgUrl(baseUrl: string | undefined, imageId: string | null | undefined, width = 900): string | null {
  if (!baseUrl || !imageId) return null;
  return `${baseUrl}/${imageId}?width=${width}`;
}

// yyyy-mm-dd du jour (en UTC) + ajout de N jours — pour les valeurs par défaut du sélecteur.
export function isoDay(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
