import type { ComponentType, SVGProps } from "react";
import { roomBenefits } from "../lib/shaping";
import type { ShapedRoom } from "../types/mews";
import { IconWave, IconLeaf, IconStairs, IconCroissant, IconCloche } from "./icons";
import { t, type TKey } from "../i18n";

type IconC = ComponentType<SVGProps<SVGSVGElement>>;
type Tag = { key: string; label: string; Icon: IconC };

// Mapping clé → libellé (i18n) + picto SVG. Règle en dur côté roomBenefits (par nom) :
// Panorama→Vue mer, Sérénité→Sans vis-à-vis, Harmonie→1er étage.
const BENEFIT: Record<string, { key: TKey; Icon: IconC }> = {
  sea: { key: "benefit.sea", Icon: IconWave },
  quiet: { key: "benefit.quiet", Icon: IconLeaf },
  floor: { key: "benefit.floor", Icon: IconStairs },
};

export function benefitTags(room: ShapedRoom): Tag[] {
  return roomBenefits(room).map((b) => ({ key: b, label: t(BENEFIT[b].key), Icon: BENEFIT[b].Icon }));
}

// Repas inclus (demi-pension) — Hôtel Bambou uniquement.
export function mealTags(room: ShapedRoom): Tag[] {
  if (room.property !== "hotel") return [];
  return [
    { key: "breakfast", label: t("roomCard.breakfastIncl"), Icon: IconCroissant },
    { key: "dinner", label: t("roomCard.dinnerIncl"), Icon: IconCloche },
  ];
}

// Tags bénéfice en OVERLAY sur la photo (fond sombre translucide, lisibles sur l'image).
export function RoomBenefitsOverlay({ room }: { room: ShapedRoom }) {
  const tags = benefitTags(room);
  if (!tags.length) return null;
  return (
    <div className="pointer-events-none absolute right-2 top-2 flex flex-col items-end gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag.key}
          className="inline-flex items-center gap-1 rounded-full bg-ink/65 px-2 py-1 text-[11px] font-semibold text-cream shadow-sm backdrop-blur"
        >
          <tag.Icon className="h-3.5 w-3.5" /> {tag.label}
        </span>
      ))}
    </div>
  );
}

// Bénéfices + repas repris dans le PANNEAU de détails (chips clairs).
export function RoomTagsPanel({ room }: { room: ShapedRoom }) {
  const tags = [...benefitTags(room), ...mealTags(room)];
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag.key}
          className="inline-flex items-center gap-1.5 rounded-full bg-turquoise/10 px-2.5 py-1 text-xs font-semibold text-teal-deep"
        >
          <tag.Icon className="h-3.5 w-3.5" /> {tag.label}
        </span>
      ))}
    </div>
  );
}
