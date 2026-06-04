import { productLineTotal } from "../state/booking";
import { eur, imgUrl } from "../lib/format";
import { chargingLabel } from "../lib/shaping";
import type { ShapedProduct } from "../types/mews";
import { Photo } from "./Photo";
import { IconCheck, IconPlus, IconSparkles } from "./icons";

// Carte extra (étape Extras) — toggle d'ajout.
export function UpsellCard({
  product,
  imageBaseUrl,
  selected,
  nightsCount,
  guestsCount,
  onToggle,
}: {
  product: ShapedProduct;
  imageBaseUrl: string;
  selected: boolean;
  nightsCount: number;
  guestsCount: number;
  onToggle: () => void;
}) {
  const lineTotal = productLineTotal(product, nightsCount, guestsCount);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`card group flex w-full items-stretch gap-0 overflow-hidden text-left transition hover:shadow-float ${
        selected ? "ring-2 ring-turquoise" : ""
      }`}
    >
      <div className="relative w-24 shrink-0 sm:w-28">
        <Photo
          src={imgUrl(imageBaseUrl, product.imageId, 300)}
          alt={product.name}
          className="h-full w-full object-cover"
          gradient="from-creole via-creole-soft to-turquoise-vivid"
        />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold leading-snug text-ink">{product.name}</p>
          <span
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition ${
              selected ? "border-turquoise bg-turquoise text-white" : "border-ink/25 text-ink/40"
            }`}
          >
            {selected ? <IconCheck className="h-4 w-4" /> : <IconPlus className="h-4 w-4" />}
          </span>
        </div>
        {product.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink/60">{product.description}</p>
        )}
        <div className="mt-auto pt-2 text-sm">
          <span className="font-display text-lg text-teal-deep">{eur(product.priceEur)}</span>
          {chargingLabel(product.chargingMode) && (
            <span className="text-xs text-ink/45"> {chargingLabel(product.chargingMode)}</span>
          )}
          {lineTotal !== product.priceEur && (
            <span className="text-xs text-ink/45"> · {eur(lineTotal)} au total</span>
          )}
        </div>
      </div>
    </button>
  );
}

// Suggestion inline (écran résultats) — nudge sur un extra phare.
export function InlineUpsell({
  product,
  added,
  onToggle,
}: {
  product: ShapedProduct;
  added: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl2 border border-creole/30 bg-creole/10 p-4 sm:p-5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-creole/20 text-creole">
        <IconSparkles className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">
          Sublimez votre séjour&nbsp;: {product.name}
        </p>
        <p className="text-xs text-ink/60">
          {product.description || "Un petit plus créole pour démarrer la journée en beauté."} ·{" "}
          <span className="font-semibold text-teal-deep">{eur(product.priceEur)}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={added ? "btn-ghost" : "btn-accent"}
      >
        {added ? (
          <>
            <IconCheck className="h-4 w-4" /> Ajouté
          </>
        ) : (
          <>
            <IconPlus className="h-4 w-4" /> Ajouter
          </>
        )}
      </button>
    </div>
  );
}
