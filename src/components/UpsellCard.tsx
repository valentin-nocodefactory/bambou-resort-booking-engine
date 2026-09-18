import { useEffect, useState } from "react";
import { productLineTotal } from "../state/booking";
import { money, imgUrl } from "../lib/format";
import { chargingLabel } from "../lib/shaping";
import { qcMeal } from "../lib/quebec";
import type { ShapedProduct } from "../types/mews";
import { Photo } from "./Photo";
import { IconCheck, IconPlus, IconSparkles } from "./icons";
import { t } from "../i18n";

// Carte extra (étape Extras) — carte VERTICALE : photo en haut (ratio 3:2 constant),
// infos dessous (titre COMPLET, description, prix), bouton d'ajout en overlay sur la
// photo. Conteneur en <div role="button"> (et non <button>) pour imbriquer le bouton
// « En savoir plus » sans bouton-dans-bouton (HTML invalide).
export function UpsellCard({
  product,
  imageBaseUrl,
  selected,
  nightsCount,
  guestsCount,
  onToggle,
  locked = false,
}: {
  product: ShapedProduct;
  imageBaseUrl: string;
  selected: boolean;
  nightsCount: number;
  guestsCount: number;
  onToggle: () => void;
  locked?: boolean; // extra obligatoire (ex. réveillon aux dates concernées) : non décochable
}) {
  const [detail, setDetail] = useState(false);
  const lineTotal = productLineTotal(product, nightsCount, guestsCount);
  return (
    <>
      <div
        role={locked ? undefined : "button"}
        tabIndex={locked ? undefined : 0}
        aria-pressed={locked ? undefined : selected}
        aria-disabled={locked || undefined}
        onClick={locked ? undefined : onToggle}
        onKeyDown={
          locked
            ? undefined
            : (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggle();
                }
              }
        }
        className={`group flex h-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-card transition focus:outline-none focus-visible:ring-2 focus-visible:ring-corail focus-visible:ring-offset-2 ${
          locked
            ? "cursor-default border-turquoise/70 ring-1 ring-turquoise/50"
            : selected
              ? "cursor-pointer border-turquoise shadow-float ring-2 ring-turquoise"
              : "cursor-pointer border-ink/10 hover:shadow-float"
        }`}
      >
        {/* Photo (ratio constant 3:2) + bouton d'ajout / badge obligatoire en overlay */}
        <div className="relative aspect-[3/2] w-full overflow-hidden">
          <Photo
            src={imgUrl(imageBaseUrl, product.imageId, 640)}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            gradient="from-creole via-creole-soft to-turquoise-vivid"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/35 via-transparent to-transparent" />
          {locked ? (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-turquoise px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-card">
              <IconCheck className="h-3 w-3" /> {t("upsell.mandatory")}
            </span>
          ) : (
            <span
              className={`absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full shadow-card ring-1 transition ${
                selected
                  ? "bg-turquoise text-white ring-turquoise"
                  : "bg-white/90 text-ink ring-black/5 backdrop-blur group-hover:bg-white"
              }`}
            >
              {selected ? <IconCheck className="h-4 w-4" /> : <IconPlus className="h-4 w-4" />}
            </span>
          )}
        </div>

        {/* Infos : titre COMPLET (jamais tronqué), description, prix */}
        <div className="flex flex-1 flex-col p-4">
          <p className="font-semibold leading-snug text-ink">{qcMeal(product.name)}</p>
          {product.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink/60">{qcMeal(product.description)}</p>
          )}
          <div className="mt-auto flex items-end justify-between gap-2 pt-3">
            <div>
              <span className="font-display text-lg text-teal-deep">{money(product.priceEur)}</span>
              {chargingLabel(product.chargingMode) && (
                <span className="text-xs text-ink/45"> {chargingLabel(product.chargingMode)}</span>
              )}
              {lineTotal !== product.priceEur && (
                <span className="block text-[11px] text-ink/45">
                  {money(lineTotal)} {t("upsell.total")}
                </span>
              )}
            </div>
            {/* stopPropagation : ouvrir le détail sans (dé)cocher l'extra. */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDetail(true);
              }}
              className="shrink-0 whitespace-nowrap text-xs font-medium text-turquoise underline-offset-2 hover:underline"
            >
              {t("upsell.learnMore")}
            </button>
          </div>
        </div>
      </div>

      {detail && (
        <ExtraDetailModal
          product={product}
          imageBaseUrl={imageBaseUrl}
          selected={selected}
          locked={locked}
          lineTotal={lineTotal}
          onToggle={onToggle}
          onClose={() => setDetail(false)}
        />
      )}
    </>
  );
}

