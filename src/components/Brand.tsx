import logoRaw from "../assets/bambou-logo.svg?raw";

// Logo officiel Bambou Resort (emblème + wordmark), repris du site bambouresort.com.
// SVG inline → se colore via `currentColor` : marine sur le header beige (`text-teal-deep`),
// clair sur le footer / la confirmation (`text-cream`). Taille pilotée par la hauteur.
export function Brand({ className = "", subtle = false }: { className?: string; subtle?: boolean }) {
  return (
    <span
      role="img"
      aria-label="Bambou Resort"
      className={`inline-flex h-7 items-center sm:h-8 [&>svg]:h-full [&>svg]:w-auto ${subtle ? "opacity-70" : ""} ${className}`}
      dangerouslySetInnerHTML={{ __html: logoRaw }}
    />
  );
}
