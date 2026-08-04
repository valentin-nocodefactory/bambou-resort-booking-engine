import type { ReactNode } from "react";
import { BookingSummary } from "./BookingSummary";
import { IconChevron } from "./icons";
import { t } from "../i18n";

// Mise en page commune des étapes guest / extras / paiement :
// contenu principal + récapitulatif sticky.
export function StepLayout({
  title,
  subtitle,
  onBack,
  backLabel = t("stepLayout.back"),
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      {onBack && (
        <button type="button" onClick={onBack} className="btn-link mb-3">
          <IconChevron className="h-4 w-4 rotate-180" />
          {backLabel}
        </button>
      )}
      <h1 className="font-display text-2xl text-ink sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-ink/55">{subtitle}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_21rem]">
        <div className="min-w-0">{children}</div>
        <div className="lg:sticky lg:top-24 lg:self-start">
          <BookingSummary />
        </div>
      </div>
    </div>
  );
}
