import { useEffect, useState } from "react";
import { useBooking } from "../state/booking";
import { ApiError, api, errorMessage } from "../lib/api";
import { eur, fmtDate, toUtc } from "../lib/format";
import { StepLayout } from "../components/StepLayout";
import { SecureBadge } from "../components/DataBadge";
import { HoldTimer, TrustRow } from "../components/conversion";
import { IconArrowRight, IconCheck, IconShield } from "../components/icons";
import { t } from "../i18n";

export function Payment() {
  const {
    hotel,
    selectedRoom,
    selectedRate,
    checkIn,
    checkOut,
    adults,
    children,
    voucherCode,
    productIds,
    products,
    guest,
    grandTotal,
    nightsCount,
    setCreated,
    goTo,
    track,
  } = useBooking();

  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!selectedRoom || !selectedRate) goTo("results");
  }, [selectedRoom, selectedRate, goTo]);

  if (!selectedRoom || !selectedRate) return null;

  const onSession = selectedRate.settlement.isAutomatic;

  async function pay() {
    if (!accepted || !selectedRoom || !selectedRate) return;
    setSubmitting(true);
    setError(null);
    setUnavailable(false);
    // Filet de sécurité : ne jamais envoyer un extra d'un autre hébergement que la
    // chambre (Mews refuse → « product invalid »). En pratique déjà filtré en amont.
    const safeProductIds = productIds.filter((id) => {
      const p = products.find((pr) => pr.id === id);
      return !p || !p.property || p.property === selectedRoom.property;
    });
    try {
      const result = await api.createReservation({
        property: selectedRoom.property ?? undefined,
        customer: {
          email: guest.email.trim(),
          firstName: guest.firstName.trim(),
          lastName: guest.lastName.trim(),
          telephone: guest.telephone.trim() || undefined,
          nationalityCode: guest.nationalityCode || undefined,
          sendMarketingEmails: guest.sendMarketingEmails,
        },
        reservations: [
          {
            roomCategoryId: selectedRoom.categoryId,
            startUtc: toUtc(checkIn),
            endUtc: toUtc(checkOut),
            rateId: selectedRate.rateId,
            adults,
            children,
            productIds: safeProductIds.length ? safeProductIds : undefined,
            voucherCode: voucherCode || undefined,
            notes: guest.notes.trim() || undefined,
          },
        ],
        returnUrl: `${window.location.origin}/confirmation`,
      });

      setCreated(result);

      // Panier → « paiement initié ». On await (avant la redirection) pour être sûr
      // que l'event parte. reservationGroupId fourni ici car `created` (contexte)
      // n'est pas encore à jour à cet instant.
      await track("paiement_initie", {
        reservationGroupId: result.id,
        paymentRequestId: result.paymentRequestId ?? null,
      });

      if (result.paymentUrl) {
        // Voie A : redirection vers la page carte + 3DS hébergée par Mews.
        window.location.href = result.paymentUrl;
        return;
      }
      // Pas de paiement en ligne (settlement manuel) → confirmation directe.
      goTo("confirmation");
    } catch (e) {
      if (e instanceof ApiError && e.code === "exceeding_availability") {
        setUnavailable(true);
      } else {
        setError(errorMessage(e));
      }
      setSubmitting(false);
    }
  }

  return (
    <StepLayout
      title={t("payment.title")}
      subtitle={onSession ? t("payment.subtitleOnline") : t("payment.subtitleFinalize")}
      onBack={() => goTo("extras")}
      backLabel={t("payment.backLabel")}
    >
      <div className="space-y-5">
        {/* Réassurance / urgence */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <HoldTimer minutes={10} />
          <span className="text-xs text-ink/55">{t("payment.reassurance")}</span>
        </div>

        {/* Récap final */}
        <div className="card p-5">
          <h2 className="font-display text-lg text-ink">{t("payment.yourBooking")}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Recap label={t("payment.recapAccommodation")} value={selectedRoom.name} />
            <Recap label={t("payment.recapRate")} value={selectedRate.name} />
            <Recap
              label={t("payment.recapStay")}
              value={`${fmtDate(checkIn)} → ${fmtDate(checkOut)} · ${t("payment.nights", { count: nightsCount })}`}
            />
            <Recap
              label={t("payment.recapTraveler")}
              value={`${guest.firstName} ${guest.lastName}`.trim() || "—"}
            />
          </dl>
        </div>

        {/* Mode de règlement */}
        <div className="rounded-xl2 border border-turquoise/30 bg-turquoise/5 p-5">
          <p className="inline-flex items-center gap-2 font-semibold text-teal-deep">
            <IconShield className="h-5 w-5 text-turquoise" />
            {onSession ? t("payment.methodOnlineTitle") : t("payment.methodArrivalTitle")}
          </p>
          <p className="mt-1.5 text-sm text-ink/70">
            {onSession
              ? t("payment.methodOnlineDesc")
              : t("payment.methodArrivalDesc")}
          </p>
        </div>

        {/* CGV */}
        <label className="flex cursor-pointer items-start gap-3 text-sm text-ink/80">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-turquoise"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <span>
            {t("payment.acceptPrefix")}{" "}
            {hotel?.TermsAndConditionsUrl ? (
              <a
                href={hotel.TermsAndConditionsUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-turquoise underline underline-offset-2"
              >
                {t("payment.termsLink")}
              </a>
            ) : (
              <span className="font-semibold">{t("payment.termsLink")}</span>
            )}{" "}
            {t("payment.acceptSuffix")}
          </span>
        </label>

        {unavailable && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
            <p className="font-medium text-amber-800">
              {t("payment.unavailable")}
            </p>
            <button type="button" onClick={() => goTo("results")} className="btn-primary mt-3">
              {t("payment.editSearch")}
            </button>
          </div>
        )}
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        <div className="rounded-xl2 bg-cream/70 p-4">
          <TrustRow compact />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <SecureBadge />
          <button
            type="button"
            onClick={pay}
            disabled={!accepted || submitting}
            className="btn-accent min-w-56 text-base"
          >
            {submitting ? (
              t("payment.processing")
            ) : onSession ? (
              <>
                {t("payment.pay")} {eur(grandTotal)} <IconArrowRight className="h-4 w-4" />
              </>
            ) : (
              <>
                {t("payment.confirmBooking")} <IconCheck className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </StepLayout>
  );
}

function Recap({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink/55">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
