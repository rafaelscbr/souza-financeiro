# Identidade "Folha Clara" — Souza Imobiliária

*Referência da interface. Adotada no Souza Financeiro em 02/11/2026, no branch `identidade-folha-clara`. Substitui o Souza 4.0, que usava marinho `#0F1730` com areia `#E4B23C`, papel `#F6F3EC` e a letra Schibsted Grotesk.*

A migração muda só a aparência. Ficam como estão:
- regras de negócio;
- dados;
- rotas;
- textos de conteúdo;
- comportamento.

## Essência

- **Clara e objetiva.** Fundo claro, muito espaço e poucas caixas. O que importa é grande; o resto é pequeno e cinza-azulado.
- **Uma ação por vez.** Um botão principal por tela.
- **Marinho estrutura, Champanhe destaca.**
  - O azul faz a moldura: barra, títulos e texto.
  - O dourado aparece pouco e com propósito: dinheiro, meta, ação principal e a palavra de destaque.
- **Cor com significado.** Nunca use cor para enfeitar.
  - Verde: ganho ou feito.
  - Âmbar: atenção.
  - Vermelho: risco.
  - Petróleo: informação.
- **Proporção.** Cerca de 80% Folha/Papel, 15% Marinho e 5% Champanhe.

## Tokens (exatamente estes)

```css
:root {
  --page-bg: #F3F6FB;  --surface: #FFFFFF;  --surface-2: #EDF1F8;  --surface-3: #E0E7F2;
  --t1: #0B1A3A;  --t2: #2A3A5C;  --t3: #44557A;  --t4: #5D6E8E;  --t5: #A6B3CB;
  --line: rgba(15,39,89,.10);  --line-strong: rgba(15,39,89,.18);
  --bar-bg: #0F2759;  --bar-text: rgba(255,255,255,.82);
  --hero-bg: linear-gradient(140deg, #1A3F8F 0%, #12306E 48%, #0C2153 100%);
  --brand-fill: #D6B26E;  --brand-fill-hover: #CBA55F;  --brand-fill-text: #0B1A3A;
  --brand: #8F6B2C;  --brand-text: #7A5A22;  --brand-tint: rgba(214,178,110,.18);
  --destaque: #9C7430;
  --field-bg: #EEF2F8;  --field-bg-hover: #E6ECF5;  --field-focus: #2563EB;
  --success: #1F8A62;  --success-bg: #E7F5ED;
  --warning: #BD7A12;  --warning-bg: #FBF0DC;
  --error:   #C7474F;  --error-bg:   #FBEAEB;
  --info:    #236B73;  --info-bg:    #E7F2F2;
  --whatsapp: #1FAE5B;
  --font-display: "Plus Jakarta Sans", Geist, system-ui, sans-serif;
  --font-body: Geist, system-ui, sans-serif;
  --font-destaque: "Instrument Serif", Georgia, serif;
}
.destaque { font-family: var(--font-destaque); font-style: italic; font-weight: 400;
            font-size: 1.12em; color: var(--destaque); }
```

- **Etapas do funil** (só em réguas e gráficos de funil):

  | Etapa | Cor |
  |---|---|
  | Lead | `#4F46E5` |
  | Followup | `#7E22CE` |
  | Atendimento | `#0369A1` |
  | Visita | `#0F766E` |
  | Proposta | `#946200` |
  | Venda | `#15803D` |

- **Tema escuro** (opcional, não é o padrão):
  - Fundo `#0B1426`, superfície `#111D35`, texto `#EEF2F9`.
  - A mesma barra e o mesmo Champanhe.
  - Destaque `#E2C385`.
- **Sobre o bloco-herói** (fundo marinho em degradê):
  - Texto branco; a palavra de destaque em `#E2C385`.
  - Bom e ruim aparecem nos tons claros da própria paleta (`--success-bg`, `--error-bg`), sempre com a palavra que diz o que é.

### Como o código usa (Souza Financeiro)

