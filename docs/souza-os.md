# Padrão de design "Souza OS": guia para um sistema financeiro

> Entregue pelo Rafael em 12/09/2026. É o sistema de design do iCRM da Souza
> Imobiliária, e o financeiro deve ter a mesma cara, a mesma linguagem e as
> mesmas regras. **Onde este guia conflita com `docs/sistema-visual.md`, este
> guia vence.** O `sistema-visual.md` continua valendo apenas no que este não
> cobre e for coerente com os princípios da seção 1 (por exemplo: a regra de
> que previsão não é dívida, o vocabulário de situação, o drill-down até a
> parcela, e a cascata da comissão).

Este guia é o sistema de design do iCRM da Souza Imobiliária. O novo sistema
financeiro deve ter a mesma cara, a mesma linguagem e as mesmas regras.
Siga à risca. Quando algo não estiver coberto, escolha o que for mais
coerente com os princípios da seção 1.

Stack de referência: React + TypeScript + Tailwind 3 + lucide-react + Recharts.
Toda cor vem de token CSS. Nunca escrever hex direto num componente.

---

## 1. Os 12 princípios (valem para toda tela)

1. **Cor é significado, nunca decoração.** Seis tons, cada um com um trabalho:
   - Ouro (Areia): marca, dinheiro, meta. Ex.: saldo, receita do mês, meta.
   - Verde: ganho, feito. Ex.: recebido, pago, meta batida, conciliado.
   - Âmbar: atenção, prazo. Ex.: vence em 3 dias, pendente de conferência.
   - Vermelho: risco. Ex.: vencido, saldo negativo, inadimplente.
   - Azul-petróleo: informação neutra. Ex.: agendado, previsto.
   - Neutro: o que ainda não aconteceu.
   Se dois blocos precisam se diferenciar e nenhum é "melhor", a diferença é
   de posição ou tamanho, nunca de matiz. Nada de roxo, rosa, laranja ou
   cor inventada para categoria.
2. **O dourado é racionado: um bloco dourado por tela**, no número que carrega
   o julgamento (ex.: saldo consolidado ou resultado do mês). Se todo card tem
   filete dourado, nenhum destaca e vira "dashboard gamer".
3. **Cor sozinha nunca comunica status.** Sempre com ícone ou texto junto.
4. **Superfície nunca é chapada.** Três camadas: grão (incolor), degradê de
   superfície a 158° (incolor) e ouro (raro). Mesmo ângulo, 158°, em tudo.
5. **Hierarquia é tamanho, não negrito.** O número que decide a ação é grande
   (26–38px, extrabold, tabular). O rótulo é pequeno, maiúsculo e discreto.
6. **Números alinham sempre.** `tabular-nums` em todo número de lista, coluna
   ou que muda no tempo. Valores monetários alinhados à direita.
7. **A tela diz o que aconteceu, não o que mede.** "Rafael pagou o boleto da
   Copel · R$ 312,40", não "pagamentos: 21".
8. **Nunca afirmar mais do que se observou.** Se o dado é parcial, a tela diz
   quanto ficou sem registro (ex.: "12 lançamentos sem categoria").
9. **Movimento é ambiente, não evento.** Só `transform`/`opacity`, sempre com
   `prefers-reduced-motion`. Detalhes na seção 7.
10. **Contexto acima de foco total.** Edição e detalhe abrem em painel lateral
    à direita. Modal central só para confirmação curta e destrutiva.
11. **Menos cliques que a explicação.** A ação principal fica a um toque. Regra
    não óbvia vira dica escrita na tela.
12. **O custo faz parte do desenho.** Nada de polling de rede em `setInterval`,
    recarga total periódica ou imagem em base64 no banco.

Regras de dado que acompanham o design:
- **Banco é a única fonte de verdade.** Proibido optimistic update. Fluxo:
  aguarda o banco, e só com sucesso atualiza a UI. Se falhar, mantém o estado
  anterior e mostra erro específico ("Lançamento não salvo").
- **Falha nunca vira vazio.** Toda tela que lê do banco tem três estados, nesta
  precedência: carregando (esqueleto), falhou (erro com "Tentar de novo"),
  vazio (ícone + título + ação). Uma consulta que falhou não pode dizer
  "Nenhum lançamento".
- **Moeda sempre Real.** Exibir com `toLocaleString('pt-BR', { style: 'currency',
  currency: 'BRL' })`. Input de dinheiro guarda só dígitos, exibe formatado com
  prefixo `R$`. Nunca `type="number"` cru para dinheiro.
- Semana = domingo a sábado. Datas em pt-BR.

---

## 2. Marca e paleta

