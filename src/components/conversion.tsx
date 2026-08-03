import { useEffect, useState } from "react";
import { eur } from "../lib/format";
import { IconCheck, IconClock, IconFlame, IconHeart, IconLock, IconStar, IconTag, IconUsers } from "./icons";

// ⚠️ DONNÉES DE DÉMONSTRATION (EN DUR) — leviers de conversion.
// Tout ce fichier produit des valeurs *non issues de Mews* : notes & avis, « X personnes
// consultent », « réservé N fois », badges marketing, minuteur, bandeaux d'urgence, copie
// « annulation gratuite », etc. En production : brancher de vraies sources (avis clients,
// politique d'annulation depuis les RateGroups Mews, etc.). Voir l'onglet « Sources des
// données » du Dev Panel. NB : ScarcityBadge/SavingsBadge reçoivent des valeurs RÉELLES
// (AvailableRoomCount / MaxPrice) — c'est l'appelant qui décide.

// Pseudo-aléatoire déterministe (stable par chambre) pour les nudges de conversion.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export const seeded = (seed: string, min: number, max: number) => min + (hash(seed) % (max - min + 1));

// ── Avis / note ────────────────────────────────────────────────────────────
export function Stars({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex text-creole ${className}`} aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <IconStar key={i} className="h-3.5 w-3.5" />
      ))}
    </span>
  );
}

export function RatingPill({ score = "4,2", count = "2 064", className = "" }: { score?: string; count?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${className}`}>
      <IconStar className="h-4 w-4 text-creole" />
      <strong className="font-semibold text-ink">{score}</strong>
      <span className="text-ink/50">· {count} avis</span>
    </span>
  );
}

// ── Confiance ────────────────────────────────────────────────────────────────
const TRUST = [
  { icon: IconCheck, label: "0 € de frais", sub: "ni commission plateforme" },
  { icon: IconTag, label: "Meilleur prix garanti", sub: "réservé en direct" },
  { icon: IconLock, label: "Paiement sécurisé", sub: "3-D Secure" },
  { icon: IconCheck, label: "Sans frais de réservation", sub: "0 commission" },
];

export function TrustRow({ compact = false }: { compact?: boolean }) {
  return (
    <ul className={`flex flex-wrap gap-x-5 gap-y-2 ${compact ? "text-xs" : "text-sm"}`}>
      {TRUST.map((t) => (
        <li key={t.label} className="inline-flex items-center gap-2 text-teal-deep">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-turquoise/12 text-turquoise">
            <t.icon className="h-3.5 w-3.5" />
          </span>
          <span>
            <span className="font-semibold text-ink">{t.label}</span>
            {!compact && <span className="block text-[11px] text-ink/45">{t.sub}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ── Rareté / urgence ─────────────────────────────────────────────────────────
export function ScarcityBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-creole/15 px-2.5 py-1 text-[11px] font-semibold text-creole">
      <IconFlame className="h-3.5 w-3.5" /> Plus que {count} {count > 1 ? "chambres" : "chambre"}
    </span>
  );
}
export function HotBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-creole/15 px-2.5 py-1 text-[11px] font-semibold text-creole">
      <IconFlame className="h-3.5 w-3.5" /> Très demandé
    </span>
  );
}
export function FavoriteBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-teal-deep shadow-card">
      <IconHeart className="h-3.5 w-3.5 text-creole" /> Coup de cœur voyageurs
    </span>
  );
}

export function ViewersNudge({ seed }: { seed: string }) {
  const viewers = seeded(seed, 6, 23);
  const booked = seeded(seed + "b", 2, 9);
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/55">
      <span className="inline-flex items-center gap-1.5">
        <IconUsers className="h-3.5 w-3.5 text-turquoise" />
        {viewers} personnes consultent ce séjour
      </span>
      <span className="inline-flex items-center gap-1.5">
        <IconFlame className="h-3.5 w-3.5 text-creole" />
        réservé {booked} fois cette semaine
      </span>
    </p>
  );
}

export function UrgencyBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl2 border border-creole/30 bg-creole/10 p-3.5 text-sm sm:items-center">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-creole/20 text-creole">
        <IconFlame className="h-4 w-4" />
      </span>
      <p className="text-ink/80">
        <strong className="font-semibold text-ink">Forte demande pour vos dates.</strong> Nos plus beaux bungalows
        partent vite — réservez sans frais, annulez gratuitement.
      </p>
    </div>
  );
}

// ── Valeur / économie ──────────────────────────────────────────────────────
export function SavingsBadge({ from, max }: { from: number | null; max: number | null }) {
  if (from == null || max == null || max <= from) return null;
  const pct = Math.round((1 - from / max) * 100);
  if (pct < 1) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
      <IconTag className="h-3 w-3" /> -{pct}%
    </span>
  );
}

export function SavingsLine({ amount }: { amount: number }) {
  if (amount <= 0) return null;
  return (
    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
      <IconTag className="h-4 w-4" /> Vous économisez {eur(amount)}
    </p>
  );
}

// ── Minuteur de maintien (paiement) ──────────────────────────────────────────
export function HoldTimer({ minutes = 10 }: { minutes?: number }) {
  const [left, setLeft] = useState(minutes * 60);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-turquoise/10 px-3 py-1 text-xs font-semibold text-teal-deep tabular-nums">
      <IconClock className="h-3.5 w-3.5 text-turquoise" />
      Nous gardons votre chambre {mm}:{ss}
    </span>
  );
}
