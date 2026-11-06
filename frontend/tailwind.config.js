/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Segoe UI Variable Text"', '"Segoe UI"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['"Cascadia Mono"', 'Consolas', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        'surface-3': token('surface-3'),
        border: token('border'),
        'border-strong': token('border-strong'),
        fg: token('fg'),
        muted: token('fg-muted'),
        subtle: token('fg-subtle'),
        primary: token('primary'),
        'primary-fg': token('primary-fg'),
        'primary-hover': token('primary-hover'),
        success: token('success'),
        warning: token('warning'),
        danger: token('danger'),
        info: token('info'),
        violet: token('violet'),
        sidebar: token('sidebar'),
        header: token('header'),
        'header-fg': token('header-fg'),
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        xs: ['0.75rem', { lineHeight: '1.05rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.25rem' }],
        lg: ['1rem', { lineHeight: '1.5rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      },
      borderRadius: {
        DEFAULT: '4px',
        md: '4px',
        lg: '8px',
        xl: '8px',
      },
      boxShadow: {
        card: '0 0 2px rgb(var(--shadow) / 0.12), 0 1px 2px rgb(var(--shadow) / 0.14)',
        pop: '0 0 2px rgb(var(--shadow) / 0.12), 0 8px 16px rgb(var(--shadow) / 0.14)',
        overlay: '0 0 8px rgb(var(--shadow) / 0.12), 0 32px 64px rgb(var(--shadow) / 0.14)',
        inset: 'inset 0 0 0 1px rgb(var(--border))',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'slide-in-right': { from: { transform: 'translateX(24px)', opacity: 0 }, to: { transform: 'none', opacity: 1 } },
        'pop-in': { from: { transform: 'scale(.97) translateY(4px)', opacity: 0 }, to: { transform: 'none', opacity: 1 } },
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 rgb(var(--danger) / .5)' }, '100%': { boxShadow: '0 0 0 8px rgb(var(--danger) / 0)' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-in-right': 'slide-in-right 200ms cubic-bezier(.2,.8,.2,1)',
        'pop-in': 'pop-in 160ms cubic-bezier(.2,.8,.2,1)',
        'pulse-ring': 'pulse-ring 1.6s ease-out infinite',
      },
    },
  },
  plugins: [],
};
