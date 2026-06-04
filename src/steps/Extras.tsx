import { useEffect, useMemo } from "react";
import { useBooking } from "../state/booking";
import { groupProducts, upgradeRooms } from "../lib/shaping";
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
    availableRooms,
    goTo,
  } = useBooking();

  useEffect(() => {
    if (!selectedRoom || !selectedRate) goTo("results");
  }, [selectedRoom, selectedRate, goTo]);

  // Regroupement des extras par catégorie.
  const groups = useMemo(() => groupProducts(products), [products]);

  // Retour : vers le surclassement s'il y en avait, sinon vers les infos.
  const currentTotal = selectedRate?.totalGross ?? selectedRoom?.fromGross ?? 0;
  const back = upgradeRooms(availableRooms, selectedRoom, currentTotal).length > 0 ? "upgrade" : "guest";

  return (
    <StepLayout
      title="Composez votre séjour"
      subtitle="Ajoutez des expériences et services pour sublimer votre escapade."
      onBack={() => goTo(back)}
      backLabel="Retour"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="inline-flex items-center gap-2 text-sm text-ink/60">
            <IconSparkles className="h-4 w-4 text-creole" />
            {productIds.length > 0
              ? `${productIds.length} extra${productIds.length > 1 ? "s" : ""} sélectionné${productIds.length > 1 ? "s" : ""}`
              : "Optionnel — passez si vous préférez l'essentiel."}
          </p>
          <DataBadge label="Extras · Mews" />
        </div>

        {groups.length > 0 ? (
          <div className="space-y-7">
            {groups.map((g) => (
              <section key={g.key}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="h-5 w-1 rounded-full bg-creole" />
                  <h2 className="font-display text-lg text-teal-deep">{g.label}</h2>
                  <span className="text-xs text-ink/40">
                    {g.items.length} option{g.items.length > 1 ? "s" : ""}
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
