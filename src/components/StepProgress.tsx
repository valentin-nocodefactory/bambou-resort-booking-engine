import { useBooking, type Step } from "../state/booking";
import { IconCheck } from "./icons";

const STEPS: { key: Step; label: string }[] = [
  { key: "dates", label: "Dates" },
  { key: "results", label: "Chambre" },
  { key: "guest", label: "Vos infos" },
  { key: "upgrade", label: "Surclassement" },
  { key: "extras", label: "Extras" },
  { key: "payment", label: "Paiement" },
];

export function StepProgress() {
  const { step, goTo } = useBooking();
  const current = step === "confirmation" ? STEPS.length : STEPS.findIndex((s) => s.key === step);
  const isConfirmation = current >= STEPS.length;
  const currentLabel = isConfirmation ? "Confirmation" : (STEPS[current]?.label ?? "");

  return (
    <nav aria-label="Progression de la réservation" className="w-full">
      {/* Mobile : titre de l'étape courante, bien lisible */}
      <div className="flex items-center gap-2.5 sm:hidden">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-corail text-xs font-semibold text-marine">
          {isConfirmation ? <IconCheck className="h-4 w-4" /> : current + 1}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-lg leading-tight text-ink">{currentLabel}</p>
          <p className="text-xs text-ink/50">
            {isConfirmation ? "Réservation terminée" : `Étape ${current + 1} sur ${STEPS.length}`}
          </p>
        </div>
      </div>

      {/* Fil d'Ariane — pastilles cliquables (mobile + desktop), libellés sur desktop */}
      <ol className="mt-2 flex items-center gap-1 sm:mt-0 sm:gap-2">
        {STEPS.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const clickable = done;
          return (
            <li key={s.key} className="flex flex-1 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && goTo(s.key)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-1 py-1 text-xs font-semibold transition sm:gap-2 sm:px-2.5 sm:text-sm ${
                  active
                    ? "text-marine sm:bg-marine sm:text-cream"
                    : done
                      ? "text-marine hover:bg-corail/10"
                      : "text-ink/35"
                } ${clickable ? "cursor-pointer" : "cursor-default"}`}
              >
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${
                    active
                      ? "bg-creole text-ink"
                      : done
                        ? "bg-turquoise text-white"
                        : "border border-ink/20 text-ink/40"
                  }`}
                >
                  {done ? <IconCheck className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <span className={`h-px flex-1 ${i < current ? "bg-turquoise/60" : "bg-ink/10"}`} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
