import { money, imgUrl } from "../lib/format";
import type { Combo, Occ } from "../lib/shaping";
import { Photo } from "./Photo";
import { IconBed, IconCheck, IconUsers } from "./icons";
import { t } from "../i18n";

// Carte « combo 2 chambres » — proposée quand aucune chambre seule n'accueille le groupe.
// 2 chambres du MÊME hébergement, réparties automatiquement, 1 seul paiement.
export function ComboCard({
  combo,
  imageBaseUrl,
  onChoose,
}: {
  combo: Combo;
  imageBaseUrl: string;
  onChoose: () => void;
}) {
  const occCount = (o: Occ) => o.adults + o.children;
  const total = occCount(combo.a.occupancy) + occCount(combo.b.occupancy);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-teal-deep/5 px-5 py-3">
        <span className="inline-flex items-center gap-1.5 font-semibold text-teal-deep">
          <IconUsers className="h-4 w-4" /> {t("combo.badge", { count: total })}
        </span>
        <span className="text-xs text-ink/55">{t("combo.note")}</span>
      </div>

      <div className="grid gap-px bg-ink/10 sm:grid-cols-2">
        {[combo.a, combo.b].map((cr, i) => (
          <div key={i} className="flex gap-3 bg-white p-4">
            <Photo
              src={imgUrl(imageBaseUrl, cr.room.imageIds[0], 200)}
              alt={cr.room.name}
              className="h-16 w-20 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-deep/60">
                {t("combo.roomLabel", { n: i + 1 })}
              </p>
              <p className="truncate font-medium text-ink">{cr.room.name}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink/55">
                <span className="inline-flex items-center gap-1">
                  <IconUsers className="h-3 w-3" /> {t("combo.roomOcc", { count: occCount(cr.occupancy) })}
                </span>
                <span className="inline-flex items-center gap-1">
                  <IconBed className="h-3 w-3" /> {t("combo.beds", { count: cr.room.capacity })}
                </span>
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">{money(cr.rate.totalGross)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-ink/10 bg-cream/50 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-deep/70">{t("combo.total")}</p>
          <p className="font-display text-xl text-teal-deep">{money(combo.totalGross)}</p>
        </div>
        <button type="button" onClick={onChoose} className="btn-primary">
          {t("combo.choose")} <IconCheck className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
