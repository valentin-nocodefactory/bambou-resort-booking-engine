import { useEffect } from "react";
import { BookingProvider, useBooking, type Step } from "./state/booking";
import { Brand } from "./components/Brand";
import { StepProgress } from "./components/StepProgress";
import { ContactBar } from "./components/ContactBar";
import { Dates } from "./steps/Dates";
import { Results } from "./steps/Results";
import { Guest } from "./steps/Guest";
import { Upgrade } from "./steps/Upgrade";
import { Extras } from "./steps/Extras";
import { Payment } from "./steps/Payment";
import { Confirmation } from "./steps/Confirmation";
import { VillaPage } from "./steps/VillaPage";
import { IconLeaf, IconTag } from "./components/icons";
import { t } from "./i18n";
import { getLang, setLangAndReload, type Lang } from "./lib/lang";
import type { Currency } from "./lib/currency";

const STEP_COMPONENTS: Record<Step, () => JSX.Element | null> = {
  dates: Dates,
  results: Results,
  guest: Guest,
  upgrade: Upgrade,
  extras: Extras,
  payment: Payment,
  confirmation: Confirmation,
};

function Shell() {
  const { step, hotelError, reloadHotel, resetAll, goTo, hydrating } = useBooking();
  const StepView = STEP_COMPONENTS[step];
  const showProgress = ["results", "guest", "upgrade", "extras", "payment"].includes(step);
  // Page de garde : le carousel prend tout l'écran → en-tête transparent EN SURIMPRESSION
  // (logo clair), pour que la photo remonte jusqu'en haut. Autres étapes : barre crème.
  const isHero = step === "dates";

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // Titre d'onglet dans la langue courante (l'index.html est statique en FR).
  useEffect(() => {
    document.title = t("meta.title");
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <header
        className={
          isHero
            ? "absolute inset-x-0 top-0 z-30"
            : "sticky top-0 z-30 border-b border-ink/5 bg-cream/85 backdrop-blur"
        }
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <button
            type="button"
            onClick={() => {
              resetAll();
              goTo("dates");
            }}
            className="self-start"
            aria-label={t("header.home")}
          >
            <Brand className={isHero ? "text-cream drop-shadow-[0_1px_12px_rgba(6,26,45,0.55)]" : "text-teal-deep"} />
          </button>
          {showProgress ? (
            <div className="sm:max-w-xl sm:flex-1">
              <StepProgress />
            </div>
          ) : (
            <span
              className={`hidden items-center gap-1.5 text-sm font-medium sm:inline-flex ${
                isHero ? "text-white/90 drop-shadow-[0_1px_12px_rgba(6,26,45,0.55)]" : "text-teal-deep"
              }`}
            >
              <IconTag className={`h-4 w-4 ${isHero ? "text-corail" : "text-turquoise"}`} /> {t("header.bestPrice")}
            </span>
          )}
        </div>
      </header>

      {hotelError && (
        <div className="bg-amber-50 px-5 py-2 text-center text-sm text-amber-800">
          {t("hotelError.msg")}{" "}
          <button type="button" onClick={reloadHotel} className="font-semibold underline">
            {t("common.retry")}
          </button>
        </div>
      )}

      <main className="flex-1">
        {hydrating ? <HydrateLoader /> : <StepView />}
      </main>

      <Footer />
      <ContactBar />
    </div>
  );
}

// Écran d'attente pendant la réhydratation d'un lien profond partagé.
function HydrateLoader() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-5">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="h-9 w-9 animate-spin rounded-full border-2 border-turquoise/25 border-t-turquoise" />
        <p className="text-sm text-ink/60">{t("common.restoring")}</p>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink/10 bg-teal-deep text-cream/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Brand className="text-cream" />
          <p className="mt-2 max-w-sm text-sm text-cream/60">{t("footer.tagline")}</p>
        </div>
        <div className="space-y-2.5 text-sm sm:text-right">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
            <CurrencySwitcher />
            <LangSwitcher />
          </div>
          <p className="inline-flex items-center gap-1.5 text-cream/60">
            <IconLeaf className="h-4 w-4 text-creole-soft" /> {t("footer.securePayment")}
          </p>
          <p className="text-cream/60">
            {t("footer.developedBy")}{" "}
            <a
              href="https://www.nocodefactory.fr/?utm_source=bambou-booking-engine"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-cream/85 underline underline-offset-2 transition hover:text-cream"
            >
              NocodeFactory
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

// Sélecteur de langue FR / EN : met à jour ?lang= et recharge (re-localise UI + Mews).
function LangSwitcher() {
  const active = getLang();
  const opts: { code: Lang; label: string }[] = [
    { code: "fr", label: "FR" },
    { code: "en", label: "EN" },
  ];
  return (
    <div className="flex items-center gap-1.5 sm:justify-end" role="group" aria-label={t("footer.language")}>
      {opts.map((o) => {
        const on = o.code === active;
        return (
          <button
            key={o.code}
            type="button"
            onClick={() => setLangAndReload(o.code)}
            aria-pressed={on}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
              on ? "bg-cream text-teal-deep" : "text-cream/60 hover:bg-cream/10 hover:text-cream"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Sélecteur de devise d'AFFICHAGE (EUR / USD / CAD) — purement cosmétique : la transaction
// reste en EUR (rappelée sur la step de paiement). Pré-réglé par la géo IP (US→USD, CA→CAD).
// Contrairement à la langue, PAS de reload : les prix se convertissent instantanément.
function CurrencySwitcher() {
  const { currency, setCurrency } = useBooking();
  const opts: Currency[] = ["EUR", "USD", "CAD"];
  return (
    <div className="flex items-center gap-1.5 sm:justify-end" role="group" aria-label={t("footer.currency")}>
      {opts.map((c) => {
        const on = c === currency;
        return (
          <button
            key={c}
            type="button"
            onClick={() => setCurrency(c)}
            aria-pressed={on}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
              on ? "bg-cream text-teal-deep" : "text-cream/60 hover:bg-cream/10 hover:text-cream"
            }`}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

// Route pathname /villa (servie par le fallback SPA) → page villas dédiée, HORS moteur de
// réservation (pas de BookingProvider nécessaire). Le reste passe par le flux d'étapes.
const isVillaRoute = () =>
  typeof window !== "undefined" && window.location.pathname.replace(/\/+$/, "").toLowerCase() === "/villa";

export default function App() {
  if (isVillaRoute()) return <VillaPage />;
  return (
    <BookingProvider>
      <Shell />
    </BookingProvider>
  );
}
