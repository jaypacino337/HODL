import type { Config } from "tailwindcss";

// Rally — a rally poster: cream paper, black ink, signal orange.
// Deliberately light and loud; nothing like a dark crypto dashboard.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F3EDE2",
        surface: "#FFFCF6",
        raised: "#EAE2D3",
        edge: "#CDC2AE",
        text: "#17150F",
        muted: "#6A6253",
        accent: "#FF4A1C",
        "accent-dim": "#DB3A0F",
        ink: "#17150F",
        success: "#178A4C",
        danger: "#C8203A",
        warn: "#A86F00",
      },
      fontFamily: {
        sans: ["'Bricolage Grotesque'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "Menlo", "monospace"],
      },
      borderRadius: { xl: "10px", "2xl": "14px" },
      boxShadow: {
        card: "3px 3px 0 #17150F",
        glow: "5px 5px 0 #FF4A1C",
      },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        pulseDot: { "0%,100%": { opacity: "1" }, "50%": { opacity: ".35" } },
      },
      animation: {
        rise: "rise .28s ease-out both",
        "pulse-dot": "pulseDot 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
