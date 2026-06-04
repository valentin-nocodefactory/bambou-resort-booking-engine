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

  return (
    <nav aria-label="Progression de la réservation" className="w-full">
      <ol className="flex items-center gap-1.5 sm:gap-2">
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
                className={`flex items-center gap-2 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold transition sm:text-sm ${
                  active
                    ? "bg-teal-deep text-cream"
                    : done
                      ? "text-teal-deep hover:bg-turquoise/10"
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
