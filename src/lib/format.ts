import type { Localized } from "../types/mews";
import { getLang, LOCALE } from "./lang";
import { getCurrency, convert, CURRENCIES, type Currency } from "./currency";

// Locale Intl courante (fr-FR | en-GB). La langue est fixe par chargement de page.
const locale = () => LOCALE[getLang()];

// Sélection de la valeur localisée selon la langue active : la langue courante
// d'abord, puis repli sur l'autre, puis 1ère clé dispo.
export function loc(value: Localized | null | undefined, fallback = ""): string {
  if (!value) return fallback;
  const order =
    getLang() === "en"
      ? ["en-GB", "en-US", "en", "fr-FR", "fr"]
      : ["fr-FR", "fr", "en-GB", "en-US", "en"];
  for (const k of order) {
    const v = value[k];
    if (v) return v;
  }
  return Object.values(value)[0] || fallback;
}

// Nom localisé d'un pays à partir de son code ISO (FR/EN via Intl.DisplayNames).
const regionCache = new Map<string, Intl.DisplayNames>();
export function regionName(code: string): string {
  const loc = locale();
  let dn = regionCache.get(loc);
  if (!dn) {
    dn = new Intl.DisplayNames([loc], { type: "region" });
    regionCache.set(loc, dn);
  }
  try {
    return dn.of(code) ?? code;
  } catch {
    return code;
  }
}

// Formatters Intl mémoïsés par (locale, décimales) — reconstruits si la locale change.
const numCache = new Map<string, Intl.NumberFormat>();
const eurFmt = (decimals: number) => {
  const key = `${locale()}:${decimals}`;
  let f = numCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale(), {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    numCache.set(key, f);
  }
  return f;
};

// Prix EUR. Par défaut : 0 décimale si entier (« à partir de 126 € »), sinon 2.
export function eur(value: number | null | undefined, opts?: { decimals?: 0 | 2 }): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const d = opts?.decimals ?? (Number.isInteger(value) ? 0 : 2);
  return eurFmt(d).format(value);
}

// Formatter Intl DÉCIMAL (sans style « currency ») mémoïsé par (locale, décimales) : pour
// les devises converties (USD/CAD), on colle nous-même le symbole désambiguïsé (US$ / C$).
const decCache = new Map<string, Intl.NumberFormat>();
const decFmt = (decimals: number) => {
  const key = `${locale()}:${decimals}`;
  let f = decCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    decCache.set(key, f);
  }
  return f;
};

// Prix d'AFFICHAGE dans la devise choisie. EUR → eur() natif (inchangé). USD/CAD →
// conversion « approximative » (⚠️ la transaction reste EN EUR) + symbole collé (US$ / C$).
// `decimals` : même logique que eur() (0 si le montant EUR est entier, sinon 2), surchargeable.
export function money(value: number | null | undefined, opts?: { decimals?: 0 | 2; currency?: Currency }): string {
  const cur = opts?.currency ?? getCurrency();
  if (cur === "EUR") return eur(value, opts);
  if (value == null || !Number.isFinite(value)) return "—";
  const d = opts?.decimals ?? (Number.isInteger(value) ? 0 : 2);
  const meta = CURRENCIES[cur];
  const num = decFmt(d).format(convert(value, cur));
  return meta.position === "prefix" ? `${meta.symbol}${num}` : `${num} ${meta.symbol}`;
}

// Fuseau de l'établissement = `IanaTimeZoneIdentifier` de la config Mews (Enterprise).
// Les dates de séjour sont des dates CALENDRIER de l'hôtel : l'API Mews attend un
// StartUtc/EndUtc = l'instant UTC de MINUIT LOCAL de l'hôtel. Envoyer un minuit UTC
// (T00:00:00Z) décalait la réservation d'UN JOUR EN ARRIÈRE sur un fuseau à l'ouest de UTC
// (ici UTC−4 → Mews réservait le 22 pour un choix du 23). On ancre donc à minuit local.
const HOTEL_TZ = "America/Caracas"; // UTC−4 (= config Mews, même enterprise pour les 3 hébergements)

// Décalage (minutes, local − UTC) d'un fuseau IANA à un instant donné (gère un éventuel DST).
function tzOffsetMinutes(tz: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date(utcMs));
  const p: Record<string, string> = {};
  for (const x of parts) p[x.type] = x.value;
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utcMs) / 60_000);
}

// Normalise une date (yyyy-mm-dd) en ISO 8601 UTC = MINUIT LOCAL DE L'HÔTEL (≠ minuit UTC).
// Un ISO complet (déjà horodaté) passe tel quel.
export function toUtc(date: string): string {
  if (!date) return date;
  if (/T/.test(date)) return date;
  const [y, m, d] = date.split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  const offMin = tzOffsetMinutes(HOTEL_TZ, utcMidnight);
  return new Date(utcMidnight - offMin * 60_000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

// Nombre de nuits entre deux dates (calcul en UTC, robuste DST).
export function nights(start: string, end: string): number {
  const a = Date.parse(toUtc(start));
  const b = Date.parse(toUtc(end));
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

const dateCache = new Map<string, Intl.DateTimeFormat>();
const dateFmtFor = (opts: Intl.DateTimeFormatOptions, tag: string) => {
  const key = `${locale()}:${tag}`;
  let f = dateCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale(), { ...opts, timeZone: "UTC" });
    dateCache.set(key, f);
  }
  return f;
};

export function fmtDate(date: string): string {
  const t = Date.parse(toUtc(date));
  return Number.isNaN(t)
    ? date
    : dateFmtFor({ day: "numeric", month: "short", year: "numeric" }, "short").format(new Date(t));
}
export function fmtDateLong(date: string): string {
  const t = Date.parse(toUtc(date));
  return Number.isNaN(t)
    ? date
    : dateFmtFor({ weekday: "long", day: "numeric", month: "long" }, "long").format(new Date(t));
}

// URL d'image Mews : `${ImageBaseUrl}/{imageId}?width=…&mode=fit`. Renvoie null si pas d'id.
// ⚠️ Le CDN Mews attend `width` (et non `w`) : avec `w`, le prod sert l'image pleine
// résolution TRONQUÉE à 1 Mio (illisible → image cassée).
// ⚠️ `mode=fit` est INDISPENSABLE : SANS lui, Mews fige la hauteur d'origine et force
// juste la largeur → l'image est DÉFORMÉE (écrasée en hauteur, ex. 240×1632 au lieu de
// 240×160). `mode=fit` conserve le ratio (redimensionnement proportionnel).
export function imgUrl(baseUrl: string | undefined, imageId: string | null | undefined, width = 900): string | null {
  if (!baseUrl || !imageId) return null;
  return `${baseUrl}/${imageId}?width=${width}&mode=fit`;
}

// URL d'une photo de villa (galerie /villa). Les photos stockées sont des URL COMPLÈTES,
// mixtes : Mews CDN (seed) ou Supabase Storage (upload depuis le BO). Pour les URL Mews on
// peut demander une largeur (comme imgUrl → responsive) ; les autres sont renvoyées telles
// quelles. Idempotent : on repart toujours de l'URL sans query.
export function villaImg(url: string | null | undefined, width = 1024): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname === "cdn.mews.com" && u.pathname.startsWith("/Media/Image/")) {
      return `${u.origin}${u.pathname}?width=${width}&mode=fit`;
    }
  } catch {
    /* URL relative/invalide → renvoyée telle quelle */
  }
  return url;
}

// yyyy-mm-dd du jour (en UTC) + ajout de N jours — pour les valeurs par défaut du sélecteur.
export function isoDay(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
