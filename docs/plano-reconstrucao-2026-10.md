# Plano de reconstrução do sistema financeiro — Souza Imobiliária

*23/10/2026 · Fases 1 (diagnóstico) e 2 (arquitetura financeira) do prompt master.
Nada aqui foi implementado ainda: este documento é o que o Rafael aprova antes
de cada fase de construção.*

---

## 1. Diagnóstico do que existe

### 1.1 Tecnologia

| Camada | Hoje | Decisão |
|---|---|---|
| Front-end | React 18 + Vite + TypeScript + Tailwind, PWA | **manter** |
| Gráficos | Recharts 2 | **manter** |
| Banco e login | Supabase (Postgres + Auth + RLS) | **manter** |
| Publicação | Vercel, a partir da `main` (prebuild roda `scripts/verificar-design.mjs`) | **manter** |
| Tamanho | ~30,8 mil linhas em `src`, 42 componentes de UI, 40 migrações | — |

Nenhuma troca de tecnologia: o prompt proíbe reescrever por preferência, e a
base atende.

### 1.2 Telas

| Área | Telas | Situação |
|---|---|---|
| Administrador | Início, Vendas, Venda (ficha), Receber, Recebimentos, Pagar, Despesas, Corretores, Simulação, Configurações | **reorganizar** na navegação nova |
| Relatórios | Escolha, DRE (competência), Fluxo de caixa, Orçamento (teto) | **manter o motor, refazer a casca** |
| Corretor | Início, Minhas vendas, Venda, Recebimentos | **reconstruir** (níveis, metas, desempenho) |
| Vitrine `demo.html` | todas as telas com dados de exemplo | **manter** (é como se confere sem login) |

### 1.3 Banco (contagens de 23/10/2026)

| Tabela | Linhas | Papel |
|---|---|---|
| `transactions` | 106 da imobiliária (+8 de outras empresas arquivadas) | razão: receita, imposto, comissão, despesa, retirada |
| `sales` | 11 (10 ativas) | a venda |
| `sale_installments` | 40 | parcelas da comissão, com gatilho, nota e recebimento |
| `accounts` | 2 (Bradesco PJ, Cartão PJ) | contas de dinheiro |
| `budget_lines` | 4 | orçamento de custos (039) |
| `companies.monthly_budget` | R$ 4.915 | teto de gastos (040) |
| `contacts`, `profiles`, `developers`, `cost_centers`, `categories` | cadastros | — |

**Segurança:** tabelas com RLS `admin_tudo` (`is_admin()`); o corretor lê só
por funções filtradas (migração 010). Revisar na fase 7.

### 1.4 Valores de referência (para reconciliar depois de cada fase)

Arquivo: `scratchpad/referencia-2026-10-23.json`. Backup completo:
`~/Documents/souza-financeiro-backup-20261023-2012` (214 linhas, manifesto
SHA-256).

| Referência | Valor |
|---|---|
| Lançamentos da imobiliária | 106 |
| Receita (todos os lançamentos) | R$ 287.060,41 |
| Impostos | R$ 22.518,57 |
| Comissões de corretores | R$ 144.730,38 |
| Despesas | R$ 1.079,63 |
| Distribuição | R$ 1.965,49 |
| VGV ativo · comissão ativa | R$ 6.007.774,96 · R$ 280.036,19 |
| Parcelas previstas · recebidas · canceladas | R$ 246.135,78 · R$ 60.676,65 · R$ 6.112,65 |
| Saldo em conta | R$ 7.391,60 |

**Ocorrência registrada:** em 23/10/2026 a venda Itajaí Urban Club T1 1204 foi
cancelada pelo app ("distrato provável"); as parcelas 3 a 9 (R$ 6.112,65 de
comissão, R$ 3.056,32 de repasse) saíram da carteira. As 2 recebidas ficaram.

**Conferência do backup:** 2 avisos de ordem de restauração (as tabelas
`sale_installments` e `transactions` se referenciam). Não é perda de dado;
a restauração precisa adiar as chaves estrangeiras.

### 1.5 O que já está certo e será preservado

- Motor do DRE por competência (`lib/dre.ts`): comissão reconhecida na nota →
  gatilho → recebimento → previsão; imposto e corretor andam junto.
- Fluxo de caixa que fecha com o saldo das contas (`lib/fluxoDeCaixa.ts`).
- Orçamento e teto (`lib/orcamento.ts`), avisos no Início, no lançamento e no sino.
- Funções de banco atômicas para venda, recebimento e repasse (009).
- Todo número abre nos lançamentos de origem (composição).

