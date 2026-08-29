import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#070706",
        surface: "#11110f",
        "surface-2": "#1b1b18",
        border: "#34342e",
        muted: "#97978e",
        text: "#f3f1e8",
        accent: "#d6ff45",
        "accent-dim": "#93ae39",
        danger: "#ff5a4f",
        warn: "#ffc857",
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Arial Narrow", "sans-serif"],
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
