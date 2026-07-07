/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        farm: {
          green: "#2E7D32",
          light: "#A5D6A7",
          blue: "#1E3A8A",
          yellow: "#FBC02D",
          bg: "#F5F5F5"
        }
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Poppins", "sans-serif"]
      },
      boxShadow: {
        soft: "0 10px 25px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};
