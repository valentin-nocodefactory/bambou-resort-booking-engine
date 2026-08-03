/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Charte réelle Bambou Resort (extraite de bambouresort.com) ──────────
        beige: { DEFAULT: "#fffbf0", deep: "#f3ecd9" }, // fond chaud + beige profond (bordures/sections)
        corail: { DEFAULT: "#ff6f62", soft: "#ff8a7f", dark: "#e85b4f" }, // accent / CTA — le « pop » de la marque
        marine: { DEFAULT: "#061a2d", soft: "#0e2c47" }, // bleu nuit — texte, surfaces sombres, structure

        // ── Alias rétro-compat : anciens noms → charte réelle (rôles préservés) ──
        // Les composants existants (bg-turquoise, text-creole, bg-cream…) restent
        // automatiquement dans la charte, sans réécriture.
        turquoise: { DEFAULT: "#061a2d", vivid: "#ff6f62" }, // primaire/liens → marine ; accent vif → corail
        teal: { deep: "#061a2d" }, // fonds sombres / hero → marine
        creole: { DEFAULT: "#ff6f62", soft: "#ff8a7f" }, // accent chaud → corail
        sand: "#f3ecd9",
        cream: "#fffbf0",
        ink: "#061a2d",
      },
      fontFamily: {
        display: ['"Instrument Serif"', "ui-serif", "Georgia", "serif"],
        body: ['"Urbanist"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 40px -12px rgba(6, 26, 45, 0.18)",
        float: "0 24px 60px -20px rgba(6, 26, 45, 0.38)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      backgroundImage: {
        "hero-fade":
          "linear-gradient(180deg, rgba(6,26,45,0.15) 0%, rgba(6,26,45,0.55) 55%, rgba(6,26,45,0.9) 100%)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
        "scale-in": "scale-in 0.25s ease-out both",
      },
    },
  },
  plugins: [],
};
