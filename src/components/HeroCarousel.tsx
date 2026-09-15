import { useEffect, useState, type ReactNode } from "react";
import { t } from "../i18n";

// Carousel plein écran en fond de la page de garde : photos du resort en fondu
// enchaîné (auto-rotation) + léger zoom Ken Burns. Barre de progression DISCRÈTE en
// bas à gauche. Photos fournies par le client (public/img/hero).
const SLIDES = [
  "/img/hero/1-resort.webp", // vue aérienne du resort (piscine + marina + mer)
  "/img/hero/2-plage.webp", // plage lagon turquoise (aérien)
  "/img/hero/3-bambou.webp", // cannes de bambou (identité « Bambou »)
  "/img/hero/4-piscine.webp", // coupe au bord de la piscine (art de vivre)
];
const INTERVAL = 6000; // synchronisé avec l'animation `hero-progress` (6s)

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

export function HeroCarousel({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(0);
  const reduced = usePrefersReducedMotion();
  const count = SLIDES.length;

  // Auto-rotation : timer relancé à chaque changement (donc aussi au clic sur un
  // segment). Désactivée si l'utilisateur préfère les animations réduites.
  useEffect(() => {
    if (reduced) return;
    const id = setTimeout(() => setActive((i) => (i + 1) % count), INTERVAL);
    return () => clearTimeout(id);
  }, [active, reduced, count]);

  return (
    <section className="relative isolate">
      {/* Couches photo plein cadre — overflow-hidden ICI seulement (pas sur la section)
          pour ne pas rogner les popovers du formulaire qui s'ouvrent vers le bas. */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {SLIDES.map((src, i) => (
          <div
            key={src}
            className={`absolute inset-0 transition-opacity duration-[1200ms] ease-out ${
              i === active ? "opacity-100" : "opacity-0"
            }`}
          >
            <img
              src={src}
              alt=""
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              className={`h-full w-full object-cover ${i === active && !reduced ? "animate-hero-pan" : ""}`}
            />
          </div>
        ))}
        {/* Voile dégradé : sombre en haut (titre) et en bas (arguments / progression),
            plus clair au centre pour laisser respirer la photo. */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/20 to-ink/85" />
      </div>

      {/* Contenu (titre + moteur + arguments) au-dessus du carousel */}
      <div className="relative z-10">{children}</div>

      {/* Barre de progression DISCRÈTE — bas à gauche. Fins segments (le clic navigue).
          py-2 = zone tactile confortable autour du trait fin. */}
      <div className="absolute bottom-5 left-5 z-20 flex items-center gap-1.5 sm:left-8">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            aria-label={t("hero.goToSlide", { n: i + 1, total: count })}
            aria-current={i === active}
            className="group py-2"
          >
            <span className="block h-[3px] w-6 overflow-hidden rounded-full bg-white/35 transition group-hover:bg-white/60 sm:w-9">
              <span
                key={`fill-${i}-${active}`}
                className={`block h-full w-full origin-left rounded-full bg-white ${
                  i === active && !reduced ? "animate-hero-progress" : ""
                }`}
                style={{
                  transform:
                    i < active || (i === active && reduced) ? "scaleX(1)" : i > active ? "scaleX(0)" : undefined,
                }}
              />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
