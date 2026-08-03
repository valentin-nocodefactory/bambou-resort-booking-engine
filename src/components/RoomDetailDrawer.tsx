import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { eur, imgUrl } from "../lib/format";
import { spaceLabel } from "../lib/shaping";
import type { ShapedRate, ShapedRoom } from "../types/mews";
import { Photo } from "./Photo";
import { FavoriteBadge, RatingPill, ScarcityBadge, ViewersNudge } from "./conversion";
import { IconBed, IconCheck, IconClose, IconLeaf, IconShield, IconSun, IconUsers, IconWave } from "./icons";

// ⚠️ DÉMO (en dur) : Mews n'expose pas d'équipements structurés sur les RoomCategories ici.
// À remplacer par de vraies données équipements en production.
const AMENITIES = [
  { icon: IconWave, label: "Vue lagon / jardin" },
  { icon: IconSun, label: "Terrasse privative" },
  { icon: IconLeaf, label: "Climatisation" },
  { icon: IconCheck, label: "Wi-Fi gratuit" },
];

// Panneau détail qui glisse depuis la DROITE — large, miniatures au-dessus de la
// photo, détails sur 2 colonnes (infos à gauche, tarifs à droite).
export function RoomDetailDrawer({
  room,
  imageBaseUrl,
  search,
  nightsCount,
  onClose,
  onSelectRate,
}: {
  room: ShapedRoom;
  imageBaseUrl: string;
  search: { checkIn: string; checkOut: string; adults: number; children: number };
  nightsCount: number;
  onClose: () => void;
  onSelectRate: (rate: ShapedRate) => void;
}) {
  const [entered, setEntered] = useState(false);
  const [active, setActive] = useState(0);
  const [confirmed, setConfirmed] = useState<Record<string, number>>({});
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => setEntered(true));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    setEntered(false);
    setTimeout(onClose, 240);
  }

  useEffect(() => {
    let alive = true;
    setConfirming(true);
    api
      .pricing({
        checkIn: search.checkIn,
        checkOut: search.checkOut,
        roomCategoryId: room.categoryId,
        adults: search.adults,
        children: search.children,
      })
      .then((res) => {
        if (!alive) return;
        const map: Record<string, number> = {};
        for (const op of res.occupancyPrices ?? [])
          for (const p of op.pricing ?? []) if (p.total?.gross != null) map[p.rateId] = p.total.gross;
        setConfirmed(map);
      })
      .catch(() => void 0)
      .finally(() => alive && setConfirming(false));
    return () => {
      alive = false;
    };
  }, [room.categoryId, search.checkIn, search.checkOut, search.adults, search.children]);

  const images = room.imageIds.length ? room.imageIds : [null];
  const lowStock = room.availableRoomCount > 0 && room.availableRoomCount <= 4;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Détails — ${room.name}`}>
      <div
        onClick={close}
        className={`absolute inset-0 bg-ink/55 transition-opacity duration-300 ${entered ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`absolute right-0 top-0 flex h-full w-full max-w-3xl flex-col bg-cream shadow-float transition-transform duration-300 ease-out ${
          entered ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Contenu défilant */}
        <div className="flex-1 overflow-y-auto">
          {/* Photo principale — miniatures EN OVERLAY (ne prend pas de place en plus) */}
          <div className="relative">
            <Photo
              src={imgUrl(imageBaseUrl, images[active], 1200)}
              alt={`${room.name} — photo ${active + 1}`}
              className="aspect-[16/9] w-full object-cover"
            />
            <span className="absolute left-3 top-3 rounded-full bg-teal-deep/85 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cream">
              {spaceLabel(room.spaceType)}
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="Fermer"
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink shadow-card backdrop-blur transition hover:bg-white"
            >
              <IconClose className="h-5 w-5" />
            </button>
            {images.length > 1 && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/65 via-ink/15 to-transparent p-3">
                <div className="no-scrollbar flex gap-2 overflow-x-auto">
                  {images.map((id, i) => (
                    <button
                      key={`${id}-${i}`}
                      type="button"
                      onClick={() => setActive(i)}
                      aria-label={`Photo ${i + 1}`}
                      className={`h-11 w-14 shrink-0 overflow-hidden rounded-md ring-2 transition ${
                        i === active ? "ring-white" : "ring-white/40 opacity-80 hover:opacity-100"
                      }`}
                    >
                      <Photo src={imgUrl(imageBaseUrl, id, 200)} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Détails sur 2 colonnes */}
          <div className="grid gap-x-7 gap-y-6 px-5 py-5 sm:grid-cols-2 sm:px-6">
            {/* Colonne gauche : infos */}
            <div>
              <h2 className="font-display text-2xl text-ink">{room.name}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-teal-deep/85">
                {room.capacity > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <IconUsers className="h-4 w-4 text-turquoise" /> {room.capacity} pers.
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <IconBed className="h-4 w-4 text-turquoise" /> {room.normalBedCount} lit{room.normalBedCount > 1 ? "s" : ""}
                  {room.extraBedCount > 0 ? ` + ${room.extraBedCount}` : ""}
                </span>
              </div>
              <div className="mt-2">
                <RatingPill score="4,6" count="312" />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <FavoriteBadge />
                {lowStock && <ScarcityBadge count={room.availableRoomCount} />}
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  <IconCheck className="h-3.5 w-3.5" /> 0 € de frais et commission
                </span>
              </div>
              <div className="mt-3">
                <ViewersNudge seed={room.categoryId} />
              </div>

              {room.description && (
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink/75">{room.description}</p>
              )}

              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-teal-deep/60">Équipements</p>
              <ul className="mt-2 grid grid-cols-2 gap-2.5">
                {AMENITIES.map((a) => (
                  <li key={a.label} className="inline-flex items-center gap-2 text-sm text-ink/75">
                    <a.icon className="h-4 w-4 shrink-0 text-turquoise" /> {a.label}
                  </li>
                ))}
              </ul>
            </div>

            {/* Colonne droite : tarifs */}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg text-teal-deep">Choisissez votre tarif</h3>
                <span className="text-[11px] text-ink/45">{confirming ? "Confirmation…" : "Prix en direct"}</span>
              </div>
              <ul className="mt-3 space-y-3">
                {room.rates.map((rate, i) => {
                  const total = confirmed[rate.rateId] ?? rate.totalGross;
                  const best = i === 0;
                  return (
                    <li
                      key={rate.rateId}
                      className={`rounded-2xl border p-4 transition ${best ? "border-turquoise bg-white shadow-card" : "border-ink/10 bg-white/70"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-ink">{rate.name}</p>
                            {best && (
                              <span className="chip bg-turquoise text-white">
                                <IconCheck className="h-3.5 w-3.5" /> Meilleur prix
                              </span>
                            )}
                            {rate.isPrivate && <span className="chip bg-creole/20 text-creole">Tarif privé</span>}
                          </div>
                          {rate.description && <p className="mt-1 text-sm leading-relaxed text-ink/60">{rate.description}</p>}
                          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-teal-deep/70">
                            <IconShield className="h-3.5 w-3.5" />
                            {rate.settlement.isAutomatic ? "Paiement en ligne sécurisé" : "Paiement à l'hôtel"}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          {rate.maxGross != null && <p className="text-xs text-ink/40 line-through">{eur(rate.maxGross)}</p>}
                          <p className="font-display text-2xl text-teal-deep">{eur(total)}</p>
                          {rate.perNightGross != null && (
                            <p className="text-[11px] text-ink/45">
                              {eur(rate.perNightGross)}/nuit · {nightsCount} nuit{nightsCount > 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelectRate({ ...rate, totalGross: total ?? rate.totalGross })}
                        className={`mt-3 w-full ${best ? "btn-primary" : "btn-ghost"}`}
                      >
                        Réserver à ce tarif
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
