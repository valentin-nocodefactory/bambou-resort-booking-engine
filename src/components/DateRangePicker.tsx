import { useEffect, useRef, useState } from "react";
import { fmtDate, isoDay, nights } from "../lib/format";
import { stayCoversHoliday, HOLIDAY_MIN_NIGHTS } from "../lib/shaping";
import { t } from "../i18n";
import { getLang, LOCALE } from "../lib/lang";
import { IconCalendar, IconChevron } from "./icons";

const WEEKDAYS_FR = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
const WEEKDAYS_EN = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const monthLabel = (y: number, m: number) =>
  new Intl.DateTimeFormat(LOCALE[getLang()], { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m, 1)),
  );

// Cellules d'un mois (Monday-first), `null` pour les jours vides en tête.
function monthCells(y: number, m: number): (string | null)[] {
  const startWeekday = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(startWeekday).fill(null);
  for (let d = 1; d <= count; d++) cells.push(iso(y, m, d));
  return cells;
}

/**
 * Sélecteur de plage de dates à la Airbnb : popover calendrier (2 mois desktop,
 * 1 mois mobile), sélection début → fin, surbrillance de plage + aperçu au survol.
 */
export function DateRangePicker({
  checkIn,
  checkOut,
  onChange,
  minDate = isoDay(0),
  blockHolidayMin = true,
}: {
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
  minDate?: string;
  // Applique le minimum 4 nuits pendant les fêtes (moteur Mews). Désactivé pour la demande
  // de villa (formulaire libre, « pas de blocages de dates »).
  blockHolidayMin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Mois affiché en premier (par défaut : mois du check-in ou mois courant).
  const seed = checkIn || minDate;
  const [view, setView] = useState(() => {
    const d = new Date(`${seed}T00:00:00Z`);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const n = checkIn && checkOut ? nights(checkIn, checkOut) : 0;
  const weekdays = getLang() === "en" ? WEEKDAYS_EN : WEEKDAYS_FR;

  // Fêtes (Noël / jour de l'an) : minimum 4 nuits. Pendant la sélection du DÉPART, toute fin
  // qui couvrirait les fêtes avec moins de 4 nuits est refusée (grisée) → les 3 lendemains de
  // l'arrivée sont disable, le minimum devient 4 nuits.
  const holidayBlocks = (candidateEnd: string) =>
    blockHolidayMin &&
    !!checkIn &&
    !checkOut &&
    candidateEnd > checkIn &&
    nights(checkIn, candidateEnd) < HOLIDAY_MIN_NIGHTS &&
    stayCoversHoliday(checkIn, candidateEnd);

  function pick(day: string) {
    if (day < minDate) return;
    if (!checkIn || (checkIn && checkOut)) {
      onChange(day, ""); // démarre une nouvelle plage
    } else if (day <= checkIn) {
      onChange(day, ""); // recommence si on clique avant l'arrivée
    } else if (holidayBlocks(day)) {
      return; // garde-fou : séjour minimum de 4 nuits pendant les fêtes
    } else {
      onChange(checkIn, day); // fin de plage
      setTimeout(() => setOpen(false), 180);
    }
  }

  // Pas d'aperçu de plage sur une fin refusée (fêtes < 4 nuits).
  const previewEnd = !checkOut && hover && checkIn && hover > checkIn && !holidayBlocks(hover) ? hover : checkOut;

  const inRange = (d: string) =>
    checkIn && previewEnd && d > checkIn && d < previewEnd;

  function shiftMonth(delta: number) {
    setView((v) => {
      const m = v.m + delta;
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });
  }
  const canGoPrev = iso(view.y, view.m, 1) > minDate;

  const months = [view, { y: view.y + (view.m === 11 ? 1 : 0), m: (view.m + 1) % 12 }];

  return (
    <div ref={wrapRef} className="relative">
      {/* Déclencheur : deux segments Arrivée / Départ */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-stretch overflow-hidden rounded-2xl border border-ink/15 bg-white text-left transition hover:border-turquoise"
      >
        <Segment label={t("datePicker.checkIn")} value={checkIn ? fmtDate(checkIn) : t("datePicker.when")} active={open && !checkIn} icon />
        <span className="my-2 w-px bg-ink/10" />
        <Segment label={t("datePicker.checkOut")} value={checkOut ? fmtDate(checkOut) : t("datePicker.when")} active={open && !!checkIn && !checkOut} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 animate-scale-in rounded-2xl border border-ink/10 bg-white p-3 shadow-float sm:left-auto sm:right-auto sm:w-[600px] sm:p-4">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => canGoPrev && shiftMonth(-1)}
              disabled={!canGoPrev}
              aria-label={t("datePicker.prevMonth")}
              className="grid h-8 w-8 place-items-center rounded-full text-teal-deep transition hover:bg-turquoise/10 disabled:opacity-25"
            >
              <IconChevron className="h-4 w-4 rotate-180" />
            </button>
            <p className="font-display text-base capitalize text-ink">{n > 0 ? t("datePicker.nights", { count: n }) : t("datePicker.selectDates")}</p>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label={t("datePicker.nextMonth")}
              className="grid h-8 w-8 place-items-center rounded-full text-teal-deep transition hover:bg-turquoise/10"
            >
              <IconChevron className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {months.map((mv, idx) => (
              <div key={`${mv.y}-${mv.m}`} className={idx === 1 ? "hidden sm:block" : ""}>
                <p className="mb-1.5 text-center text-sm font-semibold capitalize text-ink">{monthLabel(mv.y, mv.m)}</p>
                <div className="grid grid-cols-7 gap-y-0.5 text-center">
                  {weekdays.map((w) => (
                    <span key={w} className="pb-0.5 text-[11px] font-medium uppercase text-ink/35">
                      {w.charAt(0)}
                    </span>
                  ))}
                  {monthCells(mv.y, mv.m).map((day, i) => {
                    if (!day) return <span key={`b${i}`} className="h-8" />;
                    const holidayBlocked = holidayBlocks(day);
                    const disabled = day < minDate || holidayBlocked;
                    const isStart = !!checkIn && day === checkIn;
                    const isEnd = !!previewEnd && day === previewEnd && day !== checkIn;
                    const between = inRange(day);
                    const edge = isStart || isEnd;
                    // Bande de fond sur la CELLULE pleine largeur → plage continue.
                    // Demi-dégradé aux extrémités (côté intérieur de la plage uniquement).
                    const band = between
                      ? "bg-turquoise/15"
                      : isStart && previewEnd
                        ? "bg-[linear-gradient(to_right,transparent_50%,#061a2d26_50%)]"
                        : isEnd
                          ? "bg-[linear-gradient(to_right,#061a2d26_50%,transparent_50%)]"
                          : "";
                    return (
                      <div key={day} onMouseEnter={() => setHover(day)} className="group relative h-8">
                        {band && (
                          <span
                            className={`pointer-events-none absolute inset-x-0 top-1/2 h-7 -translate-y-1/2 ${band}`}
                            aria-hidden
                          />
                        )}
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => pick(day)}
                          aria-label={fmtDate(day)}
                          aria-pressed={isStart || day === checkOut}
                          className={`absolute inset-0 m-auto grid h-8 w-8 place-items-center rounded-full text-sm transition ${
                            disabled
                              ? "cursor-not-allowed text-ink/25 line-through"
                              : edge
                                ? "bg-teal-deep font-semibold text-cream"
                                : "text-ink hover:bg-turquoise/20"
                          }`}
                        >
                          {parseInt(day.slice(8), 10)}
                        </button>
                        {/* Info-bulle au survol d'une fin refusée pendant les fêtes. */}
                        {holidayBlocked && (
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden w-36 -translate-x-1/2 rounded-lg bg-marine px-2 py-1.5 text-center text-[11px] font-medium leading-tight text-cream shadow-float group-hover:block"
                          >
                            {t("datePicker.holidayMin")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-ink/10 pt-2.5">
            <button
              type="button"
              onClick={() => {
                onChange("", "");
                setHover(null);
              }}
              className="text-sm font-semibold text-ink/60 underline-offset-4 hover:text-ink hover:underline"
            >
              {t("datePicker.clear")}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-primary px-5 py-2 text-sm">
              {checkIn && checkOut ? t("datePicker.apply") : t("datePicker.close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Segment({
  label,
  value,
  active,
  icon,
}: {
  label: string;
  value: string;
  active: boolean;
  icon?: boolean;
}) {
  return (
    <span className={`flex flex-1 items-center gap-2 px-4 py-3 transition ${active ? "bg-turquoise/5" : ""}`}>
      {icon && <IconCalendar className="h-4 w-4 shrink-0 text-turquoise" />}
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-teal-deep/60">{label}</span>
        <span className={`block truncate text-sm ${value === t("datePicker.when") ? "text-ink/40" : "font-medium text-ink"}`}>
          {value}
        </span>
      </span>
    </span>
  );
}
