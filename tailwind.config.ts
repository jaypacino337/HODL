import type { Config } from "tailwindcss";

// Sentia — dark agent studio. Pink = influencers, green = traders,
// gold = the $SENTIA burn.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        studio: "#0E0E11",
        chalk: "#F0EEEA",
        fog: "#8E8D95",
        line: "rgba(240,238,234,0.14)",
        sign: "#FF4D8D",
        trade: "#3DF08C",
        burn: "#F2B705",
      },
      fontFamily: {
        sans: ["Archivo", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      transitionTimingFunction: { out2: "cubic-bezier(.22,1,.36,1)" },
    },
  },
  plugins: [],
};

export default config;
