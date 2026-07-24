import type { Config } from "tailwindcss";

// OVERBID design system: dark "listing ink" greens, ticket-green up moves,
// coral down moves, amber for the auction-paddle accent.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#050908",
          900: "#0A110E",
          850: "#0D1512",
          800: "#101B16",
          700: "#16241E",
          600: "#1F3129",
        },
        up: {
          300: "#7CF5C1",
          400: "#3BEC9F",
          500: "#00D97C",
          600: "#00A85F",
        },
        down: {
          400: "#FF7A70",
          500: "#FF5D5D",
          600: "#D93636",
        },
        paddle: {
          300: "#FFDE8A",
          400: "#F2C14E",
          500: "#DBA32E",
        },
        paper: "#EFF6F1",
        moss: "#8FA69A",
        line: "rgba(143, 166, 154, 0.18)",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        "glow-up": "0 0 24px rgba(0, 217, 124, 0.25)",
        "glow-soft": "0 18px 50px rgba(0, 0, 0, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