Os tokens moram em `src/index.css` (bloco `html.light`, o padrão) e chegam ao Tailwind por `tailwind.config.js`. Os nomes que o código já usava foram mantidos e agora apontam para a paleta nova:

| Nome no código | Token novo | Para que serve |
|---|---|---|
| `acao` | `--brand-fill` | O botão principal |
| `ouro` | `--brand-text` | Texto dourado |
| `areia` | `#E2C385` | Destaque sobre marinho |
| `moldura` | `--bar-bg` | A barra |
| `creme` | `--surface` | Superfície |
| `coral` | `--error-bg` | Ruim, sobre o herói |
| `menta` | `--success-bg` | Bom, sobre o herói |
| `serie`, `g-entra` | `--bar-bg` | O dado principal do gráfico |
| `g-sai` | `--t5` | O dado secundário do gráfico |

## Tipografia

| Papel | Letra | Uso |
|---|---|---|
| Display | Plus Jakarta Sans 700–800, tracking −0,025em | Títulos, nome na ficha, números-herói |
| Texto | Geist 400–600 | Interface, corpo, rótulos e botões |
| Destaque | Instrument Serif itálica, em `--destaque` | Uma palavra por frase. Nunca em botão, campo, tabela ou número |

- **Escala:**

  | Tamanho | Uso |
  |---|---|
  | 12,5 | Rótulo |
  | 14 | Texto |
  | 15 | Título de seção |
  | 17–19 | Título de tela |
  | 26–28 | Nome da ficha |
  | 40–56 | Herói |

- **Rótulos:** nunca em MAIÚSCULAS espaçadas.
- **Números:** sempre tabulares.
- **Fonte monoespaçada:** nenhuma.
- **Carregamento:** as fontes vêm do Google Fonts, no `<head>` de `index.html`, `demo.html` e `kit.html`.

## Espaçamento

Escala de 4 em 4 até 16 e de 8 em 8 depois disso: 4, 8, 12, 16, 24, 32, 40, 48 e 64. Nada fora dela.

| Medida | Celular (<640) | Tablet (640–1023) | Computador (≥1024) |
|---|---|---|---|
| Margem lateral da página | 16 | 24 | 32 |
| Recuo dentro de caixa | 16 | 20 | 24 |
| Entre blocos irmãos | 16 | 16 | 16 |
| Entre seções da página | 24 | 24 | 32 |
| Do título ao primeiro bloco | 24 | 24 | 32 |

- **Largura máxima do conteúdo:** 1200px, centralizado.
- **Texto corrido:** no máximo 720px.

## Layout

- **Pontos de quebra:**
  - celular: abaixo de 640px;
  - tablet: de 640 a 1023px;
  - computador: a partir de 1024px.
- **Alturas fixas:**

  | Peça | Altura | Onde aparece | O que leva |
  |---|---|---|---|
  | Topo da tela | 56px | Celular e tablet | Marca, título e sino |
  | Barra | 60px | Computador | Marca, menu em pílulas, busca e conta |
  | Barra de baixo | 64px | Celular e tablet | Os destinos do polegar |

- **No computador:**
  - Não há menu lateral.
  - Os destinos do dia a dia ficam em pílulas na barra do topo.
  - Os de gestão ficam numa pílula "Gestão", que abre um menu.
  - Configurações e Minhas comissões ficam no menu da conta.
- **Barra de baixo:** o conteúdo nunca fica escondido atrás dela, que tem respiro próprio de 64px mais a área segura.

## Componentes

### Barra do topo

- Fundo `--bar-bg`, 60px de altura.
- **Logo:** "S" em quadrado Champanhe (raio 24%) + "Souza" (Plus Jakarta 800, branco) + "imobiliária" (Geist 500, branco 82%).
- **Itens:** pílulas com texto branco 82%.
- **Item ativo:** pílula Champanhe com texto `--t1`.

### Botões

