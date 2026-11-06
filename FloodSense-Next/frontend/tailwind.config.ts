import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "Arial", "sans-serif"] },
      colors: { navy: "#101f34", brand: "#2563eb" },
      boxShadow: {
        panel: "0 1px 2px rgba(17,33,61,.03),0 10px 34px rgba(22,42,69,.035)",
      },
    },
  },
  plugins: [],
} satisfies Config;
