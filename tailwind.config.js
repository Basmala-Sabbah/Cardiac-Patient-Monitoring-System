/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./pages/**/*.html",
    "./src/**/*.{js,html}",
  ],

  darkMode: "class",

  theme: {
    extend: {
      colors: {
        primary: {
          50: "#F0FDF4",
          100: "#DCFCE7",
          200: "#BBF7D0",
          300: "#86EFAC",
          400: "#4ADE80",
          500: "#22C55E",
          600: "#16A34A",
          700: "#15803D",
          800: "#166534",
          900: "#14532D",
        },

        light: {
          background: "#F8FAFC",
          surface: "#FFFFFF",
          card: "#FFFFFF",
          text: "#0F172A",
          secondary: "#475569",
          muted: "#94A3B8",
          border: "#E2E8F0",
        },

        dark: {
          background: "#0F172A",
          surface: "#1E293B",
          card: "#273449",
          text: "#F8FAFC",
          secondary: "#CBD5E1",
          muted: "#94A3B8",
          border: "#334155",
        },

        status: {
          stable: "#16A34A",
          followup: "#D97706",
          critical: "#DC2626",
          urgent: "#DC2626",
        },
      },

      fontFamily: {
        sans: ["Cairo", "sans-serif"],
      },
    },
  },

  plugins: [],
};