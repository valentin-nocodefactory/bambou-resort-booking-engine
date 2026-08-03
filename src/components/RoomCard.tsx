import { eur, imgUrl } from "../lib/format";
import { spaceLabel } from "../lib/shaping";
import type { ShapedRoom } from "../types/mews";
import { Photo } from "./Photo";
import { FavoriteBadge, HotBadge, RatingPill, SavingsBadge, ScarcityBadge, ViewersNudge, seeded } from "./conversion";
import { IconArrowRight, IconBed, IconCheck, IconUsers } from "./icons";

export function RoomCard({
  room,
  imageBaseUrl,
  nightsCount,
  featured = false,
  onChoose,
  onDetails,
}: {
  room: ShapedRoom;
  imageBaseUrl: string;
  nightsCount: number;
  featured?: boolean;
  onChoose: () => void;
  onDetails: () => void;
}) {
  const cheapest = room.rates[0];
  // RÉEL (Mews) : AvailableRoomCount → « Plus que N chambres ».
  const lowStock = room.availableRoomCount > 0 && room.availableRoomCount <= 3;
  // ⚠️ DÉMO (en dur) : « Très demandé », note & nombre d'avis — générés, pas issus de Mews.
  const hot = !lowStock && seeded(room.categoryId, 0, 2) === 0;
  const rating = (40 + seeded(room.categoryId + "r", 0, 9)) / 10; // 4.0–4.9 (échelle /5)
  const reviews = seeded(room.categoryId + "rc", 64, 540);

  return (
    <article className="card group flex flex-col overflow-hidden transition hover:shadow-float sm:flex-row">
      <button
        type="button"
        onClick={onDetails}
        className="relative h-44 w-full shrink-0 overflow-hidden sm:h-auto sm:w-72"
        aria-label={`Voir les photos — ${room.name}`}
      >
        <Photo
          src={imgUrl(imageBaseUrl, room.imageIds[0], 800)}
          alt={room.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3 rounded-full bg-teal-deep/85 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-cream backdrop-blur">
          {spaceLabel(room.spaceType)}
        </span>
        {featured && (
          <span className="absolute bottom-3 left-3">
            <FavoriteBadge />
          </span>
        )}
        {room.imageIds.length > 1 && (
          <span className="absolute bottom-3 right-3 rounded-full bg-ink/55 px-2 py-0.5 text-[11px] font-medium text-cream backdrop-blur">
            {room.imageIds.length} photos
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
          <div className="min-w-0">
            <h3 className="font-display text-xl text-ink">{room.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-teal-deep/80">
              <RatingPill score={rating.toFixed(1).replace(".", ",")} count={String(reviews)} className="text-xs" />
              {room.capacity > 0 && (
                <span className="inline-flex items-center gap-1">
                  <IconUsers className="h-3.5 w-3.5 text-turquoise" /> {room.capacity} pers.
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <IconBed className="h-3.5 w-3.5 text-turquoise" /> {room.normalBedCount} lit{room.normalBedCount > 1 ? "s" : ""}
                {room.extraBedCount > 0 ? ` +${room.extraBedCount}` : ""}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {lowStock && <ScarcityBadge count={room.availableRoomCount} />}
            {hot && <HotBadge />}
          </div>
        </div>

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink/65">
          {room.description || "Un cocon caribéen lumineux, pensé pour le repos et l'art de vivre insulaire."}
        </p>

        <div className="mt-2.5">
          <ViewersNudge seed={room.categoryId} />
        </div>

        <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          <IconCheck className="h-3.5 w-3.5" /> 0 € de frais et commission
        </span>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4">
          <div>
            <div className="flex items-center gap-2">
              {cheapest?.maxGross != null && <span className="text-sm text-ink/40 line-through">{eur(cheapest.maxGross)}</span>}
              <SavingsBadge from={room.fromGross} max={cheapest?.maxGross ?? null} />
            </div>
            <p className="flex items-baseline gap-1.5">
              <span className="text-[11px] uppercase tracking-wide text-ink/45">dès</span>
              <span className="font-display text-2xl text-teal-deep">{eur(room.fromGross)}</span>
            </p>
            <p className="text-[11px] text-ink/45">
              total · {nightsCount} nuit{nightsCount > 1 ? "s" : ""} · {room.rates.length} tarif{room.rates.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onDetails} className="btn-ghost">
              Voir le détail
            </button>
            <button type="button" onClick={onChoose} className="btn-primary">
              Choisir <IconArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
