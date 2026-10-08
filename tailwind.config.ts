import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#080b12",
        surface: "#101623",
        surface2: "#131c2c",
        elevated: "#18223a",
        line: "#222c40",
        brand: { DEFAULT: "#6d8bff", 2: "#9a7bff", ink: "#c7d3ff" },
        sev: { critical: "#f2547d", high: "#ff8a4c", medium: "#f5c451", low: "#3fd1bd" },
        good: "#34d39a",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-sora)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