// Popup détail d'un extra : image, description complète, prix + ajout/retrait.
function ExtraDetailModal({
  product,
  imageBaseUrl,
  selected,
  locked,
  lineTotal,
  onToggle,
  onClose,
}: {
  product: ShapedProduct;
  imageBaseUrl: string;
  selected: boolean;
  locked: boolean;
  lineTotal: number;
  onToggle: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative z-10 max-h-[90vh] w-full max-w-md animate-scale-in overflow-y-auto rounded-t-2xl bg-cream shadow-float sm:rounded-2xl">
        <div className="relative aspect-[3/2] w-full">
          <Photo
            src={imgUrl(imageBaseUrl, product.imageId, 800)}
            alt={product.name}
            className="h-full w-full object-cover"
            gradient="from-creole via-creole-soft to-turquoise-vivid"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t("upsell.close")}
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/85 text-ink shadow transition hover:bg-white"
          >
            ✕
          </button>
        </div>
        <div className="p-5">
          <h3 className="font-display text-xl text-ink">{qcMeal(product.name)}</h3>
          <p className="mt-1 text-sm">
            <span className="font-display text-lg text-teal-deep">{money(product.priceEur)}</span>
            {chargingLabel(product.chargingMode) && (
              <span className="text-ink/50"> {chargingLabel(product.chargingMode)}</span>
            )}
            {lineTotal !== product.priceEur && (
              <span className="text-ink/50"> · {money(lineTotal)} {t("upsell.total")}</span>
            )}
          </p>
          {product.description && (
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/70">{qcMeal(product.description)}</p>
          )}
          <div className="mt-5 flex items-center gap-2">
            {locked ? (
              <span className="flex flex-1 items-center gap-1.5 rounded-lg bg-turquoise/10 px-3 py-2 text-sm font-medium text-teal-deep">
                <IconCheck className="h-4 w-4" /> {t("upsell.mandatoryNote")}
              </span>
            ) : (
              <button type="button" onClick={onToggle} className={`flex-1 ${selected ? "btn-ghost" : "btn-primary"}`}>
                {selected ? (
                  <>
                    <IconCheck className="h-4 w-4" /> {t("upsell.added")}
                  </>
                ) : (
                  <>
                    <IconPlus className="h-4 w-4" /> {t("upsell.add")}
                  </>
                )}
              </button>
            )}
            <button type="button" onClick={onClose} className="btn-ghost">
              {t("upsell.close")}
            </button>
          </div>
        </div>
      </div>
    </div>
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
          {t("upsell.enhance", { name: qcMeal(product.name) })}
        </p>
        <p className="text-xs text-ink/60">
          {qcMeal(product.description) || t("upsell.descFallback")} ·{" "}
          <span className="font-semibold text-teal-deep">{money(product.priceEur)}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={added ? "btn-ghost" : "btn-accent"}
      >
        {added ? (
          <>
            <IconCheck className="h-4 w-4" /> {t("upsell.added")}
          </>
        ) : (
          <>
            <IconPlus className="h-4 w-4" /> {t("upsell.add")}
          </>
        )}
      </button>
    </div>
  );
}
