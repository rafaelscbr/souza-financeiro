/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Superfícies (tema claro estilo ContaAzul)
        base: '#F4F6FA', // fundo da aplicação
        surface: {
          DEFAULT: '#FFFFFF', // cards
          2: '#F1F4F9', // hover / campos
          3: '#E7ECF3', // elementos mais marcados
        },
        line: '#E6EAF1', // bordas sutis
        content: {
          DEFAULT: '#0F172A', // texto principal
          muted: '#5B6675', // texto secundário
          faint: '#94A3B8', // texto terciário
        },
        // Marca do grupo
        emerald: {
          DEFAULT: '#10B981',
          dark: '#059669',
          soft: '#E7F7F1',
        },
        brandblue: {
          DEFAULT: '#2563EB',
          soft: '#EAF1FE',
        },
        gold: {
          DEFAULT: '#B08900',
          soft: '#FBF3DC',
        },
        // Semânticas financeiras (contraste AA sobre branco)
        income: '#059669',
        expense: '#DC2626',
        withdrawal: '#7C3AED',
        pending: '#D97706',
        healthy: '#059669',
        warning: '#D97706',
        critical: '#DC2626',
        // Marcas das empresas
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
        card: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
        pop: '0 12px 40px -12px rgba(16,24,40,0.20)',
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
