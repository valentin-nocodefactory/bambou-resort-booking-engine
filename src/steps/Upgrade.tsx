import { useEffect, useMemo, useState } from "react";
import { useBooking } from "../state/booking";
import { eur, imgUrl } from "../lib/format";
import { spaceLabel, upgradeBenefits, upgradeRooms } from "../lib/shaping";
import { StepLayout } from "../components/StepLayout";
import { Photo } from "../components/Photo";
import { IconArrowRight, IconBed, IconCheck, IconSparkles, IconUsers } from "../components/icons";

// Étape de surclassement (upsell chambre) — proposée APRÈS les infos client.
// On part du choix initial (le moins cher si l'utilisateur a cliqué « Choisir »)
// et on propose les chambres plus haut de gamme avec leur différentiel de prix.
export function Upgrade() {
  const { availableRooms, selectedRoom, selectedRate, selectRoomRate, imageBaseUrl, nightsCount, goTo } = useBooking();

  useEffect(() => {
    if (!selectedRoom || !selectedRate) goTo("results");
  }, [selectedRoom, selectedRate, goTo]);

  // Base figée à l'entrée de l'étape (pour que la liste ne change pas en sélectionnant).
  const [base] = useState(() => ({
    room: selectedRoom,
    rate: selectedRate,
    total: selectedRate?.totalGross ?? selectedRoom?.fromGross ?? 0,
  }));

  const ups = useMemo(
    () => upgradeRooms(availableRooms, base.room, base.total),
    [availableRooms, base],
  );

  if (!selectedRoom || !selectedRate || !base.room) return null;

  const upgraded = selectedRoom.categoryId !== base.room.categoryId;

  return (
    <StepLayout
      title="Surclassez votre séjour"
      subtitle="Pour quelques euros de plus, offrez-vous un cadre encore plus exceptionnel."
      onBack={() => goTo("guest")}
      backLabel="Retour aux informations"
    >
      <div className="space-y-5">
        {/* Choix courant */}
        <div className="flex items-center gap-3 rounded-xl2 border border-ink/10 bg-white p-3.5">
          <Photo
            src={imgUrl(imageBaseUrl, selectedRoom.imageIds[0], 200)}
            alt={selectedRoom.name}
            className="h-14 w-16 shrink-0 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-deep/60">Votre choix actuel</p>
            <p className="truncate font-medium text-ink">{selectedRoom.name}</p>
            <p className="text-xs text-ink/50">{selectedRate.name}</p>
          </div>
          <p className="shrink-0 font-display text-lg text-teal-deep">{eur(selectedRate.totalGross)}</p>
        </div>

        {ups.length === 0 ? (
          <div className="card p-8 text-center">
            <IconCheck className="mx-auto h-8 w-8 text-emerald-500" />
            <p className="mt-2 font-display text-lg text-ink">Vous avez déjà l'un de nos plus beaux hébergements</p>
            <p className="mt-1 text-sm text-ink/60">Aucun surclassement supérieur disponible pour ces dates.</p>
          </div>
        ) : (
          <>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-creole">
              <IconSparkles className="h-4 w-4" /> {ups.length} surclassement{ups.length > 1 ? "s" : ""} disponible
              {ups.length > 1 ? "s" : ""}
            </p>

            <div className="space-y-4">
              {ups.map((room) => {
                const diff = (room.fromGross ?? 0) - base.total;
                const isSelected = selectedRoom.categoryId === room.categoryId;
                const benefits = upgradeBenefits(base.room!, room);
                return (
                  <article
                    key={room.categoryId}
                    className={`card flex flex-col overflow-hidden transition sm:flex-row ${
                      isSelected ? "ring-2 ring-turquoise" : "hover:shadow-float"
                    }`}
                  >
                    <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden sm:aspect-auto sm:w-56">
                      <Photo src={imgUrl(imageBaseUrl, room.imageIds[0], 600)} alt={room.name} className="h-full w-full object-cover" />
                      <span className="absolute left-3 top-3 rounded-full bg-teal-deep/85 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-cream">
                        {spaceLabel(room.spaceType)}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-display text-xl text-ink">{room.name}</h3>
                        <div className="shrink-0 text-right">
                          <p className="font-display text-xl text-creole">+{eur(diff)}</p>
                          <p className="text-[11px] text-ink/45">/ séjour</p>
                        </div>
                      </div>
                      <ul className="mt-2 space-y-1.5">
                        {benefits.map((b) => (
                          <li key={b} className="inline-flex items-center gap-2 text-sm text-ink/75">
                            <IconCheck className="h-4 w-4 shrink-0 text-turquoise" /> {b}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-teal-deep/75">
                        <span className="inline-flex items-center gap-1">
                          <IconUsers className="h-3.5 w-3.5 text-turquoise" /> {room.capacity} pers.
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <IconBed className="h-3.5 w-3.5 text-turquoise" /> {room.normalBedCount} lit{room.normalBedCount > 1 ? "s" : ""}
                          {room.extraBedCount > 0 ? ` +${room.extraBedCount}` : ""}
                        </span>
                        <span className="text-ink/40">soit {eur(room.fromGross)} · {nightsCount} nuit{nightsCount > 1 ? "s" : ""}</span>
                      </div>
                      <div className="mt-auto pt-4">
                        {isSelected ? (
                          <button
                            type="button"
                            onClick={() => base.room && base.rate && selectRoomRate(base.room, base.rate)}
                            className="btn-ghost w-full"
                          >
                            <IconCheck className="h-4 w-4" /> Surclassement sélectionné · retirer
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => selectRoomRate(room, room.rates[0])}
                            className="btn-accent w-full"
                          >
                            Surclasser pour +{eur(diff)} <IconArrowRight className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        <div className="flex flex-col-reverse items-center justify-between gap-3 pt-2 sm:flex-row">
          <button type="button" onClick={() => goTo("extras")} className="btn-link">
            {upgraded ? "Continuer avec ce surclassement" : "Non merci, garder ma chambre"}
          </button>
          <button type="button" onClick={() => goTo("extras")} className="btn-primary w-full sm:w-auto">
            Continuer vers les extras <IconArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </StepLayout>
  );
}
