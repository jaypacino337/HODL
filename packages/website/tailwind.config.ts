import type { Config } from "tailwindcss";

// Palette lifted from the approved game mockup (hodlornohodlgamemockup.html).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        stage: {
          950: "#0B0407",
          900: "#160709",
          800: "#1D0A0D",
          700: "#2A0E11",
        },
        ember: {
          400: "#FF6A55",
          500: "#FF3B30",
          600: "#C40E12",
          700: "#8E060B",
        },
        gold: {
          200: "#FFE9A8",
          300: "#FFD98A",
          400: "#F6C14A",
          500: "#D4A017",
          600: "#B8860B",
        },
        cream: "#FFF6E6",
        smoked: "#C9A8A0",
        good: "#57E389",
      },
      fontFamily: {
        display: ["Anton", "Impact", "'Arial Narrow Bold'", "sans-serif"],
        body: ["'Barlow Semi Condensed'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "glow-gold": "0 0 22px rgba(246,193,74,0.4)",
        "glow-red": "0 0 22px rgba(255,45,40,0.55)",
      },
    },
  },
  plugins: [],
};

export default config;
