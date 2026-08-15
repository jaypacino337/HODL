import type { Config } from "tailwindcss";

/**
 * Palette is imported from config/, not retyped. If a colour needs to change it
 * changes in one place.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        neon: "#22FF6A",
        pump: "#1FCB4F",
        ink: "#0A0D10",
        // One step up from ink, for panel fills. Still flat — this is a solid
        // colour, not a gradient.
        slab: "#11161B",
        edge: "#1E262D",
        bone: "#F2F4F0",
        mute: "#7C8B93",
        down: "#E4322B",
      },
      fontFamily: {
        // No webfont fetch: the whole aesthetic is monospace anyway, and a font
        // request is a render-blocking dependency on a third party.
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "DejaVu Sans Mono",
          "monospace",
        ],
      },
      borderRadius: {
        // Hard edges. Nothing in this design is round.
        none: "0",
      },
      boxShadow: {
        // Offset solid shadows, zero blur — the pixel-UI drop shadow.
        pixel: "4px 4px 0 0 #000000",
        "pixel-sm": "2px 2px 0 0 #000000",
        "pixel-neon": "4px 4px 0 0 #1FCB4F",
      },
      keyframes: {
        blink: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0" } },
      },
      animation: { blink: "blink 1s steps(2,start) infinite" },
    },
  },
  plugins: [],
};

export default config;
