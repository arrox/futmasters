/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0e1a",
        bg2: "#0f1624",
        accent: "#00d4ff",
        coral: "#ff6b6b",
        soft: "rgba(0,212,255,0.2)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(0,212,255,0.2), 0 0 24px rgba(0,212,255,0.12)",
        "glow-strong":
          "0 0 0 1px rgba(0,212,255,0.5), 0 0 32px rgba(0,212,255,0.25)",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { transform: "scale(0.85)", opacity: "0" },
          "60%": { transform: "scale(1.05)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        fadeUp: "fadeUp 0.35s ease-out",
        pop: "pop 0.4s cubic-bezier(0.2, 1.2, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
