/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    screens: {
      tablet: "600px",
      desktop: "1024px",
      wide: "1200px",
      large: "1280px",
      huge: "1440px",
    },
    extend: {
      colors: {
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        interactive: "rgb(var(--color-surface-interactive) / <alpha-value>)",
        recessed: "rgb(var(--color-surface-subtle) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--color-text-primary) / <alpha-value>)",
          secondary: "rgb(var(--color-text-secondary) / <alpha-value>)",
          muted: "rgb(var(--color-text-muted) / <alpha-value>)",
          disabled: "rgb(var(--color-text-disabled) / <alpha-value>)",
        },
        line: {
          subtle: "rgb(var(--color-border-subtle) / <alpha-value>)",
          DEFAULT: "rgb(var(--color-border-default) / <alpha-value>)",
          strong: "rgb(var(--color-border-strong) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--color-accent) / <alpha-value>)",
          action: "rgb(var(--color-action-accent-bg) / <alpha-value>)",
          pressed: "rgb(var(--color-accent-pressed) / <alpha-value>)",
        },
        action: {
          primary: "rgb(var(--color-action-primary-bg) / <alpha-value>)",
          "primary-ink": "rgb(var(--color-action-primary-fg) / <alpha-value>)",
        },
        success: "rgb(var(--color-success) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        error: "rgb(var(--color-error) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "IBM Plex Sans Thai",
          "IBM Plex Sans",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      fontSize: {
        "display-xl": ["3.5rem", { lineHeight: "3.75rem", letterSpacing: "-0.035em", fontWeight: "700" }],
        "display-lg": ["2.75rem", { lineHeight: "3rem", letterSpacing: "-0.03em", fontWeight: "700" }],
        h1: ["2.25rem", { lineHeight: "2.625rem", letterSpacing: "-0.025em", fontWeight: "700" }],
        h2: ["1.75rem", { lineHeight: "2.25rem", letterSpacing: "-0.015em", fontWeight: "600" }],
        h3: ["1.375rem", { lineHeight: "1.875rem", letterSpacing: "-0.01em", fontWeight: "600" }],
        data: ["2rem", { lineHeight: "2.25rem", letterSpacing: "-0.02em", fontWeight: "600" }],
        "data-xl": ["3rem", { lineHeight: "3.25rem", letterSpacing: "-0.025em", fontWeight: "600" }],
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      borderRadius: {
        xs: "2px",
        sm: "4px",
        md: "8px",
      },
      boxShadow: {
        overlay: "0 16px 40px rgb(0 0 0 / 0.38)",
      },
      maxWidth: {
        content: "1440px",
      },
    },
  },
  plugins: [],
};
