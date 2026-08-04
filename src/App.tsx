import { useEffect } from "react";
import { BookingProvider, useBooking, type Step } from "./state/booking";
import { Brand } from "./components/Brand";
import { StepProgress } from "./components/StepProgress";
import { DevPanel } from "./components/DevPanel";
import { ContactBar } from "./components/ContactBar";
import { Dates } from "./steps/Dates";
import { Results } from "./steps/Results";
import { Guest } from "./steps/Guest";
import { Upgrade } from "./steps/Upgrade";
import { Extras } from "./steps/Extras";
import { Payment } from "./steps/Payment";
import { Confirmation } from "./steps/Confirmation";
import { IconLeaf, IconTag } from "./components/icons";
import { t } from "./i18n";
import { getLang, setLangAndReload, type Lang } from "./lib/lang";

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
  const { step, hotelError, reloadHotel, resetAll, goTo } = useBooking();
  const StepView = STEP_COMPONENTS[step];
  const showProgress = ["results", "guest", "upgrade", "extras", "payment"].includes(step);

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
            aria-label={t("header.home")}
          >
            <Brand className="text-teal-deep" />
          </button>
          {showProgress ? (
            <div className="sm:max-w-xl sm:flex-1">
              <StepProgress />
            </div>
          ) : (
            <span className="hidden items-center gap-1.5 text-sm font-medium text-teal-deep sm:inline-flex">
              <IconTag className="h-4 w-4 text-turquoise" /> {t("header.bestPrice")}
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
        <StepView />
      </main>

      <Footer />
      <ContactBar />
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
          <p className="mt-2 max-w-sm text-sm text-cream/60">{t("footer.tagline")}</p>
        </div>
        <div className="space-y-2.5 text-sm sm:text-right">
          <LangSwitcher />
          <p className="inline-flex items-center gap-1.5 text-cream/60">
            <IconLeaf className="h-4 w-4 text-creole-soft" /> {t("footer.securePayment")}
          </p>
          <p className="text-cream/60">{t("footer.developedBy")}</p>
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

export default function App() {
  return (
    <BookingProvider>
      <Shell />
    </BookingProvider>
  );
}
