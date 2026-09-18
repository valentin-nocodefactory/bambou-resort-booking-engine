import { Brand } from "../components/Brand";
import { IconArrowRight, IconPalm, IconSparkles } from "../components/icons";
import { t } from "../i18n";

// Page /villa — atterrissage dédié aux villas (route pathname, servie par le fallback SPA).
// PLACEHOLDER : pour l'instant un simple « Formulaire à venir ». Le vrai questionnaire
// (dates, nombre de voyageurs, souhaits…) sera ajouté ici plus tard. Rendue AVANT le
// BookingProvider (cf. App) : autonome, sans état de réservation.
export function VillaPage() {
  // Retour accueil en conservant ?lang=/?cur= (langue & devise préservées).
  const goHome = () => window.location.assign(`/${window.location.search}`);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-marine text-white">
      {/* Photo de fond + voile marine pour la lisibilité */}
      <img
        src="/img/properties/villas.webp"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover opacity-45"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-marine/70 via-marine/55 to-marine/85" />

      {/* En-tête : logo cliquable → accueil */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center px-5 py-5 sm:px-8 sm:py-6">
        <button type="button" onClick={goHome} aria-label={t("header.home")}>
          <Brand className="text-cream drop-shadow-[0_1px_12px_rgba(6,26,45,0.55)]" />
        </button>
      </header>

      {/* Contenu centré */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-10">
        <div className="max-w-lg text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-corail ring-1 ring-white/25 backdrop-blur">
            <IconPalm className="h-7 w-7" />
          </span>
          <h1 className="mt-6 font-display text-4xl leading-tight text-white text-balance drop-shadow-[0_2px_20px_rgba(6,26,45,0.5)] sm:text-5xl">
            {t("villa.title")}
          </h1>
          <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
            <IconSparkles className="h-4 w-4 text-corail" />
            {t("villa.comingSoon")}
          </p>
          <p className="mx-auto mt-6 max-w-md text-lg leading-snug text-white/80">{t("villa.lead")}</p>
          <button
            type="button"
            onClick={goHome}
            className="mt-9 inline-flex items-center gap-2 rounded-full bg-corail px-6 py-3 font-semibold text-white shadow-float transition hover:bg-corail/90"
          >
            {t("villa.back")} <IconArrowRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    </div>
  );
}
