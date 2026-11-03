# Guia de tela — Souza 3.0

Este guia é para recompor uma tela no desenho novo. As referências prontas são:

- `src/admin/pages/Inicio.tsx` (Início do administrador)
- `src/corretor/pages/Inicio.tsx` (Início do corretor)
- `src/admin/pages/Receber.tsx` (A receber)
- o protótipo `docs/redesenho-3/prototipo.html`

Leia os três primeiros antes de começar.

## O que nunca muda

- Banco, cálculos, regras e funções de `src/lib`. Recompor tela é **apresentação**.
- Nenhuma conta nova. Os números saem das mesmas funções de hoje.
- Vocabulário:
  - **"vencida"** (vermelho) só para dívida da imobiliária: imposto, despesa e repasse já recebido e não pago.
  - Parcela que a construtora não pagou é **"em atraso"** (âmbar, `text-warning-ink`).
- "Devido agora" e A pagar mantêm a definição de hoje.
- Todo número que hoje abre a composição (`abrir(...)`, `ValorComOrigem`) continua abrindo.
- Repasse de comissão do corretor **não** grava com um clique: o brinde exige o painel.

## A forma de toda tela

1. **Título com uma frase.** `PageLayout subtitulo` recebe a resposta da tela numa linha: o número ou o fato que importa em `<b>`, depois o contexto. Exemplos:
   - "**R$ 27.700,00 previstos** · 3 parcelas, 2 em atraso"
   - "**4 vendas no mês** · R$ 124.200,00 de comissão contratada"

   Dinheiro dentro de JSX é sempre `<Valor valor={…} posto="fato" tinta="…" />`, nunca `formatCurrency` como filho (o verificador reprova).
2. **Faixa de números no lugar do `Heroi`.** Use `FaixaDeMetricas` com uma célula `lider: true` (o número que responde a tela) e 2 ou 3 células de apoio. Quem tinha `aoAbrir` no herói passa `aoClicar` na célula. Para um número só, sem apoio, o `Heroi` pode ficar.
3. **Cartões com uma pergunta cada.** `Cartao.Cabecalho` com `titulo` (substantivo curto) e `meta` (uma frase cinza). Não passe `icone` no cabeçalho.
4. **Ação na linha, e não um painel para tudo.** Lista que dá baixa usa `BaixaNaLinha` (`src/admin/BaixaNaLinha.tsx`) com `useBaixaDeLancamento` ou `useBaixaDeParcela`. O "⋯" abre o painel de sempre.
5. **Listas curtas e pareadas.** Use `grid gap-bloco lg:grid-cols-2` ou `lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]`. Lista de até 6 linhas não ocupa a largura toda: ela forma par com outro bloco. Quando a altura depende dos dados, use `items-start` no grid.
6. **Peças prontas:**
   - `FaixaDeMetricas` (com `lider`)
   - `ListaDeAcoes`, para "o que fazer agora"
   - `Regua` e `PartesDaRegua`, para um todo dividido em partes
   - `GraficoCaixaPrevisto`, para a linha de saldo com o razão embaixo
   - `GraficoAnoEmBarras`, para 12 meses empilhados
   - `TabelaDeDados`, `Tabela`, `Cartao.Lista`/`Linha` e `FiltrosRapidos`, como antes
7. **Cor:**
   - Marinho (`var(--g-entra)` / `text-brand`) só no dado principal da tela.
   - O resto em tinta e cinza.
   - Prevista é cinza.
   - Nada de quadradinho tingido atrás de ícone (`IconeTom` já é ícone solto).
8. **Movimento:** listas novas podem entrar em escada (`style={{ animation: 'sobe var(--dur-lista) var(--curva-entra) ${i*40}ms backwards' }}`) e barras podem crescer (`barraEnche`, `crescer`). Nada além disso.

## Regras do verificador (`node scripts/verificar-design.mjs`)

- Sem `m-*`/`my-*`, sem `transition-colors`/`transition-*` e sem `<li>`/`<tr>` à mão nas telas. Isso só é permitido em `src/components/ui` e `src/components/layout`. Nas telas, use `Linha`, `Tabela` ou as peças prontas.
- Sem raio arbitrário (`rounded-[…]`). Use `rounded-kbd` (4px), `rounded-controle` (6px), `rounded-caixa` (8px) e `rounded-sobreposicao` (12px).
- Sem espaço arbitrário (`p-[…]`, `gap-[…]`).
- Nada de `formatCurrency` como filho de JSX.

## Como conferir

O servidor de desenvolvimento já roda em `http://localhost:5173`. A vitrine com dados de exemplo fica em:

- `http://localhost:5173/demo.html?perfil=admin#/<rota>`
- `http://localhost:5173/demo.html?perfil=corretor#/<rota>`

Rode, nesta ordem:

```bash
./node_modules/.bin/tsc -b --noEmit
node scripts/verificar-design.mjs
node /Users/rafasouza/.claude/skills/design-taste-frontend/scripts/inspect.mjs --app "http://localhost:5173/demo.html?perfil=admin#/vendas" --out .taste-skill/<nome>
```

O inspetor tem de dar 0 FAIL. Abra os JPGs que ele lista (1440, 768 e 390) e olhe de verdade. No celular, confira que nada vaza para o lado.
