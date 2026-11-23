import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "bg": "rgb(var(--fitlog-bg) / <alpha-value>)",
        "surface": "rgb(var(--fitlog-surface) / <alpha-value>)",
        "surface-2": "rgb(var(--fitlog-surface-2) / <alpha-value>)",
        "border": "rgb(var(--fitlog-border) / <alpha-value>)",
        "control-border": "rgb(var(--fitlog-control-border) / <alpha-value>)",
        "muted": "rgb(var(--fitlog-muted) / <alpha-value>)",
        "text": "rgb(var(--fitlog-text) / <alpha-value>)",
        "accent": "rgb(var(--fitlog-accent) / <alpha-value>)",
        "accent-hover": "rgb(var(--fitlog-accent-hover) / <alpha-value>)",
        "accent-soft": "rgb(var(--fitlog-accent-soft) / <alpha-value>)",
        "on-accent": "rgb(var(--fitlog-on-accent) / <alpha-value>)",
        "danger": "rgb(var(--fitlog-danger) / <alpha-value>)",
        "warn": "rgb(var(--fitlog-warn) / <alpha-value>)",
        "success": "rgb(var(--fitlog-success) / <alpha-value>)",
        "success-soft": "rgb(var(--fitlog-success-soft) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        display: ["var(--font-manrope)", "system-ui", "sans-serif"],
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