| Nome | Hex |
|---|---|
| Carvão | `#070B1A` |
| Marinho | `#0F1730` |
| Marinho Claro | `#18224A` |
| Areia | `#E4B23C` |
| Areia Profundo | `#C2922A` |
| Areia Clara | `#F0CC78` |
| Papel | `#F6F3EC` |
| Papel 2 | `#ECE7DA` |

Logo: "S" Marinho num quadrado Areia com radius ~25%. Ponto final do lockup em
Areia. Ícones Lucide com stroke 1.6. **Nunca emoji** na interface.

Temas: `:root` é o **escuro (padrão da casa)**; `html.light` é o claro, completo
e disponível num seletor "Claro / Escuro" (duas opções com marca, não
interruptor). Persistir a escolha e ter script anti-flash no `index.html`.
Se um dia mudar o padrão persistido, subir a `version` e escrever `migrate`.

---

## 3. Tokens CSS (copiar para `src/index.css`)

```css
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600;700;800&display=swap');

:root { /* ESCURO — padrão */
  --brand:#E4B23C; --brand-dark:#C2922A; --brand-tint:rgba(228,178,60,.14);
  --brand-text:#F0CC78; --brand-shadow:rgba(228,178,60,.30); --brand-btn-text:#0F1730;
  --brand-fill:#E4B23C; --brand-fill-hover:#F0CC78; --brand-fill-deep:#C2922A; --brand-fill-text:#0F1730;
  --grad-brand:linear-gradient(158deg,#F0CC78 0%,#E4B23C 62%); --grad-brand-text:#0F1730;

  --page-bg:#070B1A; --surface:#0F1730; --surface-2:#18224A; --surface-3:#1F2A55;

  --nav-bg:#070B1A; --nav-text:rgba(246,243,236,.78); --nav-muted:rgba(246,243,236,.40);
  --nav-active-text:#F6F3EC; --nav-active-bg:rgba(255,255,255,.075);
  --nav-hover-bg:rgba(255,255,255,.05); --nav-line:rgba(255,255,255,.08);
  --nav-logo:#F6F3EC; --nav-elev:#101935;
  --nav-rail-sheen:linear-gradient(158deg,rgba(255,255,255,.05) 0%,rgba(255,255,255,0) 46%);

  --t1:#F6F3EC; --t2:#CFC9BC; --t3:#8A90A6; --t4:#7A829B; --t5:#5F6880;
  --line:rgba(255,255,255,.10); --line-strong:rgba(255,255,255,.18); --line-input:rgba(255,255,255,.14);

  --success:#34C88A; --success-bg:rgba(52,200,138,.10); --success-line:rgba(52,200,138,.28);
  --warning:#E0A030; --warning-bg:rgba(224,160,48,.10); --warning-line:rgba(224,160,48,.28);
  --error:#E5717A;   --error-bg:rgba(229,113,122,.10);  --error-line:rgba(229,113,122,.28);
  --info:#5FB3BA;    --info-bg:rgba(95,179,186,.10);    --info-line:rgba(95,179,186,.28);

  --shadow-card:0 1px 3px rgba(0,0,0,.65),0 1px 2px rgba(0,0,0,.45);
  --shadow-modal:0 25px 50px rgba(0,0,0,.80),0 10px 20px rgba(0,0,0,.55);
  --shadow-dropdown:0 10px 30px rgba(0,0,0,.65),0 4px 10px rgba(0,0,0,.50);

  --grain:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)' opacity='0.06'/%3E%3C/svg%3E");
  --surface-sheen:linear-gradient(158deg,rgba(255,255,255,.055) 0%,rgba(255,255,255,0) 58%);
  --sheen-start:var(--surface-2);
  --aurora-a:rgba(228,178,60,.14); --aurora-b:rgba(228,178,60,.09);
}

html.light { /* CLARO — Papel */
  --brand:#A8791A; --brand-dark:#8A6210; --brand-tint:rgba(228,178,60,.16);
  --brand-text:#8A6210; --brand-shadow:rgba(228,178,60,.30); --brand-btn-text:#0F1730;
  --brand-fill:#E4B23C; --brand-fill-hover:#D9A62F; --brand-fill-deep:#C2922A; --brand-fill-text:#0F1730;
  --grad-brand:linear-gradient(158deg,#F0CC78 0%,#E4B23C 62%); --grad-brand-text:#0F1730;

  --page-bg:#F6F3EC; --surface:#FFFFFF; --surface-2:#F1EEE6; --surface-3:#E6E2D8;

  --nav-bg:#FBF9F3; --nav-text:#2A3660; --nav-muted:#5A6480; --nav-active-text:#0F1730;
  --nav-active-bg:rgba(15,23,48,.062); --nav-hover-bg:rgba(15,23,48,.035);
  --nav-line:rgba(15,23,48,.10); --nav-logo:#0F1730; --nav-elev:#FFFFFF;
  --nav-rail-sheen:linear-gradient(158deg,rgba(255,255,255,.85) 0%,rgba(255,255,255,0) 46%);

  --t1:#0F1730; --t2:#2A3660; --t3:#4A5573; --t4:#5A6480; --t5:#9AA0AE;
  --line:rgba(15,23,48,.10); --line-strong:rgba(15,23,48,.18); --line-input:rgba(15,23,48,.15);

  --success:#1F8A62; --success-bg:#E7F5ED; --success-line:#A8DCC4;
  --warning:#BD7A12; --warning-bg:#FBF0DC; --warning-line:#E8C88A;
  --error:#C7474F;   --error-bg:#FBEAEB;   --error-line:#EFB3B7;
  --info:#236B73;    --info-bg:#E7F2F2;    --info-line:#A9CFD2;

  --shadow-card:0 1px 4px rgba(15,23,48,.08),0 1px 2px rgba(15,23,48,.05);
  --shadow-modal:0 25px 50px rgba(15,23,48,.18),0 10px 20px rgba(15,23,48,.10);
  --shadow-dropdown:0 10px 30px rgba(15,23,48,.12),0 4px 10px rgba(15,23,48,.08);

  --grain:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)' opacity='0.025'/%3E%3C/svg%3E");
  --surface-sheen:linear-gradient(158deg,rgba(255,255,255,0) 45%,rgba(15,23,48,.030) 100%);
  --sheen-start:color-mix(in srgb,var(--surface-2) 50%,var(--surface));
  --aurora-a:rgba(228,178,60,.055); --aurora-b:rgba(196,146,42,.035);
}
```

