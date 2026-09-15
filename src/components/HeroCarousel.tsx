import { useEffect, useState, type ReactNode } from "react";
import { t } from "../i18n";

// Carousel plein cadre en fond de la page de garde : photos qui défilent en fondu
// (auto-rotation) avec une barre de progression segmentée façon « stories ».
// Les photos sont les plus beaux plans du site bambouresort.com (public/img/hero).
const SLIDES = [
  "/img/hero/1-plage.webp",
  "/img/hero/2-vue-ciel.webp",
  "/img/hero/3-vue-mer.webp",
  "/img/hero/4-piscine.webp",
  "/img/hero/5-escale.webp",
];
const INTERVAL = 6000; // doit rester synchronisé avec l'animation `hero-progress` (6s)

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

  // Auto-rotation : un timer relancé à chaque changement de photo (donc aussi au clic
  // sur un segment). Désactivée si l'utilisateur préfère les animations réduites.
  useEffect(() => {
    if (reduced) return;
    const id = setTimeout(() => setActive((i) => (i + 1) % count), INTERVAL);
    return () => clearTimeout(id);
  }, [active, reduced, count]);

  return (
    <section className="relative isolate">
      {/* Couches photo (fondu enchaîné + léger zoom Ken Burns sur l'active).
          overflow-hidden ICI seulement (pas sur la section) pour ne pas rogner les
          popovers du formulaire (dates / voyageurs) qui s'ouvrent vers le bas. */}
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
        {/* Voile dégradé pour la lisibilité du texte blanc / du formulaire */}
        <div className="absolute inset-0 bg-gradient-to-br from-ink/75 via-ink/45 to-ink/70" />
      </div>

      {/* Barre de progression segmentée (façon stories) — cliquable */}
      <div className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-5xl gap-1.5 px-5 pt-4 sm:pt-5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={t("hero.goToSlide", { n: i + 1, total: count })}
              className="group relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/25 transition hover:bg-white/40"
            >
              <span
                key={`fill-${i}-${active}`}
                className={`block h-full w-full origin-left rounded-full bg-white ${
                  i === active && !reduced ? "animate-hero-progress" : ""
                }`}
                style={{ transform: i < active || (i === active && reduced) ? "scaleX(1)" : i > active ? "scaleX(0)" : undefined }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Contenu (titre + moteur de recherche) au-dessus du carousel */}
      <div className="relative z-10">{children}</div>
    </section>
  );
}
