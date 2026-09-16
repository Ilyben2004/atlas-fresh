/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#fafbf4",
        ink: "#3d4806",
        "ink-deep": "#1b1d00",
        muted: "#6d7208",
        "muted-soft": "#454837",
        accent: "#8fa723",
        "accent-strong": "#9aae37",
        "accent-dark": "#7e941e",
        "accent-border": "#7d931d",
        line: "#eaf1ac",
        "line-strong": "#e3e566",
        "header-band": "#f4f8d8",
        "chip-bg": "#f2f7d2",
        "warn-bg": "#fef3c7",
        "warn-ink": "#654a09",
        "warn-accent": "#9b4500",
        "warn-border": "#f59e0b",
        "row-alt": "#fcfdf9",
        "row-line": "#f0f4ce",
      },
      fontFamily: {
        display: ['"Space Grotesk"', "sans-serif"],
        body: ['"Hanken Grotesk"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
      },
      maxWidth: {
        shell: "1600px",
      },
      boxShadow: {
        none: "none",
      },
    },
  },
  plugins: [],
};