Papéis dos textos: `--t1` título · `--t2` corpo · `--t3` secundário ·
`--t4` menor texto permitido (AA) · `--t5` **só decorativo** (separador "·",
ícone inativo), nunca informação.

Armadilhas:
- `--brand` é tinta de texto/borda; controle preenchido (botão, aba ativa,
  chip selecionado) usa `--brand-fill` + `--brand-fill-text`.
- Claro não é escuro invertido. Cada receita tem valor próprio por tema.
- Gráfico (Recharts) usa `var(--*)` em stroke, fill, tick e tooltip. Hex fixo
  gera tooltip preto no tema claro.
- `fill="white"` em SVG some no claro. Usar `var(--t1)`.
- **Testar sempre no tema claro.** É onde os bugs moram.

### Tailwind (`tailwind.config.js` → `theme.extend`)

```js
colors: {
  brand:'var(--brand)', 'brand-dark':'var(--brand-dark)', 'brand-tint':'var(--brand-tint)',
  'brand-text':'var(--brand-text)', 'brand-fill':'var(--brand-fill)',
  'brand-fill-hover':'var(--brand-fill-hover)', 'brand-fill-deep':'var(--brand-fill-deep)',
  'brand-fill-text':'var(--brand-fill-text)',
  page:'var(--page-bg)', surface:'var(--surface)', s2:'var(--surface-2)', s3:'var(--surface-3)',
  'nav-surface':'var(--nav-bg)', 'nav-text':'var(--nav-text)', 'nav-muted':'var(--nav-muted)',
  'nav-active-text':'var(--nav-active-text)', 'nav-active-bg':'var(--nav-active-bg)',
  'nav-hover':'var(--nav-hover-bg)', 'nav-line':'var(--nav-line)',
  t1:'var(--t1)', t2:'var(--t2)', t3:'var(--t3)', t4:'var(--t4)', t5:'var(--t5)',
  line:'var(--line)', 'line-strong':'var(--line-strong)', 'line-input':'var(--line-input)',
  success:'var(--success)', 'success-bg':'var(--success-bg)', 'success-line':'var(--success-line)',
  warning:'var(--warning)', 'warning-bg':'var(--warning-bg)', 'warning-line':'var(--warning-line)',
  error:'var(--error)', 'error-bg':'var(--error-bg)', 'error-line':'var(--error-line)',
  info:'var(--info)', 'info-bg':'var(--info-bg)', 'info-line':'var(--info-line)',
},
fontFamily: {
  sans:['Inter','system-ui','sans-serif'],
  heading:['Sora','system-ui','sans-serif'],
  label:['Inter','system-ui','sans-serif'],
},
boxShadow: {
  card:'var(--shadow-card)', modal:'var(--shadow-modal)',
  dropdown:'var(--shadow-dropdown)', brand:'0 4px 14px var(--brand-shadow)',
},
```

