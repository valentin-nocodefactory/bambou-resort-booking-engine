import { useEffect } from "react";
import { useBooking } from "../state/booking";
import { StepLayout } from "../components/StepLayout";
import { UpsellCard } from "../components/UpsellCard";
import { DataBadge } from "../components/DataBadge";
import { IconArrowRight, IconSparkles } from "../components/icons";

export function Extras() {
  const {
    products,
    productIds,
    toggleProduct,
    imageBaseUrl,
    nightsCount,
    guestsCount,
    selectedRoom,
    selectedRate,
    goTo,
  } = useBooking();

  useEffect(() => {
    if (!selectedRoom || !selectedRate) goTo("results");
  }, [selectedRoom, selectedRate, goTo]);

  return (
    <StepLayout
      title="Composez votre séjour"
      subtitle="Ajoutez des expériences et services pour sublimer votre escapade."
      onBack={() => goTo("guest")}
      backLabel="Retour aux informations"
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="inline-flex items-center gap-2 text-sm text-ink/60">
            <IconSparkles className="h-4 w-4 text-creole" />
            {productIds.length > 0
              ? `${productIds.length} extra${productIds.length > 1 ? "s" : ""} sélectionné${productIds.length > 1 ? "s" : ""}`
              : "Optionnel — passez si vous préférez l'essentiel."}
          </p>
          <DataBadge label="Extras · Mews" />
        </div>

        {products.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {products.map((p) => (
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
        ) : (
          <div className="card p-8 text-center text-sm text-ink/60">
            Aucun extra disponible pour le moment — vous pouvez continuer.
          </div>
        )}

        <div className="flex flex-col-reverse items-center justify-between gap-3 pt-2 sm:flex-row">
          <button type="button" onClick={() => goTo("payment")} className="btn-link">
            Passer cette étape
          </button>
          <button type="button" onClick={() => goTo("payment")} className="btn-primary w-full sm:w-auto">
            Continuer vers le paiement <IconArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </StepLayout>
  );
}
