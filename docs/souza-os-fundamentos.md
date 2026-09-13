# Souza OS: fundamentos do financeiro

> ### Precedência (leia antes de tudo)
>
> Este documento vale **acima** de `docs/souza-os.md` em: **espaço, grade e
> contêiner, superfície e elevação, raio, tipografia (escala e papéis),
> anatomia de componente, movimento e plantas de tela.** Onde os dois
> divergirem nesses assuntos, vale este, e os pontos de divergência estão
> marcados **[acima do guia]**.
>
> `docs/souza-os.md` continua valendo, sem mudança, em:
> - **tokens de cor e tema** da seção 3 (escuro em `:root`, claro em
>   `html.light`), fontes **Sora** (títulos e números) e **Inter** (texto);
> - os **Ajustes do Rafael** (sem barra decorativa, sem degradê dentro do app,
>   todo ícone significa algo, um único bloco dourado por tela);
> - as **regras de dado**: previsão não é dívida nem dinheiro; atraso é só o
>   que a imobiliária recebeu e não repassou; a situação vem de
>   `situacaoDeTela()` (`src/lib/situacao.ts`); todo número abre no que o
>   compõe até a parcela da venda; dinheiro nunca abreviado, com centavos,
>   pt-BR; VGV não é receita; o corretor nunca vê o líquido da imobiliária;
>   o banco é a única fonte de verdade (nada de atualização otimista).
>
> Nenhum hex do guia muda. Todo token novo aqui é **derivado** (por
> `color-mix` ou `var()`) de um token do guia, com a razão escrita ao lado.
>
> Este documento responde ao que o Rafael disse em 12/09/2026 sobre a tela da
> Venda: *"elementos sem bordas, sem margens, todo o designer sem respiro"*.
> Cada regra tem um número que um navegador mede (seção 11).

---

## 1. Tese

1. **"Sem bordas, sem margens, sem respiro"** acaba quando o recuo pertence à
   caixa e nenhum filho consegue fugir dele: toda caixa tem fio visível, e
   nenhum texto, selo, valor ou botão fica a menos de 16px (<640), 20px
   (640–1023) ou 24px (≥1024) da borda lateral que o contém, nem a menos de 16px da borda de
   cima ou de baixo.
2. **"Clareza de números"** é um livro-razão: colunas com largura declarada
   uma vez, algarismos tabulares em Sora, valor alinhado à direita, e toda
   conta escrita de cima para baixo (bruto, menos, igual). Nunca uma fileira
   de valores lado a lado sem cabeçalho.
3. **"Parece template"** some quando o sistema é régua e não efeito: uma escala
   de espaço, uma escala de tipo com um nome por papel, cinco raios, um ouro.
   Um lint impede o que está fora.
4. **"Muito gostosa de mexer"** é previsível e rápido: tudo no mesmo lugar em
   toda tela, a ação principal sempre visível, resposta ao toque em até 150ms,
   painel que entra **e sai**, número que troca sem pular.
5. **"Com animações"**, mas movimento que confirma e nunca enfeita: só
   `transform` e `opacity`, curto, na curva da casa, e nada fica invisível se a
   animação falhar.

---

## 2. Princípios

| # | Princípio | Regra mensurável |
|---|---|---|
| P1 | **O recuo pertence à caixa.** | Zero margem negativa em `src/` (lint). Todo texto, ícone, selo, valor e botão dentro de `[data-caixa]` fica a ≥ `--recuo` das bordas **esquerda e direita** (16px <640, 20px 640–1023, 24px ≥1024; herói ≥1024: 32px) e a ≥ 16px das bordas **de cima e de baixo** em qualquer largura. A `Linha` recebe o recuo pela `Lista`, nunca do filho. |
| P2 | **Espaço entre irmãos é `gap` do pai.** | Nenhum componente de `src/components/ui` tem `m*-` no elemento raiz. Irmãos diretos de `<main>` ficam a exatamente `--vao-secao` (24 / 32). |
| P3 | **Uma régua de espaço, uma de tipo.** | Padding, margem e gap só em {0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64} ou token semântico. Zero `text-[Npx]`, zero meio-degrau (`*.5`) em espaço. |
| P4 | **Dinheiro é coluna.** | Todo valor em `tabular-nums`, `nowrap`, alinhado à direita. Numa mesma lista, a borda direita de todos os valores difere em 0px. Nenhuma linha visual com 3+ valores fora de tabela com cabeçalho ou de `Demonstrativo`. |
| P5 | **Um ouro por tela.** | No máximo 1 `[data-heroi]` por rota, e exatamente 1 nas rotas de número (lista em 11, item 17; Config, Recebimentos, Minhas Vendas e Login têm zero): borda `--borda-ouro` + número em ouro (em `error-ink` só se o número for negativo real, 6.3). Nenhum `[data-valor]` em `brand-text` fora do herói. No máximo 1 fundo `brand-fill` por camada (página, painel, modal). Aba, filtro e chip ativos são neutros. Previsão pode ser o herói (decisão do Rafael, 13/09/2026) com a palavra "previsto" no rótulo e **nunca** em ouro: variante `previsto` de 7.5 (borda `fio-caixa`, número em t1); a rota com herói previsto tem zero ouro. |
| P6 | **Camada se diz com fio, não com caixa dentro de caixa.** | Toda caixa tem borda `--fio-caixa`. Nenhum `[data-caixa]` dentro de outro `[data-caixa]`; painel e modal nunca contêm `Cartao`. Borda de campo ≥ 3:1. |
| P7 | **Movimento confirma e sai.** | Keyframes só com `opacity` e `transform`; transição de cor só em controle isolado (8.4). Duração ≤ 280ms (exceções fechadas: barra 520, badge 500, saída do destaque de chegada 520, contagem do herói 700, pulso do esqueleto 1400 em loop). Todo overlay tem saída de 150–200ms. Nada anima em refetch. Com animação desligada, a tela é idêntica ao estado final. |
| P8 | **390px e toque são a régua.** | Em 390px: `scrollWidth ≤ 390`; todo alvo ≥ 44×44; nenhum valor cortado ou em duas linhas; nenhum título com reticência numa linha só. Foco sempre visível e nunca cortado. |

---

## 3. Espaço

### 3.1 Escala

Grade de 4px. **Degraus permitidos em padding, margem e gap** (classe
Tailwind → px):

| Classe | px | Uso típico |
|---|---|---|
| `0` | 0 | — |
| `px` | 1 | fio |
| `1` | 4 | ícone ↔ texto de chip; título ↔ meta |
| `2` | 8 | rótulo ↔ campo; rótulo de grupo ↔ itens; entre botões compactos |
| `3` | 12 | vão da linha; título de seção ↔ conteúdo; entre botões |
| `4` | 16 | colunas da linha; recuo no celular; conteúdo ↔ ações |
| `5` | 20 | recuo de 640 a 1023 |
| `6` | 24 | recuo no computador; entre campos em coluna; entre seções no celular |
| `8` | 32 | entre seções no computador; herói no computador |
| `10` | 40 | — |
| `12` | 48 | respiro de estado vazio |
| `16` | 64 | fim da página no computador |

**Não existem para espaço:** `0.5, 1.5, 2.5, 3.5, 7, 9, 11, 14`. Larguras e
alturas (`w-*`, `h-*`, `size-*`) seguem a escala padrão do Tailwind, porque
selo e ícone precisam de 28 e 36.

### 3.2 Tokens semânticos

Em `src/index.css`, **depois** do bloco copiado do guia (que não muda):

```css
:root{
  --margem-pagina: 16px;   /* lateral da página */
  --recuo: 16px;           /* conteúdo ↔ borda de qualquer caixa */
  --vao-bloco: 16px;       /* entre cartões irmãos numa grade */
  --vao-secao: 24px;       /* entre filhos diretos de <main> */
  --topo-conteudo: 24px;   /* base do cabeçalho → 1º bloco */
  --linha-y: 12px;         /* padding vertical da linha (confortável) */
  --linha-min: 56px;       /* altura mínima da linha */
  --goteira: 28px;         /* coluna do selo/ícone */
  --col-valor: 9rem;       /* 144px: coluna de valor em lista */
  --col-situacao: 7.5rem;  /* 120px: coluna de chip */
  --altura-cabecalho: 56px;
  --altura-faixa: 48px;
  --altura-barra-inferior: 64px;
}
@media (min-width:640px){ :root{ --margem-pagina:24px; --recuo:20px; } }
@media (min-width:1024px){ :root{ --margem-pagina:32px; --recuo:24px; --vao-bloco:24px;
  --vao-secao:32px; --topo-conteudo:32px; --altura-cabecalho:64px; --linha-min:52px; } }
@media (min-width:1536px){ :root{ --margem-pagina:40px; } }
html.compacta{ --linha-y:8px; --linha-min:44px; }
@media (pointer:coarse){ :root, html.compacta{ --linha-min:56px; } }
```

Em `tailwind.config.js` → `theme.extend.spacing`:

```js
recuo:'var(--recuo)', margem:'var(--margem-pagina)', bloco:'var(--vao-bloco)',
secao:'var(--vao-secao)', topo:'var(--topo-conteudo)', linha:'var(--linha-y)',
goteira:'var(--goteira)', cabecalho:'var(--altura-cabecalho)', faixa:'var(--altura-faixa)',
toque:'2.75rem',
```

Gera `px-recuo`, `p-recuo`, `gap-secao`, `gap-bloco`, `pt-topo`, `py-linha`,
`w-goteira`, `h-cabecalho`, `min-h-toque`.

Área segura: três utilitários definidos uma vez em `index.css`, os únicos com
`env()`:

```css
.pb-seguro{ padding-bottom:max(16px, env(safe-area-inset-bottom)); }
.pt-seguro{ padding-top:max(16px, env(safe-area-inset-top)); }
.pb-barra-inferior{ padding-bottom:calc(var(--altura-barra-inferior) + env(safe-area-inset-bottom) + 24px); }
@media (min-width:1024px){ .pb-barra-inferior{ padding-bottom:64px; } }
```

**Camadas do CSS [correção da crítica]:** `.pb-seguro`, `.pt-seguro` e
`.pb-barra-inferior` vão em `@layer utilities`; as receitas `.conteudo`,
`.leitura`, `.grade`, `.cabecalho`, `.lista`, `.linha`, `.valor*`, `.meta`,
`.campo`, `.num` vão em `@layer components`. Uma classe escrita fora de
camada vence qualquer utilitário do Tailwind em silêncio (ex.: `lg:pb-16`
perderia para `.pb-barra-inferior`), e o valor de computador sumiria sem erro.

### 3.3 Padding por contêiner

| Contêiner | <640 | 640–1023 | ≥1024 | Classe |
|---|---|---|---|---|
| Cartão: cabeçalho | 16 lat., 16 cima, 12 baixo | 20 | 24 | `px-recuo pt-recuo pb-3 min-h-14` |
| Cartão: corpo livre | 16 | 20 | 24 | `px-recuo pb-recuo` (após cabeçalho) ou `p-recuo` |
| Cartão: rodapé | 16 lat., 16 vert. | 20 lat. | 24 lat. | `px-recuo py-4 border-t border-fio-linha` (16 embaixo: nunca menos que o piso vertical de P1) |
| Linha de lista | recuo lat., 12 vert. (8 compacta) | 20 | 24 | aplicado pela `Lista` (7.2) |
| `Cartao.Lista` / `Tabela` como 1º ou último slot | 8 em cima (se 1º) / 8 embaixo (se último) | idem | idem | `first:pt-2 last:pb-2` no slot: a última linha fica a 12 + 8 = 20 da base do cartão (16 no compacto) e o hover não encosta no canto arredondado |
| Célula de tabela | 12 lat. (1ª/última: recuo), 12 vert. | idem | idem | `px-3 py-3 first:pl-recuo last:pr-recuo` |
| Herói | 16 | 20 | 32 | `p-recuo lg:p-8` |
| KPI | 16 | 20 | 24 | `p-recuo` |
| Sub-bloco dentro de caixa | 16 lat., 12 vert. | idem | idem | `px-4 py-3` |
| Painel lateral: cab. / corpo / rodapé | 16 / 16·24 / 16·16 | 24 | 24 | 7.10 |
| Modal de confirmação | 24 | 24 | 24 | `p-6` |
| Cabeçalho da página | margem lateral, altura fixa | idem | idem | `px-margem h-cabecalho` |
| Trilho | — | — | 12 lat. | `px-3` |
| Toast | 16 | 16 | 16 | `p-4` |
| Chip | 8 lat., altura 24 | | | `h-6 px-2` |

### 3.4 Proximidade

A desigualdade que o código obedece (e o checklist mede):

```
dentro do item 4–8  <  entre itens 12  <  conteúdo ↔ ações 16  ≤  recuo 16/20/24
≤  entre cartões 16/24  <  entre seções 24/32
```

| Relação | Valor |
|---|---|
| Ícone ↔ texto (chip / botão) | 4 / 8 |
| Título da linha ↔ meta | 4 |
| Colunas da linha | 12 (<640) / 16 |
| Rótulo ↔ campo; campo ↔ dica | 8 / 8 |
| Entre campos | 24 vertical, 16 horizontal |
| Título de seção ↔ conteúdo | 12 |
| Conteúdo ↔ fileira de ações | 16 |
| Entre botões | 12 (8 no modo compacto) |
| Entre cartões de uma grade | `--vao-bloco` 16 / 24 |
| Entre filhos de `<main>` | `--vao-secao` 24 / 32 |
| Base do cabeçalho ↔ 1º bloco | `--topo-conteudo` 24 / 32 |
| Último bloco ↔ barra inferior | 24 |

### 3.5 Densidade

- **Confortável (padrão):** `--linha-y` 12. Linha de título + meta mede ~64,
  de uma linha só 56 (52 no computador), linha de tabela 48.
- **Compacta** (`html.compacta`, já existe o `SeletorDensidade`): `--linha-y`
  8, mínimo 44. Com `pointer:coarse`, o mínimo nunca cai abaixo de 56.
- Densidade muda **só** o ar vertical da linha. Nunca muda recuo lateral, vão
  entre blocos, tipografia, altura de controle ou colunas.

### 3.6 Proibido (lint, seção 10)

- Margem negativa de qualquer tipo (`-m*`, `-mx-*`, `-inset-x-*`). **A
  "sangria" deixa de existir.** O fio vai de borda a borda porque a lista não
  tem padding e a linha, que ocupa a largura inteira, tem o recuo e o
  `border-top`.
- `mt-*`/`mb-*` para separar irmãos de bloco, e `space-x-*`/`space-y-*` em
  qualquer lugar (use `flex flex-col gap-*`). Margem positiva só existe
  **dentro** de componente de `src/components/ui` e `src/components/layout`,
  entre elementos de texto de um mesmo bloco (ex.: `mt-3` do número do
  herói). Em `src/admin/**`, `src/corretor/**` e `src/auth/**`, zero `m*-`
  (lint).
- `SuperficieContext` e qualquer espaço herdado por contexto implícito.
- `<li>` e `<tr>` escritos à mão em `src/admin/pages/**`, `src/corretor/pages/**`
  e nos formulários: linha só existe via `Linha`, `Parcela` ou `Tabela`.
- Números soltos de espaço (`scroll-mt-40`, `bottom-24`, `pb-[calc(4rem…)]`):
  viram token.
- `overflow-hidden` em contêiner com filho focável, exceto `[data-rolagem]`.

---

## 4. Grade e contêiner

### 4.1 Larguras e colunas

| Viewport | Trilho | Área útil | Margem | Conteúdo | Colunas / gap |
|---|---|---|---|---|---|
| 390 | — (barra inferior) | 390 | 16 | 358 | 4 / 16 |
| 768 | — (barra inferior) | 768 | 24 | 720 | 8 / 16 |
| 1024 | 248 (68 recolhido) | 776 | 32 | 712 | 12 / 24 |
| 1280 | 248 | 1032 | 32 | 968 | 12 / 24 |
| 1440 | 248 | 1192 | 32 | 1128 | 12 / 24 |
| 1710 (Rafael) | 248 | 1462 | 40 | **1216 (teto)** | 12 / 24 |

```css
.conteudo{ width:100%; max-width:calc(76rem + 2*var(--margem-pagina));
  margin-inline:auto; padding-inline:var(--margem-pagina); }
.leitura{ max-width:45rem; margin-inline:0; } /* 720px: coluna interna do <main>, alinhada à ESQUERDA do .conteudo (Config, textos longos); nunca centralizada, senão o 1º cartão sai do x do cabeçalho (item 9) */
.grade{ display:grid; gap:var(--vao-bloco); grid-template-columns:repeat(4,minmax(0,1fr)); }
@media (min-width:768px){ .grade{ grid-template-columns:repeat(8,minmax(0,1fr)); } }
@media (min-width:1024px){ .grade{ grid-template-columns:repeat(12,minmax(0,1fr)); } }
```

- O cabeçalho usa o mesmo `.conteudo`: o `left` do **primeiro elemento do
  cabeçalho** (botão voltar ou `IconeTom`) é o `left` do primeiro cartão
  (tolerância 0px). O h1 fica 12px à direita desse elemento.
- Toda fileira da grade fecha as colunas. Nada de cartão órfão de 6/12:
  sozinho, é `col-span-full`.
- Listas e parcelas decidem a forma pela **largura do cartão**, não do
  viewport (o trilho recolhido muda a conta): `container-type:inline-size` na
  `Lista` e `@container` no CSS. Tailwind 3 aceita isso com o plugin oficial
  `@tailwindcss/container-queries` (única dependência nova) ou com CSS puro em
  `index.css`; os dois servem.

### 4.2 Cabeçalho fixo (`PageLayout`, a única casca)

- **Altura:** `h-cabecalho` (56 abaixo de 1024, 64 a partir de 1024), **igual
  em todas as rotas, sem exceção**. Nenhuma troca de rota muda a altura do
  cabeçalho (a auditoria mediu 61, 76 e 122px entre telas: é esse pulo que
  acaba). **[correção da crítica]** A faixa (seletor de mês, filtros rápidos,
  abas) **não mora no cabeçalho em nenhuma largura**: é o primeiro filho do
  `<main>`, `min-h-12 flex flex-wrap items-center gap-3`, e rola com o
  conteúdo. Um cabeçalho fixo mais alto só aumentaria a área onde o conteúdo
  passa por baixo, que é a queixa do print.
- **Faixa em 390:** `FiltrosRapidos` e seletor de mês quebram em até 2 linhas
  (`flex-wrap`, `gap-2`), nunca rolagem horizontal com barra visível e nunca
  item cortado. **`Abas` nunca quebram** (uma aba na 2ª linha perde o
  sublinhado de referência) **[correção da crítica: o texto anterior dizia que
  Config tinha mais de 6 abas; tem 5, e abas quebradas em 2 linhas são o
  defeito, não a solução]**: quando não cabem, a fileira de abas é
  `data-rolagem` com `scrollbar-width:none`, `scroll-snap-type:x mandatory`, a
  aba ativa rolada para dentro da vista ao montar, e a última aba visível
  cortada pela metade para dizer "tem mais". Medidas dos controles: 7.15.
