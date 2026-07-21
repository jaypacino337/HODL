import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        stage: {
          950: "#0a0203",
          900: "#140406",
          800: "#22070a",
          700: "#38090e",
        },
        ember: {
          400: "#ff6a3d",
          500: "#ff3d1f",
          600: "#e02412",
          700: "#b3160c",
        },
        gold: {
          200: "#ffe9a8",
          300: "#ffd968",
          400: "#f6b93b",
          500: "#e8a020",
          600: "#c07f12",
        },
      },
      fontFamily: {
        display: ["Anton", "Impact", "'Arial Narrow Bold'", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "glow-gold": "0 0 25px rgba(246,185,59,0.45), 0 0 60px rgba(246,185,59,0.15)",
        "glow-red": "0 0 25px rgba(255,61,31,0.5), 0 0 60px rgba(224,36,18,0.2)",
      },
      backgroundImage: {
        "stage-spotlight":
          "radial-gradient(ellipse at 50% -10%, rgba(255,61,31,0.28), transparent 55%), radial-gradient(ellipse at 15% 110%, rgba(246,185,59,0.12), transparent 50%), radial-gradient(ellipse at 85% 110%, rgba(224,36,18,0.14), transparent 50%)",
        "gold-metal": "linear-gradient(180deg, #ffe9a8 0%, #f6b93b 45%, #c07f12 55%, #f6b93b 100%)",
      },
      keyframes: {
        shimmer: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        shimmer: "shimmer 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
