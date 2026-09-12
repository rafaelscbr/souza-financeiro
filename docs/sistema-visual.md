# Sistema visual — Souza Imobiliária Financeiro

Este documento é a regra, não a sugestão. Quem edita uma tela segue daqui.

## 1. A marca, medida

`src/assets/logo-imobiliaria.png` (1000×364) foi decodificado pixel a pixel.
São 60.634 pixels opacos:

| cor | pixels | fração da tinta | o que é |
|---|---|---|---|
| `#0F1730` | 60.007 | **98,97%** | o navy — a marca inteira |
| `#E4B23C` | 89 | **0,15%** | um disco de 11px: o ponto final de "IMOBILIÁRIA." |

**A marca tem duas cores e nada mais.** O `#1E3A8A` e o `#B08900` que estavam
declarados em `tailwind.config.js` eram invenção, e o logotipo nunca era
importado — o ícone `Building2` da lucide ocupava o lugar da marca em 4 telas.

Geometria do símbolo, também medida:

- lockup 960×272 (3,5294:1); símbolo 272×272 exato
- traço da moldura 15px = **5,51%** do lado
- raio do canto 64px = **23,53%** do lado → daí `rounded-marca` = `24%`
- aresta reta esquerda de y=64 a y=208 (144px)
- o "S" interno mede 108×128 e ocupa **47,06%** da altura da moldura
- o símbolo pende **24px** abaixo do centro do bloco de texto

Duas letras diferentes, e isto decide a tipografia:

- **SOUZA** é grotesca pesada: haste de 27px sobre caixa alta de 111px = **24,3%**
- **IMOBILIÁRIA** é **slab serif**: barra de 19px sobre haste de 7px = **2,71:1**,
  sem bracket, caixa alta de 43px, vãos de 22–26px, célula quadrada,
  entreletra ≈ **0,38em**

Os contornos reais estão traçados em `src/components/marca/paths.ts`
(fidelidade verificada: 99,94% no símbolo, 99,91% no texto). Use
`<Simbolo />` e `<Lockup />` de `src/components/marca/Marca.tsx`. Nunca um
ícone de biblioteca no lugar da marca.

## 2. Cor

Tokens em `src/index.css`, como triplo RGB, com o contraste calculado ao lado
de cada um. **42 pares foram verificados pela fórmula WCAG; todos passam.**

Regras que não se negociam:

1. **`--c-base` e `--c-surface` são o mesmo hex** (a classe da cor de página é `bg-papel`, não `bg-base` — existe um TAMANHO chamado `base`, e os dois gerariam a mesma classe `text-base`).** Não existe cartão. Separação
   é fio, não caixa. Não há `--shadow-card` — só `--shadow-pop`, e só no que
   flutua (modal, folha, toast).
2. **A cor de ação é o navy da marca.** `bg-action text-action-ink` = 17,71:1 no
   claro, 12,87:1 no escuro. O esmeralda saiu de "cor de clicável": era 2,54:1
   em 33 botões, inclusive o "Entrar".
3. **Verde significa uma coisa só: dinheiro que se moveu.** Nunca ação.
4. **O ouro se chama `seal`, não `gold`.** `#E4B23C` dá 1,96:1 sobre branco —
   quem o usar como texto no tema claro produz uma tela inacessível. Ele existe
   em dois papéis: preenchimento sob tinta navy (`bg-seal text-seal-ink`, 9,05:1
   **nos dois temas**) e o disco decorativo do rótulo assinatura. Nenhuma
   informação depende dele: é sempre `aria-hidden` e sempre reforço.
5. **Todo chip e todo selo declara o par tinta+fundo.** Nunca uma cor com alpha
   — era assim que os selos ficavam presos em 2,71:1.
6. `line` é o fio decorativo entre linhas (1,24:1). `rule` é o fio que **carrega
   leitura** (3,54:1): fecha total, delimita região. Não troque um pelo outro.
7. **Previsto não tem cor tônica.** A ausência de cor é o sinal.

## 3. Tipografia

Três famílias, cada uma com um trabalho:

| família | uso | por quê |
|---|---|---|
| Inter 400/500/600 | texto de interface | rebaixada: não é mais a fonte dos números |
| Archivo 600/700 | **todo dinheiro** e o número herói | é a letra do wordmark SOUZA |
| Roboto Slab 500 | só o rótulo assinatura | é a letra do descritor IMOBILIÁRIA |

Dinheiro usa a classe `.cifra` (Archivo + `tabular-nums`), nunca Inter.

A escala reusa os nomes do Tailwind de propósito — 290 das 350 declarações de
tamanho do app migraram sozinhas ao redefinir os valores em
`tailwind.config.js`:

