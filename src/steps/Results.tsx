import { useEffect, useMemo, useState } from "react";
import { useBooking } from "../state/booking";
import { api, errorMessage } from "../lib/api";
import { fmtDate } from "../lib/format";
import { buildRooms } from "../lib/shaping";
import type { AvailabilityResponse, ShapedRate, ShapedRoom } from "../types/mews";
import { RoomCard } from "../components/RoomCard";
import { RoomDetailDrawer } from "../components/RoomDetailDrawer";
import { InlineUpsell } from "../components/UpsellCard";
import { RatingPill, UrgencyBanner } from "../components/conversion";
import { IconCalendar, IconUsers } from "../components/icons";

export function Results() {
  const {
    hotel,
    imageBaseUrl,
    products,
    checkIn,
    checkOut,
    adults,
    children,
    voucherCode,
    nightsCount,
    roomId,
    rateId,
    selectedRoom,
    selectRoomRate,
    hydrateSelection,
    setAvailableRooms,
    toggleProduct,
    productIds,
    goTo,
  } = useBooking();

  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openRoom, setOpenRoom] = useState<ShapedRoom | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Garde-fou : pas de dates → retour à l'écran de recherche.
  useEffect(() => {
    if (!checkIn || !checkOut) goTo("dates");
  }, [checkIn, checkOut, goTo]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .availability({ checkIn, checkOut, adults, children, voucherCode })
      .then((res) => alive && setData(res))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [checkIn, checkOut, adults, children, voucherCode, reloadKey]);

  const rooms = useMemo(() => (data ? buildRooms(data, hotel) : []), [data, hotel]);

  // Publie la liste pour l'étape de surclassement (upsell chambre après Guest).
  useEffect(() => {
    if (rooms.length) setAvailableRooms(rooms);
  }, [rooms, setAvailableRooms]);

  // Réhydrate la sélection depuis l'URL (lien partagé / retour arrière).
  useEffect(() => {
    if (!selectedRoom && roomId && rooms.length) {
      const room = rooms.find((r) => r.categoryId === roomId);
      const rate = room?.rates.find((rt) => rt.rateId === rateId) ?? room?.rates[0] ?? null;
      if (room && rate) hydrateSelection(room, rate);
    }
  }, [rooms, roomId, rateId, selectedRoom, hydrateSelection]);

  const search = { checkIn, checkOut, adults, children };

  function choose(room: ShapedRoom, rate: ShapedRate) {
    selectRoomRate(room, rate);
    setOpenRoom(null);
    goTo("guest");
  }

  const inlineProduct = products[0];

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      {/* Barre de recherche / résumé */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl2 border border-ink/10 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink/80">
          <span className="inline-flex items-center gap-1.5">
            <IconCalendar className="h-4 w-4 text-turquoise" />
            {fmtDate(checkIn)} → {fmtDate(checkOut)}
            <span className="text-ink/45">
              · {nightsCount} nuit{nightsCount > 1 ? "s" : ""}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IconUsers className="h-4 w-4 text-turquoise" />
            {adults} adulte{adults > 1 ? "s" : ""}
            {children > 0 ? `, ${children} enfant${children > 1 ? "s" : ""}` : ""}
          </span>
        </div>
        <button type="button" onClick={() => goTo("dates")} className="btn-link">
          Modifier la recherche
        </button>
      </div>

      {!loading && !error && rooms.length > 0 && (
        <div className="mt-5">
          <UrgencyBanner />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink sm:text-3xl">
            {rooms.length > 0 ? `${rooms.length} hébergement${rooms.length > 1 ? "s" : ""} disponible${rooms.length > 1 ? "s" : ""}` : "Nos hébergements"}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink/55">
            <RatingPill />
            <span>Choisissez votre cocon, comparez les tarifs.</span>
          </div>
        </div>
      </div>

      {/* États */}
      {loading && <SkeletonList />}

      {!loading && error && <ErrorBox message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

      {!loading && !error && rooms.length === 0 && (
        <EmptyBox onModify={() => goTo("dates")} />
      )}

      {!loading && !error && rooms.length > 0 && (
        <div className="mt-5 space-y-4">
          {rooms.map((room, i) => (
            <div key={room.categoryId} className="space-y-4">
              <RoomCard
                room={room}
                imageBaseUrl={imageBaseUrl}
                nightsCount={nightsCount}
                featured={i === 0}
                onChoose={() => choose(room, room.rates[0])}
                onDetails={() => setOpenRoom(room)}
              />
              {/* Suggestion d'upsell inline après la 1re carte */}
              {i === 0 && inlineProduct && (
                <InlineUpsell
                  product={inlineProduct}
                  added={productIds.includes(inlineProduct.id)}
                  onToggle={() => toggleProduct(inlineProduct.id)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {openRoom && (
        <RoomDetailDrawer
          room={openRoom}
          imageBaseUrl={imageBaseUrl}
          search={search}
          nightsCount={nightsCount}
          onClose={() => setOpenRoom(null)}
          onSelectRate={(rate) => choose(openRoom, rate)}
        />
      )}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="mt-5 space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card flex animate-pulse flex-col overflow-hidden sm:flex-row">
          <div className="aspect-[4/3] w-full bg-sand sm:aspect-auto sm:w-64" />
          <div className="flex-1 space-y-3 p-5">
            <div className="h-5 w-1/3 rounded bg-sand" />
            <div className="h-3 w-3/4 rounded bg-sand/70" />
            <div className="h-3 w-2/3 rounded bg-sand/70" />
            <div className="mt-6 h-9 w-40 rounded-full bg-sand" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-6 rounded-xl2 border border-red-200 bg-red-50 p-6 text-center">
      <p className="font-medium text-red-700">{message}</p>
      <button type="button" onClick={onRetry} className="btn-primary mt-4">
        Réessayer
      </button>
    </div>
  );
}

function EmptyBox({ onModify }: { onModify: () => void }) {
  return (
    <div className="mt-6 rounded-xl2 border border-ink/10 bg-white p-10 text-center shadow-card">
      <p className="font-display text-xl text-ink">Aucune disponibilité pour ces dates</p>
      <p className="mt-2 text-sm text-ink/60">
        Essayez d'autres dates ou ajustez le nombre de voyageurs — nos plus beaux bungalows partent vite.
      </p>
      <button type="button" onClick={onModify} className="btn-primary mt-5">
        Modifier la recherche
      </button>
    </div>
  );
}
