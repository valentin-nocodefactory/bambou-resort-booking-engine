import { useBooking } from "../state/booking";
import { eur, imgUrl } from "../lib/format";
import { chargingLabel } from "../lib/shaping";
import { qcMeal } from "../lib/quebec";
import type { ShapedProduct } from "../types/mews";
import { Photo } from "./Photo";
import { IconCheck, IconPlus, IconSparkles } from "./icons";
import { t } from "../i18n";

// Upsells « stories » (cartes verticales façon Insta / Netflix) proposés à l'étape
// SURCLASSEMENT, UNIQUEMENT pour Culture Créole (où les repas sont en option). Un clic
// (dé)coche l'offre → les produits Mews correspondants sont pré-cochés à l'étape Extras.
type Offer = { key: string; title: string; desc: string; imageId?: string | null; priceLabel: string; products: ShapedProduct[] };

export function CreoleUpsellStories() {
  const { selectedRoom, products, productIds, toggleProduct, imageBaseUrl } = useBooking();
  if (selectedRoom?.property !== "creole") return null;

  const find = (re: RegExp, exclude?: RegExp) =>
    products.find((p) => (!p.property || p.property === "creole") && re.test(p.name) && (!exclude || !exclude.test(p.name)));

  // Dîner (Culture Créole) : produit Mews « Dîner de demi-pension » — id
  // f1040dc5-edc6-4bc8-8992-b39b0153b569, dîner servi chaque soir au restaurant O'Deck.
  // Le petit-déjeuner étant désormais INCLUS, on ne propose plus que le dîner (fini la
  // demi-pension). On exclut les dîners « expérience » (plage/flottant) → dîner standard.
  const dinner = find(/d[îi]ner/i, /plage|flottant|beach/i);
  const champagne = find(/champagne/i);
  const escale = find(/escale|romantique/i);

  const offers: Offer[] = [];
  if (dinner)
    offers.push({
      key: "dinner",
      title: t("creoleUp.dinnerTitle"),
      desc: t("creoleUp.dinnerDesc"),
      imageId: dinner.imageId,
      priceLabel: `+${eur(dinner.priceEur)} ${chargingLabel(dinner.chargingMode)}`.trim(),
      products: [dinner],
    });
  if (champagne && escale)
    offers.push({
      key: "romantic",
      title: t("creoleUp.romanticTitle"),
      desc: t("creoleUp.romanticDesc"),
      imageId: champagne.imageId,
      priceLabel: `+${eur(champagne.priceEur + escale.priceEur)}`,
      products: [champagne, escale],
    });

  if (!offers.length) return null;

  const isOn = (o: Offer) => o.products.every((p) => productIds.includes(p.id));
  const toggle = (o: Offer) => {
    const on = isOn(o);
    // « on » → on retire tout ; sinon on ajoute les manquants (précoche pour l'étape Extras).
    o.products.forEach((p) => {
      const inList = productIds.includes(p.id);
      if ((on && inList) || (!on && !inList)) toggleProduct(p.id);
    });
  };

  return (
    <section>
      <div className="mb-3">
        <h2 className="inline-flex items-center gap-2 font-display text-lg text-creole">
          <IconSparkles className="h-4 w-4" /> {t("creoleUp.title")}
        </h2>
        <p className="mt-0.5 text-xs text-ink/55">{t("creoleUp.subtitle")}</p>
      </div>

      {/* Rangée scrollable de cartes verticales (stories). px/py = marge de sécurité pour
          que l'anneau de sélection et l'ombre au hover ne soient PAS rognés par le scroll
          (overflow-x force le clip vertical) ; -mx compense l'alignement (StepLayout px-5). */}
      <div className="-mx-2 flex gap-3 overflow-x-auto px-2 py-3">
        {offers.map((o) => {
          const on = isOn(o);
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => toggle(o)}
              aria-pressed={on}
              className={`group relative aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-2xl text-left shadow-card transition sm:w-44 ${
                on ? "ring-2 ring-turquoise" : "hover:shadow-float"
              }`}
            >
              <Photo
                src={imgUrl(imageBaseUrl, o.imageId, 500)}
                alt={o.title}
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                gradient="from-creole via-creole-soft to-turquoise-vivid"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/25 to-transparent" />
              <span
                className={`absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full transition ${
                  on ? "bg-turquoise text-white" : "bg-white/85 text-ink"
                }`}
              >
                {on ? <IconCheck className="h-4 w-4" /> : <IconPlus className="h-4 w-4" />}
              </span>
              <div className="absolute inset-x-0 bottom-0 p-3 text-cream">
                <p className="font-display text-base leading-tight">{qcMeal(o.title)}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-cream/85">{qcMeal(o.desc)}</p>
                <p className="mt-1.5 inline-block rounded-full bg-cream/20 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">
                  {o.priceLabel}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
