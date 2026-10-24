/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAF7F1",
        card: "#FFFFFF",
        ink: { DEFAULT: "#1C1A17", soft: "#57534E", faint: "#8A857C" },
        vermilion: { DEFAULT: "#B23A2F", soft: "#F5E3DF", deep: "#8F2B22" },
        jade: { DEFAULT: "#2F6E5A", soft: "#E3EEE8", deep: "#245646" },
        gold: { DEFAULT: "#A8853C", soft: "#F4ECDC" },
        line: "#E7E1D6",
        danger: "#9B2C1F",
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', "Songti SC", "SimSun", "serif"],
        sans: ['"PingFang SC"', '"Microsoft YaHei"', "system-ui", "sans-serif"],
      },
      borderRadius: { DEFAULT: "6px" },
      boxShadow: {
        card: "0 1px 2px rgba(28,26,23,0.04), 0 1px 6px rgba(28,26,23,0.03)",
        pop: "0 4px 24px rgba(28,26,23,0.10)",
      },
    },
  },
  plugins: [],
};
