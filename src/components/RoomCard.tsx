import { eur, imgUrl } from "../lib/format";
import { spaceLabel } from "../lib/shaping";
import type { ShapedRoom } from "../types/mews";
import { Photo } from "./Photo";
import { IconArrowRight, IconBed, IconUsers } from "./icons";

export function RoomCard({
  room,
  imageBaseUrl,
  nightsCount,
  onChoose,
  onDetails,
}: {
  room: ShapedRoom;
  imageBaseUrl: string;
  nightsCount: number;
  onChoose: () => void;
  onDetails: () => void;
}) {
  const cheapest = room.rates[0];
  const lowStock = room.availableRoomCount > 0 && room.availableRoomCount <= 3;

  return (
    <article className="card group flex flex-col overflow-hidden transition hover:shadow-float sm:flex-row">
      <button
        type="button"
        onClick={onDetails}
        className="relative aspect-[4/3] w-full shrink-0 overflow-hidden sm:aspect-auto sm:w-64"
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
        {room.imageIds.length > 1 && (
          <span className="absolute bottom-3 right-3 rounded-full bg-ink/60 px-2 py-0.5 text-[11px] font-medium text-cream backdrop-blur">
            {room.imageIds.length} photos
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <h3 className="font-display text-xl text-ink">{room.name}</h3>
          {lowStock && (
            <span className="chip bg-creole/15 text-creole">
              Plus que {room.availableRoomCount} dispo
            </span>
          )}
        </div>

        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink/65">
          {room.description || "Un cocon caribéen lumineux, pensé pour le repos et l'art de vivre insulaire."}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-teal-deep/80">
          {room.capacity > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <IconUsers className="h-4 w-4 text-turquoise" /> Jusqu'à {room.capacity} pers.
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <IconBed className="h-4 w-4 text-turquoise" /> {room.normalBedCount} lit
            {room.normalBedCount > 1 ? "s" : ""}
            {room.extraBedCount > 0 ? ` +${room.extraBedCount}` : ""}
          </span>
          <span className="text-ink/40">{room.rates.length} tarif{room.rates.length > 1 ? "s" : ""}</span>
        </div>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink/45">À partir de</p>
            <p className="flex items-baseline gap-2">
              {cheapest?.maxGross != null && (
                <span className="text-sm text-ink/40 line-through">{eur(cheapest.maxGross)}</span>
              )}
              <span className="font-display text-2xl text-teal-deep">{eur(room.fromGross)}</span>
            </p>
            <p className="text-[11px] text-ink/45">
              total · {nightsCount} nuit{nightsCount > 1 ? "s" : ""}
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
