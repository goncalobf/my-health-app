import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0f14",
        surface: "#131a22",
        "surface-2": "#1b242e",
        border: "#26313d",
        muted: "#8a97a6",
        text: "#e6edf3",
        accent: "#22d3a6",
        "accent-dim": "#178b6d",
        danger: "#f2555a",
        warn: "#f5a623",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Text", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
