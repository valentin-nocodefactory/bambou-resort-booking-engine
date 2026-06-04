import { useEffect, useState } from "react";
import { useBooking } from "../state/booking";
import { ApiError, api, errorMessage } from "../lib/api";
import { eur, fmtDate, toUtc } from "../lib/format";
import { StepLayout } from "../components/StepLayout";
import { SecureBadge } from "../components/DataBadge";
import { HoldTimer, TrustRow } from "../components/conversion";
import { IconArrowRight, IconCheck, IconShield } from "../components/icons";

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
    guest,
    grandTotal,
    nightsCount,
    setCreated,
    goTo,
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
    try {
      const result = await api.createReservation({
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
            productIds: productIds.length ? productIds : undefined,
            voucherCode: voucherCode || undefined,
            notes: guest.notes.trim() || undefined,
          },
        ],
        returnUrl: `${window.location.origin}/confirmation`,
      });

      setCreated(result);

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
      title="Paiement & confirmation"
      subtitle={onSession ? "Réglez en ligne en toute sécurité." : "Finalisez votre réservation."}
      onBack={() => goTo("extras")}
      backLabel="Retour aux extras"
    >
      <div className="space-y-5">
        {/* Réassurance / urgence */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <HoldTimer minutes={10} />
          <span className="text-xs text-ink/55">Confirmation immédiate · annulation gratuite</span>
        </div>

        {/* Récap final */}
        <div className="card p-5">
          <h2 className="font-display text-lg text-ink">Votre réservation</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Recap label="Hébergement" value={selectedRoom.name} />
            <Recap label="Tarif" value={selectedRate.name} />
            <Recap
              label="Séjour"
              value={`${fmtDate(checkIn)} → ${fmtDate(checkOut)} · ${nightsCount} nuit${nightsCount > 1 ? "s" : ""}`}
            />
            <Recap
              label="Voyageur"
              value={`${guest.firstName} ${guest.lastName}`.trim() || "—"}
            />
          </dl>
        </div>

        {/* Mode de règlement */}
        <div className="rounded-xl2 border border-turquoise/30 bg-turquoise/5 p-5">
          <p className="inline-flex items-center gap-2 font-semibold text-teal-deep">
            <IconShield className="h-5 w-5 text-turquoise" />
            {onSession ? "Paiement en ligne sécurisé" : "Paiement à l'arrivée"}
          </p>
          <p className="mt-1.5 text-sm text-ink/70">
            {onSession
              ? "Vous serez redirigé vers la page de paiement sécurisée hébergée par Mews (carte + 3-D Secure). Votre réservation est confirmée dès le paiement validé."
              : "Aucun paiement en ligne pour ce tarif : votre réservation est enregistrée et réglée directement à l'hôtel."}
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
            J'accepte les{" "}
            {hotel?.TermsAndConditionsUrl ? (
              <a
                href={hotel.TermsAndConditionsUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-turquoise underline underline-offset-2"
              >
                conditions générales
              </a>
            ) : (
              <span className="font-semibold">conditions générales</span>
            )}{" "}
            de vente et la politique d'annulation.
          </span>
        </label>

        {unavailable && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
            <p className="font-medium text-amber-800">
              Cette chambre vient d'être réservée pour ces dates. Relancez une recherche pour voir les
              disponibilités à jour.
            </p>
            <button type="button" onClick={() => goTo("results")} className="btn-primary mt-3">
              Modifier la recherche
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
              "Traitement…"
            ) : onSession ? (
              <>
                Payer {eur(grandTotal)} <IconArrowRight className="h-4 w-4" />
              </>
            ) : (
              <>
                Confirmer la réservation <IconCheck className="h-4 w-4" />
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
