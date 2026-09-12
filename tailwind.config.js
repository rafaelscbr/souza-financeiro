/** @type {import('tailwindcss').Config} */

// Cor via variável CSS em RGB triplo — permite alpha (bg-income/12) e troca de
// tema sem um único `dark:` no app. Os valores ficam em src/index.css, com o
// contraste de cada par calculado ao lado.
const v = (name) => `rgb(var(${name}) / <alpha-value>)`

export default {
  darkMode: ['selector', '[data-theme="dark"]'],
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
        /*
         * `papel`, não `base`: existe um TAMANHO de fonte chamado `base` (o
         * corpo de 15px, usado em 95 lugares), e o Tailwind gera a mesma
         * classe `text-base` para o tamanho e para a cor. A cor ganhava, e
         * todo texto sem cor explícita saía branco sobre branco. Um nome, um
         * significado.
         */
        papel: v('--c-base'),
        surface: {
          DEFAULT: v('--c-surface'),
          2: v('--c-surface-2'),
          3: v('--c-surface-3'),
        },
        // line = fio decorativo entre linhas · rule = fio que carrega leitura
        line: v('--c-line'),
        rule: v('--c-rule'),
        content: {
          DEFAULT: v('--c-content'),
          muted: v('--c-content-muted'),
          faint: v('--c-content-faint'),
        },
        // Ação: o navy da marca. Único clicável do sistema.
        action: {
          DEFAULT: v('--c-action'),
          ink: v('--c-action-ink'),
          hover: v('--c-action-hover'),
          soft: v('--c-action-soft'),
          'soft-ink': v('--c-action-soft-ink'),
        },
        // Ouro. Chamado `seal` de propósito: #E4B23C dá 1,96:1 sobre branco, e
        // quem o alcançar como cor de TEXTO produz uma tela inacessível. Só
        // existe como preenchimento (bg-seal + text-seal-ink) e como o disco.
        seal: {
          DEFAULT: v('--c-seal'),
          ink: v('--c-seal-ink'),
          dot: v('--c-seal-dot'),
        },
        income: {
          DEFAULT: v('--c-income'),
          field: v('--c-income-field'),
          ink: v('--c-income-ink'),
        },
        critical: {
          DEFAULT: v('--c-critical'),
          field: v('--c-critical-field'),
          ink: v('--c-critical-ink'),
        },
        expense: v('--c-expense'),
        // Previsto não tem cor tônica — só tinta neutra e borda de 3,54:1.
        forecast: {
          ink: v('--c-forecast-ink'),
          border: v('--c-forecast-border'),
        },
        // A marca, medida no PNG. 98,97% da tinta é o navy; 0,15% é o ouro.
        marca: {
          navy: '#0F1730',
          ouro: '#E4B23C',
        },
      },

      fontFamily: {
        // Texto de interface. Rebaixada: deixa de ser a fonte dos números.
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        // Números e número-herói. A letra do wordmark SOUZA.
        cifra: ['Archivo', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
        // A letra do descritor IMOBILIÁRIA: slab de barra 2,71× a haste.
        slab: ['Roboto Slab', 'ui-serif', 'Georgia', 'serif'],
      },

      /*
       * Seis degraus, entrelinha embutida, e os NOMES DO TAILWIND preservados
       * de propósito: das 350 declarações de tamanho no app, 290 usam estes
       * nomes e migram sozinhas ao redefinir os valores aqui. Inventar
       * micro/corpo/metric transformaria 60 edições em 350.
       *
       * Piso absoluto: 12px (xs). Morrem os cinco degraus empilhados entre 10
       * e 15px — eram 114 usos de 10-11px a 2,56:1, lidos em pé, no sol.
       * Nada que carregue número, data ou unidade desce abaixo de 12px.
       */
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }], //      12/16 rótulo, cabeçalho de tabela
        sm: ['0.8125rem', { lineHeight: '1.125rem' }], // 13/18 metadado, data, base × %
        base: ['0.9375rem', { lineHeight: '1.375rem' }], // 15/22 prosa, rótulo de linha
        lg: ['1.0625rem', { lineHeight: '1.5rem' }], //   17/24 título de tela e seção
        xl: ['1.375rem', { lineHeight: '1.75rem' }], //   22/28 DINHEIRO EM LISTA — o degrau de comparação
        '2xl': ['1.625rem', { lineHeight: '1.875rem' }], // 26/30 herói que estourou 7 dígitos
        '3xl': ['2.125rem', { lineHeight: '2.25rem' }], // 34/36 O NÚMERO HERÓI (celular)
        '4xl': ['2.5rem', { lineHeight: '2.625rem' }], //  40/42 o mesmo, ≥640px
      },

      /*
       * Raio PROPORCIONAL, não fixo. A moldura do símbolo tem raio de 64px
       * sobre lado de 272px = 23,5%. Daí a regra: raio ≈ 24% da altura.
       * Campo/botão de 44px → 10px. Chip de 24px → 6px. Folha → 20px (teto).
       * `marca` é o único raio percentual: é o que faz o símbolo parecer o
       * mesmo a 32px e a 80px (rounded-xl fixo vira 39% a 36px e 22% a 80px —
       * é por isso que a marca atual não escala).
       */
      borderRadius: {
        md: '0.375rem', //  6px — chip
        lg: '0.625rem', // 10px — campo, botão
        xl: '0.625rem', // 10px
        '2xl': '0.875rem', // 14px
        '3xl': '1.25rem', // 20px — teto: folha inferior, modal
        marca: '24%',
      },

      boxShadow: {
        // Elevação curta do bloco, tingida de navy. `pop` é só para o que de
        // fato flutua: modal, folha inferior, toast.
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },

      spacing: {
        // Goteira do selo de situação e piso de alvo tocável.
        toque: '2.75rem', // 44px
      },

      keyframes: {
        // Sem translateY: quatro pixels de subida numa lista de dinheiro leem
        // como carregamento, e o app passava a piscar "espere" a cada tela.
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
        // O recibo: a linha afetada lava do ouro para transparente, uma vez,
        // depois de uma baixa confirmada. Única animação celebratória do
        // sistema, e só em ação irreversível do próprio usuário.
        recibo: {
          from: { backgroundColor: 'rgb(var(--c-seal) / 0.22)' },
          to: { backgroundColor: 'rgb(var(--c-seal) / 0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.18s ease-out',
        'scale-in': 'scale-in 0.18s ease-out',
        'slide-up': 'slide-up 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        recibo: 'recibo 0.6s ease-out',
      },
    },
  },
  plugins: [],
}
