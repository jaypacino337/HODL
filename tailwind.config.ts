import type { Config } from "tailwindcss";

// OUTLET — paper-and-ink editorial, wall-power accents. Appliance colors
// identify plugs only.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F2EFE7",
        plate: "#F7F5EF",
        ink: { DEFAULT: "#151514", 2: "#2C2C2A" },
        mute: "#6E6D66",
        line: "rgba(21,21,20,0.14)",
        dark: { DEFAULT: "#141413", 2: "#1E1E1C", line: "rgba(247,245,239,0.14)", mute: "#8F8E86" },
        current: "#E85D04",
        lamp: "#F2B705",
        fee: "#3056D6",
        oracle: "#0D9488",
        orders: "#C2366F",
        custom: "#B45309",
      },
      fontFamily: {
        sans: ["Archivo", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      transitionTimingFunction: {
        out2: "cubic-bezier(.22,1,.36,1)",
      },
    },
  },
  plugins: [],
};

export default config;
