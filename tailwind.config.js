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

        /* -------------- Fundamentos 5.1: tokens derivados (index.css) -------------- */
        'fio-caixa': c('--fio-caixa'),
        'fio-linha': c('--fio-linha'),
        'fio-controle': c('--fio-controle'),
        'borda-ouro': c('--borda-ouro'),
        't-meta': c('--t-meta'),
        'linha-hover': c('--linha-hover'),
        'linha-press': c('--linha-press'),
        'success-ink': c('--success-ink'),
        'warning-ink': c('--warning-ink'),
        'error-ink': c('--error-ink'),
        'info-ink': c('--info-ink'),

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
       * Fundamentos 6.1: um nome por papel. A família vem junto no componente
       * (`font-heading` nos papéis Sora). Pares por largura: `text-X-m lg:text-X`.
       * `rotulo` pede também `uppercase` (fontSize não carrega text-transform).
       * `campo` não é token: é a classe .campo do index.css.
       * Nenhum nome aqui repete um nome de `colors` (texto-meta é tamanho, t-meta é cor).
       */
      fontSize: {
        'numero-heroi': ['34px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '800' }],
        'numero-heroi-m': ['28px', { lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '800' }],
        'numero-kpi': ['28px', { lineHeight: '32px', letterSpacing: '-0.015em', fontWeight: '700' }],
        'numero-kpi-m': ['22px', { lineHeight: '28px', letterSpacing: '-0.015em', fontWeight: '700' }],
        'titulo-pagina': ['19px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '700' }],
        'titulo-pagina-m': ['17px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '700' }],
        'titulo-painel': ['16px', { lineHeight: '24px', letterSpacing: '-0.005em', fontWeight: '600' }],
        'titulo-secao': ['15px', { lineHeight: '24px', letterSpacing: '0', fontWeight: '600' }],
        'valor-destaque': ['17px', { lineHeight: '24px', letterSpacing: '-0.005em', fontWeight: '600' }],
        'valor-linha': ['15px', { lineHeight: '20px', letterSpacing: '0', fontWeight: '600' }],
        'valor-fato': ['14px', { lineHeight: '20px', letterSpacing: '0', fontWeight: '500' }],
        'texto-titulo': ['14px', { lineHeight: '20px', letterSpacing: '0', fontWeight: '500' }],
        texto: ['14px', { lineHeight: '20px', letterSpacing: '0', fontWeight: '400' }],
        'texto-corrido': ['14px', { lineHeight: '22px', letterSpacing: '0', fontWeight: '400' }],
        'texto-meta': ['13px', { lineHeight: '20px', letterSpacing: '0', fontWeight: '400' }],
        nota: ['12px', { lineHeight: '16px', letterSpacing: '0', fontWeight: '400' }],
        rotulo: ['11px', { lineHeight: '16px', letterSpacing: '0.14em', fontWeight: '500' }],
        chip: ['11px', { lineHeight: '16px', letterSpacing: '0', fontWeight: '600' }],
        botao: ['14px', { lineHeight: '20px', letterSpacing: '0', fontWeight: '600' }],
        'botao-secundario': ['14px', { lineHeight: '20px', letterSpacing: '0', fontWeight: '500' }],
      },

      /* Fundamentos 5.3: cinco raios (rounded-full vem do Tailwind). */
      borderRadius: {
        badge: '6px',
        controle: '8px',
        caixa: '14px',
        sobreposicao: '20px',
        // A moldura do "S" da marca: 25%, fora dos cinco.
        marca: '25%',
      },

      /* Fundamentos 3.2: espaço semântico (valores responsivos no index.css). */
      spacing: {
        recuo: 'var(--recuo)',
        margem: 'var(--margem-pagina)',
        bloco: 'var(--vao-bloco)',
        secao: 'var(--vao-secao)',
        topo: 'var(--topo-conteudo)',
        linha: 'var(--linha-y)',
        goteira: 'var(--goteira)',
        cabecalho: 'var(--altura-cabecalho)',
        faixa: 'var(--altura-faixa)',
        // Alvo de toque: 44px.
        toque: '2.75rem',
      },

      /* Fundamentos 4.5: camadas. Nenhum `z-` literal no código. */
      zIndex: {
        cabecalho: 'var(--z-cabecalho)',
        nav: 'var(--z-nav)',
        veu: 'var(--z-veu)',
        painel: 'var(--z-painel)',
        popover: 'var(--z-popover)',
        modal: 'var(--z-modal)',
        toast: 'var(--z-toast)',
        paleta: 'var(--z-paleta)',
      },

      /* Fundamentos 8.1. DEFAULT: toda `transition*` existente herda micro/cor. */
      transitionDuration: {
        DEFAULT: 'var(--dur-micro)',
        toque: 'var(--dur-toque)',
        micro: 'var(--dur-micro)',
        pagina: 'var(--dur-pagina)',
        lista: 'var(--dur-lista)',
        painel: 'var(--dur-painel)',
        saida: 'var(--dur-saida)',
        barra: 'var(--dur-barra)',
        contagem: 'var(--dur-contagem)',
      },
      transitionTimingFunction: {
        DEFAULT: 'var(--curva-cor)',
        entra: 'var(--curva-entra)',
        sai: 'var(--curva-sai)',
        cor: 'var(--curva-cor)',
      },

      /*
       * DEPRECADO — apagar na limpeza final. `animate-fade-in` (10 telas de
       * admin/corretor) e `animate-recibo` (ui/Lista.tsx) ainda são usados, mas
       * não animam mais (8.2: keyframes antigos saem; 8.4: nada de cor em
       * keyframe). A entrada nova é `.entrada-pagina`. scale-in e slide-up não
       * tinham uso e saíram, com todos os keyframes antigos do Tailwind.
       */
      animation: {
        'fade-in': 'none',
        recibo: 'none',
      },
    },
  },
  plugins: [],
}
