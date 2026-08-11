import { lazy, Suspense, useEffect, useState } from "react";
import { useBooking } from "../state/booking";
import { t } from "../i18n";
import { EMAIL_RE } from "../lib/format";
import { upgradeRooms } from "../lib/shaping";
import { StepLayout } from "../components/StepLayout";
import { IconArrowRight } from "../components/icons";

// Code-split : libphonenumber-js (~38 Ko gzip) n'est chargé qu'à cette étape.
const PhoneInput = lazy(() => import("../components/PhoneInput").then((m) => ({ default: m.PhoneInput })));

export function Guest() {
  const { selectedRoom, selectedRate, availableRooms, guest, setGuest, goTo } = useBooking();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phoneValid, setPhoneValid] = useState(true);

  // Garde-fou : pas de sélection → retour aux résultats.
  useEffect(() => {
    if (!selectedRoom || !selectedRate) goTo("results");
  }, [selectedRoom, selectedRate, goTo]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!guest.firstName.trim()) errs.firstName = t("guest.err.firstName");
    if (!guest.lastName.trim()) errs.lastName = t("guest.err.lastName");
    if (!EMAIL_RE.test(guest.email.trim())) errs.email = t("guest.err.email");
    // Téléphone OBLIGATOIRE (Culture Créole l'exige côté Mews ; requis partout par choix).
    if (!phoneValid) errs.telephone = t("guest.err.telephone");
    else if (!guest.telephone.trim()) errs.telephone = t("guest.err.telephoneRequired");
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    // Propose le surclassement seulement s'il existe des chambres supérieures.
    const currentTotal = selectedRate?.totalGross ?? selectedRoom?.fromGross ?? 0;
    const hasUpgrades = upgradeRooms(availableRooms, selectedRoom, currentTotal).length > 0;
    goTo(hasUpgrades ? "upgrade" : "extras");
  }

  return (
    <StepLayout
      title={t("guest.title")}
      subtitle={t("guest.subtitle")}
      onBack={() => goTo("results")}
      backLabel={t("guest.backLabel")}
    >
      <form onSubmit={submit} className="card space-y-5 p-5 sm:p-6" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("guest.firstName")} error={errors.firstName} required>
            <input
              className="field-input"
              value={guest.firstName}
              autoComplete="given-name"
              onChange={(e) => setGuest({ firstName: e.target.value })}
            />
          </Field>
          <Field label={t("guest.lastName")} error={errors.lastName} required>
            <input
              className="field-input"
              value={guest.lastName}
              autoComplete="family-name"
              onChange={(e) => setGuest({ lastName: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("guest.email")} error={errors.email} required>
            <input
              type="email"
              className="field-input"
              value={guest.email}
              autoComplete="email"
              placeholder={t("guest.emailPlaceholder")}
              onChange={(e) => setGuest({ email: e.target.value })}
            />
          </Field>
          <Field label={t("guest.phone")} error={errors.telephone} required>
            <Suspense fallback={<div className="field-input animate-pulse text-ink/30">…</div>}>
              <PhoneInput
                value={guest.telephone}
                defaultCountry={guest.nationalityCode}
                onChange={(val, valid) => {
                  setGuest({ telephone: val });
                  setPhoneValid(valid);
                }}
              />
            </Suspense>
          </Field>
        </div>

        <Field label={t("guest.notes")}>
          <textarea
            className="field-input min-h-[90px] resize-y"
            value={guest.notes}
            placeholder={t("guest.notesPlaceholder")}
            onChange={(e) => setGuest({ notes: e.target.value })}
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-cream/60 p-3 text-sm text-ink/75">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-turquoise"
            checked={guest.sendMarketingEmails}
            onChange={(e) => setGuest({ sendMarketingEmails: e.target.checked })}
          />
          {t("guest.marketing")}
        </label>

        <div className="flex justify-end pt-1">
          <button type="submit" className="btn-primary">
            {t("guest.continue")} <IconArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </StepLayout>
  );
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="field-label">
        {label} {required && <span className="text-creole">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