Nunca usar classes cruas do Tailwind como `text-green-400`, `bg-red-500/10`
ou `bg-indigo-600`. Sempre os tokens semânticos (`text-success`,
`bg-error-bg`, `border-warning-line`), que funcionam nos dois temas.

---

## 4. Tipografia

Três papéis, e só três:

| Papel | Classe | Uso |
|---|---|---|
| Título e número | `font-heading` (Sora 700–800, tracking −0.015 a −0.03em) | h1–h3, números de destaque, CTA |
| Rótulo | `font-label text-[11px] uppercase tracking-[0.14em] text-t4` (Inter) | rótulo de dado, cabeçalho de seção e coluna |
| Corpo | Inter 13–16px | texto operacional |

- Base do `html` = 16px. `text-xs` = 12px, `text-sm` = 14px.
- **Piso de fonte: 11px.** Proibido 8, 9 ou 10px (exceto iniciais de avatar).
- Título da página: `font-heading text-[19px] font-bold`.
- Número que decide a ação: `font-heading font-extrabold tabular-nums leading-none`
  em 22 / 28 / 34px (sm / md / lg).
- Rótulo de chip: 11px semibold.
- `body { line-height:1.6 }`, `-webkit-font-smoothing: antialiased`.
- `::selection` em Areia 35% com texto `--t1`.

---

## 5. Superfícies e profundidade

```css
.texture-grain   { background-image: var(--grain); }
.surface-premium { background-color: var(--surface);
  background-image: var(--grain), linear-gradient(158deg, var(--sheen-start) 0%, var(--surface) 62%); }
.card-surface    { background-color: var(--surface);
  background-image: var(--grain), var(--surface-sheen);
  border-color: var(--line); box-shadow: var(--shadow-card); }
.modal-surface   { background-color: var(--surface);
  background-image: var(--grain), var(--surface-sheen); border: 1px solid var(--line); }
.nav-bg-blur     { background-color: var(--nav-bg); backdrop-filter: blur(16px); }
html.light .nav-bg-blur { background-color: var(--page-bg); }

.grad-brand      { background-image: var(--grad-brand); color: var(--grad-brand-text); }
.grad-brand-glow { box-shadow: 0 0 24px var(--brand-shadow); } /* no máximo 1 por tela */

/* Ouro — USO RESTRITO: só dinheiro, meta e marca. Host precisa de position:relative. */
.gold-edge::before { content:''; position:absolute; left:0; right:0; top:0; height:1px;
  background: linear-gradient(90deg, transparent, #E4B23C, transparent); opacity:.55; }
.gold-edge-short::before { background: linear-gradient(90deg, #E4B23C 0%, transparent 60%); opacity:.45; }
.gold-glow-tl { isolation: isolate; }
.gold-glow-tl::after { content:''; position:absolute; inset:0; z-index:-1; pointer-events:none;
  background: radial-gradient(70% 60% at 6% -10%, rgba(228,178,60,.13), transparent 60%); }
html.light .gold-glow-tl::after {
  background: radial-gradient(70% 60% at 6% -10%, rgba(228,178,60,.16), transparent 60%); }

/* Lista */
.list-surface { background-color: var(--surface-2);
  background-image: var(--grain), linear-gradient(to bottom, rgba(255,255,255,.035) 0, rgba(255,255,255,0) 96px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06), var(--shadow-card); }
html.light .list-surface { background-color: var(--surface);
  background-image: var(--grain), linear-gradient(to bottom, rgba(15,23,48,.022) 0, rgba(15,23,48,0) 96px);
  box-shadow: var(--shadow-card); }
```

Barra de progresso de meta/dinheiro:
`linear-gradient(90deg, var(--brand-fill-deep), var(--brand-fill) 75%)` com
`box-shadow: 0 0 16px var(--brand-shadow)`. Barra de outro tom é chapada na cor
do tom, sem halo. Trilho `bg-s3`, altura 6px, `rounded-full`.

**Aurora** (fundo vivo de todas as telas, dentro do layout):

```css
.aurora { position:absolute; inset:0; overflow:hidden; pointer-events:none; z-index:0; }
.aurora::before, .aurora::after { content:''; position:absolute; border-radius:50%;
  filter: blur(90px); will-change: transform; }
.aurora::before { width:46vw; height:46vw; top:-14vw; left:-8vw;
  background: radial-gradient(circle, var(--aurora-a) 0%, transparent 70%);
  animation: auroraA 48s ease-in-out infinite alternate; }
.aurora::after { width:38vw; height:38vw; bottom:-12vw; right:-6vw;
  background: radial-gradient(circle, var(--aurora-b) 0%, transparent 70%);
  animation: auroraB 67s ease-in-out infinite alternate; }
@keyframes auroraA { 0%{transform:translate3d(0,0,0) scale(1)} 50%{transform:translate3d(12vw,6vh,0) scale(1.18)} 100%{transform:translate3d(4vw,14vh,0) scale(1.05)} }
@keyframes auroraB { 0%{transform:translate3d(0,0,0) scale(1.1)} 50%{transform:translate3d(-14vw,-8vh,0) scale(1)} 100%{transform:translate3d(-5vw,-16vh,0) scale(1.22)} }
.aurora-host { position: relative; }
.aurora-host > *:not(.aurora) { position: relative; z-index: 1; }
```

