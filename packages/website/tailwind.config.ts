import type { Config } from "tailwindcss";

// Terminal palette — amber-on-black with green/red data accents.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        term: {
          bg: "#050807",
          panel: "#0A100D",
          panel2: "#0D1511",
          border: "#1C2A22",
          bright: "#22392E",
        },
        amber: {
          DEFAULT: "#FFB000",
          dim: "#8A6A1C",
          hi: "#FFD23F",
        },
        pos: "#2BD96A",
        neg: "#FF4545",
        cyan: "#35C9E8",
        dim: "#5C6B63",
        paper: "#D8E2DC",
      },
      fontFamily: {
        mono: ["'IBM Plex Mono'", "'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
