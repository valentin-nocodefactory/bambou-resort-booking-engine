import { useState } from "react";

interface Country {
  code: string;
  name: string;
  dial: string;
  flag: string;
  groups: number[]; // découpage du numéro national pour le masque
}

// Liste ciblée (Martinique/France en tête car c'est le marché du resort).
const COUNTRIES: Country[] = [
  { code: "FR", name: "France", dial: "33", flag: "🇫🇷", groups: [1, 2, 2, 2, 2] },
  { code: "MQ", name: "Martinique", dial: "596", flag: "🇲🇶", groups: [3, 2, 2, 2] },
  { code: "GP", name: "Guadeloupe", dial: "590", flag: "🇬🇵", groups: [3, 2, 2, 2] },
  { code: "GF", name: "Guyane", dial: "594", flag: "🇬🇫", groups: [3, 2, 2, 2] },
  { code: "BE", name: "Belgique", dial: "32", flag: "🇧🇪", groups: [3, 2, 2, 2] },
  { code: "CH", name: "Suisse", dial: "41", flag: "🇨🇭", groups: [2, 3, 2, 2] },
  { code: "LU", name: "Luxembourg", dial: "352", flag: "🇱🇺", groups: [3, 3, 3] },
  { code: "CA", name: "Canada", dial: "1", flag: "🇨🇦", groups: [3, 3, 4] },
  { code: "US", name: "États-Unis", dial: "1", flag: "🇺🇸", groups: [3, 3, 4] },
  { code: "GB", name: "Royaume-Uni", dial: "44", flag: "🇬🇧", groups: [4, 6] },
  { code: "DE", name: "Allemagne", dial: "49", flag: "🇩🇪", groups: [3, 3, 4] },
  { code: "ES", name: "Espagne", dial: "34", flag: "🇪🇸", groups: [3, 2, 2, 2] },
  { code: "IT", name: "Italie", dial: "39", flag: "🇮🇹", groups: [3, 3, 4] },
  { code: "NL", name: "Pays-Bas", dial: "31", flag: "🇳🇱", groups: [1, 4, 4] },
  { code: "PT", name: "Portugal", dial: "351", flag: "🇵🇹", groups: [3, 3, 3] },
  { code: "MA", name: "Maroc", dial: "212", flag: "🇲🇦", groups: [3, 3, 3] },
  { code: "SN", name: "Sénégal", dial: "221", flag: "🇸🇳", groups: [2, 3, 2, 2] },
  { code: "BR", name: "Brésil", dial: "55", flag: "🇧🇷", groups: [2, 5, 4] },
];

const DEFAULT = COUNTRIES[0];
const byCode = (code?: string) => COUNTRIES.find((c) => c.code === code);

function formatNational(digits: string, groups: number[]): string {
  const parts: string[] = [];
  let i = 0;
  for (const g of groups) {
    if (i >= digits.length) break;
    parts.push(digits.slice(i, i + g));
    i += g;
  }
  if (i < digits.length) parts.push(digits.slice(i));
  return parts.join(" ");
}

// Sépare une valeur E.164 (+33612…) en pays + chiffres nationaux.
function parseValue(value: string): { country: Country; national: string } | null {
  if (!value || !value.startsWith("+")) return null;
  const rest = value.slice(1).replace(/\D/g, "");
  // plus long indicatif qui matche
  const match = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find((c) => rest.startsWith(c.dial));
  if (!match) return null;
  return { country: match, national: rest.slice(match.dial.length) };
}

const isValid = (digits: string) => digits.length >= 6 && digits.length <= 15;

// Champ téléphone international : indicatif + masque de saisie + validation.
export function PhoneInput({
  value,
  defaultCountry,
  onChange,
}: {
  value: string;
  defaultCountry?: string;
  onChange: (e164: string, valid: boolean) => void;
}) {
  const parsed = parseValue(value);
  const [country, setCountry] = useState<Country>(parsed?.country ?? byCode(defaultCountry) ?? DEFAULT);
  const [national, setNational] = useState<string>(parsed?.national ?? "");

  const emit = (c: Country, digits: string) =>
    onChange(digits ? `+${c.dial}${digits}` : "", digits ? isValid(digits) : true);

  function onCountry(code: string) {
    const c = byCode(code) ?? DEFAULT;
    setCountry(c);
    emit(c, national);
  }
  function onNational(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 15);
    setNational(digits);
    emit(country, digits);
  }

  const placeholder = formatNational("0".repeat(country.groups.reduce((a, b) => a + b, 0)), country.groups);

  return (
    <div className="flex gap-2">
      <div className="relative w-36 shrink-0">
        <select
          value={country.code}
          onChange={(e) => onCountry(e.target.value)}
          aria-label="Indicatif pays"
          className="field-input w-full appearance-none truncate pr-7 font-medium"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} +{c.dial} · {c.name}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        className="field-input flex-1"
        placeholder={placeholder}
        value={formatNational(national, country.groups)}
        onChange={(e) => onNational(e.target.value)}
      />
    </div>
  );
}
