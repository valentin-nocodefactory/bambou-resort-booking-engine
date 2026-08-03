import { productLineTotal, useBooking } from "../state/booking";
import { eur, fmtDate } from "../lib/format";
import { chargingLabel, spaceLabel } from "../lib/shaping";
import { SavingsLine } from "./conversion";
import { IconBed, IconCalendar, IconCheck, IconLock, IconUsers } from "./icons";

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

  const savings =
    selectedRate?.maxGross != null && selectedRate.totalGross != null
      ? Math.max(0, selectedRate.maxGross - selectedRate.totalGross)
      : 0;

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
          <p className="text-[11px] text-ink/50">taxes incluses{productsTotal > 0 ? ` · dont ${eur(productsTotal)} d'extras` : ""}</p>
        </div>
        <p className="font-display text-2xl text-teal-deep">{grandTotal > 0 ? eur(grandTotal) : "—"}</p>
      </div>

      {savings > 0 && (
        <div className="border-t border-ink/10 px-5 py-2.5">
          <SavingsLine amount={savings} />
        </div>
      )}

      <ul className="space-y-1.5 border-t border-ink/10 px-5 py-4 text-xs text-ink/60">
        <li className="inline-flex items-center gap-2">
          <IconCheck className="h-3.5 w-3.5 text-emerald-600" /> 0 € de frais et commission
        </li>
        <li className="inline-flex items-center gap-2">
          <IconLock className="h-3.5 w-3.5 text-turquoise" /> Paiement sécurisé · 3-D Secure
        </li>
      </ul>
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
