import { ASSETS } from "../lib/assets";
import { Photo } from "./Photo";
import { IconMapPin } from "./icons";

// Hero éditorial luxe tropical créole — écran de recherche.
export function Hero() {
  return (
    <header className="relative isolate overflow-hidden">
      <Photo
        src={ASSETS.heroBeach}
        alt="Plage turquoise et bungalows du Bambou Resort, Martinique"
        className="absolute inset-0 -z-10 h-full w-full object-cover"
        gradient="from-teal-deep via-turquoise to-turquoise-vivid"
      />
      <div className="absolute inset-0 -z-10 bg-hero-fade" />

      <div className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:pb-28 sm:pt-14">
        <Brand className="text-cream" />

        <div className="mt-14 max-w-2xl animate-fade-in sm:mt-20">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cream backdrop-blur">
            <IconMapPin className="h-4 w-4" />
            Martinique · les pieds dans l'eau
          </span>
          <h1 className="mt-5 font-display text-4xl leading-[1.05] text-cream text-balance sm:text-6xl">
            Reconnectez-vous à <span className="italic text-creole-soft">l'essentiel</span>
          </h1>
          <p className="mt-5 max-w-xl font-body text-base leading-relaxed text-cream/85 sm:text-lg">
            Un art de vivre caribéen, entre lagon turquoise et bungalows de sable. Composez votre séjour
            sur-mesure en quelques instants.
          </p>
        </div>
      </div>
    </header>
  );
}

export function Brand({ className = "", subtle = false }: { className?: string; subtle?: boolean }) {
  return (
    <div className={`flex items-baseline gap-2 ${className}`}>
      <span className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Bambou</span>
      <span
        className={`text-xs font-semibold uppercase tracking-[0.3em] ${subtle ? "opacity-60" : "text-creole"}`}
      >
        Resort
      </span>
    </div>
  );
}
