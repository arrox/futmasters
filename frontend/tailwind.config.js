/** @type {import('tailwindcss').Config}
 *
 * FUT 26 palette — retira cyan, trae gold metal + TOTW + Icon.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Shell
        bg: "#05070c",
        bg2: "#0b111a",
        bg3: "#131a26",
        ink: "#f4efe1",
        "ink-muted": "#a9a395",
        "ink-dim": "#6c6657",
        "ink-dark": "#2a2820",
        // Tiers
        gold: {
          DEFAULT: "#f0c460",
          deep: "#caa24b",
          dark: "#7a5c1e",
        },
        silver: {
          DEFAULT: "#d8dde3",
          dark: "#8a93a0",
        },
        bronze: "#c97a4a",
        totw: {
          DEFAULT: "#0e2a6b",
          accent: "#6ec5ff",
        },
        icongold: "#e8c56a",
        "fut-green": "#00ff87",
        danger: "#ff3b5c",
        warning: "#ffb547",
        // compat con código previo (evita romper clases `coral`, `accent`)
        accent: "#f0c460",
        coral: "#ff3b5c",
        soft: "rgba(240,196,96,0.22)",
      },
      fontFamily: {
        display: ["Oswald", "Saira Condensed", "Impact", "sans-serif"],
        sans: ["Saira Condensed", "Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: [
          "JetBrains Mono",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 4px 12px rgba(0,0,0,0.5), 0 20px 60px rgba(0,0,0,0.35)",
        gold: "0 0 0 1px rgba(240,196,96,0.45), 0 0 32px rgba(240,196,96,0.25), 0 10px 40px rgba(0,0,0,0.6)",
        "gold-soft":
          "0 0 0 1px rgba(240,196,96,0.3), 0 0 24px rgba(240,196,96,0.15)",
        totw: "0 0 0 1px rgba(110,197,255,0.45), 0 0 32px rgba(110,197,255,0.3)",
        icon: "0 0 0 1px rgba(232,197,106,0.45), 0 0 40px rgba(232,197,106,0.35)",
      },
      keyframes: {
        walkout: {
          "0%": {
            transform: "scale(0.2) rotateY(-180deg)",
            opacity: "0",
            filter: "brightness(3)",
          },
          "40%": {
            transform: "scale(1.15) rotateY(0)",
            opacity: "1",
            filter: "brightness(1.8)",
          },
          "70%": {
            transform: "scale(1.05) rotateY(0)",
            filter: "brightness(1)",
          },
          "100%": {
            transform: "scale(1) rotateY(0)",
            opacity: "1",
            filter: "brightness(1)",
          },
        },
        flash: {
          "0%,100%": { opacity: "0" },
          "10%,30%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        rays: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
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
        walkout: "walkout 0.8s cubic-bezier(0.2, 1.35, 0.3, 1) both",
        flash: "flash 0.9s ease-out",
        shimmer: "shimmer 2.2s linear infinite",
        rays: "rays 12s linear infinite",
        fadeUp: "fadeUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        pop: "pop 0.4s cubic-bezier(0.2, 1.2, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
