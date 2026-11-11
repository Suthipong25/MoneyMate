import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-bg-primary)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          elevated: 'var(--color-surface-elevated)',
          muted: 'var(--color-surface-muted)',
        },
        brand: {
          DEFAULT: 'var(--color-brand-primary)',
          hover: 'var(--color-brand-hover)',
          soft: 'var(--color-brand-soft)',
        },
        sky: {
          DEFAULT: 'var(--color-sky)',
          soft: 'var(--color-sky-soft)',
        },
        income: {
          DEFAULT: 'var(--color-income)',
          soft: 'var(--color-income-soft)',
        },
        expense: {
          DEFAULT: 'var(--color-expense)',
          soft: 'var(--color-expense-soft)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          soft: 'var(--color-warning-soft)',
        },
        ink: {
          DEFAULT: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          strong: 'var(--color-border-strong)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
        cute: ['var(--font-cute)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        outer: '1.25rem',    /* 20px = inner (12px) + padding (8px) concentric radius */
        inner: '0.75rem',    /* 12px */
      },
    },
  },
  plugins: [],
};

export default config;
