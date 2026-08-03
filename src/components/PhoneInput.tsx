import { useState } from "react";
import { AsYouType, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumber, type CountryCode } from "libphonenumber-js";
import { IconCheck } from "./icons";

// Liste ciblée (Martinique/France en tête — marché du resort). Code ISO + drapeau +
// exemple national (placeholder). Indicatif & formatage/validation = libphonenumber-js.
const COUNTRIES: { code: CountryCode; name: string; flag: string; example: string }[] = [
  { code: "FR", name: "France", flag: "🇫🇷", example: "06 12 34 56 78" },
  { code: "MQ", name: "Martinique", flag: "🇲🇶", example: "0696 12 34 56" },
  { code: "GP", name: "Guadeloupe", flag: "🇬🇵", example: "0690 12 34 56" },
  { code: "GF", name: "Guyane", flag: "🇬🇫", example: "0694 12 34 56" },
  { code: "BE", name: "Belgique", flag: "🇧🇪", example: "0470 12 34 56" },
  { code: "CH", name: "Suisse", flag: "🇨🇭", example: "078 123 45 67" },
  { code: "LU", name: "Luxembourg", flag: "🇱🇺", example: "621 123 456" },
  { code: "CA", name: "Canada", flag: "🇨🇦", example: "(506) 234-5678" },
  { code: "US", name: "États-Unis", flag: "🇺🇸", example: "(201) 555-0123" },
  { code: "GB", name: "Royaume-Uni", flag: "🇬🇧", example: "07400 123456" },
  { code: "DE", name: "Allemagne", flag: "🇩🇪", example: "01512 3456789" },
  { code: "ES", name: "Espagne", flag: "🇪🇸", example: "612 34 56 78" },
  { code: "IT", name: "Italie", flag: "🇮🇹", example: "312 345 6789" },
  { code: "NL", name: "Pays-Bas", flag: "🇳🇱", example: "06 12345678" },
  { code: "PT", name: "Portugal", flag: "🇵🇹", example: "912 345 678" },
  { code: "MA", name: "Maroc", flag: "🇲🇦", example: "0650 123456" },
  { code: "SN", name: "Sénégal", flag: "🇸🇳", example: "70 123 45 67" },
  { code: "BR", name: "Brésil", flag: "🇧🇷", example: "11 96123-4567" },
];

const dialOf = (c: CountryCode) => {
  try {
    return getCountryCallingCode(c);
  } catch {
    return "";
  }
};

function safeParse(value: string): { country: CountryCode; national: string } | null {
  if (!value) return null;
  try {
    const pn = parsePhoneNumber(value);
    return pn?.country ? { country: pn.country, national: pn.formatNational() } : null;
  } catch {
    return null;
  }
}

// Champ téléphone international PARFAIT : formatage « as-you-type » et validation
// exacts par pays (libphonenumber-js). Stocke un E.164 valide ; signale l'invalidité.
export function PhoneInput({
  value,
  defaultCountry,
  onChange,
}: {
  value: string;
  defaultCountry?: string;
  onChange: (e164: string, valid: boolean) => void;
}) {
  const init = safeParse(value);
  const fallback = (COUNTRIES.find((c) => c.code === defaultCountry)?.code ?? "FR") as CountryCode;
  const [country, setCountry] = useState<CountryCode>(init?.country ?? fallback);
  const [text, setText] = useState(init?.national ?? "");
  const [valid, setValid] = useState(true);

  function compute(c: CountryCode, raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 18);
    const formatted = digits ? new AsYouType(c).input(digits) : "";
    const ok = digits === "" ? true : isValidPhoneNumber(digits, c);
    let e164 = "";
    if (ok && digits) {
      try {
        e164 = parsePhoneNumber(digits, c)?.number ?? "";
      } catch {
        e164 = "";
      }
    }
    return { formatted, ok, e164 };
  }

  function apply(c: CountryCode, raw: string) {
    const { formatted, ok, e164 } = compute(c, raw);
    setText(formatted);
    setValid(ok);
    onChange(e164, ok);
  }

  const country_ = COUNTRIES.find((c) => c.code === country) ?? COUNTRIES[0];
  const showInvalid = text.trim() !== "" && !valid;
  const showValid = text.trim() !== "" && valid;

  return (
    // UN SEUL champ : segment indicatif (drapeau + code) · séparateur · numéro.
    <div
      className={`flex items-stretch overflow-hidden rounded-xl border bg-white shadow-sm transition focus-within:ring-2 ${
        showInvalid
          ? "border-red-400 focus-within:border-red-400 focus-within:ring-red-200"
          : "border-marine/15 focus-within:border-corail focus-within:ring-corail/25"
      }`}
    >
      <div className="relative w-[5rem] shrink-0">
        {/* Select natif transparent mais interactif (garde le menu déroulant natif). */}
        <select
          value={country}
          onChange={(e) => {
            setCountry(e.target.value as CountryCode);
            apply(e.target.value as CountryCode, text);
          }}
          aria-label="Indicatif pays"
          title={country_.name}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none border-0 bg-transparent pl-4 text-transparent outline-none"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code} className="text-marine">
              {c.flag} +{dialOf(c.code)} · {c.name}
            </option>
          ))}
        </select>
        {/* Affichage compact : drapeau + indicatif seulement. */}
        <span className="pointer-events-none flex h-full items-center gap-1.5 pl-4 pr-5 text-sm font-medium text-marine">
          <span className="text-base leading-none">{country_.flag}</span>
          <span>+{dialOf(country)}</span>
        </span>
        <svg
          className="pointer-events-none absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 text-marine/40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <span className="my-2 w-px shrink-0 bg-marine/12" aria-hidden />

      <div className="relative flex-1">
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          className="h-full w-full border-0 bg-transparent px-3 py-3 pr-9 text-marine outline-none placeholder:text-marine/35"
          placeholder={country_.example}
          value={text}
          onChange={(e) => apply(country, e.target.value)}
        />
        {showValid && (
          <IconCheck className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
        )}
      </div>
    </div>
  );
}
