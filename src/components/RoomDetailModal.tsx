import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { eur, imgUrl } from "../lib/format";
import { spaceLabel } from "../lib/shaping";
import type { ShapedRate, ShapedRoom } from "../types/mews";
import { Photo } from "./Photo";
import { IconBed, IconCheck, IconClose, IconShield, IconUsers } from "./icons";

export function RoomDetailModal({
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
  const [active, setActive] = useState(0);
  // Confirmation du prix exact via reservations/getPricing (selon l'occupation choisie).
  const [confirmed, setConfirmed] = useState<Record<string, number>>({});
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

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
        for (const op of res.occupancyPrices ?? []) {
          for (const p of op.pricing ?? []) {
            if (p.total?.gross != null) map[p.rateId] = p.total.gross;
          }
        }
        setConfirmed(map);
      })
      .catch(() => void 0)
      .finally(() => alive && setConfirming(false));
    return () => {
      alive = false;
    };
  }, [room.categoryId, search.checkIn, search.checkOut, search.adults, search.children]);

  const images = room.imageIds.length ? room.imageIds : [null];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Détails — ${room.name}`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-3xl animate-scale-in flex-col overflow-hidden rounded-t-xl2 bg-cream shadow-float sm:rounded-xl2"
      >
        {/* Galerie */}
        <div className="relative">
          <Photo
            src={imgUrl(imageBaseUrl, images[active], 1200)}
            alt={`${room.name} — photo ${active + 1}`}
            className="aspect-[16/10] w-full object-cover sm:aspect-[16/9]"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-cream/90 text-ink shadow-card transition hover:bg-white"
          >
            <IconClose className="h-5 w-5" />
          </button>
          <span className="absolute left-3 top-3 rounded-full bg-teal-deep/85 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cream">
            {spaceLabel(room.spaceType)}
          </span>
        </div>
        {images.length > 1 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
            {images.map((id, i) => (
              <button
                key={`${id}-${i}`}
                type="button"
                onClick={() => setActive(i)}
                className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition ${
                  i === active ? "ring-turquoise" : "ring-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <Photo src={imgUrl(imageBaseUrl, id, 200)} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Contenu défilant */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 sm:px-7">
          <div className="pt-4">
            <h2 className="font-display text-2xl text-ink sm:text-3xl">{room.name}</h2>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-teal-deep/80">
              {room.capacity > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <IconUsers className="h-4 w-4 text-turquoise" /> Jusqu'à {room.capacity} personnes
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <IconBed className="h-4 w-4 text-turquoise" /> {room.normalBedCount} lit
                {room.normalBedCount > 1 ? "s" : ""}
                {room.extraBedCount > 0 ? ` + ${room.extraBedCount} d'appoint` : ""}
              </span>
            </div>
            {room.description && (
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink/75">{room.description}</p>
            )}
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-teal-deep">Choisissez votre tarif</h3>
              <span className="text-[11px] text-ink/45">
                {confirming ? "Confirmation des prix…" : "Prix confirmés en direct"}
              </span>
            </div>

            <ul className="mt-3 space-y-3">
              {room.rates.map((rate, i) => {
                const total = confirmed[rate.rateId] ?? rate.totalGross;
                const best = i === 0;
                return (
                  <li
                    key={rate.rateId}
                    className={`rounded-xl border p-4 transition ${
                      best ? "border-turquoise bg-white shadow-card" : "border-ink/10 bg-white/70"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
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
                        {rate.description && (
                          <p className="mt-1 text-sm leading-relaxed text-ink/60">{rate.description}</p>
                        )}
                        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-teal-deep/70">
                          <IconShield className="h-3.5 w-3.5" />
                          {rate.settlement.isAutomatic ? "Paiement en ligne sécurisé" : "Paiement à l'hôtel"}
                        </p>
                      </div>
                      <div className="text-right">
                        {rate.maxGross != null && (
                          <p className="text-xs text-ink/40 line-through">{eur(rate.maxGross)}</p>
                        )}
                        <p className="font-display text-2xl text-teal-deep">{eur(total)}</p>
                        {rate.perNightGross != null && (
                          <p className="text-[11px] text-ink/45">
                            soit {eur(rate.perNightGross)} / nuit · {nightsCount} nuit
                            {nightsCount > 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectRate({ ...rate, totalGross: total ?? rate.totalGross })}
                      className={`mt-3 w-full ${best ? "btn-primary" : "btn-ghost"}`}
                    >
                      Choisir ce tarif
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