| nome | px | uso |
|---|---|---|
| `xs` | 12/16 | rótulo, cabeçalho de tabela. **Piso absoluto.** |
| `sm` | 13/18 | metadado: data, "base × %", frase de tempo |
| `base` | 15/22 | prosa, rótulo de linha, microcópia |
| `lg` | 17/24 | título de tela e de seção |
| `xl` | 22/28 | **dinheiro em lista — o degrau de comparação** |
| `2xl` | 26/30 | herói que estourou 7 dígitos |
| `3xl` | 34/36 | o número herói (celular) |
| `4xl` | 40/42 | o mesmo, ≥640px |

**Nada abaixo de 12px, sem exceção.** Eram 114 usos de 10–11px a 2,56:1, lidos
em pé, no sol. Morreram `text-[10px]`, `text-[11px]`, `text-[13px]`,
`text-[15px]`.

## 4. Dinheiro

- **Nunca abreviar.** `formatCurrencyCompact` foi apagada de `src/lib/format.ts`
  para que a regra não dependa de lembrança. Centavos sempre presentes.
- Sinal negativo é o **menos de verdade** (U+2212) em calha própria, para não
  empurrar dígito e desalinhar a coluna.
- O `R$` é composto menor que os dígitos; os **centavos ficam no corpo cheio**
  em qualquer degrau. Dois tamanhos dentro do mesmo número é defeito.
- **O tamanho codifica o posto, a cor não:**
  - `heroi` — a resposta da tela. **Um por tela.**
  - `linha` — valor que se compara dentro de uma lista.
  - `fato` — valor que é só um dado dentro de uma conta.
- **Um valor previsto nunca usa `heroi` e nunca recebe cor tônica.**
- Quando um número não cabe: corte coluna, quebre em duas tabelas, ou role o
  container. Nunca encolha o dinheiro.

## 5. Nenhum número sem origem

Este é o mecanismo central. **Todo valor abre no que o compõe, até a parcela da
venda específica.**

```tsx
const { abrir } = useComposicao()

<ValorComOrigem
  valor={total}
  rotuloAcessivel="Ver de onde vem o total a receber"
  aoAbrir={() => abrir({
    rotulo: 'A receber',          // o rótulo assinatura da folha
    titulo: 'A receber neste mês',
    explica: 'o que este número é — e o que ele NÃO é',
    total,
    itens: [{ id, titulo, meta, valor, situacao, idx, count, para }],
    nota: 'ressalva quando parte do total é previsão',
  })}
/>
```

Cada item da folha leva à ficha da venda por `para`. O provider
(`ComposicaoProvider`) já está montado nas duas cascas.

## 6. Situação — quatro sinais redundantes

Fonte única: `src/lib/situacao.ts`. A cor é o **quarto** sinal.

| situação | marcador | selo | palavra (admin / corretor) | frase |
|---|---|---|---|---|
| `prevista` | anel vazado | vazio, borda 3,54:1 | Prevista / Prevista | "prevista para 12/10" |
| `liberada` | disco | **ouro sólido, tinta navy** (9,05:1, invariante de tema) | Liberada / **A receber** | "liberada em 02/09" |
| `vencida` | quadrado | ouro + anel crítico | Vencida / Atrasada | "liberada em 02/09 · 14 dias esperando" |
| `recebida` | check | verde sólido | Recebida / Recebida | "recebida em 02/09" |
| `cancelada` | riscado | vazio, riscado | Cancelada | "cancelada" |

Em escala de cinza: vazio · médio · médio-com-anel · escuro · riscado.

**A regra de negócio mais importante do sistema:** atraso é só o que a
imobiliária **já recebeu e não pagou**. Parcela que a construtora não pagou é
espera, não atraso — `vencida` nunca se aplica a `prevista`. Use
`situacaoDeTela(status, dataPrevista)`, que já faz isso.

"Liberada" **não existe** no vocabulário do corretor: passe `perfil="corretor"`.

Data nunca aparece sozinha. Sempre com verbo, por `fraseDeTempo` /
`<FraseDeTempo>`.

## 7. Forma, espaço, movimento

- **Raio proporcional**, derivado dos 23,53% da moldura: chip 6px (`rounded-md`),
  campo e botão 10px (`rounded-lg`), folha 20px (`rounded-3xl`), e
  `rounded-marca` (24%) só no quadrado da marca.
- **Um traço só:** `border-line` entre linhas, `border-rule` acima de um total.
  Nenhuma borda colorida, nenhuma barra de acento lateral.
