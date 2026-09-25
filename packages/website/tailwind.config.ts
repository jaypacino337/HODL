import type { Config } from "tailwindcss";

// THE BOARDROOM — institutional boardroom, financial terminal. Near-black,
// warm walnut, brass, cream type, deep committee green, sharp red for
// rejections. Agent colors identify seats only.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0A0806",
          900: "#12100C",
          850: "#171410",
          800: "#1D1913",
        },
        walnut: {
          900: "#221709",
          800: "#2C1F10",
          700: "#3A2A16",
          600: "#4A371F",
        },
        brass: {
          300: "#E4C87E",
          400: "#D4B569",
          500: "#B08D3E",
          600: "#8C6F2F",
        },
        cream: {
          DEFAULT: "#F0E7D3",
          dim: "#A99C86",
          faint: "#6E6454",
        },
        committee: {
          500: "#2E9E5B",
          700: "#1F5C3D",
          900: "#10321F",
        },
        reject: "#C43333",
      },
      fontFamily: {
        display: ["'Playfair Display'", "Georgia", "serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        seat: "0 12px 40px rgba(0,0,0,0.55)",
        brass: "0 0 24px rgba(212,181,105,0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