| Variante | Aparência |
|---|---|
| Principal | Fundo `--brand-fill`, texto `--brand-fill-text`, peso 600–700, raio 12px, altura 40–44px (52px no login e no CTA de página). Hover `--brand-fill-hover`. |
| Secundário | Fundo `--surface`, borda `--line`, texto `--t1`. |
| Fantasma | Sem fundo, texto `--t3`, que vira `--t1` no hover. |
| Perigo | Texto `--error`, fundo `--error-bg` no hover. |
| WhatsApp | Fundo `--whatsapp`, texto branco. |

### Campos

- Sem borda, fundo `--field-bg`, raio 10px, altura 44px.
- **No foco:** fundo `--surface`, borda `--field-focus` e halo de 3px.
- **Rótulo:** em cima, 12,5px, peso 600, `--t3`.

### Pílulas

- Inativa: `--surface-2` com texto `--t2`.
- Ativa: `--brand-fill` com texto `--t1`.
- Raio total.

### Cartões

- `--surface`, raio 14–18px, sombra `0 1px 4px rgba(15,39,89,.08)`.
- Nada de caixa com borda dentro de caixa com borda: separe por espaço e tom.

### Faixa de números

- Até 4 números lado a lado, com filete fino entre eles.
- Rótulo de 12,5px em cima; número de 20–26px em Plus Jakarta embaixo.

### Ficha de detalhe

- **Quem é:** o nome, em 26–28px.
- **Em que pé está:** régua de pontos na cor da etapa.
- **O que fazer agora:** bloco em `--surface-2` com filete de 3px à esquerda na cor do tom, a frase da próxima ação e os botões.
- O resto vai em abas.

### Bloco-herói (meta do mês, painel do login)

- Fundo `--hero-bg`.
- Texto branco; destaque em `#E2C385`.

### Raios e sombras

| Peça | Raio |
|---|---|
| Campo | 10 |
| Botão | 12 |
| Lista | 14 |
| Bloco | 18 |
| Painel | 22–26 |

As sombras são sempre em marinho diluído, nunca em preto.

## Estados

| Estado | Como fica |
|---|---|
| Passar o mouse | Botão principal: `--brand-fill-hover`. Secundário: fundo `--surface-2`. Linha de lista: fundo `--surface-2` a 50%. Pílula inativa: `--surface-3`. Cursor de mão em tudo que é clicável. |
| Foco | Tudo que é clicável: contorno de 2px `--field-focus`, afastado 2px. Campo: fundo `--surface`, borda `--field-focus` e halo de 3px `--field-focus` a 18%. |
| Pressionar | Escala 0,97 em 100ms, sem mexer no layout. |
| Desabilitado | Opacidade 40%, cursor proibido e atributo `disabled`. Nada some sem explicação. |
| Carregando | O botão mantém o rótulo, troca o ícone por um giro de 16px, trava a largura e anuncia `aria-busy`. A tela mostra esqueleto no formato do conteúdo; nunca um giro solto acima de 1 segundo. |
| Vazio | Ícone de 22px em `--t4`, uma frase que diz o que mora ali e por que está vazio, e a ação que enche, quando ela existe. |
| Erro | Bloco em `--error-bg` com a causa, o que fazer e o botão "Tentar de novo". No campo: a mensagem embaixo dele, em `--error`, ligada por `aria-describedby`. |

## Regras de uso

- **Área de toque.** No mínimo 44 × 44px em tudo que se toca. No computador, com mouse, o mínimo visual é 32px.
- **Contraste.**
  - Texto: 4,5:1.
  - Texto a partir de 24px e contorno de controle: 3:1.
  - `--t4`: só em texto secundário de 13px ou mais.
  - `--t5`: nunca é texto, só fio e marcador.
- **Formulário.**
  - Valide ao sair do campo, não a cada tecla.
  - A mensagem diz a causa e a saída: "Informe a data do recebimento para dar baixa".
  - No envio com erro, o foco vai para o primeiro campo errado.
- **Descartar e excluir.**
  - Confirme antes de descartar o que foi digitado.
  - Depois de excluir ou dar baixa, ofereça "Desfazer" no aviso.
- **Banco primeiro.**
  - A tela só diz "salvo" depois que o banco respondeu.
  - Enquanto espera, o botão fica em "carregando".
  - Se o banco recusar, nada muda na tela e o erro aparece.

