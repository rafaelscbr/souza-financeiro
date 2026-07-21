/** @type {import('tailwindcss').Config} */

// Cor via variável CSS em RGB triplo — permite alpha (bg-income/12) e troca de
// tema sem recompilar. Os valores das variáveis ficam em src/index.css.
const v = (name) => `rgb(var(${name}) / <alpha-value>)`

export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: v('--c-base'),
        surface: {
          DEFAULT: v('--c-surface'),
          2: v('--c-surface-2'),
          3: v('--c-surface-3'),
        },
        line: v('--c-line'),
        content: {
          DEFAULT: v('--c-content'),
          muted: v('--c-content-muted'),
          faint: v('--c-content-faint'),
        },
        emerald: {
          DEFAULT: v('--c-emerald'),
          dark: v('--c-emerald-dark'),
          soft: v('--c-emerald-soft'),
        },
        brandblue: {
          DEFAULT: v('--c-brandblue'),
          soft: v('--c-brandblue-soft'),
        },
        gold: {
          DEFAULT: v('--c-gold'),
          soft: v('--c-gold-soft'),
        },
        income: v('--c-income'),
        expense: v('--c-expense'),
        withdrawal: v('--c-withdrawal'),
        pending: v('--c-pending'),
        healthy: v('--c-healthy'),
        warning: v('--c-warning'),
        critical: v('--c-critical'),
        // Marcas das empresas — identidade fixa, não muda com o tema.
        brand: {
          imobiliaria: '#1E3A8A',
          'imobiliaria-accent': '#B08900',
          escola: '#E30B41',
          'escola-accent': '#BE0836',
          assessoria: '#111827',
          'assessoria-accent': '#475569',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'scale-in': 'scale-in 0.18s ease-out',
        'slide-up': 'slide-up 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
