import { useBooking, type Step } from "../state/booking";
import { IconCheck } from "./icons";
import { t } from "../i18n";

const STEPS: { key: Step; label: string }[] = [
  { key: "dates", label: t("stepProgress.dates") },
  { key: "results", label: t("stepProgress.room") },
  { key: "guest", label: t("stepProgress.yourInfo") },
  { key: "upgrade", label: t("stepProgress.upgrade") },
  { key: "extras", label: t("stepProgress.extras") },
  { key: "payment", label: t("stepProgress.payment") },
];

export function StepProgress() {
  const { step, goTo } = useBooking();
  const current = step === "confirmation" ? STEPS.length : STEPS.findIndex((s) => s.key === step);
  const isConfirmation = current >= STEPS.length;
  const currentLabel = isConfirmation ? t("stepProgress.confirmation") : (STEPS[current]?.label ?? "");

  return (
    <nav aria-label={t("stepProgress.navLabel")} className="w-full">
      {/* ── Mobile : titre de l'étape + barre segmentée (segments faits = cliquables) ──
          Épuré : un seul titre lisible + une progression claire, sans pastilles redondantes. */}
      <div className="sm:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate font-display text-xl leading-tight text-marine">{currentLabel}</p>
          <p className="shrink-0 text-xs font-semibold tabular-nums text-marine/45">
            {isConfirmation ? t("stepProgress.done") : `${current + 1} / ${STEPS.length}`}
          </p>
        </div>
        <ol className="mt-2.5 flex items-center gap-1.5">
          {STEPS.map((s, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <li key={s.key} className="flex-1">
                <button
                  type="button"
                  disabled={!done}
                  onClick={() => done && goTo(s.key)}
                  aria-current={active ? "step" : undefined}
                  aria-label={t("stepProgress.stepAria", { index: i + 1, total: STEPS.length, label: s.label, status: done ? "done" : active ? "active" : "" })}
                  className={`flex w-full items-center py-2 ${done ? "cursor-pointer" : "cursor-default"}`}
                >
                  <span
                    className={`h-1.5 w-full rounded-full transition-colors ${
                      active ? "bg-corail" : done ? "bg-marine" : "bg-marine/15"
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* ── Desktop : fil d'Ariane complet avec libellés ── */}
      <ol className="hidden items-center gap-2 sm:flex">
        {STEPS.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const clickable = done;
          return (
            <li key={s.key} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && goTo(s.key)}
                aria-current={active ? "step" : undefined}
                className={`flex items-center gap-2 whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-semibold transition ${
                  active
                    ? "bg-marine text-cream"
                    : done
                      ? "text-marine hover:bg-corail/10"
                      : "text-ink/35"
                } ${clickable ? "cursor-pointer" : "cursor-default"}`}
              >
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${
                    active
                      ? "bg-corail text-marine"
                      : done
                        ? "bg-marine text-white"
                        : "border border-ink/20 text-ink/40"
                  }`}
                >
                  {done ? <IconCheck className="h-3.5 w-3.5" /> : i + 1}
                </span>
                {s.label}
              </button>
              {i < STEPS.length - 1 && (
                <span className={`h-px flex-1 ${i < current ? "bg-marine/50" : "bg-ink/10"}`} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