### 1.6 Problemas de experiência

- Visual escuro e carregado; o prompt pede claro, minimalista.
- Navegação plana, sem agrupar financeiro × comercial × gestão.
- Início com herói, 4 KPIs e vários cartões competindo.
- Área do corretor sem nível, meta nem desempenho.
- Sem exportação PDF/Excel, sem ajuda contextual nos números.

---

## 2. Regras de negócio

### 2.1 Comissão (já em uso)

- Padrão de contrato: **5% do VGV**. Exceções gravadas: Lago 1302A (2,5%),
  parcerias Rogga (só a parte da Souza).
- **Ordem do cálculo:** comissão − ISS retido (3%, quando a construtora retém)
  − Simples 6% sobre o que sobrou = **base**; corretor = base × % dele.
- **Brinde:** meio a meio entre imobiliária e corretor, desde 23/10/2026
  (repasse = base × % − brinde ÷ 2). A 1114-D fica como foi feita.
- **Rogga (2ª Fase):** entra 76,5% da comissão cheia na Souza, sem nota, sem
  imposto; corretor 50% do lado Souza.
- **Gatilho** do empreendimento, **nota** por parcela, **prazo** da construtora
  (LOTISA: 10 dias úteis).

### 2.2 Plano de carreira do corretor (PDF de outubro/2026)

| Nível | Comissão (da comissão líquida) | Quando |
|---|---|---|
| 1 · Corretor | 40% | até R$ 5 milhões de VGV acumulado |
| 2 · Pleno | 45% | a partir de R$ 5 milhões |
| 3 · Sênior | 50% | a partir de R$ 10 milhões |

Regras: só conta **venda efetivada** (contrato assinado **e ato pago**);
**distrato desconta** do acumulado; subir depende também do Código de Cultura;
**manutenção**: Pleno e Sênior precisam de R$ 2,5 milhões nos últimos 12 meses,
e dois semestres seguidos abaixo disso voltam um nível; **venda dividida** conta
proporcional; o corretor recebe quando o dinheiro entra.

### 2.3 Plano de carreira do gestor de equipe (PDF de outubro/2026)

- Vendas próprias: **50%** (como Sênior).
- Gestão: **5%** da comissão líquida das vendas dos corretores do time, **+3%
  de bônus (8%)** quando o time bate a meta do mês.
- Meta do time = soma das metas de quem vende no time, incluindo o gestor.
- Meta apurada no mês, com VGV efetivado; distrato desconta.

### 2.4 Metas (decididas nas conversas de 22 e 23/10/2026)

Por decisão do Rafael, **só as metas mudam em relação aos PDFs**:

| Meta | Valor |
|---|---|
| Imobiliária | R$ 1 milhão de VGV por mês, avaliada no acumulado |
| Dionata | R$ 750 mil por mês |
| Corretor novo | R$ 420 mil nos 2 primeiros meses, depois R$ 750 mil |
| Vendas do Rafael | não contam |
| Venda rápida | 50% com recebimento no mês ou no seguinte |

---

## 3. Conflitos que precisam de decisão (mudam dinheiro)

| # | Conflito | Impacto |
|---|---|---|
| C1 ✅ | **DECIDIDO 23/10:** mantém os descontos do sistema — ISS 3% (quando a construtora retém) e DAS 6% — antes do % do corretor; o PDF será corrigido. Comissão: **5% em lançamento, 6% em imóvel de terceiros**; ao lançar a venda, o sistema pergunta qual é. ~~**Base da comissão do corretor.** PDF: comissão − 6% de nota = 4,7% do VGV. Sistema: comissão − ISS 3% − Simples 6% = 4,56% do VGV quando há ISS retido. | Por R$ 1 milhão a 50%: PDF R$ 23.500, sistema R$ 22.795 (R$ 705 a mais para o corretor pelo PDF). Quem absorve o ISS?~~ |
| C2 | **Meta do time para o bônus do gestor.** PDF: R$ 1 milhão × pessoas. Plano: soma das metas individuais (750 + 420/750). | Com o corretor novo: meta do time R$ 1,17 mi (meses 1-2) e R$ 1,5 mi depois. |
| C3 | **Nível do Dionata.** Pelo PDF, com R$ 5,87 mi em 2026 ele seria Pleno (45%). Hoje recebe 50%. | Tratar como Sênior por decisão da diretoria? |
| C4 ✅ | **DECIDIDO 23/10 (muda o PDF):** o Dionata, como gestor, recebe **3% fixo** sobre a base das vendas do time e **8%** quando o time bate a **meta geral**; os dois saem da parte da imobiliária (custo direto "Gestão de equipe"). Por R$ 1 mi do corretor novo: imobiliária R$ 25.986 (3%) ou R$ 23.707 (8%). ~~**Custo da gestão para a imobiliária.** 5% a 8% da comissão líquida do time saem da parte da imobiliária. | Por R$ 1 milhão do corretor novo (base do sistema): imobiliária fica com R$ 25.075 (gestão a 5%) ou R$ 23.707 (a 8%), contra R$ 27.354 sem gestor. |
| C5 | **"Venda efetivada" exige ato pago.** O sistema conta a venda na data do contrato. | Precisa de um campo "ato pago em" para metas e níveis. |
| C6 | **Previsões no DRE** (pendência de 22/10). | R$ 4.794,80 de lucro previsto da Urban Club em 2026 — parte dele já saiu com o cancelamento da 1204. |
| C7 | **VGV em parceria** para meta e nível: cheio ou proporcional à parte da Souza? | Muda o acumulado do Dionata. |