- **Computador:**
  `[← voltar 40, só em ficha] 12 [IconeTom md 36] 12 [h1 + subtítulo na mesma linha] flex-1 … [sino 40] 12 [ações ≤ 2] 12 [CTA 40]`.
  O subtítulo é `texto-meta`, truncado em 1 linha, com `title` completo.
- **Celular:** `[IconeTom sm 28] 12 [h1 truncado] flex-1 … [sino 44] [CTA 44, rótulo curto]`.
  Em ficha (Venda, ficha do corretor): `[voltar 44] 8 [h1 truncado] … [sino 44] [⋯ 44]`,
  sem `IconeTom` e sem CTA; Editar e as demais ações vão para o menu "⋯".
  O subtítulo sai do cabeçalho e vira, junto com a faixa, o **bloco de
  abertura** do `<main>`: um único filho `flex flex-col gap-4` com o subtítulo
  (`texto-meta`, até 2 linhas) e a faixa. Assim o ritmo de `gap-secao` entre
  filhos do `<main>` continua exato.
- **Fundo:** `bg-page`, opaco. **Sem `backdrop-filter`** (no escuro o fundo do
  nav é igual ao da página; o blur não fazia nada). **Sem grão em lugar nenhum** (decisão de 13/09/2026: superfície lisa; acaba a emenda do cabeçalho).
- **Fio ao rolar** (a correção do "cartão cortado"):

  ```css
  .cabecalho{ position:sticky; top:0; z-index:var(--z-cabecalho); background:var(--page-bg); }
  .cabecalho::after{ content:''; position:absolute; inset:auto 0 -1px 0; height:1px;
    background:var(--fio-caixa); box-shadow:0 8px 20px -12px var(--sombra-rolagem);
    opacity:0; transition:opacity var(--dur-micro) var(--curva-cor); pointer-events:none; }
  .cabecalho[data-rolou]::after{ opacity:1; }
  :root{ --sombra-rolagem:color-mix(in srgb, var(--page-bg) 90%, transparent); }
  html.light{ --sombra-rolagem:color-mix(in srgb, var(--t1) 14%, transparent); } /* derivados: nenhum rgba solto */
  ```

  `data-rolou` vem de um sentinela de 1px no topo do `<main>` observado por
  `IntersectionObserver` (hook `useRolou`). O fio mora num pseudo-elemento: a
  altura nunca muda.
- **Deslocamento de âncora:**
  `html{ scroll-padding-top:calc(var(--altura-cabecalho) + 16px); scrollbar-gutter:stable; }`.
  Apagar `scroll-mt-40` e `scroll-mt-44`. `--altura-faixa` fica só como altura
  mínima da faixa (48).
- **Painel aberto não mexe no cabeçalho:** abrir `SidePanel`, `ConfirmDialog`
  ou a paleta não remove nem troca o conteúdo do cabeçalho (a auditoria viu
  uma faixa vazia de 61px com o drill-down aberto).
- **Transform no `<main>`:** a animação de entrada (8.3) roda no próprio
  `<main>` (sem invólucro: um invólucro tiraria os blocos da condição de
  "filhos diretos do `<main>`" que o ritmo e o item 5 medem). Nada
  `position:fixed` mora dentro do `<main>`: painéis, folhas, toasts, popovers
  e barras de ação fixas são renderizados em portal no `body`, porque um
  `transform` em andamento vira bloco de contenção de `fixed`. A animação usa
  `fill-mode: backwards` (8.2), então nenhum `transform` fica aplicado depois
  dos 200ms.
- **Quem mora no cabeçalho é declarado pela rota**, nunca injetado pela casca.
  `navegacao.ts` declara por rota: `icone`, `titulo`, `usaMes`, `faixa`, `cta`.
  **Seletor de mês** só em Início, Receber, Pagar, Despesas e Relatórios.
  **Nunca** em Venda, Vendas, Corretores, Config.
- O `<main>` é `conteudo entrada-pagina flex flex-col gap-secao pt-topo pb-barra-inferior` (o valor de computador, 64, está dentro de `.pb-barra-inferior`, 3.2).
- **Voltar em ficha** (`/vendas/:id`, ficha do corretor): `aria-label="Voltar para Vendas"`, leva à lista com os filtros da URL de onde veio (`location.state.de`), senão à lista sem filtro.

### 4.3 Trilho lateral (≥1024)

- **Largura:** 248 aberto, 68 recolhido (valores do guia). Fundo `--nav-bg`
  liso, **sem sheen, sem grão**, fio direito `nav-line`. A largura muda sem
  animar; só os rótulos fazem `opacity` em 120ms.
- **Topo = altura do cabeçalho (64)**, **sem fio embaixo** (o cabeçalho da
  página não tem fio em `scrollY=0`; um fio só no trilho criaria uma linha que
  para no x=248). A separação é o vão de 24 até o primeiro grupo. Contém **só a
  marca** (`data-marca`): `px-4 flex items-center gap-3 [S 32×32] [lockup: "Souza" Sora 15/20 700 + "IMOBILIÁRIA" 11/16 500 tracking .08em]`.
  O **sino vai para o cabeçalho da página** (ação global, sempre antes das
  ações da tela). O **recolher vai para o rodapé**. **[acima do guia]** Assim
  acabam a marca espremida, os botões de 30px e as áreas de toque sobrepostas.
  Recolhido: só o S centralizado.
- **Grupos:** navegação `px-3 pt-6` (24 da base do topo, y=64, até o 1º rótulo). Rótulo de
  grupo é `<h2 class="text-rotulo px-3 mb-2">` **fora do link**, com `mt-6`
  do 2º grupo em diante (24 acima, 8 abaixo). Itens `flex flex-col gap-1`.
  Recolhido: o rótulo vira fio `nav-line` com `mx-3 my-3`.
- **Item:** `h-10 px-3 gap-3 rounded-controle`, ícone 16 stroke 1.6, texto
  `texto-titulo`. Ativo: `bg-nav-active-bg text-nav-active-text font-semibold`,
  `aria-current="page"`. **Sem filete, sem ouro.** Hover `bg-nav-hover`.
  Contador `ml-auto` (Badge, 7.7). Recolhido: dica com o nome em 120ms, 8px à
  direita.
- **Rodapé:** `border-t border-nav-line p-3 flex items-center gap-2`:
  `[conta: avatar 32 + nome texto-titulo + papel texto-meta, h-14, flex-1] [recolher 40]`.
  O popover da conta abre para cima. **Recolhido (68px):** o rodapé vira
  `flex-col items-center gap-2 px-3 py-3`, com o avatar (botão 44) em cima e o
  recolher (40) embaixo; lado a lado não cabem (32 + 8 + 40 = 80 > 44 úteis).
- **Nome acessível** do link da marca: `aria-label="Souza Imobiliária, início"`.

### 4.4 Barra inferior (<1024)

- `fixed inset-x-0 bottom-0 z-nav bg-page`, com
  `box-shadow:0 -1px 0 var(--fio-caixa)`. Altura
  `calc(64px + env(safe-area-inset-bottom))`. Destinos atuais (5 + Mais),
  `grid` de colunas iguais até `max-w-xl`.
- **Item:** `min-h-16 flex flex-col items-center justify-start pt-2 gap-1`.
  Pílula `h-8 w-14 rounded-full` com ícone 20 (ativa `bg-nav-active-bg`);
  rótulo `text-chip font-medium` (11/16 500), sem caixa alta.
- **Contador:** Badge `absolute -top-1 right-0` **em relação à pílula**
  (`relative`), limitado a "9+" (largura máxima 24). Medidas: a base do badge
  fica ≥ 8px acima da base da pílula e ≥ 12px acima do topo do rótulo; o badge
  cobre no máximo 6px da largura do ícone. (Único `-top` permitido:
  posicionamento, não margem.)
- Conteúdo termina 24 acima da barra (`pb-barra-inferior`). Toast em
  `bottom: calc(64px + env(safe-area-inset-bottom) + 16px)`.
- Folha "Mais": painel de baixo (7.10), itens `h-12 px-recuo`.

### 4.5 Camadas

```css
:root{ --z-cabecalho:20; --z-nav:30; --z-veu:40; --z-painel:50; --z-popover:60;
  --z-modal:70; --z-toast:80; --z-paleta:90; }
```

Tailwind `theme.extend.zIndex` com esses nomes. Nenhum `z-` literal no código.

---

## 5. Superfícies

### 5.1 Tokens derivados

Nenhum hex novo. Razões calculadas com os hex da seção 3 do guia (WCAG 2.x).

```css
:root{ /* escuro */
  --fio-caixa: var(--line-strong);      /* 1,74:1 sobre surface (line dava 1,32) */
  --fio-linha: var(--line);             /* entre linhas dentro da caixa */
  --fio-controle: color-mix(in srgb, var(--t1) 38%, var(--surface)); /* 3,31:1: WCAG 1.4.11 (recalculado na crítica) */
  --borda-ouro: color-mix(in srgb, var(--brand) 60%, var(--surface)); /* 3,98:1 (38% dava 2,3) */
  --t-meta: var(--t3);                  /* texto pequeno: 5,6 surface / 4,8 s2 */
  --linha-hover: color-mix(in srgb, var(--surface-2) 50%, var(--surface));
  --linha-press: var(--surface-2);
  --success-ink: var(--success); --warning-ink: var(--warning);
  --error-ink: color-mix(in srgb, var(--error) 85%, var(--t1)); /* error puro dá 4,50 sobre error-bg em s2: no limite, reprova no arredondamento */
  --info-ink: var(--info);
  --veu-painel: color-mix(in srgb, var(--page-bg) 55%, transparent);
  --veu-modal:  color-mix(in srgb, var(--page-bg) 75%, transparent);
}
html.light{
  --fio-controle: color-mix(in srgb, var(--t1) 55%, var(--surface)); /* 3,97 branco / 3,59 papel */
  --borda-ouro: var(--brand);                                        /* 3,88:1 sobre branco */
  --t-meta: var(--t4);                                               /* ≥4,55 no pior fundo */
  --success-ink: color-mix(in srgb, var(--success) 75%, var(--t1));  /* 5,53 sobre success-bg */
  --warning-ink: color-mix(in srgb, var(--warning) 65%, var(--t1));  /* 5,62 sobre warning-bg */
  --error-ink:   color-mix(in srgb, var(--error) 85%, var(--t1));    /* 5,06 sobre error-bg */
  --info-ink: var(--info);                                           /* 5,37 */
  --veu-painel: color-mix(in srgb, var(--t1) 28%, transparent);
  --veu-modal:  color-mix(in srgb, var(--t1) 45%, transparent);
}
```

Tailwind `theme.extend.colors`: `fio-caixa`, `fio-linha`, `fio-controle`,
`borda-ouro`, `t-meta`, `linha-hover`, `linha-press`, `success-ink`,
`warning-ink`, `error-ink`, `info-ink`. **Registrar com o helper `c()` que já
existe em `tailwind.config.js`**, nunca como `'var(--x)'` puro: no Tailwind 3
uma cor que é só `var()` ignora em silêncio o modificador de opacidade
(`border-borda-ouro/50` sairia a 100%). Ex.: `border-fio-caixa`,
`text-t-meta`, `text-error-ink`. `bg-surface-2`/`bg-surface-3` são aliases deprecados que somem na Fase 6:
todo código novo usa `bg-s2`/`bg-s3`. Classes de tom montadas por interpolação
(`text-${tom}-ink`) são proibidas: o JIT não as gera. O mapa de classes
literais mora em `tom.ts`.

**Regras de tinta:**
- Texto de chip, badge, dica e valor com estado usa `*-ink`. Ícone, borda e
  barra continuam no tom puro.
- Texto informativo pequeno **nunca** sobre `s3` (s3 é trilho de barra e
  esqueleto). A **classe** `text-t4` só em texto ≥18px ou ícone (o token
  `--t-meta` aponta para `t4` no claro porque lá passa AA; quem escreve usa
  `text-t-meta`, nunca `text-t4`). `t5` só no separador "·" e em ícone
  inativo.
- `text-brand-text` só sobre `surface` ou `page` (sobre s3, no claro, reprova).

### 5.2 Níveis

| Nível | Uso | Fundo | Borda | Sombra |
|---|---|---|---|---|
| 0 Página | fundo | `page`, liso | — | — |
| 1 Caixa | cartão, herói, KPI | `surface` | `fio-caixa` 1px | `shadow-card` (invisível no escuro, e tudo bem: o fio separa) |
| 1a Sub-bloco | demonstrativo destacado, dica, resumo dentro da caixa | `surface-2` | nenhuma | nenhuma |
| 1b Estado da linha | hover / pressionar / chegada | `linha-hover` / `linha-press` | — | — |
| 2 Sobreposição | painel lateral, modal, popover, toast, paleta | `surface` | `fio-caixa` | `shadow-modal` (painel, modal) / `shadow-dropdown` (popover, toast) |

