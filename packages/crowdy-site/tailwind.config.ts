import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0B0B10",
        surface: "#15151E",
        raised: "#1C1C28",
        edge: "#252533",
        text: "#ECECF3",
        muted: "#8B8BA3",
        accent: "#7C5CFF",
        "accent-dim": "#5B3FE0",
        success: "#35E08F",
        danger: "#FF5C5C",
        warn: "#FFB84D",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: { xl: "14px", "2xl": "20px" },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,.4), 0 8px 24px -12px rgba(0,0,0,.6)",
        glow: "0 0 0 1px rgba(124,92,255,.35), 0 8px 40px -12px rgba(124,92,255,.45)",
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
