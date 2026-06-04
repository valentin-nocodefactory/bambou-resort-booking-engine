// Marque Bambou Resort — wordmark Fraunces + « Resort » lettré.
export function Brand({ className = "", subtle = false }: { className?: string; subtle?: boolean }) {
  return (
    <div className={`flex items-baseline gap-2 ${className}`}>
      <span className="font-display text-2xl font-semibold tracking-tight sm:text-[1.7rem]">Bambou</span>
      <span
        className={`text-xs font-semibold uppercase tracking-[0.3em] ${subtle ? "opacity-60" : "text-creole"}`}
      >
        Resort
      </span>
    </div>
  );
}