- **Sem grão** em lugar nenhum: página, cabeçalho, barra inferior, cartão,
  trilho, herói e símbolo são cor lisa (decisão de 13/09/2026, depois do "S
  granulado"; o grão também criava emenda entre o cabeçalho opaco e a página).
  A variável `--grain` fica no bloco copiado do guia, mas nada a lê.
  **[acima do guia]**
- **Controle nunca tem sombra** (sai de `SeletorMes` e `Segmented`).
- Sem `shadow-brand`, sem halo, sem brilho.
- **Classes que deixam de existir:** `surface-premium`, `card-surface`,
  `list-surface`, `modal-surface`, `nav-rail`, `nav-bg-blur`, `gold-edge*`,
  `gold-glow-tl`, `grad-brand-glow`, `aurora*`, `barra-atencao`,
  `atencao-pulse`, `shimmer`. As variáveis `--surface-sheen`,
  `--nav-rail-sheen`, `--aurora-*` e `--grad-action` ficam no bloco copiado do
  guia, mas nada as lê. `.grad-brand` continua pintando liso (Ajuste 2).

### 5.3 Raios (cinco)

`theme.extend.borderRadius`:

| Token | Valor | Onde |
|---|---|---|
| `rounded-badge` | 6 | badge, contador, bloco de esqueleto |
| `rounded-controle` | 8 | botão, campo, chip, item do trilho, seletor de mês, sub-bloco, Selo, IconeTom |
| `rounded-caixa` | 14 | cartão, **herói**, KPI, toast, popover, modal de confirmação |
| `rounded-sobreposicao` | 20 | lado preso do painel lateral e topo da folha no celular |
| `rounded-full` | — | pílula, avatar, trilho de barra |

- **[acima do guia]** O herói deixa de ter 18px: o que o distingue é a borda
  Areia e o número em ouro (Ajuste 4). Selo e IconeTom passam a 8.
- **Aninhamento:** interno = max(externo − recuo, 6). Com caixa 14 e recuo
  ≥16, todo raio interno é 8 ou 6, **nunca** o do pai.
- Hover de linha: o fundo da linha **nunca toca um canto arredondado**, porque
  a `Cartao.Lista` ganha 8px de respiro quando é o primeiro ou o último slot
  (3.3). A primeira linha depois de um cabeçalho não está em canto. Por isso o
  cartão **não precisa de `overflow-hidden`**, o foco não é cortado, e não
  existe raio arbitrário (`rounded-[…]`) em lugar nenhum. **[correção da
  crítica: o `first:rounded-t-[13px]` arredondava a primeira linha mesmo
  debaixo do cabeçalho do cartão, onde não há canto]**
- O símbolo "S" (`data-marca`) mantém o raio da marca (`rounded-marca`, 25%),
  fora dos cinco.

### 5.4 Separar sem caixa dentro de caixa

Dentro de uma caixa, em ordem de força: (1) fio `fio-linha` de borda a borda;
(2) vão de 24 + `titulo-grupo`; (3) sub-bloco `bg-s2 rounded-controle
px-4 py-3`, sem borda e sem sombra.

Dentro de painel lateral e modal: seções `<section>` com `titulo-secao`,
separadas por `gap-8` e um fio. **Nunca `Cartao`.** Profundidade máxima:
página › caixa › sub-bloco. Lista dentro de linha é proibida (o acordeão de
MinhasVendas vira ficha, 9.8).

### 5.5 Foco e seleção

```css
:focus-visible{ outline:2px solid var(--brand); outline-offset:2px; }
[data-rolagem] :focus-visible{ outline-offset:-2px; }
::selection{ background:color-mix(in srgb, var(--brand) 35%, transparent); color:var(--t1); }
```

- Contraste do contorno: 10:1 no escuro, 3,88:1 no claro.
- **Linha de chegada** (`?parcela=<id>`, origem de drill-down aberto):
  `bg-linha-hover aria-current="true"`, rolagem respeitando o
  `scroll-padding`, foco programático (`tabindex=-1`). O destaque é o
  **`::after`** da linha (o `::before` é do hover; os dois não podem dividir o
  mesmo pseudo-elemento): `.linha[data-chegada]::after{ content:''; position:absolute;
  inset:0; z-index:-1; background:var(--linha-hover); pointer-events:none; opacity:1;
  transition:opacity 520ms var(--curva-cor) 700ms; }` e
  `.linha[data-chegada="saindo"]::after{ opacity:0 }` no quadro seguinte. Sem
  pintura dourada, sem filete.
- **Aba ativa:** sublinhado de 2px em `t1` + texto `t1` 600. **Filtro rápido
  ativo:** `bg-s2 border-fio-controle text-t1 font-semibold`; inativo
  `bg-surface border-fio-linha text-t2`. **Nunca `brand-fill`.**
  **[acima do guia §8]**

---

## 6. Tipografia

### 6.1 Escala

`theme.extend.fontSize` com os nomes abaixo (na fase de limpeza, os tamanhos
padrão `text-xs…text-4xl` passam a ser proibidos pelo lint).

| Token `text-*` | Fonte | Tam/entrelinha | Peso | Tracking | Cor padrão | Uso |
|---|---|---|---|---|---|---|
| `numero-heroi` | Sora | 28/32 (<1024) · 34/40 | 800 | −0.02em | `brand-text` | só o número do herói |
| `numero-kpi` | Sora | 22/28 (<1024) · 28/32 | 700 | −0.015em | t1 | KPI |
| `titulo-pagina` | Sora | 17/24 (<1024) · 19/28 | 700 | −0.01em | t1 | h1 |
| `titulo-painel` | Sora | 16/24 | 600 | −0.005em | t1 | painel lateral, modal, estado vazio |
| `titulo-secao` | Sora | 15/24 | 600 | 0 | t1 | título de cartão e de seção (h2) |
| `valor-destaque` | Sora | 17/24 | 600 | −0.005em | t1 | apoios do herói, total fora do herói |
| `valor-linha` | Sora | 15/20 | 600 | 0 | t1 | valor de linha e célula |
| `valor-fato` | Sora | 14/20 | 500 | 0 | t2 | deduções, valores de apoio |
| `texto-titulo` | Inter | 14/20 | 500 | 0 | t1 | título de linha, item do trilho |
| `texto` | Inter | 14/20 | 400 | 0 | t2 | corpo operacional |
| `texto-corrido` | Inter | 14/22 | 400 | 0 | t2 | parágrafo, dica (máx. 62ch) |
| `texto-meta` | Inter | 13/20 | 400 | 0 | t-meta | meta de linha, subtítulo, rótulo de campo (500) |
| `nota` | Inter | 12/16 | 400 | 0 | t-meta | dica de campo, nota de KPI |
| `rotulo` | Inter | 11/16 | 500 | 0.14em, MAIÚSCULAS | t-meta | rótulo de dado, cabeçalho de coluna, grupo do trilho. **Só isso.** |
| `chip` | Inter | 11/16 | 600 | 0 | `*-ink` | chip, badge, contador, rótulo da barra inferior |
| `botao` | Sora | 14/20 | 600 | 0 | — | botão primário |
| `botao-secundario` | Inter | 14/20 | 500 | 0 | t1 | secundário, fantasma, perigo |
| `campo` | Inter | 16/24 (<1024) · 14/20 | 400 | 0 | t1 | input (sem zoom no iOS) |

```js
fontSize: {
  'numero-heroi': ['34px', { lineHeight:'40px', letterSpacing:'-0.02em', fontWeight:'800' }],
  'numero-heroi-m': ['28px', { lineHeight:'32px', letterSpacing:'-0.02em', fontWeight:'800' }],
  'rotulo': ['11px', { lineHeight:'16px', letterSpacing:'0.14em', fontWeight:'500' }],
  // … um por linha; responsivo por par: `text-numero-heroi-m lg:text-numero-heroi`
}
```

**Pares por largura [correção da crítica: a tabela dava dois tamanhos a quatro
papéis e o código só criava o par do herói]:** `numero-heroi-m`,
`numero-kpi-m` (22/28) e `titulo-pagina-m` (17/24), sempre usados como
`text-X-m lg:text-X`. O `campo` **não** é token de `fontSize`: é a classe
`.campo` (`@layer components`), 16/24 por padrão e 14/20 só em
`@media (min-width:1024px) and (pointer:fine)` (um iPad de 1024px com 14px
dá zoom ao focar).

A família vem junto: cada token Sora é usado com `font-heading`, empacotado nos
componentes (`Valor`, `Cartao`, `PageLayout`), nunca solto.

**Regras:**
- **Piso de 11px, só em `rotulo` e `chip`** (e no lockup "IMOBILIÁRIA" dentro
  de `[data-marca]`, que é marca e não texto de interface). 12px só em `nota`.
  Todo o resto ≥13px. (Relatórios tinha 74 textos abaixo de 12px.)
- **Colisão de nomes:** `text-*` resolve tamanho **e** cor no Tailwind. Nenhum
  nome de `fontSize` pode repetir um nome de `colors` (hoje: `texto-meta` é
  tamanho, `t-meta` é cor; manter assim).
- **Um papel, um estilo.** O 11px maiúsculo nunca é título de cartão: título
  de cartão é `titulo-secao` (Sora 15). **[acima do guia §8, que pedia
  PainelTitulo no estilo rótulo; a auditoria mediu esse estilo fazendo quatro
  papéis]**. Assim existe um degrau entre h1 (19) e texto (14).
- Nada de `font-bold` em Inter para simular título.

### 6.2 Números

- **A Sora tem `tnum`** (verificado no arquivo servido pelo Google Fonts).
  Sem ele, o "1" tem 56% da largura do "0". Como o subconjunto servido pode
  mudar, o aceite mede (11, item 25): "111,11" e "000,00" em `.num` têm a
  mesma largura. Se falhar, a correção é auto-hospedar a Sora completa, nunca
  trocar a fonte do número. Todo `numero-*` e `valor-*` leva:
  `font-variant-numeric: tabular-nums lining-nums; font-feature-settings:"tnum" 1;`
  (classe `.num`, aplicada pelo `Valor`).
- Colunas com largura declarada: `--col-valor` 9rem (até R$ 9.999.999,99 em
  `valor-linha`); 8rem para `valor-fato` no demonstrativo.
- Valor **nunca** trunca nem quebra (`whitespace-nowrap shrink-0`). Quem cede é
  a coluna de texto (`minmax(0,1fr)`).

### 6.3 Composição do dinheiro (`Valor`, a única forma)

`formatToParts` de `Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})`
vira spans:

```html
<span class="valor num" data-valor aria-label="menos 17 mil e 20 reais e 36 centavos">
  <span class="valor-sinal">−</span><span class="valor-moeda">R$</span><span class="valor-inteiro">17.020</span><span class="valor-centavos">,36</span>
</span>
```

```css
.valor{ display:inline-flex; align-items:baseline; white-space:nowrap; }
.valor-moeda{ margin-inline-end:.25em; }
.valor-sinal{ margin-inline-end:.15em; }
```

| Posto | Dígitos | "R$" | Centavos |
|---|---|---|---|
| `heroi` 34/28 | 800, `brand-text` | 17px 600, mesma cor | 0.6em, mesma cor |
| `kpi` 28/22 | 700, t1 | 15px 600, t2 | inteiro |
| `destaque` 17 | 600, t1 | 13px 500, t2 | inteiro |
| `linha` 15 | 600, t1 | 12px 500, t2 | inteiro |
| `fato` 14 | 500, t2 | 12px 400, t-meta | inteiro |

- **"R$" em t2** (não t3): menor, visível, lido como unidade e não como sujeira.
- **Sinal:** "−" (U+2212), nunca hífen nem "(–)". Positivo sem sinal. Dedução
  **não é vermelha**.
- **Zero:** "R$ 0,00" em t-meta, nunca vermelho.
- **Negativo real:** "− R$ 8.381,94" em `error-ink`, com ícone `TrendingDown`
  16 e a palavra "prejuízo" no mesmo **pai** (o texto de `[data-valor]` é só o
  dinheiro, para o aceite casar a expressão do item 25). No herói (Relatórios,
  resultado do mês), o negativo real troca o ouro do número por `error-ink`; a
  borda continua `borda-ouro`.
- **No `Demonstrativo`** o sinal mora na coluna de sinal e o `Valor` recebe
  `sinal={false}`; fora dele (forma A da parcela) o "−" vai dentro do `Valor`.
- **Herói com zero:** "R$ 0,00" continua em `brand-text` (é o único ouro da
  tela) e a frase diz por quê ("nada entrou ainda · R$ ··· dependem da
  construtora").
- **Cor por estado**, prop `estado` (`recebido`, `vencido`, `negativo`). A
  prop `previsto` é mutuamente exclusiva com `estado` e com `posto="heroi"`
  **no tipo TypeScript**: previsão fica t2, nunca ouro, nunca herói.
- **Proibido** `{formatCurrency(...)}` como filho de JSX fora de `Valor` e da
  exportação CSV (lint). Em string que não é desenhada como número
  (`aria-label`, `title`, mensagem de toast, texto de `ConfirmDialog`) o
  `formatCurrency` continua permitido. Dinheiro dentro de uma frase de meta
  ("caíram R$ 16.509,75") é `<Valor posto="fato" />` inline.
- **Valor em linha clicável:** se a linha inteira abre algo (a venda), o valor
  é `Valor` simples; `ValorComOrigem` só em linha não clicável, herói, apoio,
  `Demonstrativo` e `ParAgoraPrevisto`. Nunca dois chevrons na mesma linha.

### 6.4 Truncamento

- **Título de linha:** `line-clamp-2`, nunca reticência numa linha só.
- **Meta:** **[correção da crítica: um `::before` no 2º item quebra junto com
  o item e aparece exatamente no começo da linha nova]** A receita é:

  ```css
  .meta{ display:flex; flex-wrap:wrap; column-gap:16px; row-gap:0; clip-path:inset(0); }
  .meta > *{ position:relative; white-space:nowrap; }
  .meta > * + *::before{ content:'·'; position:absolute; left:-10px; color:var(--t5); }
  ```

  O ponto fica no vão de 16px entre dois itens. Quando um item abre linha nova,
  o ponto dele cai 10px à esquerda da caixa e o `clip-path` o recorta. Sem
  margem negativa, sem `overflow-hidden` (meta não tem filho focável). Item
  longo demais para uma linha (nome de empreendimento) recebe
  `min-w-0 truncate` com `title`. Computador: 1 linha (`flex-nowrap`,
  `truncate` no último item). Celular: até 2 linhas.
- **h1:** 1 linha `truncate` com `title`. **Subtítulo:** 1 linha no computador,
  texto corrido no celular.
- **Valor, chip, botão:** nunca truncam. Botão com rótulo longo recebe
  `rotuloCurto` para o celular.
- **Placeholder:** até 24 caracteres ("Buscar venda"); a explicação vai numa
  `nota` abaixo.

---

## 7. Anatomia dos componentes

Todo componente estrutural põe atributos para o checklist medir:
`data-caixa`, `data-heroi`, `data-linha`, `data-parcela`, `data-valor`,
`data-coluna="…"`, `data-goteira`, `data-acao`, `data-rolagem`.

### 7.1 Cartão (`Cartao`, substitui `Painel` + `Secao` + `SecaoTitulo`)

```tsx
<section data-caixa className="rounded-caixa border border-fio-caixa bg-surface shadow-card">
  <Cartao.Cabecalho>   {/* flex items-center gap-3 px-recuo pt-recuo pb-3 min-h-14 */}
    <Icone nome="ListOrdered" className="text-t3" />   {/* 16, com significado; opcional mas consistente na tela */}
    <h2 className="font-heading text-titulo-secao">Parcelas</h2>
    <span className="text-texto-meta">3 parcelas · 1 recebida</span>
    <div className="ml-auto flex items-center gap-3">{extra}</div>
  </Cartao.Cabecalho>
  <Cartao.Corpo />     {/* px-recuo pb-recuo flex flex-col gap-4 */}
  <Cartao.Lista />     {/* sem padding; filhos: Linha | LinhaGrupo | Parcela */}
  <Cartao.Rodape />    {/* px-recuo py-4 border-t border-fio-linha flex justify-between text-texto-meta */}
</section>
```

- Só os quatro slots como filhos. **[correção da crítica: o TypeScript não
  consegue restringir o tipo de elemento de `children` em JSX (toda expressão
  JSX é `JSX.Element`), então "não compila" era falso.]** A garantia é tripla:
  (1) o lint proíbe `<li`/`<tr` nas telas (10, Fase 1); (2) em
  desenvolvimento, `Cartao` e `Cartao.Lista` percorrem `Children` e dão
  `console.error` quando um filho não é `Linha`, `LinhaGrupo`, `Parcela` ou
  slot; (3) o aceite (11, item 3) mede o recuo de toda linha.
- **Espaço nas pontas:** `Cartao.Lista` e `Tabela` como primeiro slot ganham
  `pt-2`; como último, `pb-2` (3.3).
- Sem `overflow-hidden`. Sem margem. O vão vem do pai.
- Cartão sem título: `Cartao.Corpo` com `p-recuo`.
- O ícone do título e a goteira da primeira linha ficam no mesmo x
  (os dois partem de `--recuo`).

### 7.2 Lista e Linha

A `Lista` declara as colunas **uma vez**; cabeçalho e linhas leem as mesmas
variáveis. A `Lista` põe `data-com-goteira` quando declara `goteira:true` (sem goteira, a
forma estreita também perde a coluna de 28). A prop `contexto` é **obrigatória**: `'cartao'` (linha com
`px-recuo`) ou `'sobreposicao'` (linha com `px-0`, porque o corpo do painel já
tem recuo). Não há contexto herdado.

```tsx
<Lista contexto="cartao"
  colunas={{ goteira:true, situacao:'7.5rem', valor:'9rem', acao:'7rem', fim:true }}
  cabecalho={['', 'Venda', 'Situação', 'Comissão', '', '']}>
```

```css
.lista{ container-type:inline-size; }
.linha{ position:relative; isolation:isolate; display:grid; align-items:center; column-gap:12px; row-gap:4px;
  padding:var(--linha-y) var(--recuo-linha); min-height:var(--linha-min);
  border-top:1px solid var(--fio-linha); }
.lista[data-contexto="cartao"]{ --recuo-linha:var(--recuo); }
.lista[data-contexto="sobreposicao"]{ --recuo-linha:0px; }
.lista[data-contexto="sobreposicao"] .linha::before{ inset:0 -12px; border-radius:8px; } /* hover com 12px de ar dentro do recuo do painel, sem margem negativa */
.linha [data-acao]{ position:relative; z-index:1; }
/* estreito e largo são mutuamente exclusivos: a ordem no arquivo não decide nada */
@container (max-width:39.99rem){ .linha{ grid-template-columns:28px minmax(0,1fr) auto;
  grid-template-areas:"g t v" "g m s" "g a a"; } }
@container (max-width:39.99rem){ .lista:not([data-com-goteira]) .linha{ grid-template-columns:minmax(0,1fr) auto;
  grid-template-areas:"t v" "m s" "a a"; } }
@container (min-width:40rem){ .linha{ column-gap:16px; grid-template-areas:none;
  grid-template-columns:var(--colunas); } }
.linha::before{ content:''; position:absolute; inset:0; z-index:-1; background:var(--linha-hover);
  opacity:0; transition:opacity var(--dur-micro) var(--curva-cor); pointer-events:none; border-radius:inherit; }
.linha[data-clicavel]:hover::before{ opacity:1; }
.linha[data-clicavel]:active::before{ opacity:1; background:var(--linha-press); }
```

**Colunas (cartão ≥ 40rem):**

| Coluna | Largura | Conteúdo |
|---|---|---|
| goteira | 28 | `Selo` ordinal 28 **ou** `IconeTom sm` 28, com significado. Uma lista usa um só dos dois. Sem ícone significativo, a coluna não existe na lista inteira. |
| texto | `minmax(0,1fr)` | título `texto-titulo line-clamp-2` + `gap-1` + meta `texto-meta` |
| situação | `--col-situacao` 7.5rem | `Chip`, alinhado à esquerda da coluna |
| valor | `--col-valor` 9rem | `Valor posto="linha"`, `justify-self-end`; meta opcional à direita embaixo |
| ação | declarada (ex.: 7rem) | ação principal **sempre visível** (`Button sm`) + menu "⋯" 32 se houver secundárias |
| fim | 16 | `ChevronRight` 16 `t3`, se a linha abre algo; se alguma linha da lista abre, a coluna existe em todas |

- **Nenhuma ação escondida por hover, nunca.** (Acaba com as goteiras vazias de
  95–140px de Receber e Despesas.)
- **Linha clicável:** um `<a>`/`<button>` com `after:absolute after:inset-0`
  cobre a linha; a ação fica acima pela receita `.linha [data-acao]` (z local
  dentro da linha, que é `isolation:isolate`; nenhuma classe `z-` literal).
  `cursor-pointer` na linha. **Por que `isolation` e `z-index:-1`
  [correção da crítica]:** um `::before` posicionado sem `z-index` pinta
  **por cima** do conteúdo estático; com `linha-hover` opaco, o texto sumia no
  hover. Na forma estreita a coluna `fim` não existe: a linha inteira é o alvo.
- **Cartão < 40rem** (celular, e também cartões estreitos no computador, como
  as colunas de 6/12 da Venda e de 5/12 do Início): as áreas do CSS acima.
  Linha 1: título | valor; linha 2: meta | chip (à direita); linha 3: ações
  `flex gap-3 pt-2` (4 do `row-gap` + 8 = 12 acima), principal `flex-1`,
  "⋯" quadrado. A **altura** do botão vem do ponteiro e da viewport (7.8),
  não do contêiner: 44 abaixo de 1024 ou com toque, `sm` 32 no computador.
  Linha com ações tem `padding-bottom:16px` fixo (em qualquer densidade).
- **Cabeçalho de colunas:** `grid h-10 items-center px-recuo text-rotulo
  border-t border-fio-linha`, mesmas colunas; rótulo numérico
  `justify-self-end`. Sem fundo. `role="row"` com filhos
  `role="columnheader"` (o aceite usa isso). Só existe com o cartão ≥ 40rem;
  abaixo disso some, e o rótulo de cada valor que não é óbvio vai para a meta.
- **`LinhaGrupo`** (mês, "HOJE"): `min-h-10 px-recuo pt-6 pb-2 flex items-end
  gap-3 text-rotulo border-t border-fio-linha`; contador `texto-meta`; à
  direita o par "agora · previsto" (7.3.4), que ocupa da coluna de situação
  até a de fim (`grid-column: situacao / -1; justify-self:end`) e alinha a
  borda direita do último número com a coluna de valor. O par tem ~260px e não
  cabe nos 9rem da coluna. Com o cartão < 40rem, o par desce para uma 2ª linha
  do grupo, alinhado à direita. "HOJE" usa rótulo em t2 e fio `fio-caixa`.
- Uniformidade: toda linha de uma lista tem as mesmas colunas à direita.

### 7.3 Demonstrativo e Parcela (resolvem a fileira de seis valores)

#### 7.3.1 Os dados

`src/lib/sales.ts` ganha `linhasDaParcela(parcela, perfil)` e
`linhasDaVenda(venda, perfil)`, que devolvem `LinhaDemonstrativo[]`
(`{ rotulo, detalhe?, sinal:'+'|'−'|'=', valor, origem?, situacao? }`). Para
`perfil:'corretor'` a linha "Fica para a imobiliária" **não é gerada**, com
teste unitário. O componente só desenha o que recebe.

#### 7.3.2 `Demonstrativo` (vertical; substitui `Cascata`, a prévia do Registrar venda e `ContaDaParcela`)

```
Parcela recebida                               R$ 17.020,36   texto-titulo | valor-linha t1
ISS retido pela construtora · 3%          −      R$ 510,61    texto t2 + detalhe texto-meta | sinal | valor-fato
Simples Nacional · 6%                     −      R$ 990,58
Dionata Alves · 65% da base  [✓ Paga]     −   R$ 10.000,00    situação do corretor em Chip inline
──────────────────────────────────────────────────────────    fio-caixa
Fica para a imobiliária                        R$ 5.519,17    texto-titulo | valor-destaque t1 (nunca ouro aqui)
```

```tsx
<dl className="grid grid-cols-[minmax(0,1fr)_12px_var(--col-valor-fato,8rem)] gap-x-2">
  {/* cada linha: dt (min-h-8 flex items-center) · dd sinal (text-center text-t-meta) · dd valor (justify-self-end) */}
  {/* total: hr col-span-3 mt-2 border-fio-caixa; linha min-h-10 pt-2 */}
</dl>
```

- Com toque ou abaixo de 1024, a linha que abre algo (`ValorComOrigem`) tem
  `min-h-11` (44): alvos de 44 em linhas de 32 se sobreporiam (item 32).
- Linha de 32px (`min-h-8`), sem gap vertical: o ritmo vem da altura. Total
  com 40px, 8 abaixo do fio.
- O detalhe ("3%") fica na mesma linha; se o `dl` tiver < 22rem, desce para
  uma 2ª linha em `texto-meta`.
- Todo valor com origem é `ValorComOrigem` (abre a composição). O chevron fica
  **dentro** da coluna, à esquerda do número, e não desloca a borda direita.
- **"Caiu R$ 16.509,75"** não é linha da conta: é fato do extrato e vai para a
  meta da parcela ("recebida em 02/09 · caíram R$ 16.509,75").
- **Dentro do herói** (Venda, 9.2): o demonstrativo é a conta **contratada** e
  o número do herói é o **realizado**, então são números diferentes. O total do
  demonstrativo fica em `valor-destaque` t1, nunca ouro. **[correção da
  crítica: o texto anterior dizia que o total era o número do herói, o que
  contradizia a planta 9.2]** Quando a venda está toda recebida e os dois
  números ficam iguais, a linha de total diz "Fica para a imobiliária · tudo
  já entrou" e continua mostrando o valor (a conta precisa fechar à vista).

#### 7.3.3 `Parcela` (item de `Cartao.Lista`; forma pela largura do cartão)

`Parcela` é uma `.linha` (recuo, fio, hover, chegada, `isolation`) marcada
`data-parcela`, e declara a própria grade com `.linha[data-parcela]`
(especificidade 0,2,0) **nas três faixas**, `grid-template-areas` incluído:
sem isso, a regra estreita de `.linha` (< 40rem) vazaria para a forma B.

**(A) Cartão ≥ 65rem: tabela comparável.**

```css
@container (min-width:65rem){ [data-parcela]{ grid-template-columns:
  28px minmax(9rem,1fr) 9rem 8rem 9rem 9rem 8rem 16px; column-gap:16px; } }
```

**[correção da crítica]** A versão anterior (`minmax(14rem,1fr) 9 9 10 9 8`)
somava 1.100px de colunas + 112 de vãos + 48 de recuo = 1.260px, e o cartão da
Venda em 1440 tem 1.128px: estourava exatamente na tela do print. Agora o
mínimo é 28+144+144+128+144+144+128+16 = 876, + 7×16 = 988, + 2×24 = 1.036px
(65rem = 1.040). Resultado por largura com trilho aberto: 1280 (cartão 968) →
forma B; 1440 (1.128) e 1710 (1.216) → forma A. A coluna de ação tem 8rem:
`[Recebi sm ~72] 8 [⋯ 32]`.

Cabeçalho uma vez (`text-rotulo h-10`): `# · Parcela · Valor · Impostos ·
Corretor · Fica · (ação) · (fim)`.

```
[①] Parcela 1 de 3                   R$ 17.020,36  − R$ 1.501,19  − R$ 10.000,00  R$ 5.519,17  [ ⋯ ]  ›
    recebida 02/09 · caíram R$ 16.509,75            (fato t2)       [✓ Paga]        (linha t1 600)
    [✓ Recebida]
```

- Impostos = ISS + Simples (abre as duas linhas). Corretor com o chip da
  situação **dele** embaixo do valor (`flex-col items-end gap-1`). **Fica** é o
  único em `valor-linha` t1 600; Impostos e Corretor em `valor-fato` t2.
- `px-recuo py-4`, `min-h-16`.

**(B) Cartão de 30 a 65rem: linha em duas partes.** Parte 1: goteira |
título + meta | chip | valor | ação | fim. Parte 2: três células
`grid grid-cols-3 gap-4 pt-3 border-t border-fio-linha col-[2/-1]`
(**não** `col-start-2 col-span-full`: `col-span-full` escreve
`grid-column:1/-1` e anula o início), marcada `data-celulas`, cada célula com
`rotulo` em cima e valor embaixo, alinhados à direita da célula:
`IMPOSTOS − R$ 1.501,19` (`valor-fato` t2) · `CORRETOR · [Paga] − R$ 10.000,00`
(`valor-fato` t2; o nome vai na meta da célula, em `texto-meta`, não em
maiúsculas) · `FICA R$ 5.519,17` (`valor-linha` t1 600, o único com peso).

**(C) Cartão < 30rem (celular):**

```
px-recuo py-4 flex flex-col gap-3
┌ grid [28px 1fr auto] gap-x-3
│ [②]  Parcela 2 de 3                          R$ 17.020,36
│      recebida em 02/09 · caíram R$ 16.509,75   [✓ Recebida]
├ Demonstrativo resumido (largura total, 3 linhas + total):
│   Impostos                   −   R$ 1.501,19
│   Dionata Alves [Paga]       −  R$ 10.000,00
│   ─────
│   Fica para a imobiliária        R$ 5.519,17
└ ações: [Recebi esta parcela  h-11 flex-1]  [⋯ h-11 w-11]
```

- Em C, "caíram R$ 16.509,75" na meta é `Valor posto="fato"` inline; o
  demonstrativo resumido não tem cabeçalho e não é sub-bloco (sem fundo s2).
- Tocar na parcela (ou no chevron) abre o painel "Parcela 2 de 3 · 414-D" com
  o `Demonstrativo` completo (bruta, − ISS, − Simples, − corretor, = fica) e a
  ação no rodapé.
- **Uma ação principal por parcela:** prevista → "Recebi esta parcela";
  recebida com corretor liberado → "Pagar Dionata"; o resto (Reagendar,
  Desfazer recebimento) no menu "⋯". **Nenhuma é `brand-fill`.**
- **Data passou, sem baixa** (`situacaoDeTela()` diz prevista e a data já
  passou): chip tom **atenção**, ícone `CalendarX2`, palavra "Sem baixa"; meta
  "era prevista para 12/08 · a construtora atrasou ou não foi baixada".
  **Nunca** triângulo vermelho, **nunca** "vencida" (vencida é só repasse que a
  imobiliária deve). O componente dá forma; a regra continua em
  `situacaoDeTela()`.

#### 7.3.4 Par "agora · previsto" (`ParAgoraPrevisto`)

Dois `ValorComOrigem` que **nunca se somam**, separados pela palavra:
`agora R$ 10.000,00 · previsto R$ 18.645,33`. O primeiro em `valor-fato` t1,
o segundo em `valor-fato` t2. Usado em subtotal de mês, rodapé de lista, linha
de corretor, Início. Não aceita prop `total`.

### 7.4 KPI (`Kpi`, substitui `KpiCard`)

```tsx
<a data-caixa className="group block rounded-caixa border border-fio-caixa bg-surface shadow-card p-recuo">
  <div className="flex items-center gap-2"><IconeTom tamanho="sm" tom={…}/><span className="text-rotulo">Já entrou</span></div>
  <div className="mt-3"><Valor posto="kpi" /></div>
  <p className="mt-1 text-nota line-clamp-2">nota</p>
</a>
```

- Hover (a borda não muda: `fio-caixa` já é `line-strong`): `-translate-y-0.5` + `::after` com
  `shadow-dropdown` de opacidade 0→1, 150ms. Pressionar `scale-[.98]` 100ms.
- Número colorido só com estado real; o tom colore o ícone.
- **Abaixo de 768px não há grade de KPI.** Os KPIs viram um `Cartao.Lista` de
  `Linha`s (rótulo como título, `valor-destaque` à direita, chevron). De 768 a
  1279: `grid-cols-2`; de 1280: `grid-cols-4`.
- **Sem contagem no KPI.** Se a tela tem filtros rápidos com contador, ela não
  tem KPIs que filtram (dois controles para a mesma coisa).

### 7.5 Herói dourado (`Heroi`, único por tela)

```tsx
<section data-caixa data-heroi className="rounded-caixa border border-borda-ouro bg-surface shadow-card
  p-recuo lg:p-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12">
  <div className="flex flex-col">
    <div className="flex items-start justify-between gap-4">
      <p className="text-rotulo">Já ficou para a imobiliária</p>
      {/* ≤1 ação secundária não destrutiva, Button sm; no celular vai para o fim, h-11 w-full */}
    </div>
    <p className="mt-3"><ValorComOrigem posto="heroi" contar /></p>
    <p className="mt-2 text-texto-corrido max-w-[62ch]">o que o número NÃO é</p>
    <Barra className="mt-6" />                         {/* opcional, 6px, cor lisa */}
  </div>
  <dl data-celulas className="border-t border-fio-linha pt-6 lg:border-t-0 lg:pt-0 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
    {/* até 3 apoios: dt text-rotulo + dd valor-destaque (ValorComOrigem) — ou um Demonstrativo */}
  </dl>
</section>
```

- O único ouro: `border-borda-ouro` + número em `brand-text`.
- **Proibido no herói:** grão, sheen, halo, degradê, botão vermelho, segundo
  número ≥ 22px, previsão em ouro.
- **Herói dourado** é dinheiro realizado, saldo real ou obrigação real.
- **Herói previsto** (decisão do Rafael, 13/09/2026): quando o número que
  decide a tela é previsão (Vendas "Comissão em carteira", Receber "A
  receber"), o `Heroi` recebe `previsto`: `data-previsto`, rótulo que
  **contém a palavra "previsto/prevista"**, borda `fio-caixa` (não
  `borda-ouro`), número em `t1` no mesmo tamanho de herói, e a frase de apoio
  diz de que depende ("depende de a construtora pagar"). **Nunca ouro.** A
  rota com herói previsto tem zero ouro; o dinheiro realizado vai para os
  apoios. No tipo, `previsto` e o ouro são mutuamente exclusivos (uma prop
  `variante: 'ouro' | 'previsto'`, sem padrão implícito).
- No celular, os apoios empilham como `Linha`s de 44px; um demonstrativo vira
  `<details>` "Ver a conta (5 linhas)" com área de 44px.

### 7.6 Tabela (`Tabela`: relatórios, DRE, doze meses)

- Dentro de `Cartao`, sem borda própria: `<div data-rolagem class="overflow-x-auto">`
  + `<table class="w-full border-collapse">`.
- `th`: `h-10 px-3 first:pl-recuo last:pr-recuo text-rotulo text-left
  border-b border-fio-caixa`; numérico `text-right`. **Sem `sticky top-0`**
  **[correção da crítica]**: `overflow-x:auto` força `overflow-y:auto` no
  mesmo contêiner, que não rola na vertical, então o cabeçalho grudado não
  gruda em nada. Tabela longa o bastante para precisar disso vira lista
  agrupada.
- `td`: `h-12 px-3 first:pl-recuo last:pr-recuo border-t border-fio-linha
  text-texto`; valor `Valor posto="linha"` à direita.
- Total: `border-t border-fio-caixa`, `valor-destaque`.
- Celular: 1ª coluna `sticky left-0 bg-surface min-w-[10rem]`.
- Sem zebra. Hover só se a linha abre algo.
- **Coluna vazia em todas as linhas não é renderizada** (acaba com as colunas
  de "—"). Mês sem movimento é `R$ 0,00` em t-meta; "—" só quando o dado não se
  aplica.
- Rolagem horizontal só quando a soma das colunas declaradas excede a largura,
  e **nunca em ≥768 nas tabelas do sistema**: "Doze meses" é **um mês por
  linha** (colunas Mês · Entrou · Saiu · Resultado · Margem), não um mês por
  coluna. Isso acaba com a barra de rolagem medida em 1458px.

### 7.7 Chip, Badge, Selo

- **Chip (situação):** `inline-flex h-6 items-center gap-1 rounded-controle
  border px-2 text-chip bg-{tom}-bg border-{tom}-line text-{tom}-ink`, ícone 12
  stroke 1.6. **Sempre ícone + palavra.** Chip é situação, nunca categoria.
- **Badge (contagem):** `inline-flex h-5 min-w-5 items-center justify-center
  rounded-full px-1 text-chip num bg-s2 text-t2` (o `px-1.5` anterior
  violava P3 e o próprio lint); com risco
  `bg-error-bg text-error-ink`. Zero em `text-t-meta`.
- **Selo ordinal:** 28×28 `rounded-controle`, `valor-fato` centrado, na
  goteira de 28. **Sem `glifo="traco"`** (apagar a opção).
- **Ícone por situação** (um glifo por significado):

| Situação | Ícone | Tom |
|---|---|---|
| Prevista | `CalendarClock` | info |
| Sem baixa (data passou) | `CalendarX2` | atenção |
| Liberada | `HandCoins` | atenção |
| Vencida (repasse devido) | `AlertCircle` | risco |
| Recebida / Paga | `CheckCircle2` | sucesso |
| Cancelada | `Ban` | neutro |

  `CalendarClock` e `CalendarX2` não são usados para mais nada (título de
  cartão de mês usa `CalendarRange`; o seletor de mês não tem ícone de
  calendário, só as setas). Em lista toda prevista (ex.: "A seguir"), o chip
  "Prevista" é omitido: a seção já diz.

### 7.8 Botões

| Tamanho | Altura | px lat. | Ícone | Onde |
|---|---|---|---|---|
| `sm` | 32 | 12 | 16 | só ≥1024 e sem toque: linha, cabeçalho de cartão |
| `md` | 40 | 16 | 16 | padrão no computador |
| `lg` | 44 | 20 | 16 | padrão <1024; rodapé de painel no celular |
| `icone` | 32 (≥1024) / 44 | — | 16 | "⋯", fechar, voltar; `aria-label` |

```css
@media (pointer:coarse), (max-width:1023.98px){ .botao{ min-height:44px; } .botao-icone{ min-width:44px; } }
```

| Variante | Classes |
|---|---|
| `primario` | `bg-brand-fill text-brand-fill-text font-heading text-botao rounded-controle`; hover `bg-brand-fill-hover`. **Liso**: apagar o `hover:bg-[image:linear-gradient…]` de `Button.tsx`. Um por camada. |
| `secundario` | `bg-surface border border-fio-controle text-botao-secundario`; hover `bg-linha-hover` |
| `fantasma` | sem borda, `text-t2`; hover `bg-linha-hover` |
| `perigo` | `bg-surface border border-error-line text-error-ink`. **Nunca chapado.** Só em menu ou modal de confirmação. |

- Pressionar `active:scale-[.98]` 100ms. Desabilitado `opacity-40
  cursor-not-allowed`.
- **Carregando:** o rótulo fica; `Loader2` 16 entra à esquerda (no lugar do
  ícone); `aria-busy`, `disabled`, largura travada. **Proibido trocar o rótulo
  por `<Spinner>`.**
- Entre botões `gap-3`. Ação principal à direita no computador; primeira e
  largura total no celular.

### 7.9 Campo (`Field`, `MoneyInput`, select, data)

```tsx
<div className="flex flex-col gap-2">
  <label className="text-texto-meta font-medium text-t2">Valor da parcela <span className="text-error-ink">*</span></label>
  <input className="h-11 rounded-controle border border-fio-controle bg-surface px-3 campo text-t1
    placeholder:text-t-meta hover:border-t3 focus:border-brand focus:outline-none
    focus:ring-[3px] focus:ring-brand/25 aria-[invalid=true]:border-error" />
  <p className="text-nota">dica</p>   {/* ou <p role="alert" className="text-nota text-error-ink">erro</p> no mesmo lugar */}
</div>
```

- **44px para todo controle** (texto, select, data, dinheiro). Acaba com 42/44/48.
- **[correção da crítica]** Hover e erro não podem baixar o contraste da borda:
  `hover:border-line-strong` dava 1,46:1 no claro (pior que o repouso, 3,97) e
  `border-error-line` dava 1,78:1. Hover usa `t3` (≥5,5:1 nos dois temas) e
  erro usa `error` (4,73:1 no claro, 5,88 no escuro).
- Dica e erro ocupam o mesmo slot: o erro substitui a dica, o layout não pula.
- Grade de formulário: `grid gap-x-4 gap-y-6 sm:grid-cols-2`.
- `MoneyInput`: "R$" `absolute left-3 text-t-meta`, input `pl-10 num text-right`.
- **Data:** input nativo com `color-scheme` do tema (`dark` / `light`) e o
  indicador **nativo** do navegador (sem ícone lucide extra: seriam dois
  calendários, e o glifo de calendário é reservado à situação, 7.7). No iOS o
  input de data ignora `height`: aplicar `appearance:none; min-height:44px;
  display:flex; align-items:center`. Valor exibido `dd/mm/aaaa`.

### 7.10 Painel lateral (`SidePanel`)

- **Larguras:** `md` 30rem (480: detalhe, drill-down, parcela); `lg` 42rem (672:
  formulários, Registrar venda); `xl` 52rem (tabela de relatório).
- **Computador:** `fixed inset-y-0 right-0 rounded-l-sobreposicao border-l
  border-fio-caixa bg-surface shadow-modal`. **Celular:** tela cheia; se o
  conteúdo é curto (menu "Mais", confirmação de parcela), folha de baixo com
  `rounded-t-sobreposicao`.
- **Véu:** `bg-[color:var(--veu-painel)]` (corrige o `black/25`; o prefixo `color:` evita que o Tailwind adivinhe o tipo).

| Parte | Classes |
|---|---|
| Cabeçalho | `h-16 shrink-0 px-4 sm:px-6 flex items-center gap-3 border-b border-fio-linha`: `[Voltar 40, se drill-down aninhado] [título text-titulo-painel + subtítulo text-texto-meta, min-w-0 truncate] … [ações ≤1] [Fechar 40 / 44]` |
| Corpo | `flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-6 flex flex-col gap-8`; seções sem `Cartao`; `Lista contexto="sobreposicao"` |
| Rodapé (só com ação) | `shrink-0 border-t border-fio-caixa px-4 sm:px-6 pt-4 pb-seguro flex items-center gap-3`: resumo opcional à esquerda (`texto-meta` + `valor-destaque`), `[secundário][primário]` à direita; celular: botões `lg flex-1` |

- **Um painel por vez.** Drill-down dentro dele **substitui** o conteúdo (pilha
  interna, "Voltar"), com o estado na URL. Nunca empilha.
- **O fim do drill-down é a venda** (frase 1 do Rafael): item de composição
  que é parcela ou comissão é um link para `/vendas/:id?parcela=<id>` (admin)
  ou `/minhas-vendas?venda=<id>&parcela=<id>` (corretor); clicar fecha o painel
  com a saída de 180ms e a tela chega com a parcela destacada (5.5).
- Trava de foco, Escape fecha, o foco volta ao gatilho.
- `scrollbar-gutter:stable` no `html`: travar a rolagem não desloca a página.
- **Edição e criação abrem aqui** (Registrar venda, Editar venda, Reagendar,
  Editar corretor, Lançar, Receber, Pagar).

### 7.11 Modal de confirmação (`ConfirmDialog`, o único modal)

- `fixed inset-0 grid place-items-center p-4 bg-[color:var(--veu-modal)] z-modal`.
- Caixa: `w-full max-w-[25rem] rounded-caixa border border-fio-caixa bg-surface
  shadow-modal p-6`.
- Conteúdo: `IconeTom md` do tom → `mt-4 text-titulo-painel` → `mt-2
  text-texto-corrido` (o que acontece, com números, e o que não volta) →
  `mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3`:
  `[Voltar secundário] [Cancelar venda perigo]`. Foco inicial em "Voltar".
- Celular (<640): `items-end p-0`, caixa `max-w-none rounded-b-none
  rounded-t-sobreposicao pb-seguro`, botões `lg` empilhados.
- A caixa do diálogo, o toast, o popover e a `Dica` **não** levam `data-caixa`
  (o aceite de recuo e de caixa dentro de caixa não se aplica a eles; o do
  painel, item 1b, sim).
- `Modal.tsx` genérico deixa de existir para formulário. `window.confirm` é
  proibido.

### 7.12 Toast

- Computador `fixed right-6 bottom-6`; celular `inset-x-4` acima da barra
  inferior. `w-[min(24rem,calc(100%_-_32px))]` (sem os espaços, o `calc` é inválido).
- Caixa: `rounded-caixa border border-fio-caixa bg-surface shadow-dropdown p-4
  grid grid-cols-[16px_1fr_auto] gap-3 items-start`.
- Conteúdo: ícone 16 do tom · `texto` t1 ("Recebimento registrado ·
  R$ 16.509,75") · ação `fantasma sm` ("Desfazer", que só age depois do banco)
  + fechar 32/44.
- `role="status" aria-live="polite"`; erro `role="alert"` e não some sozinho.
  5s (8s com ação), pausa em hover e foco.

### 7.13 Estados

Precedência: carregando → erro → vazio.

- **Carregando:** esqueleto com a **forma real** (linha com goteira 28, barras
  de 14 e 12px em 40% e 25%, valor 96×16 à direita, mesma `min-height`).
  Blocos `bg-s2 rounded-badge`, **pulso de opacidade** (8.2), **sem
  shimmer**. Aparece só se o banco demorar **> 300ms** (`useAtraso(300)`); antes
  disso, altura reservada vazia. Se já havia dado (troca de mês), o conteúdo
  antigo fica com `opacity .6` e `aria-busy` em vez de esqueleto.
- **Erro:** dentro do cartão que falhou, nunca a tela toda nem um cartão só para
  ele. `flex flex-col items-center text-center px-recuo py-12`: `IconeTom lg`
  risco `AlertCircle` → `mt-4 text-titulo-painel` "Não foi possível carregar as
  parcelas" → `mt-1 text-texto-corrido text-t3 max-w-[48ch]` motivo → `mt-6
  Button secundario` "Tentar de novo". O cabeçalho da página continua.
- **Vazio:** mesma geometria: `IconeTom lg` → título → texto → ação. Dentro do
  cartão da lista. Por filtro: "Nenhuma parcela sem baixa" + "Ver todas".
- Apagar `EmptyState.tsx`, `QuadroErro`, `QuadroCarregando`. `Spinner` só
  dentro de botão.

### 7.14 Ícones

- Componente `Icone` (lucide) com `strokeWidth` 1.6 fixo e tamanho por
  contexto: **12** chip · **16** padrão (linha, botão, título de cartão,
  navegação) · **20** barra inferior, toast · IconeTom sm 28 (glifo 14), md 36
  (glifo 16), lg 44 (glifo 20).
- Nenhum ícone lucide importado direto em tela sem passar por `Icone`/`IconeTom`
  (lint: `strokeWidth` ausente).
- Todo ícone significa algo (Ajuste 3). Sem ponto colorido decorativo (sai de
  `ProximaAcao`), sem triângulo de reforço redundante.

### 7.15 Controles da faixa (`SeletorMes`, `FiltrosRapidos`, `Abas`, busca)

A faixa tem **uma altura de controle só**: 40px com ponteiro fino ≥1024 e 44px
abaixo de 1024 ou com toque (a mesma media de 7.8). Todos na mesma fileira
alinham topo e base (0px).

| Controle | Classes |
|---|---|
| `SeletorMes` | `inline-flex items-center rounded-controle border border-fio-controle bg-surface`: `[‹ quadrado]` · rótulo `texto-titulo num min-w-[9rem] text-center` · `[› quadrado]`. Sem sombra, sem `overflow-hidden`, sem ícone de calendário. Em 390 ocupa a largura toda. |
| `FiltrosRapidos` (item) | `inline-flex items-center gap-2 px-3 rounded-controle border texto-titulo` + `Badge`; ativo 5.5. `role="radio"` dentro de `role="radiogroup"`, `aria-checked`. |
| `Abas` (item) | `px-3 texto-titulo text-t2`, ativo `text-t1 font-semibold` + sublinhado 2px na base da fileira; a fileira tem `border-b border-fio-linha`. `role="tab"`. |
| Busca | `Field` na altura da faixa (não 44 fixo): `rounded-controle border-fio-controle pl-10`, ícone `Search` 16 à esquerda, placeholder ≤ 24 caracteres. |

- Pressionar em aba, filtro, seletor, item do trilho e item da barra inferior:
  fundo `linha-press` enquanto pressionado, sem escala.
- Formulário (painel lateral) é outra régua: campo 44 e **todo botão na mesma
  fileira de um campo é `lg` (44)**, para a fileira não misturar 44 com 40.

---

## 8. Movimento

### 8.1 Tokens

```css
:root{
  --dur-toque:100ms;    /* pressionar */
  --dur-micro:150ms;    /* hover, cor, fio do cabeçalho, troca de número */
  --dur-pagina:200ms;   /* entrada de página, modal, troca de conteúdo no painel */
  --dur-lista:240ms;    /* escada, expandir linha, toast */
  --dur-painel:280ms;   /* painel lateral e folha entrando */
  --dur-saida:180ms;    /* toda saída */
  --dur-barra:520ms;    /* barra enche (guia) */
  --dur-contagem:700ms; /* contagem do herói (guia) */
  --escada:30ms;        /* atraso por item, teto de 7 itens */
  --curva-entra:cubic-bezier(.16,1,.3,1);   /* a curva da casa: desacelera sem passar do ponto */
  --curva-sai:cubic-bezier(.3,0,.8,.15);    /* saída acelera para fora */
  --curva-cor:cubic-bezier(.2,0,0,1);       /* cor e estado */
}
```

Tailwind: `transitionDuration: { toque:'var(--dur-toque)', micro:'var(--dur-micro)', … }`,
`transitionTimingFunction: { entra:'var(--curva-entra)', sai:'var(--curva-sai)', cor:'var(--curva-cor)' }`,
e o `DEFAULT` de ambos redefinido para `--dur-micro` / `--curva-cor` (as
transições existentes herdam a curva sem editar uma a uma).

### 8.2 Keyframes (substituem todos os atuais)

```css
@keyframes sobe         { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
@keyframes esmaeceEntra { from{opacity:0} to{opacity:1} }
@keyframes esmaeceSai   { from{opacity:1} to{opacity:0} }
@keyframes painelEntra  { from{opacity:0;transform:translateX(32px)} to{opacity:1;transform:none} }
@keyframes painelSai    { from{opacity:1;transform:none} to{opacity:0;transform:translateX(24px)} }
@keyframes folhaEntra   { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:none} }
@keyframes folhaSai     { from{opacity:1;transform:none} to{opacity:0;transform:translateY(16px)} }
@keyframes modalEntra   { from{opacity:0;transform:scale(.98)} to{opacity:1;transform:none} }
@keyframes modalSai     { from{opacity:1;transform:none} to{opacity:0;transform:scale(.98)} }
@keyframes toastEntra   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
@keyframes avanca       { from{opacity:0;transform:translateX(12px)} to{opacity:1;transform:none} }
@keyframes recua        { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:none} }
@keyframes numeroTroca  { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }
@keyframes barraEnche   { from{transform:scaleX(0)} to{transform:scaleX(1)} }
@keyframes pulsoEsqueleto { 0%,100%{opacity:1} 50%{opacity:.55} }
@keyframes saltoBadge   { 0%,100%{transform:scale(1)} 30%{transform:scale(1.3)} 60%{transform:scale(.92)} 80%{transform:scale(1.08)} }

/* Estado padrão é VISÍVEL. Só anima com .animar, que o JS põe no <html> quando a aba está visível. */
/* ENTRADA usa fill backwards: o estado final é o natural do elemento e nenhum transform fica aplicado depois (um transform que "fica" cria bloco de contenção e camada de composição). SAÍDA usa both: o elemento some logo depois. */
.animar .entrada-pagina{ animation:sobe var(--dur-pagina) var(--curva-entra) backwards; }
.animar .escada:not([data-animou]) > *{ animation:sobe var(--dur-lista) var(--curva-entra) backwards;
  animation-delay:calc(min(var(--i,0),7) * var(--escada)); }       /* --i inline; teto 210ms */
/* rede de segurança: 600ms depois de montar, o JS põe data-animou e a animação some;
   se o navegador não rodou os quadros (iframe fora da tela, aba congelada), o item aparece mesmo assim */
.painel[data-estado="entrando"]{ animation:painelEntra var(--dur-painel) var(--curva-entra) backwards; }
.painel[data-estado="saindo"]  { animation:painelSai var(--dur-saida) var(--curva-sai) both; }
.folha[data-estado="entrando"] { animation:folhaEntra var(--dur-painel) var(--curva-entra) backwards; }
.folha[data-estado="saindo"]   { animation:folhaSai var(--dur-saida) var(--curva-sai) both; }
.veu[data-estado="entrando"]{ animation:esmaeceEntra var(--dur-pagina) linear backwards; }
.veu[data-estado="saindo"]  { animation:esmaeceSai var(--dur-saida) linear both; }
.modal[data-estado="entrando"]{ animation:modalEntra var(--dur-pagina) var(--curva-entra) backwards; }
.modal[data-estado="saindo"]  { animation:modalSai 150ms var(--curva-sai) both; }
.numero-trocou{ animation:numeroTroca var(--dur-micro) var(--curva-cor); }
.barra-preenchimento{ transform-origin:left; }
.animar .barra-preenchimento[data-primeira]{ animation:barraEnche var(--dur-barra) var(--curva-entra) backwards; }
.esqueleto{ animation:pulsoEsqueleto 1.4s ease-in-out infinite; }
html.trocando-tema *, html.trocando-tema *::before, html.trocando-tema *::after{ transition:none!important; }
```

- `--i` vem inline (`style={{'--i': n}}`); `nth-child` sai. A classe `.animar`
  só entra com `document.visibilityState==='visible'`: acaba a corrida que
  deixou 5 linhas invisíveis no Início do celular.
- **Apagar:** `slideUp`, `entradaPagina`, `auroraA`, `auroraB`, `atencaoPulse`,
  `barraAtencao`, `shimmer`, `painelDireita`, `painelSobe`, `overlayEntra`,
  `badgeBounce` (vira `saltoBadge`), e no Tailwind `fade-in`, `scale-in`,
  `slide-up`, `recibo`. Classes `.stagger-children`, `.entrada` (320ms),
  `animate-fade-in`, `animate-recibo`.

### 8.3 Coreografia

| Interação | O que acontece |
|---|---|
| **Entrada de página** | `<main>` com `entrada-pagina` 200ms, uma vez por rota (`key` = rota). Cabeçalho e trilho não animam e não mudam de altura. |
| **Escada** | Filhos de listas com `escada`, 30ms por item, teto 7. **Só na 1ª montagem da lista na rota** (`useRef` `jaAnimou`). Filtro, ordenação, troca de mês e refetch não refazem. Se houve esqueleto, o conteúdo entra com `esmaeceEntra` 150ms, sem escada. |
| **Abrir painel** | Véu 200ms + painel 280ms `curva-entra` (folha no celular). Foco no título após 1 quadro. |
| **Fechar painel** | Hook `usePresenca(aberto, 180)` mantém montado com `data-estado="saindo"` e desmonta no `animationend` (timeout 220ms de garantia). Vale para SidePanel, ConfirmDialog, Toast, Tip, popovers, paleta. Substitui `{aberto && …}`. |
| **Drill-down no painel** | Avançar: conteúdo novo com `avanca` 200ms. Voltar: `recua` 200ms. O painel não fecha nem reabre. |
| **Trocar mês** | Rótulo do mês com `avanca` (próximo) ou `recua` (anterior) 200ms. Dados antigos ficam com `opacity .6` depois de 150ms de espera. Quando o banco responde, cada `[data-valor]` **do herói e dos apoios do herói** que mudou recebe `numero-trocou`; valores de lista, tabela e KPI trocam sem animação (8.4). Sem contagem, sem esqueleto se já havia dado. |
| **Contar número** | Só `[data-heroi]`, só na 1ª exibição do herói **naquela rota** na sessão (trocar o mês não conta de novo: usa `numero-trocou`), só **depois** da resposta do banco: 700ms, ease-out cúbico, rAF, dígitos tabulares, largura reservada pelo valor final, `aria-label` com o valor final desde o 1º quadro (o span animado `aria-hidden`). Depois: `numero-trocou`. |
| **Barra** | 1ª exibição: `barraEnche` 520ms em `scaleX` (não `width`). Valor novo (troca de mês, refetch, gravação): **sem transição**, como os números (8.4). |
| **Hover** | Linha e item de fila: `::before` com opacidade em 150ms `curva-cor`. Controle isolado (botão, campo, aba, filtro, item do trilho, seletor): `transition-colors` 150ms `ease-cor` (8.4). KPI e cartão clicável: `translateY(-2px)` + sombra em `::after`. |
| **Pressionar** | Botão `scale(.98)`, KPI `scale(.98)`, 100ms. Linha: `::before` em `linha-press`, sem escala. Aba, filtro, seletor de mês, item do trilho e da barra inferior: fundo `linha-press`, sem escala (7.15). |
| **Expandir linha / "Ver a conta"** | A altura assume o valor final na hora (não se anima altura). O conteúdo novo entra com `sobe` 240ms; chevron gira 90° (`transform`) em 150ms. Recolher: conteúdo some com `esmaeceSai` 120ms e desmonta. |
| **Toast** | `toastEntra` 240ms; sai `esmaeceSai` 180ms. Empilhados deslocam por `transform` 180ms. |
| **Aba ativa** | O sublinhado de 2px (sem raio) se move por `translateX` + `scaleX` em 200ms `curva-entra`. |
| **Filtro rápido ativo** | **Não desliza** **[correção da crítica]**: uma pílula com borda e raio de 8 esticada por `scaleX` deforma a borda e o canto. O fundo do filtro ativo entra por `::before` com opacidade em 150ms. |
| **Troca de tema** | Com `document.startViewTransition` e sem movimento reduzido: crossfade de 200ms da raiz. Sem suporte: troca instantânea com `html.trocando-tema` por 1 quadro. |
| **Salto do badge** | `saltoBadge` 500ms quando o contador do sino **aumenta** (exceção do guia). |
| **Chegada por `?parcela=`** | Rolagem suave (se permitido) + `::after` `linha-hover` que fica 700ms e sai em 520ms por `opacity` (5.5). |

### 8.4 Nunca anima

- Números de lista, tabela e KPI; qualquer refetch; valor que chega de gravação.
- Ação repetida ("Recebi" em sequência), digitação, navegação por teclado,
  seleção na paleta.
- `width`, `height`, `top`, `left`, `margin`, `padding`, `box-shadow`,
  `background-position`, `filter` em keyframe ou transição, em qualquer lugar.
- `background-color`/`border-color`/`color` em **keyframe**, em qualquer lugar,
  e em **transição dentro de lista** (linha, célula, item de fila: o hover é
  `::before` com opacidade). **[correção da crítica: a versão anterior proibia
  `transition-colors` em tudo, mas 7.8 e 7.9 pintam hover de botão, campo e
  item do trilho com troca de fundo e borda]** Em controle isolado (botão,
  campo, aba, filtro, item do trilho, seletor de mês) a transição de cor é
  permitida: `transition-colors duration-micro ease-cor`. `transition-all` é
  proibido (anima largura sem ninguém perceber).
- Halo, pulso de alerta, barra que pisca, aurora, shimmer, degradê animado.
- Nada infinito, exceto `.esqueleto` enquanto `aria-busy="true"`.
- Nenhuma duração acima de 700ms, exceto o ciclo do esqueleto (1,4s). Atraso
  (`delay`) não conta como duração: o destaque de chegada espera 700ms e sai em
  520ms.

### 8.5 `prefers-reduced-motion: reduce`

```css
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{ animation-duration:.01ms!important; animation-delay:0ms!important;
    transition-duration:.01ms!important; scroll-behavior:auto!important; }
  .esqueleto{ animation:none!important; opacity:.7; }
}
```

- Hook `useMovimentoReduzido()` escuta `matchMedia(...).addEventListener('change')`
  (hoje só lê uma vez). Com a preferência ligada: `.animar` não é aplicada,
  contagem mostra o valor final, barra já cheia, `startViewTransition` não é
  chamado, `usePresenca` desmonta em 0ms.
- Foco visível não muda.

---

## 9. Plantas de tela

Valores "R$ ···" são posição, não dado. Os números da parcela 1 são os do print
do Rafael.

### 9.1 Casca, computador 1440×900

```
┌─ trilho 248 ───────────────┬─ área 1192 ───────────────────────────────────────────────────────┐
│ topo h64 px16 (sem fio)    │ cabeçalho h64 · .conteudo (margem 32) · fio só ao rolar           │
│ [S32] 12 Souza             │ [←40] 12 [ícone36] 12 Título  subtítulo…   [sino40] 12 [ações] [CTA] │
│          IMOBILIÁRIA       │                                                                    │
│                            ├─ (fio só com data-rolou) ──────────────────────────────────────────┤
│ 24                         │ 32 (--topo-conteudo) · 1º filho: faixa (mês, filtros), se a rota tiver │
│ OPERAÇÃO (h2 rótulo)       │ ┌ conteúdo 1128 ──────────────────────────────────────────────┐    │
│ 8                          │ │ bloco                                                        │    │
│ [▣ Início          ] h40   │ │ 32 (--vao-secao)                                             │    │
│ 4                          │ │ bloco                                                        │    │
│ [▣ Vendas          ] h40   │ └──────────────────────────────────────────────────────────────┘    │
│ 24                         │ 64 até o fim                                                       │
│ FINANCEIRO                 │                                                                    │
├─ fio ──────────────────────┤                                                                    │
│ [avatar] Rafael / admin [«40]                                                                   │
└────────────────────────────┴────────────────────────────────────────────────────────────────────┘
```

### 9.2 Venda (`/vendas/:id`, a tela do print), computador 1440

```
cabeçalho h64 (sem seletor de mês, sem CTA "Registrar venda"):
  [← Vendas 40] 12 [IconeTom Handshake 36] 12 414-D · PortoVelas  Maria Souza · vendida 12/03/2026 · Dionata Alves…   [sino 40] 12 [Editar sec md] 12 [⋯ 40]
                (h1 e subtítulo na MESMA linha, subtítulo texto-meta truncado com title; 4.2)
                                                                         menu ⋯: Reagendar parcelas · Cancelar venda (perigo → ConfirmDialog)
32
┌ HERÓI col 12 · p32 · borda-ouro · grid [1fr 26rem] gap48 ─────────────────────────────────────────┐
│ JÁ FICOU PARA A IMOBILIÁRIA                            │ A CONTA DA COMISSÃO (contratada)          │
│ 12                                                     │ Comissão contratada          R$ ···       │
│ R$ 5.519,17   (34/40, ouro, conta 700ms na 1ª vez)     │ ISS retido · 3%          −   R$ ···       │
│ 8                                                      │ Simples · 6%             −   R$ ···       │
│ "de R$ ··· que a venda deixa · R$ ··· ainda dependem   │ Dionata Alves · 65%      −   R$ ···       │
│  da construtora (não é caixa)"   texto-corrido         │ ─ fio-caixa ─                             │
│ 24                                                     │ Fica, se tudo for pago      R$ ···        │
│ ▬▬▬▬▬▬░░░░░░░░ barra 6px · legenda "já entrou 33%"     │   (valor-destaque t1, NUNCA ouro)         │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
32
┌ DA CONSTRUTORA PARA A IMOBILIÁRIA col 6 ───────┐ 24 ┌ DA IMOBILIÁRIA PARA O CORRETOR col 6 ───────┐
│ h56 [Building2] título                          │    │ h56 [HandCoins] título                       │
│ barra 6px recebido/contratado   (px-recuo)      │    │ barra 6px pago/contratado                    │
│ Recebido     [✓ Recebida]      R$ ···  ›  h56   │    │ Pago a Dionata   [✓ Paga]     R$ ···  ›      │
│ A receber    [◷ Prevista]      R$ ···  ›  h56   │    │ A pagar agora    [Liberada]   R$ ··· [Pagar] │
│                                                 │    │ Previsto         [◷ Prevista] R$ ···  ›      │
└─────────────────────────────────────────────────┘    └──────────────────────────────────────────────┘
   (os dois lados nunca somam entre si)
32
┌ PARCELAS col 12 · @container ≥65rem → forma A ─────────────────────────────────────────────────────┐
│ h56 [ListOrdered] Parcelas · 3 parcelas · 1 recebida                                                │
│ h40 rótulo:  #   PARCELA                    VALOR       IMPOSTOS     CORRETOR        FICA     AÇÃO   │
│ ─ fio ───────────────────────────────────────────────────────────────────────────────────────────── │
│ 24 [①] 16 Parcela 1 de 3             R$ 17.020,36  − R$ 1.501,19  − R$ 10.000,00  R$ 5.519,17  [⋯] › 24│
│         recebida 02/09 · caíram R$ 16.509,75                      [✓ Paga]                          │
│         [✓ Recebida]                                                               py16 · min-h64   │
│ ─ HOJE · 12/09 (rótulo t2, fio-caixa) ───────────────────────────────────────────────────────────── │
│ 24 [②] Parcela 2 de 3                R$ ···        − R$ ···       − R$ ···        R$ ···  [Recebi] › │
│         prevista para 10/10 · em 28 dias                          [◷ Prevista]                      │
│ …                                                                                                   │
│ rodapé: já entrou R$ ··· · depende da construtora R$ ···   (ParAgoraPrevisto)                       │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
32
┌ HISTÓRICO col 12 · linhas texto-meta (reagendamentos, desconto combinado, observações) ─────────────┐
```

- Entre 30 e 65rem de cartão (ex.: 1280 com trilho aberto): forma B (7.3.3).
- Os dois cartões de col 6 medem 552px em 1440 (34,5rem < 40rem): as linhas
  deles usam a **forma estreita** de 7.2 (título | valor; meta | chip; ação na
  3ª fileira). A planta mostra o conteúdo, não a geometria. De 1536 com trilho
  recolhido para cima (cartão ≥ 40rem), passam à forma larga.
- A barra de cada cartão fica em `Cartao.Corpo` (`px-recuo`), antes da lista.
- `?parcela=<id>` rola até a parcela, destaca (5.5) e foca.
- Editar e Reagendar abrem `SidePanel lg`; Cancelar abre `ConfirmDialog`.

**Cada defeito do print e onde ele deixa de existir:**

| Defeito | Regra |
|---|---|
| Selo "1" encostado e cortado na borda esquerda | Linha com `px-recuo` (24) dada pela `Lista`; goteira 28 com selo 28; sem margem negativa; cartão sem `overflow-hidden` |
| R$ 17.020,36 encostado à direita | O último elemento da linha termina a exatamente `--recuo` (24) da borda direita; a coluna Valor, que não é a última na forma A, termina ≥ 24 + 16 da borda (itens 1 e 3) |
| Botões colados no fundo | Ação na coluna (A/B) ou fileira com 16 abaixo (C); `last:-mb-3` apagado |
| Fileira de seis valores | Colunas com cabeçalho (Impostos, Corretor, Fica) ou `Demonstrativo`; "caiu" vira meta; "Fica" é o único peso 600 t1 |
| Topo do trilho espremido | Topo de 64 só com a marca, 24 até OPERAÇÃO; sino no cabeçalho, recolher no rodapé |
| Conteúdo sob o cabeçalho, cartão cortado | Fundo sólido + fio e sombra ao rolar + `scroll-padding-top` |
| Total repetido e "Cancelar venda" vermelho no ouro | Herói = realizado; conta ao lado com total em t1; Cancelar no menu ⋯ |

**Celular 390 (forma C):** herói `p-4` com "R$ 5.519,17" em 28/32, frase, barra;
a conta vira `<details>` "Ver a conta (5 linhas)" de 44px; os dois cartões de
lado empilham (`gap-secao` 24); parcelas na forma C com ações `h-11`.

### 9.3 Início (admin), computador 1440

```
cabeçalho h64:
  [Home 36] Boa tarde, Rafael · sábado, 12 de setembro · 4 coisas pedem você     [sino] [+ Registrar venda]
32
faixa (1º filho do <main>, rola): [‹ Setembro 2026 ›]
32
┌ HERÓI col 12 · borda-ouro · p32 ───────────────────────────────────────────────────────────────────┐
│ DISPONÍVEL EM CONTA                                                                                  │
│ R$ ··· (34/40 ouro; abre as contas com o saldo de cada uma)                                          │
│ "soma de 3 contas · último lançamento em 11/09"                                                      │
│ 24 ─ fio ─ 24   grid-cols-3 gap24:                                                                   │
│ DEVIDO AGORA R$ ··· ›  |  ENTRA PREVISTO NO MÊS R$ ··· › (t2)  |  SEM BAIXA, DATA PASSADA R$ ··· ›   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
32
┌ AGORA col 7 ────────────────────────────────────────┐ 24 ┌ SETEMBRO col 5 ───────────────────────────┐
│ h56 [ListChecks] Agora  [4]                          │    │ h56 [CalendarRange] Setembro              │
│ LinhaGrupo VOCÊ DEVE · 2                             │    │ LinhaGrupo ENTRA                          │
│ [HandCoins] Comissão liberada · Dionata              │    │ Previsto no mês            R$ ···  ›      │
│   liberada há 3 dias           R$ ··· [Pagar sm]  ›  │    │ Sem baixa, data passada    R$ ···  ›      │
│ LinhaGrupo CONFERIR · 2                              │    │ LinhaGrupo SAI                            │
│ [CalendarX2] Parcela 3/3 · Solaris 1202              │    │ Devido agora               R$ ···  ›      │
│   era prevista para 12/08 · sem baixa  R$ ··· [Recebi sm][⋯] │ Previsto                   R$ ···  ›      │
│ vazio: "Tudo em dia" + próxima parcela prevista      │    │ rodapé: 7 vendas ativas · R$ ··· a entrar ›│
└──────────────────────────────────────────────────────┘    └────────────────────────────────────────────┘
```

Sai: "Ver A receber"/"Ver A pagar", seção "Carteira" de uma linha (vira rodapé),
parágrafo de rodapé, selo "traço". A faixa de mês afeta toda a tela; o que não
depende do mês (saldo) diz "hoje" no rótulo.

### 9.4 Início (admin), celular 390×844

```
┌ cabeçalho h56 px16: [Home 28] 12 Início                    [sino 44] [+ Venda 44] ┐
├──────────────────────────────────────────────────────────────────────────────────┤
│ 24 ┌ bloco de abertura (um filho do main, flex-col gap-4) ─┐                      │
│    │ "Boa tarde, Rafael · sábado, 12/09" texto-meta         │                      │
│    │ 16                                                     │                      │
│    │ [‹44] Setembro 2026 [›44]  (seletor largura total, h44)│                      │
│    └────────────────────────────────────────────────────────┘                      │
│ 24                                                                                │
│ ┌ HERÓI p16 borda-ouro ───────────────────────────────────┐                        │
│ │ DISPONÍVEL EM CONTA                                      │                        │
│ │ R$ ···  28/32 ouro                                       │                        │
│ │ "3 contas · ver contas ›" (44 de área)                   │                        │
│ │ 16 ─ fio ─                                               │                        │
│ │ Devido agora                        R$ ···  › h44        │                        │
│ │ Previsto no mês                     R$ ···  › h44        │                        │
│ │ Sem baixa                           R$ ···  › h44        │                        │
│ └──────────────────────────────────────────────────────────┘                        │
│ 24                                                                                │
│ ┌ Agora [4] h56 px16 ─────────────────────────────────────┐                        │
│ │ VOCÊ DEVE · 2                                            │                        │
│ │ [HandCoins28] Comissão liberada ·        R$ 10.000,00    │  título | valor        │
│ │   Dionata · há 3 dias               [Liberada]           │  meta | chip           │
│ │   [Pagar                   h44 flex-1] [⋯ 44]            │  ações, 12 acima, 16 abaixo │
│ │ CONFERIR · 2 …                                           │                        │
│ └──────────────────────────────────────────────────────────┘                        │
│ 24 · Setembro (Linhas h56) · 24                                                   │
├ barra inferior h64 + safe: Início · Vendas · Receber · Pagar · Corretores · Mais ──┤
```

Largura útil do título: 358 − 32 (recuo) − 28 (goteira) − 12 (vão) − valor.
Com valor de ~112px, sobram ~174px, em até 2 linhas, nunca cortado.

### 9.5 Receber, computador 1440

```
cabeçalho h64:
  [ArrowDownToLine 36] A receber · 2 com data passada · R$ ··· previstos em setembro   [sino] [+ Registrar venda]
32
faixa (1º filho do <main>): [‹ Setembro ›]   [Este mês 3] [30 dias 7] [Tudo 21]   (FiltrosRapidos neutros; SÓ mexem nas listas)
32
┌ HERÓI previsto (fio-caixa, número t1, SEM ouro; 7.5) ─────────────────────────────────────────────────┐
│ A RECEBER · PREVISTO · R$ ··· (t1; abre as parcelas; não muda com o filtro)                            │
│ "depende de a construtora pagar · comissão contratada, não dinheiro em conta"                          │
│ ─ fio ─ grid-cols-2: CAIU NA CONTA EM SETEMBRO R$ ··· › (realizado, t1) | SEM BAIXA, DATA PASSADA R$ ··· ›│
└───────────────────────────────────────────────────────────────────────────────────────────────────────┘
   (o herói não muda com o filtro)
32
┌ PARA CONFERIR · 2 (só existe se > 0; se 0, linha calma "Nada com data passada") ──────────────────────┐
│ colunas: 28 IconeTom | 1fr | 7.5rem chip | 9rem valor | 11rem ação | 16                                │
│ [CalendarX2] 414-D · parcela 2/3     [Sem baixa]   R$ 17.020,35   [Recebi sm] [Reagendar sm]  ›         │
│   era prevista para 12/08 · PortoVelas · Maria Souza                                                    │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
32
┌ A SEGUIR ──────────────────────────────────────────────────────────────────────────────────────────────┐
│ colunas: 28 Selo | 1fr | 9rem valor | 11rem ação | 16    (sem coluna de chip: tudo é previsto)          │
│ LinhaGrupo SETEMBRO · 3                                            previsto R$ ··· (abre)               │
│ [②] 414-D · parcela 2/3 · Maria Souza · prevista 10/10     R$ ···   [Recebi sm]  ›                     │
│ LinhaGrupo OUTUBRO · 4 …                                                                                │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

As duas listas têm a mesma posição da coluna de valor (a de "A seguir" omite o
chip reservando o mesmo espaço à esquerda do valor, então as bordas direitas
coincidem). Goteira: ícone numa lista, selo na outra, nunca misturados.
"Recebi" abre `ReceberParcela` (venda) ou `BaixarLancamento` (avulsa) no
`SidePanel`. Celular: ações na 3ª fileira da linha, `h-11`.

### 9.6 Painel "Registrar venda" (`SidePanel lg`, 672px)

```
┌ h64 px24: [FilePlus2] Registrar venda / "a conta aparece enquanto você preenche"           [X 40] ┐
├─ fio ──────────────────────────────────────────────────────────────────────────────────────────────┤
│ corpo px24 py24 · flex-col gap-32 (seções separadas por fio-linha)                                 │
│ [Building2 16] A venda  (titulo-secao) · 12                                                        │
│   grid-cols-2 gap-x16 gap-y24: Empreendimento [select 44] | Unidade [44]                           │
│                                Comprador [44]             | Data da venda [date 44]               │
│                                Valor do imóvel [R$ 44]    | Comissão contratada [R$ 44]           │
│ ─ fio ─                                                                                            │
│ [Users 16] A comissão · 12                                                                         │
│   Corretor [select] | % do corretor [44] ; Simples % | ISS retido % ; nota 12/16 sob cada          │
│ ─ fio ─                                                                                            │
│ [ListOrdered 16] As parcelas · 12                                                                  │
│   Lista contexto="sobreposicao" (linhas px0, border-top fio-linha):                                │
│   colunas 28 Selo | data [44] | valor [R$ 44] 9rem | remover 44                                    │
│   [+ Adicionar parcela  fantasma md]                                                               │
│ ─ fio ─                                                                                            │
│ [Calculator 16] O que sobra desta venda · 12 → Demonstrativo (sub-bloco s2, sem ouro)              │
├─ fio-caixa · rodapé px24 pt16 pb-seguro ───────────────────────────────────────────────────────────┤
│ Fica para a imobiliária  R$ ··· (valor-destaque)                  [Cancelar sec md] 12 [Registrar venda] │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
celular: tela cheia, cabeçalho h56 px16, campos em 1 coluna gap-y24, rodapé com botões lg flex-1
```

- **[acima do guia]** Sai a janela central de 3 passos: uma rolagem só, sem
  caixa dentro de caixa. Validação no envio: mostra todos os erros no slot da
  dica, rola e foca o primeiro. Escape com dados preenchidos pede
  `ConfirmDialog` "Descartar a venda?".
- `ReceberParcela`, `PagarComissao`, `LancarDespesa`, `BaixarLancamento` seguem
  a mesma anatomia. Em `ReceberParcela`, o `Demonstrativo` "a conta que vai ser
  gravada" fica no rodapé fixo, visível enquanto se digita; a dica do ISS
  aparece uma vez. `PagarComissao`: botão com o valor ("Pagar R$ 10.000,00");
  o ordinal vem de `idx/count` no dado, não de regex.
- `FolhaDeLancamento.tsx` perde `ListaNaFolha`, `QuadroDaConta`, `DobraDaFolha`.

### 9.7 Demais telas do admin (regras de composição)

- **Vendas:** herói **previsto** "Comissão em carteira · prevista" (variante
  `previsto`, sem ouro, 7.5) com barra "já entrou X%" e apoios "já recebida
  R$ ···" e "fica para a imobiliária R$ ···"; `ProximaAcao` como
  item de fila (`FilaDeAcao`, sem ponto decorativo e sem pulso); **os 4 KPIs
  saem** (os filtros rápidos com contador ficam na faixa); lista com colunas
  Venda | Situação | Já entrou (≥1024) | Comissão | fim, grupos por ano, rodapé
  `ParAgoraPrevisto`. Celular: meta com "·" em `::before`, no máximo 2 linhas.
- **Pagar:** herói "Devido agora" com apoios Corretores · Imposto · Despesas
  vencidas (cada um abre; "previsão não entra"); cartão "Pagar agora" (fila por
  prazo, agrupada por beneficiário, ação "Pagar" visível); cartão "Vence nos
  próximos 30 dias"; cartão "Previsto, depende da construtora" com **uma linha
  por corretor** que abre a composição (a lista parcela a parcela sai da tela).
- **Despesas:** herói "Saiu no mês" (pago) com apoios "em aberto" e "outras
  entradas" (não somam); faixa de dica "Lançar 4 fixas · R$ ···" com uma ação;
  lista agrupada por data com filtros (Tudo, Em aberto, Pagos, Entradas) na
  faixa; excluir no menu "⋯" com `ConfirmDialog`; a seção de uma linha e o
  parágrafo saem.
- **Corretores:** herói "A pagar agora" com apoio "previsto"; dica de logins sem
  vínculo; **uma lista só**: nome + ícone de acesso | vendas · VGV
  (`texto-meta`, nunca como receita) | Pago | A pagar agora (com "Pagar") |
  Previsto | barra fina. A linha abre o **painel do corretor** (dados, %,
  acesso, parcelas liberadas, vendas; Editar ali). A seção "Produção" sai.
- **Relatórios:** herói "Resultado de setembro" (abre os lançamentos) com apoio
  "margem X% · mês anterior R$ ···"; `Abas` na faixa: Resultado (DRE com cada
  linha abrindo + doze meses) | Empreendimentos | Corretores (Pago · A pagar
  agora · Previsto, colunas separadas) | Categorias; o saldo em conta sai;
  `Caixa/Competência` vira `FiltrosRapidos` na faixa (nunca colado no herói).
- **Config:** `PageLayout` com `Abas` na faixa; corpo `.leitura`; cada aba em
  lista + `SidePanel` de edição; o parágrafo de imposto vira `nota` junto do
  campo. `Segmented` de 40rem sai.

### 9.8 Corretor (celular 390 é a tela)

- **Início = o bolso:** herói "A receber agora" (liberado, **todos os anos**),
  com linha "R$ ··· atrasado há N dias" em `error-ink` + ícone só se houver;
  cartão "Próximos" (liberadas + 3 previstas, linha de HOJE); tocar abre folha
  com o `Demonstrativo` perfil corretor e "ver a venda"; cartão "Seu ano": barra
  + recebido · a receber · previsto numa linha. Lista mensal e produção saem.
- **Recebimentos = cronograma:** sem herói repetido (o topo é uma frase
  `texto-meta`); filtros A receber · Previstas · Recebidas **rolam com a
  lista**; meses com `LinhaGrupo` e `ParAgoraPrevisto`; parcela abre a mesma
  folha.
- **Minhas Vendas = lista e ficha:** uma `Linha` por venda (título,
  empreendimento, "R$ recebido de R$ contratado", barra); tocar abre **ficha em
  tela cheia** (rota `?venda=`): dados, barra de 3 números, `Parcela` perfil
  corretor. O acordeão com lista dentro de lista sai. Sem herói em ouro de
  "sua comissão nesta carteira".
- A linha "Fica para a imobiliária" **não existe no DOM** do corretor.
- Os números "A receber agora" têm **uma** definição nas três telas.

### 9.9 Login

Frase 3 do Rafael: *"Isso que é um login de SaaS? Cadê a identidade?"* O login
é a única tela com marca em tamanho de marca, e é a única com degradê.

```
≥1024 (grid-cols-[minmax(0,1fr)_minmax(28rem,36rem)], altura 100dvh):
┌ PAINEL DE MARCA (data-painel-marca) ─────────────────────┬ FORMULÁRIO bg-page ─────────────────┐
│ p-12 · degradê do guia (--grad-brand sobre Carvão)        │ px-12 · conteúdo max-w-[22rem],     │
│ [S 48] 16 lockup Souza/IMOBILIÁRIA                        │ centrado na vertical                │
│ … (flex-1)                                                │ [S 32] (só <1024; aqui não)         │
│ "Da venda ao repasse, sem planilha." Sora 34/40 700       │ Entrar          titulo-pagina 19/28 │
│ 24                                                        │ 8 · texto-meta "Use o login que a   │
│ 3 provas, texto-corrido, gap-3, ícone 16 com significado  │     imobiliária criou para você"    │
│ … (flex-1)                                                │ 32                                  │
│ rodapé nota "Souza Imobiliária · Itajaí, SC"              │ Login [44] · 24 · Senha [44]        │
│                                                           │ 32 · [Entrar  lg w-full primário]   │
│                                                           │ 16 · "Esqueci a senha" fantasma md  │
└───────────────────────────────────────────────────────────┴─────────────────────────────────────┘
390: faixa de marca no topo (h-40, mesmo degradê, S 40 + lockup, sem frase) e o
formulário abaixo em px-6 pt-8; botão lg largura total; nada fixo no rodapé.
```

- O degradê mora **só** em `[data-painel-marca]`; os hex do código viram
  `var()`/`color-mix` de tokens (`#B9C8EC`/`#93A6D4` saem).
- Texto sobre o painel de marca: ≥ 4,5:1 em qualquer ponto do degradê (medir
  nos dois extremos).
- Entrada: o formulário com `sobe` 200ms, uma vez; o painel de marca não anima.
- O rótulo do identificador é **"Login"** (o corretor usa login interno
  `@souzaimobiliaria.local`; quem tem e-mail digita o e-mail no mesmo campo, e
  a nota abaixo diz isso). "Esqueci a senha" abre um `ConfirmDialog`
  informativo: e-mail de recuperação para quem tem e-mail, "fale com a
  imobiliária" para quem não tem.
- Erro de credencial no slot da dica da senha (`role="alert"`), sem apagar o
  login digitado. Botão `carregando` com rótulo (7.8).
- A troca de senha dentro do app segue a mesma coluna de formulário, dentro do
  `PageLayout` com `.leitura`.

---

## 10. Mapa de implementação

### Fase 0: decisões e dados (antes de pintar)

Não são de design, mas sem elas o sistema novo desenha números errados com mais
clareza. Conferir no banco e corrigir antes da Fase 5:
\1**[feito em c377fc4]** \2 soma `released + expected`: separar
   em A pagar agora e Previsto.
2. **"Vencida" aplicada a atraso da construtora** (Início, contador do menu,
   filtro e subtotal de Receber): passa a "Sem baixa" (7.3.3), conferido contra
   `situacaoDeTela()`.\1**[feito em d1a78cd, decisão do Rafael de 13/09/2026]** "Devido agora" = comissão e imposto de
   parcela JÁ RECEBIDA + despesa vencida ou que vence hoje; despesa futura é
   "A vencer"; retirada do sócio fica fora. App e CFO batem ao centavo. O app
   expõe `MoneyItem.grupo` (`devido`, `a_vencer`, `previsto`, `socio`,
   `entrada`) em `src/lib/sales.ts`: **toda tela decide total e seção pelo
   `grupo`**, nunca por `released` ou `kind`. Pagar mostra "A vencer" no
   cartão "Vence nos próximos 30 dias" (9.7).
4. **Corretor:** uma definição de "A receber agora" nas três telas.\1**[feito em c377fc4]** \2 decidir "vencida" pela data de recebimento (`received_date`),
   como Venda e Vendas.
6. **Receber:** herói não depende do filtro.\1**[feito em c377fc4]** \2 não soma entradas fora de venda.
8. **[decidido pelo Rafael em 13/09/2026] Herói previsto:** previsão pode ser o
   número herói, rotulada "previsto" e nunca em ouro (7.5). Vendas e Receber
   usam a variante `previsto`; as plantas 9.5 e 9.7 já estão assim.\110. **[decidido em 13/09/2026] Despesa e imposto vencidos:** conta com
   vencimento passado e sem baixa é chip **"Vencida"**, tom risco, ícone
   `CalendarX2`, meta "venceu em 05/09 · ou foi paga sem baixa". "Vencida" em
   comissão continua sendo só repasse que a imobiliária recebeu e não fez;
   parcela da construtora com data passada é **"Sem baixa"** (7.3.3), nunca
   "vencida".

### Fase 1: trava

- `scripts/verificar-design.mjs` + `"verificar-design": "node scripts/verificar-design.mjs"`
  e `"prebuild": "npm run -s verificar-design"`. Varre `src/**/*.{ts,tsx}` e
  **falha** em arquivos migrados; em arquivos da lista `ISENTOS` (as telas ainda
  não migradas) só avisa. A lista só diminui.
  - `(^|[\s"'`])-(m|mx|my|mt|mb|ml|mr|inset-x)-` (margem negativa)
  - `\b(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y)-(0\.5|1\.5|2\.5|3\.5|7|9|11|14)\b`
  - `\b(p|m|gap)[xytrbl]?-\[`, `\bspace-[xy]-`
  - `text-\[\d`, e na limpeza `\btext-(xs|sm|base|lg|xl|\dxl)\b`
  - `rounded-\[` em qualquer arquivo; `rounded-(2xl|xl|md|lg|sm)\b` (usar os tokens)
  - `#[0-9a-fA-F]{3,8}\b` fora de `index.css`, `LoginPage.tsx`, `marca/`
  - `gradient` fora de `LoginPage.tsx` e `index.css`
  - `transition-all`, `transition-\[`, `animate-\[` em qualquer arquivo;
    `transition-colors` fora de `src/components/ui` e `src/components/layout`
    (8.4: cor só transiciona em controle isolado)
  - `formatCurrency\(` em `.tsx` fora de `Valor.tsx` e CSV
  - `window\.confirm`, `glifo="traco"`, `SuperficieContext`
  - `<li\b|<tr\b` em `src/admin/pages`, `src/corretor/pages`, formulários de `src/admin`
  - `from 'lucide-react'` em telas sem passar por `Icone` (aviso)
  - `\bz-(\d|\[)` (z literal ou arbitrário; usar `z-cabecalho`, `z-nav`, `z-painel`, `z-modal`…)
  - classes mortas: `gold-edge|gold-glow|grad-brand-glow|surface-premium|card-surface|list-surface|modal-surface|nav-bg-blur|aurora|barra-atencao|atencao-pulse|shimmer|stagger-children|animate-fade-in|animate-recibo|\bcifra\b|\bassinatura\b|texture-grain`
  - aliases deprecados em arquivo migrado: `\b(bg|text|border)-(surface-[23]|content|rule|income|expense|critical|action|forecast|seal|papel)\b`
  - filete: `\bborder-[lr]-(2|4|\[)` (Ajuste 1)
  - cor de fonte fora de token: `\btext-t4\b` em texto < 18px (aviso; usar `text-t-meta`)
- `scripts/aceite-visual.js`: o checklist da seção 11 como função injetável no
  navegador que devolve JSON de violações por rota, largura e tema.

### Fase 2: régua (`src/index.css`, `tailwind.config.js`)

- `index.css`: manter o bloco verbatim do guia. Acrescentar tokens derivados
  (5.1), espaço (3.2), z (4.5), movimento (8.1), `.conteudo`, `.leitura`,
  `.grade`, `.num`, `.valor*`, `.cabecalho`, `.lista`, `.linha`, keyframes (8.2),
  reduced-motion (8.5), foco (5.5), `scrollbar-gutter`, `scroll-padding-top`,
  sem grão (nem no `body`), utilitários de área segura. **Apagar** as classes e
  keyframes listados em 5.2 e 8.2, `.cifra`, `.tnum`, `.assinatura`,
  `.superficie`, `.rotulo::before`, `.rotulo-*`, `.acao-ouro`, `.brilho-ouro`,
  `.barra-marca`.
- `tailwind.config.js`: em `extend`, `spacing` semântico, `fontSize` (6.1),
  `borderRadius` (5.3), cores derivadas, `zIndex`, `transitionDuration`,
  `transitionTimingFunction`. Remover `keyframes`/`animation` antigos. **Os
  aliases antigos** (`content*`, `rule`, `income`, `expense`, `critical*`,
  `action*`, `forecast`, `papel`, `surface.2/3`) e a restrição de `padding`,
  `margin`, `gap` à escala 3.1 (`theme.padding`, `theme.margin`, `theme.gap`
  substituídos) **só na Fase 6**, quando nenhuma tela antiga depender deles.

### Fase 3: primitivas (cada uma com exemplo no Kit, nos dois temas e em 390)

| Arquivo | Mudança |
|---|---|
| `ui/Valor.tsx` | 6.3: postos, `formatToParts`, `estado` × `previsto` tipados, `ValorComOrigem` sem `-mr-2`, chevron dentro da coluna, `contar` só no herói |
| `ui/Icone.tsx` (novo), `IconeTom.tsx`, `Selo.tsx`, `Rotulo.tsx` | 7.14, raio 8, sem `traco`, tokens `rotulo`/`t-meta` |
| `ui/Chip.tsx`, `Badge.tsx`, `tom.ts` | tintas `*-ink`, mapa de ícones 7.7 |
| `ui/Button.tsx` | 7.8; sem degradê; `carregando` com rótulo; 44 com toque |
| `ui/Field.tsx`, `MoneyInput.tsx` | 7.9 |
| `ui/Abas.tsx`, `FiltrosRapidos.tsx`, `admin/SeletorMes.tsx` | 7.15; sublinhado da aba desliza, filtro ativo **não** desliza (8.3); ativo neutro; **apagar `Segmented.tsx`** |
| `ui/Barra.tsx` | `scaleX`; absorve `Trilha.tsx` (**apagar**) |
| `ui/Esqueleto.tsx`, `Estados.tsx` | 7.13; **apagar `EmptyState.tsx`**; `Spinner` só em botão |
| `src/lib/useRolou.ts`, `usePresenca.ts`, `useMovimentoReduzido.ts`, `useAtraso.ts` (novos) | fio do cabeçalho, saída, preferência reativa, espera de 300ms |

### Fase 4: estrutura

| Arquivo | Mudança |
|---|---|
| `ui/Cartao.tsx` (novo) | 7.1; **apagar `Painel.tsx`, `Secao.tsx`, `SecaoTitulo.tsx`** e `SuperficieContext` |
| `ui/Lista.tsx` | 7.2: colunas, `contexto` obrigatório, `Linha`, `LinhaGrupo`, sem sangria, `--i` |
| `ui/Demonstrativo.tsx` (novo) + `src/lib/sales.ts` | 7.3.1–7.3.2, teste do perfil corretor; **apagar `Cascata.tsx`** |
| `ui/Parcela.tsx`, `ui/ParAgoraPrevisto.tsx` (novos) | 7.3.3–7.3.4 |
| `ui/Heroi.tsx` (novo) | 7.5; **apagar `Assinatura.tsx`** e o "Painel dourado" feito à mão |
| `ui/Kpi.tsx` | 7.4; substitui `KpiCard.tsx` |
| `ui/Tabela.tsx` (novo) | 7.6 |
| `ui/Dica.tsx` | `rounded-caixa px-4 py-3`, ícone 16 |
| `ui/SidePanel.tsx`, `ConfirmDialog.tsx`, `Toast.tsx`, `Tip.tsx`, `shared/PopoverAvisos.tsx`, `shared/PaletaDeBusca.tsx` | 7.10–7.12, véus, `usePresenca`, z por token; **`Modal.tsx` apagado** (formulários vão para SidePanel) |
| `composicao/Composicao.tsx` | `Lista contexto="sobreposicao"` + `Demonstrativo`; sem `list-surface` |
| `shared/ProximaAcao.tsx` → `FilaDeAcao.tsx` | item com motivo, valor, prazo, ação na linha; sem ponto, sem pulso |

### Fase 5: casca

| Arquivo | Mudança |
|---|---|
| `layout/PageLayout.tsx` | 4.2: um modelo só; props `titulo`, `subtitulo`, `icone`, `mes?`, `acoes`, `faixa`, `voltarPara?`, `largura: 'dados' \| 'leitura'`; **apagar `BarraDeTransicao`, `AreaDaTela`, `QuadroErro`** |
| `layout/navegacao.ts` | por rota: `icone`, `titulo`, `usaMes`, `faixa`, `cta` |
| `admin/AdminShell.tsx`, `corretor/CorretorShell.tsx` | param de injetar `SeletorMes` e CTA; `pb-barra-inferior` |
| `admin/SeletorMes.tsx` | 40 / 44 com toque, sem sombra, sem `overflow-hidden`, rótulo anima (8.3) |
| `layout/NavRail.tsx` | 4.3 |
| `layout/BottomNav.tsx` | 4.4 |
| `layout/ThemeToggle.tsx` | view transition (8.3) |
| `admin/AcoesAdmin.tsx` | Registrar venda abre `SidePanel lg` |

### Fase 6: telas, uma por PR, na ordem do dano

Regra: **uma tela migra inteira** (sai da lista `ISENTOS` e passa no aceite da
seção 11 em 390 e 1440, escuro e claro). Proibido deixar classe antiga num
arquivo migrado.

1. `admin/pages/Venda.tsx` · 2. `Inicio.tsx` · 3. `Receber.tsx` ·
4. `Pagar.tsx` · 5. `Vendas.tsx` · 6. `Despesas.tsx` · 7. `Corretores.tsx` ·
8. `Relatorios.tsx` · 9. `Config.tsx` · 10. formulários de `src/admin`
(`RegistrarVenda`, `ReceberParcela`, `PagarComissao`, `LancarDespesa`,
`BaixarLancamento`, `FolhaDeLancamento`) · 11. `corretor/pages/Inicio.tsx`,
`Recebimentos.tsx`, `MinhasVendas.tsx` · 12. `auth/LoginPage.tsx` ·
13. `kit/Kit.tsx` + `kit.html` (todo componente, dois temas, 390 e 1216; lockup
no escuro com `--nav-logo`; seletor de aparência reflete o tema real).

Depois: remover aliases antigos e restringir `padding`/`margin`/`gap` no
`theme`; lint sem isentos.

---

## 11. Checklist de aceite visual

Medido por `scripts/aceite-visual.js` (`getBoundingClientRect`,
`getComputedStyle`, `document.getAnimations()`), em **escuro e claro**, larguras
**390, 768, 1024, 1280, 1440 e 1710**, com o trilho aberto e, em 1280,
recolhido. Rotas: `/`, `/vendas`, `/vendas/:id` (uma venda com parcela
recebida, uma liberada e uma prevista com data passada), `/vendas/:id?parcela=<id>`,
`/receber`, `/pagar`, `/despesas`, `/corretores`, `/relatorios`, `/config`
(cada aba), painel **Registrar venda** aberto, painel de **composição** aberto
(clicar no número do herói) e um nível de drill-down dentro dele; no perfil
corretor `/`, `/recebimentos`, `/minhas-vendas`, a ficha `?venda=<id>`; `/login`
deslogado; troca de senha; `/kit.html`. Abrir painel não grava nada: nenhum
teste clica em botão de rodapé de painel. Cada rota rolada até o fim.
Tolerância 0,5px salvo indicação. Cada item diz **o que medir**; um item sem
violação devolve lista vazia.

### Espaço
1. **Recuo lateral:** para todo `[data-caixa]`, todo nó de texto, `svg`,
   `[data-valor]`, `button`, `input` e selo descendente fica a ≥ 16px (<640),
   ≥ 20px (640–1023), ≥ 24px (≥1024) das bordas **esquerda e direita**; no
   `[data-heroi]` ≥1024, ≥ 32px. **Recuo vertical:** ≥ 16px das bordas de cima e
   de baixo em qualquer largura (≥ 32px no herói ≥1024). Exceções: fundo de
   hover e fio da linha; descendentes de `[data-rolagem]` que estão fora da área
   visível da rolagem.
   1b. **Painel lateral e folha:** o mesmo, medido contra o corpo de
   `[role=dialog]`: ≥ 16px (<640) e ≥ 24px (≥640) nas laterais; o botão mais
   baixo do rodapé ≥ 16px acima da base da tela (mais a área segura).
2. **Vazamento:** nenhum descendente de `[data-caixa]` com `left` menor ou `right`
   maior que a caixa, exceto dentro de `[data-rolagem]`.
3. **Linha:** `padding-left === padding-right === --recuo` computado em todo
   `[data-linha]` e `[data-parcela]` de `contexto="cartao"`; o último filho
   visível da linha termina a exatamente `--recuo` da borda direita do cartão.
4. **Fundo do item:** o botão mais baixo de um `[data-linha]`/`[data-parcela]` fica
   ≥ 12px acima da base do item (≥ 16px em 390), e ≥ 16px acima da base do cartão
   se for o último.
5. **Ritmo de `<main>`:** distância vertical entre filhos diretos visíveis de
   `<main>` = 24px (<1024) ou 32px (≥1024), ±1. Nenhum par com 0 ou negativo.
   Entre cartões de uma grade: 16 (<1024) ou 24 (≥1024), nas duas direções.
   5b. **Nada colado:** dentro de qualquer contêiner, nenhum par de irmãos
   visíveis de bloco (altura ≥ 20px) com distância vertical < 8px, exceto
   `[data-linha]`, `[data-parcela]`, `tr`, `[role=row]` e as linhas do `dl` do
   `Demonstrativo` (que se tocam pelo fio por desenho). Mede os casos da
   auditoria: segmentado sob o herói (0px), subtítulo sobre o herói (2px), nota
   sob cartão no Kit.
6. **Margem negativa:** zero elementos com `margin-*` computada < 0.
7. **Régua:** todo `padding`, `margin` (≠ auto) e `gap` computado ∈ {0, 1, 4, 8,
   12, 16, 20, 24, 32, 40, 48, 64}. Exceções: descendentes de `[data-valor]`
   (espaços em `em` do "R$" e do sinal, 6.3); `padding-bottom` de `<main>` e de
   elementos com `pb-seguro`/`pt-seguro` (área segura).

### Grade e casca
8. **Cabeçalho fixo:** altura de `header.cabecalho` = 56 (<1024) e 64 (≥1024)
   **em todas as rotas** (a faixa não mora no cabeçalho, 4.2), inclusive com
   painel aberto.
9. **Alinhamento:** `left` do primeiro elemento do cabeçalho (voltar ou
   `IconeTom`) = `left` do primeiro `[data-caixa]` do `<main>` (0px). Em cada
   `Cartao`, `left` do primeiro elemento do cabeçalho do cartão (ícone ou h2) =
   `left` do primeiro filho da primeira linha (goteira ou texto) (0px): mede o
   rótulo a 15px com linhas a 18–20px da auditoria.
10. **Fio ao rolar:** `scrollY=0` → `::after` do cabeçalho com `opacity 0`;
    `scrollY=200` → `opacity 1` após 150ms. Em `/vendas/:id?parcela=<id>`, o topo
    da parcela fica entre 12 e 20px abaixo da base do cabeçalho e ela tem
    `aria-current="true"`.
11. **Seletor de mês:** presente em `/`, `/receber`, `/pagar`, `/despesas`,
    `/relatorios`; ausente em `/vendas`, `/vendas/:id`, `/corretores`, `/config`
    e nas rotas do corretor que não o declaram.
12. **Trilho (≥1024):** topo com altura = cabeçalho (64); nenhum botão no topo
    além do link da marca; topo do primeiro rótulo de grupo a 24 ± 1px abaixo
    da base do topo (y = 64); todo botão do trilho ≥ 32×32 sem sobrepor outro;
    nome acessível do link da marca = "Souza Imobiliária, início". Recolhido
    (68): nenhum elemento com `right` > 68.
13. **Largura:** conteúdo de `<main>` ≤ 1216px e centrado em 1710 (|esq − dir| ≤ 1).
    Em 390, `document.documentElement.scrollWidth ≤ 390`; na faixa, nenhum
    contêiner com `scrollWidth > clientWidth` exceto a fileira de `Abas`
    marcada `[data-rolagem]`, e nenhuma barra de rolagem visível
    (`scrollbar-width: none`).
14. **Barra inferior (<1024):** altura = 64 + área segura; em cada item, a base
    do badge ≥ 8px acima da base da pílula e ≥ 12px acima do topo do rótulo; o
    badge cobre ≤ 6px da largura do ícone e nenhum badge tem mais de 3
    caracteres ("9+"); o último bloco do `<main>` termina ≥ 24px acima do topo
    da barra.
15. **Painel e rolagem:** abrir e fechar um `SidePanel` com Escape devolve o
    foco ao gatilho; o `left` do `<main>` não muda (0px) com o painel aberto nem
    depois de fechado; com o painel aberto, o texto do h1 e a altura do
    cabeçalho são os mesmos de antes de abrir.

### Superfície e cor
16. **Borda de caixa:** todo `[data-caixa]` com `border-width` 1px nos 4 lados e
    cor = `--fio-caixa` \1 sem `data-previsto`\2; no claro,
    `box-shadow` ≠ `none`. Nenhum `[data-caixa]` com ancestral `[data-caixa]`;
    nenhum `[data-caixa]` dentro de `[role=dialog]`; nenhuma `.lista` dentro de
    `[data-linha]` ou de outra `.lista`. `button`, `input`, `select` e
    `[role=tab]` com `box-shadow` = `none` fora do foco.
    16b. **Caixa não declarada:** nenhum elemento sem `data-caixa` com borda nos
    4 lados, `border-radius` ≥ 12px e fundo diferente do pai, exceto a caixa do
    `ConfirmDialog`, toast, popover e `Dica` (mede a lista com borda dentro do
    drill-down).
17. **Ouro único:** exatamente 1 `[data-heroi]` em `/`, `/vendas`,
    `/vendas/:id`, `/receber`, `/pagar`, `/despesas`, `/corretores`,
    `/relatorios` e no `/` do corretor; zero em `/config`, `/recebimentos`,
    `/minhas-vendas`, `/login` (o Kit fica fora). Por camada (página, painel,
    modal), ≤ 1 elemento com `background-color` = `--brand-fill`; nenhuma aba,
    filtro ou chip ativo com `brand-fill`. Dentro de `[data-heroi]`: ≤ 1
    `button` fora de `[data-valor]`, nenhum com cor ou fundo de erro, e ≤ 4
    `[data-valor]` fora de um `dl` de `Demonstrativo`. Nenhum `button` na página
    com `background-color` de `--error`/`--error-bg` fora de `[role=dialog]`.
    Véu do painel e do modal com a cor computada de `--veu-painel`/`--veu-modal`.
17b. **Herói previsto:** todo `[data-heroi][data-previsto]` tem borda
    `--fio-caixa`, nenhum descendente com cor `brand-text`, e o rótulo casa
    `/previst/i`; em `/vendas` e `/receber` o herói é `data-previsto` e a rota
    não tem nenhum elemento com cor `brand-text` nem borda `--borda-ouro`.
18. **Sem degradê, sem barra, sem sobra:** nenhum `background-image` com
    `gradient` fora de `[data-painel-marca]`; nenhum `::before`/`::after` com
    largura ≤ 4px, altura ≥ 12px e cor sólida; nenhum elemento com
    `border-left-width` ou `border-right-width` ≥ 2px diferente dos outros
    lados; nenhum elemento com classe da lista de mortas (Fase 1); nenhuma
    regra `@keyframes` chamada `aurora*`, `barraAtencao`, `atencaoPulse`,
    `shimmer`, `slideUp` nas folhas de estilo carregadas.
19. **Raios:** todo `border-radius` computado de elemento com borda ou fundo ∈
    {0, 6, 8, 14, 20, 9999} (ou `50%`), exceto `[data-marca]`; filho com borda
    ou fundo dentro de caixa de 14 tem raio ≤ 8.
20. **Contraste de texto:** todo texto visível < 18,66px (< 14px se ≥ 700) tem
    ≥ 4,5:1 contra o fundo efetivo (composição de alfas), incluindo chips,
    linha em hover (forçar `:hover` via CDP) e o lockup da marca, nos dois
    temas; texto maior ≥ 3:1.
21. **Contraste de contorno e ícone:** borda de `input`/`select`/`textarea` ≥
    3:1 em repouso, hover e erro; contorno de foco ≥ 3:1; todo `svg` dentro de
    `button` ou `a` sem texto visível ≥ 3:1 contra o fundo (mede a lixeira e o
    "Pagar" quase invisíveis de Despesas).
22. **Estado e ícone:** todo elemento com cor `*-ink` tem `svg` ou texto de
    estado no mesmo pai. Todo `svg.lucide` com `stroke-width` = 1.6.
    `svg.lucide-calendar-clock` só dentro de chip ou goteira de situação
    "Prevista"; `svg.lucide-calendar-x-2` só em "Sem baixa"; nenhum
    `svg.lucide-triangle-alert`/`lucide-alert-triangle` em linha de parcela a
    receber. Dentro de uma rota, ou todo cabeçalho de `Cartao` tem ícone ou
    nenhum tem.

### Tipografia e números
23. **Piso:** nenhum texto < 11px; 11px só em `.text-rotulo`, `.text-chip` e
    dentro de `[data-marca]`; 12px só em `.text-nota`; `text-transform:
    uppercase` só em 11px.
24. **Títulos:** exatamente um `h1` visível por rota, Sora 19px (≥1024) ou 17px
    (<1024); todo h2 de `Cartao` é Sora 15px 600; nenhum título de tela dentro do
    `<main>` (h1 só no cabeçalho).
25. **Números:** todo `[data-valor]` com `font-family` iniciando em Sora,
    `font-variant-numeric` com `tabular-nums`, `white-space: nowrap`, sem
    reticência, altura ≤ `line-height + 1`, texto casando
    `/^−?R\$\s?\d{1,3}(\.\d{3})*,\d{2}$/` (espaço fino/inquebrável aceito).
    "111,11" e "000,00" num `.num` de teste têm a mesma largura. Nenhum nó de
    texto visível contém "(–)", "(-)" ou "-R$".
26. **Tamanhos de número:** todo `font-size` dos dígitos de `[data-valor]` ∈ {34,
    28 (herói <1024 e KPI ≥1024), 22 (KPI <1024), 17, 15, 14}; 34 e 28-herói só
    dentro de `[data-heroi]`; nenhum `[data-valor]` fora de `[data-heroi]` e de
    KPI maior que 17px.
27. **Coluna:** em cada `.lista`, `table` ou conjunto de `[data-parcela]` forma
    A, o `right` de todos os `[data-valor]` da mesma coluna difere em 0px e
    coincide com o `right` do cabeçalho numérico. Listas irmãs com a mesma
    largura e a mesma declaração de colunas numa rota (ex.: "Para conferir" e
    "A seguir" em `/receber`; as seções de `/pagar`) têm a coluna de valor no
    mesmo `right` (0px).
28. **Goteira:** todo `[data-goteira]` com 28px de largura; nenhuma lista mistura
    `Selo` e `IconeTom`; nos `Selo` de uma lista, os números são crescentes.
29. **Fileira de valores:** nenhum grupo de ≥ 3 `[data-valor]` na mesma faixa de
    `top` (±4px) fora de `table`/forma A com `[role=columnheader]`, de
    `[data-celulas]` ou de `dl` de `Demonstrativo`. Em 390, a decomposição da
    parcela tem `right` igual e `top` diferente em todos os valores.
30. **Truncamento:** nenhum título de linha com `text-overflow: ellipsis` numa
    linha só; em 390, em cada `.meta`, todo item que começa uma linha nova
    (`top` maior que o do irmão anterior) tem `left` = `left` da `.meta` (o ponto
    ficou recortado); todo `input` com placeholder tem o placeholder inteiro
    visível (medir com um `span` de mesma fonte ≤ largura útil do campo).
31. **Perfil corretor:** logado como corretor, o texto "Fica para a imobiliária"
    e o valor líquido da imobiliária não existem no DOM, nem em `aria-label`.

### Toque e foco
32. **Alvos:** em 390 e com `pointer: coarse`, todo `a`, `button`, `input`,
    `select`, `[role=tab]`, `[role=radio]` visível ≥ 44×44 (retângulo mais
    pseudo-elemento de expansão), sem sobrepor outro alvo; ≥1024 com ponteiro
    fino, ≥ 32. `input`, `select` e `textarea` de uma linha com 44px de altura em
    qualquer largura; na faixa, todos os controles com a mesma altura (40 ou 44,
    7.15); botão na mesma fileira de um campo com a altura do campo.
33. **Foco:** Tab percorre a rota; cada parada tem `outline-width ≥ 2px` e
    `outline-style` ≠ `none`, e o retângulo do contorno (+2px) fica inteiro
    dentro de todo ancestral com `overflow: hidden` (exceto `[data-rolagem]`,
    onde o offset é −2px). A primeira parada é o link "pular para o conteúdo"
    ou o link da marca, com contorno visível.
34. **Ações visíveis:** nenhum `[data-acao]` com `opacity 0` ou
    `visibility: hidden` fora de hover, com `hover:hover` e `hover:none`; nenhum
    contêiner de ação com largura > 0 e conteúdo invisível. Todo
    `[data-clicavel]` com `cursor: pointer`.

### Movimento
35. **Propriedades e duração:** toda `CSSAnimation` de `getAnimations()` só com
    `opacity` e/ou `transform` nos keyframes e duração ≤ 280ms, exceto
    `barraEnche` (520), `saltoBadge` (500) e `pulsoEsqueleto` (1400, só com
    `aria-busy="true"` num ancestral). Toda `CSSTransition` com
    `transitionProperty` ∈ {`opacity`, `transform`}, ou ∈ {`color`,
    `background-color`, `border-color`} num controle isolado (7.8, 7.9, 7.15),
    nunca dentro de `[data-linha]`/`[data-parcela]` exceto no `::before`/`::after`
    por opacidade; duração ≤ 280ms, exceto a saída do destaque de chegada (520,
    com atraso de 700). Animação de entrada com `fill` `backwards` ou `none`.
36. **Nada invisível:** 1s depois de montar (inclusive em iframe fora da tela e
    aba em segundo plano), zero elementos visíveis em `<main>` com `opacity < 1`
    computada, exceto `:disabled`, `[aria-disabled=true]` e descendentes de
    `[aria-busy=true]`.
37. **Saída:** fechar painel, modal e toast mantém o elemento no DOM 100ms
    depois do fechamento e o remove até 250ms depois, com animação de saída.
38. **Refetch e mês:** trocar o mês e voltar não gera animação em `.escada > *`
    nem em `[data-valor]` fora de `[data-heroi]`; nenhum `[data-valor]` exibe
    valor intermediário (o texto muda uma vez, observado por `MutationObserver`);
    a contagem do herói não roda de novo; a altura do cabeçalho não muda.
39. **Movimento reduzido** (`emulateMedia`): nenhuma animação com `transform`
    ativa 50ms após abrir um painel; o número do herói tem o valor final no 1º
    quadro; `.esqueleto` sem animação.

### Estados
40. **Falha:** com o Supabase bloqueado, cada cartão mostra "Tentar de novo" e
    nenhum mostra texto de estado vazio; o cabeçalho continua.
41. **Esqueleto:** com latência de 1s, o esqueleto aparece entre 300 e 400ms,
    tem a altura da lista final ±8px e não usa `background-image`.

### Drill-down (frase 1 do Rafael)
42. **Todo número abre:** todo `[data-valor]` fora de formulário, de toast e de
    `aria-hidden` está dentro de um `[data-clicavel]` ou de um `button`/`a`
    (`ValorComOrigem`), exceto as linhas do `Demonstrativo` de prévia
    (Registrar venda) e os totais do rodapé de painel. Clicar num valor de
    herói, apoio, `ParAgoraPrevisto` ou linha de corretor abre `[role=dialog]`
    em ≤ 300ms; todo item de composição que é parcela é um `a` com `href`
    casando `/vendas/[^/?]+\?parcela=` (admin) ou `/minhas-vendas\?venda=`
    (corretor). Um drill-down dentro do painel deixa exatamente 1
    `[role=dialog]` no DOM e mostra "Voltar".

### Por tela
43. **`/vendas/:id`:** sem seletor de mês e sem CTA no cabeçalho; "Cancelar
    venda" não está visível sem abrir o menu "⋯"; em 1440 com trilho aberto,
    `[data-parcela]` tem 8 colunas (`grid-template-columns`), em 1280 tem
    `[data-celulas]`, em 390 tem `dl`; cada parcela tem ≤ 1 botão visível além
    do "⋯"; nenhum texto "vencid" em parcela a receber; o total do
    `Demonstrativo` do herói não usa `brand-text`.
44. **`/` (admin):** sem botões "Ver A receber"/"Ver A pagar"; o cartão "Agora"
    tem os grupos "Você deve" e "Conferir" (ou o vazio "Tudo em dia"); todo item
    de "Conferir" tem "Recebi" visível; nenhum texto "vencid" em "Conferir"; o
    rodapé da página não tem parágrafo explicativo.
45. **`/receber`:** clicar em cada filtro não muda o texto do `[data-valor]` do
    herói; "A seguir" não tem chip "Prevista"; nenhum texto "vencid"; toda linha
    tem "Recebi" visível sem hover.
46. **`/pagar`:** o cartão "Previsto, depende da construtora" tem uma linha por
    corretor (nº de linhas = nº de corretores com previsão); nenhuma linha de
    retirada do sócio dentro de "Pagar agora"; a altura do documento em 1440 é
    ≤ 2,5× a de `/receber` com os mesmos dados de teste.
47. **`/vendas`:** nenhum KPI (`a[data-caixa]` em grade) acima da lista; os
    filtros rápidos estão no primeiro filho do `<main>`; em 390, cada linha de
    venda ≤ 136px de altura e a meta em ≤ 2 linhas.
48. **`/despesas`:** `window.confirm` substituído por uma função que falha o
    teste se chamada; "Paguei"/"Recebi" visíveis sem hover; excluir só dentro do
    menu "⋯".
49. **`/corretores`:** uma única lista de corretores (cada nome aparece uma vez
    na rota); nenhum cartão "Produção"; o VGV nunca é `[data-valor]` na coluna de
    valor nem no herói (fica em `.meta`).
50. **`/relatorios`:** o número do herói abre `[role=dialog]`; em ≥ 768 nenhuma
    `table` com `scrollWidth > clientWidth`; a aba Corretores tem colunas "A pagar
    agora" e "Previsto" separadas; o texto "Saldo em conta" não existe na rota.
51. **`/config`:** o corpo mede ≤ 720px e começa no `left` do cabeçalho; as abas
    ficam numa fileira só (`top` igual); editar abre `[role=dialog]` com `right`
    = largura da viewport (≥ 640).
52. **Registrar venda:** `[role=dialog]` com `right` = viewport e largura 672 ±1
    (≥ 768); tela cheia em 390; sem indicador de passos; o rodapé contém o total
    "Fica para a imobiliária"; nenhum `[data-caixa]` dentro.
53. **Composição (drill-down):** largura 480 ±1 (≥ 640); cada item é linha com
    origem, situação e valor; nenhum elemento com borda nos 4 lados dentro do
    corpo (16b).
54. **Corretor:** o `[data-valor]` "A receber agora" tem o mesmo texto em `/` e
    no resumo de `/recebimentos`; `/minhas-vendas` sem `.lista .lista` e sem
    `[data-heroi]`; em 390 os filtros de `/recebimentos` não estão dentro do
    cabeçalho fixo.
55. **`/login`:** `[data-painel-marca]` existe e é o único com `gradient`; texto
    sobre ele ≥ 4,5:1 nos dois extremos do degradê; campos com 44px; o rótulo do
    identificador é "Login"; em 390 o botão "Entrar" está inteiro dentro de
    844px sem rolar.
56. **`/kit.html`:** o seletor de aparência tem `aria-pressed="true"` na opção
    igual ao tema de `html`; o lockup em `[data-marca]` passa o item 20 nos dois
    temas; o conteúdo usa `.conteudo` (largura > 900px em 1440); cada componente
    aparece nos dois temas e em 390.
