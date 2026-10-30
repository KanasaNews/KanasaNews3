import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F7F5EF",
        surface: "#EFECE4",
        ink: "#182223",
        muted: "#5A6562",
        vermilion: "#BF4638",
        slateEditorial: "#243A3E",
        rule: "#DCDED6"
      },
      fontFamily: {
        serif: ["'Source Serif Pro'", "Georgia", "serif"],
        sans: ["'Work Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
