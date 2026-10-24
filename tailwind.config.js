/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F9F6EF",
        card: "#FFFFFF",
        ink: { DEFAULT: "#1F1F1F", soft: "#57534E", faint: "#8A857C" },
        teal: { DEFAULT: "#2F5D5B", soft: "#E4EEEA", deep: "#244A48" },
        vermilion: { DEFAULT: "#B44D3C", soft: "#F6E6E1", deep: "#8F3527" },
        jade: { DEFAULT: "#8CA695", soft: "#EDF2EC", deep: "#6E8C7A" },
        gold: { DEFAULT: "#D4C19A", soft: "#F5EFDF", deep: "#B09B6B" },
        line: "#E5E0D5",
        danger: "#9B2C1F",
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', "Songti SC", "SimSun", "serif"],
        sans: ['"PingFang SC"', '"Microsoft YaHei"', "system-ui", "sans-serif"],
      },
      borderRadius: { DEFAULT: "8px" },
      boxShadow: {
        card: "0 1px 2px rgba(31,31,31,0.03), 0 2px 8px rgba(31,31,31,0.04)",
        pop: "0 6px 28px rgba(31,31,31,0.12)",
      },
    },
  },
  plugins: [],
};
