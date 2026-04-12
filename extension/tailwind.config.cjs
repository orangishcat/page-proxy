/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{html,js,ts,svelte}"],
  theme: {
    extend: {
      colors: {
        gray: {
          950: "#20211f",
          900: "#2b2c2a",
          850: "#333533",
          800: "#3d403d",
          700: "#4d524e",
          600: "#5e635e",
          500: "#787d78",
          400: "#9ea39e",
          300: "#c1c6c1",
          200: "#dcdedc",
          100: "#f2f3f2",
        },
        primary: {
          300: "#f9f0b0",
          400: "#fbb124",
          500: "#efda39",
          600: "#cbb930",
          700: "#a79928",
          800: "#83781f",
        },
        secondary: {
          300: "#e4d4b6",
          400: "#d0b47f",
          500: "#bb9348",
          600: "#9f7d3d",
          700: "#836732",
          800: "#675127",
        },
        accent: {
          300: "#cfedb7",
          400: "#aae081",
          500: "#86d24b",
          600: "#72b240",
          700: "#5e9334",
          800: "#4a7429",
        },
        background: {
          DEFAULT: "#1d1e1d",
          overlay: {
            DEFAULT: "#2D2B25",
            hover: "#393830",
          },
        },
      },
      fontFamily: {
        sans: ["Open Sans", "ui-sans-serif", "system-ui"],
        mono: ["Monaco", "Consolas", "Liberation Mono", "Courier New", "monospace"],
      },
      keyframes: {
        "dialog-in": {
          "0%": { opacity: "0", transform: "translate(-50%, -50%) scale(0.96)" },
          "100%": { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
        },
        "dialog-out": {
          "0%": { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
          "100%": { opacity: "0", transform: "translate(-50%, -50%) scale(0.96)" },
        },
      },
      animation: {
        "dialog-in": "dialog-in 160ms ease-out",
        "dialog-out": "dialog-out 120ms ease-in",
      },
    },
  },
  plugins: [],
};
