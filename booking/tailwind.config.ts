import type { Config } from "tailwindcss";
// Same palette as the main Qalb-E-Abbas website (navy · brand blue · gold).
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#0B1B36", 800: "#0E2244", 700: "#13284F" },
        brand: { DEFAULT: "#1F55E0", dark: "#1A47BD", tint: "#EDF2FD" },
        gold: { DEFAULT: "#F5B12E", dark: "#D99A1E" },
        ink: "#0E1E3A",
        body: "#3B4A63",
        muted: "#5F6E85",
        line: "#E3E8F0",
        soft: "#F6F8FC",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: { card: "0 1px 2px rgba(14,30,58,.05), 0 4px 14px -6px rgba(14,30,58,.10)" },
    },
  },
  plugins: [],
} satisfies Config;
