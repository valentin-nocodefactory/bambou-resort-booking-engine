import { useCallback, useEffect, useRef, useState } from "react";
import { useBooking } from "../state/booking";
import { api, errorMessage } from "../lib/api";
import { eur, fmtDate } from "../lib/format";
import type { ReservationStatusResult } from "../types/mews";
import { Brand } from "../components/Brand";
import { IconArrowRight, IconCalendar, IconCheck, IconShield } from "../components/icons";
import { t } from "../i18n";

const MAX_POLLS = 5;

// Réservation de la navette aéroport : plateforme EXTERNE (SimplyBook), hors Mews.
// Lien sortant proposé sur l'écran de confirmation une fois la réservation validée.
const SHUTTLE_BOOKING_URL = "https://transfertshbambou.simplybook.me/v2/";

export function Confirmation() {
  const { rgid, created, checkIn, checkOut, guest, grandTotal, selectedRate, airportTransfer, resetAll, goTo, track } =
    useBooking();

  const [status, setStatus] = useState<ReservationStatusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);
  const polls = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const groupId = rgid ?? created?.id ?? null;

  const loadStatus = useCallback(
    async (poll = false) => {
      if (!groupId) return;
      if (!poll) setLoading(true);
      try {
        const s = await api.reservationStatus(groupId);
        setStatus(s);
        setError(null);
        // Re-poll tant que ni payé ni en échec final, dans la limite.
        if (!s.paid && !s.finalFailure && s.paymentRequests.length > 0 && polls.current < MAX_POLLS) {
          polls.current += 1;
          timer.current = setTimeout(() => loadStatus(true), 2500);
        }
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [groupId],
  );

  useEffect(() => {
    if (!groupId) {
      goTo("dates");
      return;
    }
    loadStatus();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [groupId, loadStatus, goTo]);

  // Panier → « paiement validé » (une seule fois) dès que Mews confirme le paiement.
  const paidSent = useRef(false);
  useEffect(() => {
    if (status?.paid && !paidSent.current) {
      paidSent.current = true;
      void track("paiement_valide", { reservationGroupId: groupId ?? undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.paid]);

  async function resumePayment() {
    if (!groupId) return;
    setResuming(true);
    try {
      const r = await api.paymentLink(groupId, `${window.location.origin}/confirmation`);
      if (r.paymentUrl) {
        window.location.href = r.paymentUrl;
        return;
      }
      polls.current = 0;
      await loadStatus();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setResuming(false);
    }
  }

  const numbers = (status?.reservations ?? created?.reservations ?? [])
    .map((r) => r.number)
    .filter(Boolean);
  const hasPayment = (status?.paymentRequests.length ?? 0) > 0;
  const paid = status?.paid ?? false;
  const pending = hasPayment && !paid && !status?.finalFailure;
  const failed = status?.finalFailure ?? false;

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <div className="card overflow-hidden">
        <div className={`px-6 py-8 text-center ${paid || (!hasPayment && status) ? "bg-teal-deep" : "bg-teal-deep/90"}`}>
          <Brand className="justify-center text-cream" />
          {loading ? (
            <Spinner />
          ) : paid ? (
            <Badge tone="success" title={t("confirmation.confirmedTitle")} sub={t("confirmation.paidSub")} />
          ) : pending ? (
            <Badge tone="pending" title={t("confirmation.pendingTitle")} sub={t("confirmation.pendingSub")} />
          ) : failed ? (
            <Badge tone="warn" title={t("confirmation.failedTitle")} sub={t("confirmation.failedSub")} />
          ) : (
            <Badge tone="success" title={t("confirmation.confirmedTitle")} sub={t("confirmation.arrivalSub")} />
          )}
        </div>

        <div className="space-y-4 p-6">
          {!loading && numbers.length > 0 && (
            <div className="rounded-xl bg-cream/70 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-deep/70">
                {t("confirmation.confirmationNumber", { count: numbers.length })}
              </p>
              <p className="mt-1 font-display text-2xl text-ink">{numbers.join(" · ")}</p>
            </div>
          )}

          <div className="space-y-2 text-sm">
            {checkIn && checkOut && (
              <Line icon={<IconCalendar className="h-4 w-4" />} label={t("confirmation.stay")}>
                {fmtDate(checkIn)} → {fmtDate(checkOut)}
              </Line>
            )}
            {guest.email && <Line label={t("confirmation.travelerEmail")}>{guest.email}</Line>}
            {selectedRate && grandTotal > 0 && <Line label={t("confirmation.total")}>{eur(grandTotal)}</Line>}
            {created?.totalAmount?.gross != null && !selectedRate && (
              <Line label={t("confirmation.total")}>{eur(created.totalAmount.gross)}</Line>
            )}
          </div>

          {/* Navette aéroport — lien SORTANT (plateforme externe SimplyBook), affiché
              UNIQUEMENT si le client a coché « transfert aéroport », une fois la résa confirmée. */}
          {airportTransfer && !loading && !pending && !failed && (
            <div className="rounded-xl border border-turquoise/30 bg-turquoise/5 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-turquoise/15 text-xl" aria-hidden>
                  ✈️
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-teal-deep">{t("confirmation.shuttleTitle")}</p>
                  <p className="mt-0.5 text-sm text-ink/60">{t("confirmation.shuttleBody")}</p>
                  <a
                    href={SHUTTLE_BOOKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary mt-3 inline-flex"
                  >
                    {t("confirmation.shuttleCta")} <IconArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          {(pending || failed) && (
            <div className="rounded-xl border border-turquoise/30 bg-turquoise/5 p-4">
              <p className="inline-flex items-center gap-2 text-sm font-medium text-teal-deep">
                <IconShield className="h-4 w-4 text-turquoise" />
                {pending
                  ? t("confirmation.pendingNote")
                  : t("confirmation.failedNote")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={resumePayment} disabled={resuming} className="btn-primary">
                  {resuming ? t("confirmation.redirecting") : t("confirmation.resumePayment")} <IconArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    polls.current = 0;
                    loadStatus();
                  }}
                  className="btn-ghost"
                >
                  {t("confirmation.refreshStatus")}
                </button>
              </div>
            </div>
          )}

          {paid && (
            <p className="flex items-center justify-center gap-2 text-sm text-teal-deep">
              <IconCheck className="h-4 w-4" /> {t("confirmation.keepNumber")}
            </p>
          )}

          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => {
                resetAll();
                goTo("dates");
              }}
              className="btn-link"
            >
              {t("confirmation.newSearch")}
            </button>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-ink/45">
        {t("confirmation.footer")}
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="mt-5 flex flex-col items-center gap-3">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-cream/30 border-t-creole" />
      <p className="text-sm text-cream/80">{t("confirmation.verifyingPayment")}</p>
    </div>
  );
}

function Badge({ tone, title, sub }: { tone: "success" | "pending" | "warn"; title: string; sub: string }) {
  const ring =
    tone === "success" ? "bg-turquoise text-white" : tone === "pending" ? "bg-creole text-ink" : "bg-amber-400 text-ink";
  return (
    <div className="mt-5 flex flex-col items-center gap-3">
      <span className={`grid h-16 w-16 place-items-center rounded-full ${ring} shadow-float`}>
        {tone === "success" ? <IconCheck className="h-9 w-9" /> : <IconShield className="h-8 w-8" />}
      </span>
      <div>
        <h1 className="font-display text-2xl text-cream sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-cream/80">{sub}</p>
      </div>
    </div>
  );
}

function Line({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-ink/5 pb-2 last:border-0">
      <span className="inline-flex items-center gap-1.5 text-ink/55">
        {icon && <span className="text-turquoise">{icon}</span>}
        {label}
      </span>
      <span className="text-right font-medium text-ink">{children}</span>
    </div>
  );
}
