import { useEffect } from "react";
import { BookingProvider, useBooking, type Step } from "./state/booking";
import { Brand } from "./components/Hero";
import { StepProgress } from "./components/StepProgress";
import { Dates } from "./steps/Dates";
import { Results } from "./steps/Results";
import { Guest } from "./steps/Guest";
import { Extras } from "./steps/Extras";
import { Payment } from "./steps/Payment";
import { Confirmation } from "./steps/Confirmation";
import { IconLeaf, IconMapPin } from "./components/icons";

const STEP_COMPONENTS: Record<Step, () => JSX.Element | null> = {
  dates: Dates,
  results: Results,
  guest: Guest,
  extras: Extras,
  payment: Payment,
  confirmation: Confirmation,
};

function Shell() {
  const { step, hotelError, reloadHotel } = useBooking();
  const StepView = STEP_COMPONENTS[step];
  const showTopBar = step !== "dates";
  const showProgress = ["results", "guest", "extras", "payment"].includes(step);

  // Remonte en haut à chaque changement d'étape.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      {showTopBar && (
        <header className="sticky top-0 z-30 border-b border-ink/5 bg-cream/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={() => reloadHotel()} className="self-start">
              <Brand className="text-teal-deep" />
            </button>
            {showProgress && <div className="sm:max-w-xl sm:flex-1">{<StepProgress />}</div>}
          </div>
        </header>
      )}

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
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink/10 bg-teal-deep text-cream/80">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Brand className="text-cream" />
          <p className="mt-2 max-w-sm text-sm text-cream/60">
            Art de vivre caribéen, les pieds dans l'eau. Réservation en direct au meilleur tarif.
          </p>
        </div>
        <div className="space-y-1.5 text-sm">
          <p className="inline-flex items-center gap-1.5">
            <IconMapPin className="h-4 w-4 text-creole-soft" /> Martinique, Petites Antilles
          </p>
          <p className="inline-flex items-center gap-1.5 text-cream/60">
            <IconLeaf className="h-4 w-4 text-creole-soft" /> Réservation sécurisée · propulsée par Mews
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
