/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Palette Bambou Resort (inspirée de bambouresort.com)
        turquoise: {
          DEFAULT: "#0E7E8C", // primaire — turquoise des Caraïbes
          vivid: "#2BB4C6", // turquoise vif (accents lumineux)
        },
        teal: {
          deep: "#093E47", // vert-canard profond — fonds sombres / hero
        },
        creole: {
          DEFAULT: "#E89A3C", // jaune/orange créole — accent, bungalows
          soft: "#F2B968",
        },
        sand: "#ECE5D6",
        cream: "#F5F1E8",
        ink: "#143230",
      },
      fontFamily: {
        display: ['"Fraunces"', "ui-serif", "Georgia", "serif"],
        body: ['"Manrope"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 40px -12px rgba(9, 62, 71, 0.25)",
        float: "0 24px 60px -20px rgba(9, 62, 71, 0.45)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      backgroundImage: {
        "hero-fade":
          "linear-gradient(180deg, rgba(9,62,71,0.15) 0%, rgba(9,62,71,0.55) 55%, rgba(9,62,71,0.88) 100%)",
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
