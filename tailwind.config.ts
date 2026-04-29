import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Legacy primary (alias of accent — keep for backward compat)
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        // Design tokens
        bg: "var(--bg)",
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
        },
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        text: {
          DEFAULT: "var(--text)",
          2: "var(--text-2)",
          3: "var(--text-3)",
          4: "var(--text-4)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          ink: "var(--accent-ink)",
          soft: "var(--accent-soft)",
        },
        positive: {
          DEFAULT: "var(--positive)",
          soft: "var(--positive-soft)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          soft: "var(--warning-soft)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          soft: "var(--danger-soft)",
        },
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'ui-monospace', '"SF Mono"', 'monospace'],
      },
      boxShadow: {
        token: "var(--shadow)",
        "token-sm": "var(--shadow-sm)",
        "token-lg": "var(--shadow-lg)",
      },
      animation: {
        'in': 'fadeIn 0.3s ease-in',
        'slide-in-from-right': 'slideInFromRight 0.3s ease-out',
        'slide-in-from-right-10': 'slideInFromRight10 0.3s ease-out',
        'slide-in-from-bottom': 'slideInFromBottom 0.3s ease-out',
        'zoom-in-95': 'zoomIn95 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInFromRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideInFromRight10: {
          '0%': { transform: 'translateX(10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInFromBottom: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        zoomIn95: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
export default config;