48s e 67s não são múltiplos de propósito. Anima só `transform`, nunca
`background-position`.

Raios: cards e painéis `rounded-[14px]`; hero e blocos grandes `rounded-[16px]`
a `18px`; botões e inputs `rounded-lg` a `rounded-[12px]`; chips `rounded-lg`;
pílulas de filtro `rounded-full`; painel lateral `rounded-l-[20px]`.

**Nem tudo é card.** Borda, fundo, raio e sombra dizem "objeto separado". Não
aninhar caixa dentro de caixa dentro de caixa. Sub-blocos internos usam só fundo
tonalizado, sem borda.

---

## 6. Layout e navegação

**Casca do app:**
- **Trilho lateral** à esquerda, 248px, recolhível para 68px (estado
  persistido, atalho `[`). Classe `nav-rail` (grão + `--nav-rail-sheen`).
  - Topo: logo "S" + wordmark, sino de notificações e botão recolher
    (botões-ícone de 30px, radius 9px).
  - Seções com rótulo em 11px maiúsculo (ex.: OPERAÇÃO / FINANCEIRO /
    RELATÓRIOS), itens com ícone Lucide 16px + texto 14px.
  - Item ativo: fundo neutro `--nav-active-bg`, texto `--nav-active-text`,
    ícone em Areia e filete Areia de 3px à esquerda. Um só sinal dourado.
  - Grupo com filhos abre submenu (flutuante quando o trilho está recolhido).
  - Rodapé: avatar Areia com inicial + nome + papel. Clique abre popover
    (`nav-elev`, radius 14px) com Buscar ⌘K, Aparência (Claro/Escuro),
    Densidade (Confortável/Compacta), ferramentas externas e Sair.
- **Mobile (< lg):** trilho some; **BottomNav** fixa com 5 destinos + "Mais",
  item ativo com fundo tonalizado. Respeitar `env(safe-area-inset-*)`.
  Sem FAB duplicando o botão "Novo" do cabeçalho.
- Uma **lista única de navegação** alimenta trilho e BottomNav.

**PageLayout (quadro de toda tela):**
```
<div class="flex-1 min-h-screen bg-page texture-grain aurora-host">
  <div class="aurora" aria-hidden />
  <header class="sticky top-0 z-10 nav-bg-blur border-b border-line">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
      [IconeTom da área]  [h1 19px Sora bold + subtítulo 13px t3]      [ações] [CTA grad-brand]
    </div>
    [band opcional: abas, filtros ou indicadores, pb-3, fixa junto]
  </header>
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">…</main>
</div>
```
- Cada área tem um ícone e um tom próprios no cabeçalho (memória de lugar).
- Subtítulo diz o que a tela faz ou um resumo vivo ("R$ 48.320 a receber · 7 vencendo").
- CTA principal: `grad-brand`, `rounded-lg`, `min-h-[40px]`, Sora 13px bold,
  ícone `Plus`. No mobile o rótulo vira "Novo".

**Composição de uma tela financeira típica:**
1. Hero com o número que decide (ex.: saldo do mês ou resultado), único bloco
   dourado, com barra de meta e 2–3 números de apoio.
2. **Próxima melhor ação** (seção 9).
3. Seção "Indicadores": grade `grid-cols-2 lg:grid-cols-4 gap-3` de KPIs.
4. Seções de trabalho (lista de lançamentos, contas a vencer, gráficos).

Toda seção tem título com **filete + ícone**:
`[w-1 h-3.5 rounded-full na cor do tom] [ícone 15px t3] [texto]`.

Grades: preferir `gap-3` em KPIs, `gap-5/6` em cards maiores. A contagem de
colunas deve ser preenchida pelos itens, sem card sozinho numa linha.

---

## 7. Movimento (com licença e cota)

Curva padrão: `cubic-bezier(0.16, 1, 0.3, 1)`. Sem bounce/spring em
componente (a única exceção é o salto do badge). Durações: 150–180ms micro,
220–280ms entrada/painel, 520ms barra, 700ms contagem.

