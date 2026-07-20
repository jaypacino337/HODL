import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sherwood: {
          50: "#eefbf3",
          100: "#d5f5e0",
          200: "#a8e9c1",
          300: "#71d69d",
          400: "#3fbd79",
          500: "#1f9f5f",
          600: "#147d4b",
          700: "#12633f",
          800: "#124f35",
          900: "#0b2e1f",
          950: "#061a12",
        },
        gold: {
          400: "#f2cf6d",
          500: "#e6b73f",
          600: "#c8952a",
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      backgroundImage: {
        "radial-fade": "radial-gradient(circle at 50% 0%, rgba(63,189,121,0.18), transparent 60%)",
      },
    },
  },
  plugins: [],
};

export default config;