## Ícones e movimento

### Ícones

- Lucide, com traço 1,8. Em 16px ou menos, traço 2, para não sumir.
- Nunca emoji.

| Tamanho | Onde |
|---|---|
| 16 | Linha, botão e menu |
| 18 | Barra do topo |
| 20 | Barra de baixo e aviso |
| 22 | Estado vazio |

### Movimento

- **Entradas:** de 150 a 420ms, com desaceleração (`cubic-bezier(.16,1,.3,1)`):

  | Duração | O que anima |
  |---|---|
  | 150ms | Cor e estado |
  | 200ms | Página e modal |
  | 240ms | Lista em escada (30ms por item, até 7) |
  | 280ms | Painel lateral |
  | 420ms | Número que rola e barra que enche |

- **Saídas:** em 180ms.
- **Propriedades:** só `transform` e `opacity`.
- **"Reduzir movimento" ligado:** nada anima e os números aparecem prontos.

## Textos

- **Botão.**
  - Verbo + objeto: "Registrar venda", "Dar baixa", "Salvar despesa".
  - Nada de "OK", "Enviar" ou "Clique aqui".
  - O botão de perigo diz o que acontece: "Excluir despesa".
- **Aviso.**
  - O que aconteceu, no passado e com o objeto: "Despesa salva", "Baixa desfeita".
  - O de erro diz a causa e a saída: "Não deu para salvar: sem conexão. Tente de novo."
  - Some sozinho em 4 a 5 segundos, menos o de erro.
- **Tela vazia.**
  - O que mora ali e por que está vazio: "Nenhuma parcela em atraso neste mês".
  - Depois, a ação que enche, quando existir.
  - Sem graça e sem exclamação.
- **Vocabulário da casa.**
  - "Vencida" (vermelho): só para dívida da imobiliária.
  - Parcela que a construtora não pagou: "em atraso" (âmbar).

## Não fazer

- Fundo de página branco puro, bege ou creme.
- Dourado em tudo.
- Mais de uma palavra serifada por frase, ou serifa em título inteiro.
- Rótulos em maiúsculas espaçadas.
- Caixa com borda dentro de caixa com borda.
- Preto puro em texto ou sombra.
- Cor sem significado.
- Resquícios da identidade antiga. Encontrou, substitua:
  - a paleta marinho com areia (`#0F1730`, `#E4B23C`, `#F6F3EC`);
  - as fontes Schibsted Grotesk, Hanken Grotesk e Space Grotesk;
  - sol, ondas e horizonte.

## Acessibilidade

- Contraste de texto de 4,5:1 ou mais (3:1 a partir de 24px).
- Foco visível em tudo que é clicável.
- A estrutura semântica não muda.

## Decisões de implementação (Souza Financeiro, 02/11/2026)

- **Destaque em texto pequeno.** O `--destaque` (`#9C7430`) dá 3,9:1 sobre a página. Abaixo de 24px, o que inclui o nome no título da tela, a palavra de destaque usa `--brand-text` (`#7A5A22`, 6:1). A partir de 24px e sobre o herói, vale a regra da especificação.
- **Onde fica o bloco-herói:**
  - Início do administrador.
  - Início do corretor.
  - Painel do login.

  Em A receber, A pagar e Vendas, os mesmos números ficam na faixa de números clara, para manter cerca de 15% de marinho na tela.
- **Botão principal.**
  - Em cada tela, o principal é o "Novo lançamento" (52px no computador).
  - O botão de tela vazia e o "Aplicar" das Metas passaram a secundário.
  - Painéis e janelas têm o seu próprio principal, porque são outra camada.
- **Marca.** "S" em quadrado Champanhe + "Souza imobiliária" (`MarcaSouza` em `src/components/marca/Marca.tsx`). Os ícones do app (`public/`) seguem o mesmo "S".
- **Tema escuro.** Continua opcional, com os valores da especificação e tons derivados por mistura, sem hex fora da paleta.