### 3.1 Decisões de 23/10/2026 (todas fechadas)

| # | Decisão |
|---|---|
| Comissão | 5% em lançamento, 6% em imóvel de terceiros; ao lançar, o sistema pergunta qual é |
| C1 | Base do corretor = comissão − ISS 3% (só quando retido na fonte) − DAS 6%; repasse = base × % − metade do brinde. O PDF será corrigido |
| C2 | A gestão de 8% libera quando a imobiliária bate a meta geral de R$ 1 milhão no mês, somando as vendas do Dionata e do time |
| C3 | Dionata é Sênior (50%) por decisão da diretoria |
| C4 | Gestão do Dionata: 3% fixo sobre a base das vendas do time, 8% com a meta geral batida; sai da parte da imobiliária; **não há gestão sobre as vendas dele**. Os % são campos editáveis |
| C5 | A venda conta na data do contrato (sem campo de ato pago) |
| C6 | DRE realizado só com comissão devida (nota, gatilho ou recebimento); o previsto sai do resultado e aparece à parte (CPC 47, restrição da contraprestação variável) |
| C7 | VGV = valor geral vendido, cheio, para metas e níveis. Novo indicador **VLV (Valor Líquido Vendido)** = proporcional à parte da Souza |
| ISS terceiros | Só quando retido na fonte; revenda paga por pessoa física desconta só o DAS |

---

## 4. Arquitetura proposta

### 4.1 Navegação (enxuta)

| Grupo | Itens |
|---|---|
| **Visão geral** | Painel · Atenção |
| **Dinheiro** | A receber · A pagar · Fluxo de caixa · Contas e movimentações |
| **Comercial** | Vendas e VGV · Comissões e repasses · Empreendimentos e construtoras |
| **Gestão** | DRE · Relatórios · Indicadores · Metas e orçamento · Cenários e ponto de equilíbrio · Marketing e ROI |
| **Administração** | Corretores e níveis · Categorias · Configurações · Usuários · Auditoria |
| **Corretor** | Meu painel · Minhas vendas · Minhas comissões · Minhas metas e nível |

### 4.2 Design system claro

Fundo branco e cinzas suaves, tipografia com dígitos tabulares, bordas finas,
cor só com propósito (positivo, negativo, previsão, atenção), sem degradê nem
sombra pesada. Os tokens vivem em `src/index.css` (`--c-*`), então a troca é
centralizada: novo tema claro como padrão, escuro opcional. O guia
`docs/souza-os*.md` será atualizado no mesmo commit.

### 4.3 Motor financeiro e dicionário de métricas

Uma camada só (`src/lib/metricas/`) com cada métrica documentada (nome,
finalidade, fórmula, fonte, regime, filtros, inclusão/exclusão, cancelamento,
limitações). Conceitos que **nunca** se somam entre si:

| Conceito | Fonte | Regime |
|---|---|---|
| VGV comercial | `sales.property_value`, venda efetivada | data do ato pago |
| Comissão contratada | `sales.commission_total` | data da venda |
| Receita reconhecida | parcela devida (nota/gatilho/recebimento) | competência |
| Faturado (nota) | `invoice_issued_date` | data da nota |
| A receber | parcelas não recebidas | vencimento |
| Recebido | `received_date` | caixa |
| Repasse devido / pago | `broker_tx_id` pendente / liquidado | competência / caixa |
| Gestão do gestor | nova (5% + bônus) | competência |
| Retido pela imobiliária | base − corretor − gestão | competência |
| Lucro operacional / líquido | DRE | competência |

