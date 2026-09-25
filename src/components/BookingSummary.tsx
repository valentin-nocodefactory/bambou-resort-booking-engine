import { useBooking } from "../state/booking";
import { money, fmtDate } from "../lib/format";
import { spaceLabel } from "../lib/shaping";
import { qcMeal } from "../lib/quebec";
import { StayBreakdown } from "./StayBreakdown";
import { SavingsLine } from "./conversion";
import { IconBed, IconCalendar, IconCheck, IconLock, IconUsers } from "./icons";
import { t } from "../i18n";

// Récapitulatif sticky : hébergement, tarif, dates, occupants, extras, total.
export function BookingSummary() {
  const { selectedRoom, selectedRate, checkIn, checkOut, nightsCount, adults, children, productsTotal, grandTotal } =
    useBooking();

  const savings =
    selectedRate?.maxGross != null && selectedRate.totalGross != null
      ? Math.max(0, selectedRate.maxGross - selectedRate.totalGross)
      : 0;

  return (
    <aside className="card overflow-hidden">
      <div className="bg-teal-deep px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-creole-soft">{t("summary.yourStay")}</p>
        <p className="mt-0.5 font-display text-lg text-cream">
          {selectedRoom ? selectedRoom.name : t("summary.toCompose")}
        </p>
      </div>

      <div className="space-y-3 px-5 py-4 text-sm">
        {selectedRoom && (
          <Row icon={<IconBed className="h-4 w-4" />} label={spaceLabel(selectedRoom.spaceType)}>
            {selectedRate?.name ? qcMeal(selectedRate.name) : "—"}
          </Row>
        )}
        <Row icon={<IconCalendar className="h-4 w-4" />} label={t("summary.stay")}>
          {checkIn && checkOut ? (
            <>
              {fmtDate(checkIn)} → {fmtDate(checkOut)}
              <span className="text-ink/50">
                {" "}
                · {t("summary.nights", { count: nightsCount })}
              </span>
            </>
          ) : (
            "—"
          )}
        </Row>
        <Row icon={<IconUsers className="h-4 w-4" />} label={t("summary.travelers")}>
          {t("summary.guests", { adults, children })}
        </Row>
      </div>

      {/* Détail du prix — IDENTIQUE au récap de la dernière étape (même composant
          StayBreakdown → toujours synchronisé en live) : hébergement, repas inclus,
          suppléments réveillon, extras, taxe de séjour. Le total est porté par le pied. */}
      <div className="border-t border-ink/10 px-5 py-4">
        {selectedRoom && selectedRate ? (
          <StayBreakdown hideTotal />
        ) : (
          <p className="text-sm text-ink/50">{t("summary.selectPrompt")}</p>
        )}
      </div>

      <div className="flex items-end justify-between border-t border-ink/10 bg-cream/60 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-deep/70">{t("summary.total")}</p>
          <p className="text-[11px] text-ink/50">{t("summary.taxesIncluded")}{productsTotal > 0 ? t("summary.extrasNote", { amount: money(productsTotal) }) : ""}</p>
        </div>
        <p className="font-display text-2xl text-teal-deep">{grandTotal > 0 ? money(grandTotal) : "—"}</p>
      </div>

      {savings > 0 && (
        <div className="border-t border-ink/10 px-5 py-2.5">
          <SavingsLine amount={savings} />
        </div>
      )}

      <ul className="space-y-1.5 border-t border-ink/10 px-5 py-4 text-xs text-ink/60">
        <li className="inline-flex items-center gap-2">
          <IconCheck className="h-3.5 w-3.5 text-emerald-600" /> {t("summary.noFees")}
        </li>
        <li className="inline-flex items-center gap-2">
          <IconLock className="h-3.5 w-3.5 text-turquoise" /> {t("summary.securePayment")}
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