Movimentos permitidos:
- **Entrada de página:** fade + 5px, 200ms.
- **Entrada em escada** (`.stagger-children`): filhos entram com `slideUp`
  240ms, atraso de 50ms por item até o 8º, uma vez. Usar em listas e grades.
- **Contagem:** número puro sobe de 0 ao valor em 700ms (ease-out cúbico,
  `requestAnimationFrame`). Valor formatado em R$ pode aparecer pronto ou
  contar sobre o número bruto e formatar a cada frame.
- **Barra enche:** nasce com largura 0 e transiciona até o valor em 520ms.
- **Atenção com cota** (`.atencao-pulse`): halo vermelho que pulsa 3 vezes e
  para. Barra lateral crítica pisca 4 vezes e para. Pulso infinito só para o
  que precisa incomodar até ser resolvido (ex.: conta vencida hoje sem baixa).
- **Salto do aviso** (`.badge-bounce`): o ponto do sino salta quando a
  contagem muda.
- **Painel lateral** desliza da direita (`translateX(2rem)`→0, 280ms); no
  mobile sobe (`translateY(1.5rem)`). Overlay entra em 220ms.
- **Hover de card clicável:** `-translate-y-0.5` + `shadow-dropdown` +
  `border-line-strong`. Botão pressionado: `active:scale-[0.98]`.
- **Comemoração** (ex.: meta do mês batida) pode interromper a tela por alguns
  segundos, com confete. É a única animação que chama atenção para si.

```css
@keyframes slideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
.stagger-children > * { animation: slideUp 240ms cubic-bezier(.16,1,.3,1) backwards; }
.stagger-children > *:nth-child(2){animation-delay:50ms} /* …até nth-child(8): 350ms */
.entrada { animation: slideUp 320ms cubic-bezier(.16,1,.3,1) backwards; }
.atencao-pulse { animation: atencaoPulse 2.2s ease-in-out 3; }
@keyframes atencaoPulse { 0%,100%{box-shadow:var(--shadow-card)}
  50%{box-shadow:0 0 0 4px var(--error-bg),0 10px 28px rgba(229,113,122,.28)} }
.barra-atencao { animation: barraAtencao 1.6s ease-in-out 4; }
@keyframes barraAtencao { 0%,100%{opacity:1} 50%{opacity:.3} }
.badge-bounce { animation: badgeBounce 500ms cubic-bezier(.36,.07,.19,.97); }
@keyframes badgeBounce { 0%,100%{transform:scale(1)} 30%{transform:scale(1.3)} 60%{transform:scale(.92)} 80%{transform:scale(1.08)} }
.shimmer { background: linear-gradient(90deg,var(--surface-2) 25%,var(--surface-3) 50%,var(--surface-2) 75%);
  background-size:200% 100%; animation: shimmer 1.5s infinite; }
@keyframes shimmer { from{background-position:200% 0} to{background-position:-200% 0} }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration:.01ms !important; animation-iteration-count:1 !important;
    transition-duration:.01ms !important; scroll-behavior:auto !important; }
}
```

---

## 8. Componentes (vocabulário compartilhado)

Crie estes uma vez em `components/ui` e `components/shared`. Nunca recriar
primitiva por tela. Se um estilo aparece em duas telas, vira componente ou token.

**Tabela de tons** (usada por todos):
```ts
type Tom = 'marca'|'sucesso'|'atencao'|'risco'|'info'|'neutro'
const TOM = {
  marca:   { texto:'text-brand-text', fundo:'bg-brand-tint', borda:'border-brand/25',     ponto:'bg-brand',   solido:'var(--brand)' },
  sucesso: { texto:'text-success',    fundo:'bg-success-bg', borda:'border-success-line', ponto:'bg-success', solido:'var(--success)' },
  atencao: { texto:'text-warning',    fundo:'bg-warning-bg', borda:'border-warning-line', ponto:'bg-warning', solido:'var(--warning)' },
  risco:   { texto:'text-error',      fundo:'bg-error-bg',   borda:'border-error-line',   ponto:'bg-error',   solido:'var(--error)' },
  info:    { texto:'text-info',       fundo:'bg-info-bg',    borda:'border-info-line',    ponto:'bg-info',    solido:'var(--info)' },
  neutro:  { texto:'text-t3',         fundo:'bg-s3/60',      borda:'border-line',         ponto:'bg-t4',      solido:'var(--t3)' },
}
```

- **Painel:** `relative rounded-[14px] border border-line surface-premium shadow-card overflow-hidden`;
  prop `dourado` adiciona `gold-edge gold-glow-tl`.
- **PainelTitulo:** `flex items-center gap-2 px-4 pt-3.5 pb-2.5` com filete
  `w-1 h-3.5 rounded-full`, ícone 15px `text-t3` e h2 no estilo rótulo; `extra` à direita.
