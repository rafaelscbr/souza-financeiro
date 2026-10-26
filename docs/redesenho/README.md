# Souza 2.0 — redesenho radical do front-end

*24 a 26/10/2026 · pedido do Rafael: "SaaS financeiro premium, não uma atualização cosmética"*

Dados, regras financeiras, banco e funcionalidades: intactos. Mudou a experiência inteira.

## Por que a versão anterior parecia antiga (diagnóstico)

1. **Todo bloco era a mesma caixa** — borda, filete dourado, ícone, título e uma frase. A tela virava uma sequência de cartões iguais.
2. **Número principal numa caixa enorme** com muito vazio, separado dos números de apoio.
3. **Sora** nos títulos e valores: geométrica, ar de template, não de produto financeiro.
4. **Rótulos em CAIXA ALTA espaçada** e linhas de duas alturas (título + frase longa): ruído.
5. **Ícones coloridos em quadradinhos** em cada indicador, cores competindo.
6. **Listas sem colunas**: sem cabeçalho, ordenação, paginação.
7. **Gráficos de barras CSS** sem eixo, sem balão, sem legenda.
8. **Menu longo**: 6 grupos em caixa alta, 18 itens, sem busca.

## O design system novo

| | Souza 2.0 |
|---|---|
| Fundo | off-white `#F7F8FA`; superfícies brancas; fio `rgba(11,18,32,.06–.09)` |
| Texto | tinta `#0B1220`, cinzas `#30384A → #9AA1AE` |
| Marca | marinho na ação principal e no estado ativo; areia só na marca e nos gráficos |
| Estado | sucesso `#0E8A5F`, atenção `#B7791F`, risco `#D03A3A`, informação `#2563EB` |
| Letra | Inter só (400–700), número tabular, alternativas `cv11` e `ss01`, sem caixa alta |
| Escala | página 24, seção 15, valor herói 34, indicador 24, corpo 14, meta 13, nota 12 |
| Espaço | grade de 4px com meio passo (2, 6, 10, 14) |
| Raios | controle 8, caixa 12, sobreposição 16, segmento 10/7 |
| Sombra | só contato (`0 1px 2px`), balões e painéis com sombra de verdade |
| Gráficos | recharts; entra em marinho `#2848A8`, sai em areia `#E9B44C`, resultado em tinta |

Tokens em `src/index.css` (`html.light`), escala em `tailwind.config.js`. O verificador
(`scripts/verificar-design.mjs`) foi ajustado para a grade nova.

## Componentes novos ou redesenhados

- **Menu lateral**: empresa no topo, busca ⌘K, grupos Operação · Caixa · Gestão · Minhas comissões, Configurações e perfil no rodapé, recolhível.
- **Cabeçalho de página**: barra fina (onde estou, avisos, ação) e título editorial no conteúdo, com descrição, mês e ações à direita.
- **FaixaDeMetricas**: os números de resumo num painel só, com fio entre eles e tendência discreta.
- **Heroi**: faixa de resumo — número à esquerda, apoios em colunas à direita.
- **Cartao**: título e descrição, sem filete, sem ícone.
- **FiltrosRapidos**: controle segmentado.
- **TabelaDeDados**: ordenação, paginação, linha clicável, colunas que somem no celular.
- **ContaDoRelatorio**: demonstrativo em tabela com período anterior e variação.
- **Graficos**: evolução (barras + linha), rosca, área — com balão em reais e clique que abre os lançamentos.
- **CampoDeBusca**, **Atalho**, **Kpi** sem ícone colorido.

## Telas recompostas

- **Visão financeira** (antigo Início): resumo do negócio · evolução financeira (competência ou caixa) · para onde vai a comissão · próximos recebimentos · desempenho da operação · caixa nos próximos 6 meses · alertas e decisões · orçamento, nota fiscal e pessoa física.
- **DRE** e **Fluxo de caixa**: relatório em tabela com comparação; o Fluxo ganhou o gráfico de 12 meses.
- **Relatórios**: biblioteca agrupada por pergunta (Resultado, Dinheiro, Comercial), com busca.
- **Vendas** e **Despesas**: tabela de dados com ordenação e paginação.
- **Vendas, Projeções, área do corretor**: faixa de métricas no lugar dos cartões soltos.
- Todas as outras telas herdam os componentes novos — não há tela no desenho antigo.

## Validação

- 22 telas do administrador e 4 do corretor abertas a 1440, 820 e 375px: nenhuma com erro, nenhuma com rolagem lateral, todas com título.
- Área do corretor sem nenhum dado da imobiliária.
- Verificador de design, tipos e build de produção passando.
- Antes e depois: `antes-depois-*.png` nesta pasta.
