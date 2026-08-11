import { useEffect, useMemo } from "react";
import { useBooking } from "../state/booking";
import { t } from "../i18n";
import { eur } from "../lib/format";
import { groupProducts, upgradeRooms, isHotelIncludedMeal } from "../lib/shaping";
import { StepLayout } from "../components/StepLayout";
import { UpsellCard } from "../components/UpsellCard";
import { DataBadge } from "../components/DataBadge";
import { IconArrowRight, IconCheck, IconSparkles } from "../components/icons";

export function Extras() {
  const {
    products,
    productIds,
    toggleProduct,
    airportTransfer,
    setAirportTransfer,
    imageBaseUrl,
    nightsCount,
    guestsCount,
    selectedRoom,
    selectedRate,
    availableRooms,
    grandTotal,
    goTo,
  } = useBooking();

  useEffect(() => {
    if (!selectedRoom || !selectedRate) goTo("results");
  }, [selectedRoom, selectedRate, goTo]);

  // On n'affiche QUE les extras de l'hébergement de la chambre choisie (step 2) :
  // un produit d'une autre config Mews est refusé à la réservation. De plus, à l'Hôtel
  // Bambou (demi-pension incluse), on masque les extras petit-déjeuner / dîner redondants
  // — sauf le petit-déjeuner flottant. Culture Créole & Villas montrent tout.
  const groups = useMemo(() => {
    const isHotel = selectedRoom?.property === "hotel";
    const visible = products.filter(
      (p) => (!p.property || p.property === selectedRoom?.property) && !(isHotel && isHotelIncludedMeal(p)),
    );
    return groupProducts(visible);
  }, [products, selectedRoom]);

  // Retour : vers le surclassement s'il y en avait, sinon vers les infos.
  const currentTotal = selectedRate?.totalGross ?? selectedRoom?.fromGross ?? 0;
  const back = upgradeRooms(availableRooms, selectedRoom, currentTotal).length > 0 ? "upgrade" : "guest";

  return (
    <StepLayout
      title={t("extras.title")}
      subtitle={t("extras.subtitle")}
      onBack={() => goTo(back)}
      backLabel={t("extras.backLabel")}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="inline-flex items-center gap-2 text-sm text-ink/60">
            <IconSparkles className="h-4 w-4 text-creole" />
            {productIds.length > 0
              ? t("extras.selectedCount", { count: productIds.length })
              : t("extras.optional")}
          </p>
          <DataBadge label="Extras · Mews" />
        </div>

        {/* Service Bambou (HORS Mews) : simple case à cocher « transfert aéroport ».
            N'entre pas dans le total ni la résa Mews — booléen envoyé à n8n (relance). */}
        <section>
          <div className="mb-3 flex items-center gap-3">
            <span className="h-5 w-1 rounded-full bg-turquoise" />
            <h2 className="font-display text-lg text-teal-deep">{t("extras.serviceSection")}</h2>
          </div>
          <button
            type="button"
            onClick={() => setAirportTransfer(!airportTransfer)}
            aria-pressed={airportTransfer}
            className={`flex w-full items-start gap-3 rounded-xl2 border p-4 text-left transition ${
              airportTransfer
                ? "border-turquoise bg-turquoise/5 ring-1 ring-turquoise"
                : "border-ink/12 bg-white hover:border-turquoise/60"
            }`}
          >
            <span
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                airportTransfer ? "border-turquoise bg-turquoise text-white" : "border-ink/25 text-transparent"
              }`}
            >
              <IconCheck className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-xl leading-none" aria-hidden>
                  ✈️
                </span>
                <span className="font-semibold text-marine">{t("extras.transferTitle")}</span>
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-ink/60">{t("extras.transferDesc")}</span>
            </span>
            <span className="shrink-0 rounded-full bg-cream px-2 py-0.5 text-[11px] font-medium text-teal-deep/70">
              {t("extras.transferBadge")}
            </span>
          </button>
        </section>

        {groups.length > 0 ? (
          <div className="space-y-7">
            {groups.map((g) => (
              <section key={g.key}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="h-5 w-1 rounded-full bg-creole" />
                  <h2 className="font-display text-lg text-teal-deep">{g.label}</h2>
                  <span className="text-xs text-ink/40">
                    {t("extras.optionCount", { count: g.items.length })}
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {g.items.map((p) => (
                    <UpsellCard
                      key={p.id}
                      product={p}
                      imageBaseUrl={imageBaseUrl}
                      selected={productIds.includes(p.id)}
                      nightsCount={nightsCount}
                      guestsCount={guestsCount}
                      onToggle={() => toggleProduct(p.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="card p-8 text-center text-sm text-ink/60">
            {t("extras.none")}
          </div>
        )}

        {/* Barre d'action collante : toujours visible sans scroller */}
        <div className="sticky bottom-0 z-20 mt-2 border-t border-ink/10 bg-cream/95 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-xs text-ink/55">{t("extras.total")}</span>
              <span className="font-display text-lg text-teal-deep">{eur(grandTotal)}</span>
              <span className="ml-1 text-[11px] text-ink/45">{t("extras.taxesIncl")}</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => goTo("payment")} className="btn-link hidden sm:inline-flex">
                {t("extras.skip")}
              </button>
              <button type="button" onClick={() => goTo("payment")} className="btn-primary">
                {t("extras.continueToPayment")} <IconArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </StepLayout>
  );
}