- **Rotulo:** `font-label text-[11px] uppercase tracking-[0.14em] text-t4`.
- **IconeTom:** ícone sempre dentro de bloco tonalizado, nunca solto.
  sm `w-7 h-7 rounded-[9px]` ícone 13 · md `w-9 h-9 rounded-[11px]` 16 ·
  lg `w-11 h-11 rounded-[14px]` 19. Fundo + borda do tom, stroke 1.6.
- **Numero / KpiCard:** IconeTom sm + Rotulo, número grande `text-t1` e nota
  11px `text-t4`. **O tom colore o ícone, nunca o número.** Número colorido só
  com estado real (meta batida em verde, vencido > 0 em vermelho). **Zero nunca
  é vermelho.** Card de KPI inteiro é clicável e leva à lista filtrada.
- **Barra:** `role="progressbar"` com `aria-valuenow`; ouro com halo só no tom marca.
- **Chip de status:** `inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5
  text-[11px] font-semibold` + ícone 11px, cores do tom.
- **Dica:** caixa `rounded-[14px] border px-3.5 py-2.5` com ícone `Lightbulb` 13px
  e texto 13px. Explica a regra que a tela não mostra sozinha.
- **SecaoTitulo:** filete vertical + ícone + rótulo + descrição 11px; divide
  formulários longos em blocos com nome.
- **Button:** variantes `primary` (`grad-brand shadow-brand font-heading font-bold`),
  `secondary` (`bg-surface border-line text-t2`), `ghost`, `danger` e `success`
  (fundo `-bg`, texto e borda do tom). Tamanhos sm 36px, md 40px, lg 44px.
  `type="button"` por padrão. `disabled:opacity-40`.
  Foco: `focus-visible:ring-2 ring-brand/40`.
- **Input / Select / Textarea:** label sempre visível (12px `text-t2`, `*`
  vermelho se obrigatório), placeholder não é rótulo. `min-h-[42px] rounded-lg
  px-3 py-2.5 text-sm bg-surface border-line-input`, foco `ring-2 ring-brand/25
  border-brand`, erro `border-error-line` + mensagem com `role="alert"`, dica em
  `text-t4`. Select nativo.
- **MoneyInput:** prefixo `R$`, só dígitos no estado, formatado pt-BR.
- **Badge:** `rounded-md px-2 py-0.5 text-xs` com fundo/texto/borda do tom e
  ponto opcional.
- **Abas:** sublinhado Areia na ativa, ícone + rótulo + contador opcional.
  Teclado completo: uma parada de Tab, setas circulam, Home/End.
- **Filtros rápidos:** pílulas `rounded-full` com contador; a ativa preenchida
  em `brand-fill`; contador zero fica esmaecido.
- **SidePanel (padrão de edição/detalhe):** à direita, larguras md 34rem,
  lg 42rem, xl 52rem; tela cheia no mobile. Overlay leve (`bg-black/25`).
  Cabeçalho fixo (título Sora 16px + subtítulo + ações + X), corpo que rola,
  **rodapé fixo** com as ações. Focus trap, Escape fecha, foco volta à origem.
  Estado na URL (`?lancamento=<id>`).
- **Modal central:** só confirmação curta e destrutiva. Mesmo focus trap.
- **Busca global ⌘K:** paleta centralizada, resultados agrupados por tipo com
  rótulo de seção, setas + Enter, rodapé com atalhos.
