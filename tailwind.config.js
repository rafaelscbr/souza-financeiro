/** @type {import('tailwindcss').Config} */

/*
 * Toda cor é uma variável CSS; os valores moram em src/index.css (seção 3 do
 * docs/souza-os.md) e mudam de tema sem um único `dark:` no app.
 *
 * Por que color-mix e não 'var(--x)' puro como está escrito no guia: no
 * Tailwind 3, uma cor que é só var() IGNORA o modificador de opacidade em
 * silêncio. `border-brand/25`, `bg-s3/60` e `ring-brand/40`, que o próprio
 * guia usa, sairiam com opacidade cheia, sem erro nenhum. Com <alpha-value>
 * dentro do color-mix, o Tailwind troca o marcador pela opacidade pedida (ou
 * por 1, ou pela variável --tw-*-opacity) e o modificador volta a funcionar.
 * Funciona também para token que já é rgba, como --brand-tint: 100% devolve o
 * próprio rgba, 50% corta o alfa dele pela metade.
 */
const c = (nome) => `color-mix(in srgb, var(${nome}) calc(<alpha-value> * 100%), transparent)`

export default {
  /*
   * O escuro é o padrão da casa e o claro é `html.light`. Se alguém um dia
   * escrever `dark:`, que ele siga a mesma chave e não o sistema operacional.
   * Mas o caminho certo continua sendo o token, que troca sozinho.
   */
  darkMode: ['selector', 'html:not(.light)'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    /*
     * paths.ts guarda os contornos da marca traçados do PNG: duas strings de
     * ~2KB e ~9KB numa linha só, no formato "M128 71L128 72L122 72…". O
     * extrator de classes do Tailwind trava ao varrer isso — o servidor de
     * desenvolvimento parou de responder e o navegador congelou o renderizador.
     * O arquivo não tem uma única classe, então não há o que varrer nele.
     */
    '!./src/components/marca/paths.ts',
  ],
  theme: {
    extend: {
      colors: {
        /* ------------------- Souza OS, seção 3 (nomes do guia) ------------------- */
        brand: c('--brand'),
        'brand-dark': c('--brand-dark'),
        'brand-tint': c('--brand-tint'),
        'brand-text': c('--brand-text'),
        'brand-fill': c('--brand-fill'),
        'brand-fill-hover': c('--brand-fill-hover'),
        'brand-fill-deep': c('--brand-fill-deep'),
        'brand-fill-text': c('--brand-fill-text'),
        page: c('--page-bg'),
        /*
         * `surface` é o nome do guia. As chaves 2 e 3 são ALIASES DEPRECADOS
         * (bg-surface-2, bg-surface-3) das telas antigas; o guia chama essas
         * camadas de `s2` e `s3`.
         */
        surface: {
          DEFAULT: c('--surface'),
          2: c('--surface-2'),
          3: c('--surface-3'),
        },
        s2: c('--surface-2'),
        s3: c('--surface-3'),
        'nav-surface': c('--nav-bg'),
        'nav-text': c('--nav-text'),
        'nav-muted': c('--nav-muted'),
        'nav-active-text': c('--nav-active-text'),
        'nav-active-bg': c('--nav-active-bg'),
        'nav-hover': c('--nav-hover-bg'),
        'nav-line': c('--nav-line'),
        t1: c('--t1'),
        t2: c('--t2'),
        t3: c('--t3'),
        t4: c('--t4'),
        t5: c('--t5'),
        line: c('--line'),
        'line-strong': c('--line-strong'),
        'line-input': c('--line-input'),
        success: c('--success'),
        'success-bg': c('--success-bg'),
        'success-line': c('--success-line'),
        warning: c('--warning'),
        'warning-bg': c('--warning-bg'),
        'warning-line': c('--warning-line'),
        error: c('--error'),
        'error-bg': c('--error-bg'),
        'error-line': c('--error-line'),
        info: c('--info'),
        'info-bg': c('--info-bg'),
        'info-line': c('--info-line'),

        /*
         * ------------------------- ALIASES DEPRECADOS -------------------------
         * TEMPORÁRIOS. Os nomes da paleta anterior, apontados para o token novo
         * de mesmo trabalho, para as telas que ainda não migraram continuarem
         * compilando e pintando nos dois temas. Nenhum componente novo usa
         * estes nomes; a verificação final apaga o bloco inteiro.
         */
        papel: c('--page-bg'),
        rule: c('--line-strong'),
        content: {
          DEFAULT: c('--t1'),
          muted: c('--t3'),
          faint: c('--t4'),
        },
        action: {
          DEFAULT: c('--brand-fill'),
          ink: c('--brand-fill-text'),
          hover: c('--brand-fill-hover'),
          soft: c('--brand-tint'),
          'soft-ink': c('--brand-text'),
        },
        seal: {
          DEFAULT: c('--brand-fill'),
          ink: c('--brand-fill-text'),
          dot: c('--brand'),
        },
        income: {
          DEFAULT: c('--success'),
          field: c('--success-bg'),
          ink: c('--success'),
        },
        critical: {
          DEFAULT: c('--error'),
          field: c('--error-bg'),
          ink: c('--error'),
        },
        expense: c('--error'),
        forecast: {
          ink: c('--info'),
          border: c('--info-line'),
        },
        marca: {
          navy: c('--marinho'),
          ouro: c('--brand-fill'),
        },
      },

      /*
       * Cor de fio padrão (preflight e `divide-*` sem cor) e anel padrão.
       * Sem isto, uma `border` esquecida sai cinza-200 do Tailwind e um
       * `ring-2` sem cor sai azul: duas cores que não existem na casa.
       */
      borderColor: {
        DEFAULT: 'var(--line)',
      },
      ringColor: {
        /*
         * Função, e não a string de c(): o anel padrão é resolvido por outro
         * caminho do Tailwind, que não entende <alpha-value> dentro de
         * color-mix e cai em silêncio no azul dele. A função recebe a
         * opacidade padrão do anel (0.5) e devolve o ouro nessa medida.
         */
        DEFAULT: ({ opacityValue = 1 } = {}) =>
          `color-mix(in srgb, var(--brand) calc(${opacityValue} * 100%), transparent)`,
      },

      /*
       * `shadow-brand` casa DUAS coisas no Tailwind: a sombra `brand` do guia e
       * a COR de sombra `brand` (que vem de colors). A regra da cor sai depois
       * e reescreve a sombra como `0 4px 14px var(--brand)` a 100%, um halo
       * chapado em vez dos 30% de --brand-shadow. Apontar a cor de sombra
       * `brand` para --brand-shadow faz as duas regras concordarem.
       */
      boxShadowColor: {
        brand: 'var(--brand-shadow)',
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Sora', 'system-ui', 'sans-serif'],
        label: ['Inter', 'system-ui', 'sans-serif'],
      },

      boxShadow: {
        card: 'var(--shadow-card)',
        modal: 'var(--shadow-modal)',
        dropdown: 'var(--shadow-dropdown)',
        brand: '0 4px 14px var(--brand-shadow)',
        /* DEPRECADO — `shadow-pop` das telas antigas; o que flutua agora é modal. */
        pop: 'var(--shadow-modal)',
      },

      /*
       * Tamanho de fonte e raio seguem a escala PADRÃO do Tailwind, que é a do
       * guia (text-xs 12px, text-sm 14px, rounded-lg 8px). Só dois nomes da
       * casa ficam: o raio do símbolo e o alvo de toque.
       */
      borderRadius: {
        // A moldura do "S" da marca: radius ~25% (seção 2), o mesmo a 32px e a 80px.
        marca: '25%',
      },

      spacing: {
        // Alvo de toque da ação principal: 44px (seção 12).
        toque: '2.75rem',
      },

      /*
       * DEPRECADO — animações das telas antigas (animate-fade-in, -scale-in,
       * -slide-up, -recibo). Ficam com a curva da casa até cada tela trocar
       * pelas receitas da seção 7 no index.css. A verificação apaga.
       */
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        recibo: {
          from: { backgroundColor: 'color-mix(in srgb, var(--brand-fill) 22%, transparent)' },
          to: { backgroundColor: 'color-mix(in srgb, var(--brand-fill) 0%, transparent)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slide-up 280ms cubic-bezier(0.16, 1, 0.3, 1)',
        recibo: 'recibo 600ms ease-out',
      },
    },
  },
  plugins: [],
}
