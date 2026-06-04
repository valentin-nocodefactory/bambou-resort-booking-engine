import { productLineTotal, useBooking } from "../state/booking";
import { eur, fmtDate } from "../lib/format";
import { chargingLabel, spaceLabel } from "../lib/shaping";
import { IconBed, IconCalendar, IconUsers } from "./icons";

// Récapitulatif sticky : hébergement, tarif, dates, occupants, extras, total.
export function BookingSummary() {
  const {
    selectedRoom,
    selectedRate,
    checkIn,
    checkOut,
    nightsCount,
    adults,
    children,
    guestsCount,
    selectedProducts,
    roomTotal,
    productsTotal,
    grandTotal,
  } = useBooking();

  return (
    <aside className="card overflow-hidden">
      <div className="bg-teal-deep px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-creole-soft">Votre séjour</p>
        <p className="mt-0.5 font-display text-lg text-cream">
          {selectedRoom ? selectedRoom.name : "À composer"}
        </p>
      </div>

      <div className="space-y-3 px-5 py-4 text-sm">
        {selectedRoom && (
          <Row icon={<IconBed className="h-4 w-4" />} label={spaceLabel(selectedRoom.spaceType)}>
            {selectedRate?.name ?? "—"}
          </Row>
        )}
        <Row icon={<IconCalendar className="h-4 w-4" />} label="Séjour">
          {checkIn && checkOut ? (
            <>
              {fmtDate(checkIn)} → {fmtDate(checkOut)}
              <span className="text-ink/50">
                {" "}
                · {nightsCount} nuit{nightsCount > 1 ? "s" : ""}
              </span>
            </>
          ) : (
            "—"
          )}
        </Row>
        <Row icon={<IconUsers className="h-4 w-4" />} label="Voyageurs">
          {adults} adulte{adults > 1 ? "s" : ""}
          {children > 0 ? `, ${children} enfant${children > 1 ? "s" : ""}` : ""}
        </Row>
      </div>

      <div className="border-t border-ink/10 px-5 py-4 text-sm">
        {selectedRate && (
          <Line label={`Hébergement · ${nightsCount} nuit${nightsCount > 1 ? "s" : ""}`} value={eur(roomTotal)} />
        )}
        {selectedProducts.map((p) => (
          <Line
            key={p.id}
            label={
              <>
                {p.name}
                {chargingLabel(p.chargingMode) ? (
                  <span className="text-ink/45"> · {chargingLabel(p.chargingMode)}</span>
                ) : null}
              </>
            }
            value={eur(productLineTotal(p, nightsCount, guestsCount))}
          />
        ))}
        {!selectedRate && !selectedProducts.length && (
          <p className="text-ink/50">Sélectionnez un hébergement pour voir le détail.</p>
        )}
      </div>

      <div className="flex items-end justify-between border-t border-ink/10 bg-cream/60 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-deep/70">Total</p>
          <p className="text-[11px] text-ink/50">taxes incluses</p>
        </div>
        <p className="font-display text-2xl text-teal-deep">{grandTotal > 0 ? eur(grandTotal) : "—"}</p>
      </div>

      {productsTotal > 0 && (
        <p className="px-5 pb-4 text-[11px] text-ink/45">Dont {eur(productsTotal)} d'extras.</p>
      )}
    </aside>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-turquoise">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-deep/60">{label}</p>
        <p className="text-ink">{children}</p>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-ink/75">{label}</span>
      <span className="shrink-0 font-semibold text-ink">{value}</span>
    </div>
  );
}