- **Popover de notificações:** notificações iguais **agrupadas** ("12 boletos
  vencendo hoje"), nunca 100 linhas idênticas.
- **Toasts:** com `aria-live`. Mensagem específica ao contexto.
- **Esqueleto:** blocos `shimmer` com a forma real do conteúdo (linhas com
  avatar e colunas; cards com ícone, número e barra). Nunca spinner solto.
- **Estado vazio:** IconeTom lg + título Sora + descrição + ação.
- **Estado de erro:** IconeTom risco + "Não foi possível carregar" + motivo +
  botão "Tentar de novo". Erro sempre vence vazio.

---

## 9. Listas e tabelas

- Container `list-surface border border-line rounded-xl overflow-hidden stagger-children`.
- **Largura de cada coluna declarada uma vez.** Cabeçalho e célula leem da
  mesma definição, então sempre alinham. Cabeçalho: `px-6 py-2.5 border-b
  border-line bg-s3/20`, rótulos 11px maiúsculos `text-t4`.
- Colunas somem por breakpoint (`hidden md:block`) do menos para o mais importante.
- Linha: `lista-linha group flex items-center gap-4 px-5 py-3.5 hover:bg-s3/50
  border-b border-line last:border-0 cursor-pointer`.
- **Nem tudo é pílula.** Só o que exige decisão ganha moldura (status, vencido,
  alerta). Categoria, conta, responsável e origem são contexto e leem como texto
  na segunda linha, separados por "·" em `text-t5`.
- **Valor tem coluna própria**, `tabular-nums`, alinhado à direita. Entrada e
  saída se diferenciam por sinal e ícone, e a cor só aparece com estado.
- **Ações da linha** numa faixa de largura fixa à direita, visíveis no hover e
  no foco (e sempre visíveis em telas touch).
- Nada de vazio no meio da linha: se sobra espaço, a coluna flexível estica.
- **Densidade:** preferência "Confortável / Compacta" persistida, aplicada como
  `html.compacta .lista-linha { padding-top:.5rem; padding-bottom:.5rem }`.
  Muda só o ar, nunca esconde informação.
- Linha ligada a algo crítico ganha barra lateral de 3px na cor do tom.
- Listas longas agrupadas por data ("Hoje", "Amanhã", "Esta semana") com rótulo
  de grupo e contador.

---

## 10. Inteligência: a tela sugere a ação

- **Próxima melhor ação** logo abaixo do hero: um bloco `surface-premium
  rounded-[16px]` com rótulo "PRÓXIMA MELHOR AÇÃO", IconeTom lg, **título**
  (Sora 17px extrabold), **porquê** (13px `text-t3`, máx. 62ch, escrito como a
  regra da casa) e **um botão** `grad-brand` que executa ("Dar baixa no mais
  antigo →"). Abaixo, as outras sugestões em chips `rounded-full`, em ordem de
  urgência, cada uma com atalho e o porquê no `title`.
- Se a principal é risco, o bloco ganha borda `error-line` e `atencao-pulse`.
- Sem pendência, nunca silêncio: "Tudo em dia" + sugestão produtiva.
- Só sugere o que o sistema observou. Nada de opinião sem dado.
- Exemplos para finanças, na ordem: contas vencidas sem baixa → recebíveis
  atrasados → vencendo amanhã → lançamentos sem categoria → conciliação
  pendente → meta do mês abaixo do ritmo → avisos por ler.
- **Prioridades de hoje:** lista agrupada por severidade (Crítico / Atenção /
  Oportunidade), rótulo do grupo uma vez só com contador, cada linha com título,
  motivo + tempo e botão de ação direta à direita.
- Cada sugestão e cada KPI levam a uma **lista já filtrada** por deep link
  (ex.: `/contas?foco=vencidas`, `/lancamentos?categoria=sem`).
- Hero de meta mostra ritmo: "Dia 12 de 30 · ritmo esperado 40%" e
  "Abaixo do ritmo" em âmbar, ou selo "Meta coberta" em verde.

---

## 11. Texto e conteúdo

- Português do Brasil, voz ativa, do ponto de vista de quem usa.
- Botão diz exatamente o que acontece ("Registrar pagamento"), e o toast
  confirma ("Pagamento registrado").
- Erro explica o que houve e como resolver, sem desculpas vagas.
- Saudação no Dashboard ("Boa noite, Rafael") + data por extenso.
- Subtítulo resume o estado real, com números.
- Datas relativas quando próximas ("há 2 dias", "amanhã às 10:00").
- Nunca inventar números nem arredondar para parecer melhor.

---

## 12. Acessibilidade (mínimo WCAG 2.2 AA)

- Foco visível: `*:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px }`.
- Tudo navegável por teclado. `aria-label` em botão só de ícone.
- Alvo de toque ≥ 40px (ação principal 44px ou mais).
- `role="alert"`/`aria-live` em erro e toast. `aria-busy` no esqueleto.
- Contraste AA: texto pequeno nunca abaixo de `--t4`.
- Status nunca só por cor. `prefers-reduced-motion` respeitado.
- Scrollbar fina: 4px, thumb `#4A5573` no escuro e `rgba(15,23,48,.18)` no claro.

---

## 13. Checklist antes de entregar cada tela

1. Qual é **o número que decide a ação**? Ele é o maior e recebe o único ouro.
2. O que é **status**? Tom semântico + ícone ou texto.
3. O que é **contexto**? 11–12px, neutro, sem moldura.
4. Toda seção tem **filete + ícone**?
5. Formulário e detalhe abrem **à direita**, com rodapé fixo?
6. Carregando, falhou e vazio estão desenhados, com erro vencendo vazio?
7. Números em `tabular-nums`, dinheiro em R$ pt-BR alinhado à direita?
8. Movimento dentro da cota e desligado com `prefers-reduced-motion`?
9. A tela sugere a próxima ação com botão que executa?
10. **Passou no teste do tema claro e do mobile 390px?**
