/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // INSTITUTIONAL PALETTE
        brand: {
          DEFAULT: "#1e3a8a", // Deep Academic Blue (Primary)
          light: "#3b82f6", // Action Blue
          dark: "#172554", // Navbar/Footer
        },
        // SEMANTIC STATUS COLORS
        status: {
          present: "#15803d", // Green-700
          absent: "#b91c1c", // Red-700
          leave: "#a16207", // Yellow-700
          pending: "#c2410c", // Orange-700
        },
        // NEUTRALS
        surface: {
          DEFAULT: "#ffffff", // Cards
          muted: "#f8fafc", // Backgrounds
          border: "#e2e8f0", // Dividers
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"], // Clean, modern font
      },
    },
  },
  plugins: [],
};