Dinheiro em centavos inteiros nos cálculos novos (`Math.round(v * 100)`), como
já fazem os scripts.

### 4.4 DRE gerencial completo

A estrutura do prompt, sobre o motor atual: receita bruta → deduções → receita
líquida → custos diretos (corretores e gestão) → lucro bruto → despesas
variáveis → **margem de contribuição** → despesas fixas → **EBITDA** →
depreciação (sem dados: R$ 0 com aviso) → **EBIT** → resultado financeiro
(rendimentos e tarifas) → lucro líquido. Mês, trimestre, semestre e ano;
análise vertical e horizontal; comparação com orçamento; recolher e expandir;
exportar CSV, Excel e PDF.

### 4.5 Comissões e repasses

Ficha da venda com memória do cálculo (comissão → impostos → base → corretor →
gestor → imobiliária), cronograma, liquidações e repasses. **Ao lançar uma
venda**, o sistema identifica o time do corretor, diz se o Dionata é o gestor
daquela venda e calcula a gestão (5% na hora; os 3% de bônus no fechamento do
mês, se o time bater a meta).

### 4.6 Metas, níveis e orçamento

**Tudo editável, nada fixo no código (pedido do Rafael em 23/10/2026).** Uma
tela de configuração guarda, com data de vigência para não reescrever o
passado: % de gestão do gestor (hoje 3%) e % com a meta batida (hoje 8%);
níveis do corretor (40/45/50%) e os VGVs que mudam de nível (R$ 5 e 10
milhões, manutenção R$ 2,5 milhões); % de cada corretor; comissão padrão
(5% lançamento, 6% terceiros); ISS e DAS; metas da imobiliária e de cada
corretor. Mudar um % vale dali em diante; venda já lançada mantém o que foi
gravado nela.

Tela para preencher a meta da imobiliária e a de cada corretor (com a rampa de
R$ 420 mil). Nível de cada corretor calculado do VGV efetivado acumulado, com a
regra de manutenção. Rascunho já existe em `git stash` ("metas de VGV (041)").

---

## 5. Fases de execução

| Fase | Entrega | Mexe no banco? | Validação |
|---|---|---|---|
| **0** | Backup + valores de referência | não | ✅ feito em 23/10 |
| **1** | Regras de comissão (níveis, gestor), metas e cadastro de metas, gestor calculado no lançamento | aditivo: tabelas de metas, níveis e gestão | ✅ 23/10 (041, df5349a; brinde no repasse afd963a) |
| **2** | Design system claro + navegação nova | não | ✅ 23/10 (tema Mesa, 8dd6c23) |
| **3** | Painel executivo (saldo, recebido, a receber, resultado, a pagar, VGV, saúde, previsão de caixa, metas, atenção) | não | ✅ 23/10 (Início: resultado, a pagar, previsão de caixa, fôlego, meta) |
| **4** | Dinheiro: receber, pagar, fluxo (realizado/previsto/consolidado), contas | não | ✅ 23/10 (tela Contas com extrato; previsão no Fluxo de caixa; Bradesco PJ = R$ 7.391,60) |
| **5** | Comissões e repasses: relatórios e ficha com memória do cálculo | não | soma por corretor = razão |
| **6** | Relatórios, indicadores, ajuda contextual, exportação | não | totais exportados = tela |
| **7** | Área do corretor + revisão de RLS | políticas | teste com a chave pública e com login de corretor |
| **8** | Marketing e ROI, cenários, ponto de equilíbrio | aditivo: origem da venda, investimentos | — |
| **9** | Testes finais e aceite | não | os 17 critérios do prompt |

Cada fase: um ou mais commits na `main`, verificador + tipos + build antes do
push, conferência no navegador, reconciliação com os valores de referência.

---

## 6. O que depende de dados que não existem

| Recurso | Falta |
|---|---|
| ROI e CAC de marketing | origem de cada venda (canal/campanha); o CRM (icrm) não é tocado |
| Nível pelo VGV efetivado | data do ato pago |
| Liquidez, endividamento, ROE | balanço: ativos, passivos, patrimônio |
| Depreciação | cadastro de bens |
| Conciliação bancária | extrato importado |
| Anexos (contrato, nota) | armazenamento de arquivos |

Esses indicadores aparecerão como **"Dados insuficientes"**, dizendo o que
falta, nunca como zero.
