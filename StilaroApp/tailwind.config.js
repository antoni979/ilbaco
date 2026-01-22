/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")],
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./features/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#C9A66B", // Soft Ochre
        secondary: "#E3D5C3", // Nude / Beige
        "off-white": "#F7F7F5", // Soft White
        charcoal: "#1C1C1E", // Dark Grey
        "deep-black": "#080808", // Deep Black
        "background-light": "#FAF9F6",
        "background-dark": "#0A0A0A",
        "surface-light": "#FFFFFF",
        "surface-dark": "#1C1C1C",
      },
      fontFamily: {
        display: ["Manrope", "sans-serif"],
        serif: ["Playfair Display", "serif"],
      },
    },
  },
  plugins: [],
}