- **Piso de toque 44×44px** em tudo tocável (`h-toque`, `min-h-toque`).
- Linha de lista com 56px mínimo. Respiro de 32px entre seções (`Secao` já faz).
- **Movimento só onde algo se moveu no mundo.** Número nunca conta para cima.
  Barra de progresso renderiza na largura final. Sem skeleton cintilante —
  carregar é um fio estático (`Esqueleto`), porque "tracejado" já significa
  "ainda não é fato" e o carregando não pode dividir desenho com um estado real.
  A única animação celebratória é o `recibo`, e só depois de uma baixa
  confirmada pelo próprio usuário.

## 8. Vocabulário

- **"Resultado" só existe no DRE, em Relatórios.** No Início o nome é
  "Sobrou no mês", com o detalhe "entrou menos saiu, só o que já foi pago".
  Dois nomes para duas contas, em vez de um nome para duas.
- **Subtotal de grupo é sempre em duas parcelas** (`SubtotalDuplo`):
  "agora R$ X · previsto R$ Y". Nunca um total único, que somaria o que a
  imobiliária tem com o que ela espera.
- Quando o sistema não sabe, ele diz em texto, não em zero: "venda sem VGV
  informado" no lugar do valor.

## 9. O kit

| componente | arquivo | papel |
|---|---|---|
| `Simbolo`, `Lockup` | `components/marca/Marca.tsx` | a marca em SVG traçado |
| `Assinatura`, `Heroi` | `components/ui/Assinatura.tsx` | o rótulo com o ponto de ouro + o número herói |
| — | classe `.assinatura.sem-ponto` | o mesmo rótulo **sem** o ponto, usado na casca |
| `Secao`, `SubtotalDuplo` | `components/ui/Secao.tsx` | o que substituiu o cartão |
| `Lista`, `Linha`, `LinhaDeHoje` | `components/ui/Lista.tsx` | a estrutura que substituiu a grade |
| `Valor`, `ValorComOrigem`, `Metrica` | `components/ui/Valor.tsx` | dinheiro nos três postos |
| `Selo`, `Marcador` | `components/ui/Selo.tsx` | a moldura da marca com o ordinal da parcela |
| `ChipSituacao`, `FraseDeTempo` | `components/ui/Situacao.tsx` | os quatro sinais |
| `Cascata`, `LinhaCascata`, `TotalCascata` | `components/ui/Cascata.tsx` | a conta da comissão, como documento |
| `Trilha`, `LegendaTrilha` | `components/ui/Trilha.tsx` | progresso em três texturas |
| `Esqueleto`, `ListaCarregando` | `components/ui/Esqueleto.tsx` | carregando, sem brilho |
| `ComposicaoProvider`, `useComposicao` | `components/composicao/Composicao.tsx` | nenhum número sem origem |

Telas já convertidas, que servem de referência: `auth/LoginPage.tsx`,
`admin/AdminShell.tsx`, `admin/pages/Inicio.tsx`, `corretor/CorretorShell.tsx`,
`corretor/pages/Inicio.tsx`.

### A regra do ponto único

Exatamente **um** ponto de ouro por tela, e ele fica no rótulo do número herói.
Por isso a casca usa `.assinatura.sem-ponto` para "Financeiro": esse rótulo
aparece em toda tela, e com o ponto haveria sempre dois. O `<Heroi>` é o único
lugar onde a regra e o componente coincidem — o ponto vive dentro da classe,
não na lembrança de quem edita.

Exceções conscientes, as duas únicas:
- O **login** não tem herói; o ponto está no rótulo "FINANCEIRO", que ensina a
  gramática antes de a pessoa digitar a senha. O disco dentro do lockup é da
  MARCA, não da interface.
- A **folha de composição** repete a gramática (rótulo + herói), mas ela cobre
  a página: nunca são vistos ao mesmo tempo.

Toda tela tem exatamente um `<Heroi>` — verificado. A única sem herói é
`Config.tsx`, e por um motivo: tela de configuração não tem número-resposta, e
inventar um quebraria justamente a regra que o herói existe para sustentar.

## 10. O que não entra

Vetado por escrito, com o motivo:

- Cartão, sombra em conteúdo, barra de acento lateral, gradiente em qualquer
  elemento.
- Grade de quatro indicadores. Um herói; o resto em linhas.
- Emoji de seção. Os únicos glifos são os cinco marcadores de situação e um
  chevron.
- Mono como fonte de dinheiro (lê como terminal, e é ~8% mais largo).
- Roxo. `--c-withdrawal` saiu: retirada de sócio usa a tinta navy.
- Qualquer matiz que não seja 225,5° (navy) ou 42,1° (ouro). A marca tem dois.
- Número que conta para cima, skeleton com brilho, hover que levanta elemento.
- Tracejado de 1px como canal de estado — é a primeira coisa que desaparece no
  celular a meio brilho sob sol. Estado é preenchimento, peso, risco e palavra.
