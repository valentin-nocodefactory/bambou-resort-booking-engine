import { t } from "../i18n";
import { IconShield } from "./icons";

// Indicateur discret : les données proviennent en direct de Mews (via le proxy serveur).
export function DataBadge({ label = t("dataBadge.live") }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-turquoise/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-teal-deep">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-turquoise opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-turquoise" />
      </span>
      {label}
    </span>
  );
}

export function SecureBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-deep/70">
      <IconShield className="h-4 w-4 text-turquoise" />
      {t("dataBadge.secure")}
    </span>
  );
}
