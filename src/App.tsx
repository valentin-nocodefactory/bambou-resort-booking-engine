import { useEffect } from "react";
import { BookingProvider, useBooking, type Step } from "./state/booking";
import { Brand } from "./components/Brand";
import { StepProgress } from "./components/StepProgress";
import { DevPanel } from "./components/DevPanel";
import { Dates } from "./steps/Dates";
import { Results } from "./steps/Results";
import { Guest } from "./steps/Guest";
import { Extras } from "./steps/Extras";
import { Payment } from "./steps/Payment";
import { Confirmation } from "./steps/Confirmation";
import { IconLeaf, IconMapPin, IconTag } from "./components/icons";

const STEP_COMPONENTS: Record<Step, () => JSX.Element | null> = {
  dates: Dates,
  results: Results,
  guest: Guest,
  extras: Extras,
  payment: Payment,
  confirmation: Confirmation,
};

function Shell() {
  const { step, hotelError, reloadHotel, resetAll, goTo } = useBooking();
  const StepView = STEP_COMPONENTS[step];
  const showProgress = ["results", "guest", "extras", "payment"].includes(step);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <header className="sticky top-0 z-30 border-b border-ink/5 bg-cream/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => {
              resetAll();
              goTo("dates");
            }}
            className="self-start"
            aria-label="Accueil Bambou Resort"
          >
            <Brand className="text-teal-deep" />
          </button>
          {showProgress ? (
            <div className="sm:max-w-xl sm:flex-1">
              <StepProgress />
            </div>
          ) : (
            <span className="hidden items-center gap-1.5 text-sm font-medium text-teal-deep sm:inline-flex">
              <IconTag className="h-4 w-4 text-turquoise" /> Meilleur prix garanti en direct
            </span>
          )}
        </div>
      </header>

      {hotelError && (
        <div className="bg-amber-50 px-5 py-2 text-center text-sm text-amber-800">
          Impossible de charger la configuration de l'hôtel.{" "}
          <button type="button" onClick={reloadHotel} className="font-semibold underline">
            Réessayer
          </button>
        </div>
      )}

      <main className="flex-1">
        <StepView />
      </main>

      <Footer />
      <DevPanel />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink/10 bg-teal-deep text-cream/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Brand className="text-cream" />
          <p className="mt-2 max-w-sm text-sm text-cream/60">
            Art de vivre caribéen, les pieds dans l'eau. Réservation en direct, au meilleur tarif.
          </p>
        </div>
        <div className="space-y-1.5 text-sm">
          <p className="inline-flex items-center gap-1.5">
            <IconMapPin className="h-4 w-4 text-creole-soft" /> Le Diamant, Martinique
          </p>
          <p className="inline-flex items-center gap-1.5 text-cream/60">
            <IconLeaf className="h-4 w-4 text-creole-soft" /> Paiement sécurisé · propulsé par Mews
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <BookingProvider>
      <Shell />
    </BookingProvider>
  );
}
