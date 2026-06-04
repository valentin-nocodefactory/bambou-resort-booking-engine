import { useEffect, useState } from "react";

// Image avec fallback dégradé tropical si l'URL est absente ou renvoie une erreur (404…).
export function Photo({
  src,
  alt,
  className = "",
  gradient = "from-turquoise via-turquoise-vivid to-creole",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  gradient?: string;
}) {
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [src]);

  if (!src || err) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`bg-gradient-to-br ${gradient} ${className}`}
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setErr(true)}
      className={className}
    />
  );
}
