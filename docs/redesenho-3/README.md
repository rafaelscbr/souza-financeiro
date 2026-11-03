# Souza 3.0: o que foi feito

*02/11/2026 · executado a partir do [PLANO.md](PLANO.md), aprovado pelo Rafael com "Executa"*

Banco, cálculos, regras e vocabulário ficaram intactos. "Devido agora" manteve a definição de antes.

## Fundação (vale para todas as telas)

- **Letra Geist** no lugar da Inter, com algarismos alinhados em coluna em todo o sistema.
- **Cores do "livro-razão"** (`src/index.css`, `html.light`):
  - O chão é cinza-azulado `#F2F4F7` e as caixas são brancas, com fio de 1px e sem sombra.
  - O botão principal é tinta `#0B1220`. O marinho `#2848A8` vai só no dado principal.
  - Verde e vermelho dizem bom ou ruim. Âmbar é só "em atraso".
  - O chip de "prevista" é cinza, e os quadradinhos tingidos atrás dos ícones saíram.
- **Menu:**
  - Fica no mesmo chão da página. O item ativo é uma pílula cinza.
  - Os contadores aparecem por extenso: "2 em atraso" (âmbar) e "8 esperando" (vermelho).
  - Sem rótulo, no alto: Início, Vendas, A receber, A pagar, Despesas e Contas. Em Gestão: Relatórios, Metas, Projeções e Corretores.
- **No computador, a barra de cima saiu.** Título, frase do que importa, mês, sino e "Novo lançamento" ficam numa linha só. Na ficha, o "voltar" fica acima do título. No celular, a barra fixa continua.
- **Novo lançamento (tecla N), em todas as telas:** abre a escolha entre despesa (D), recebimento (R), venda (V) e pagamento (P).
- **Baixa na linha:** "Recebi" e "Paguei" passam a "Confirmar" e gravam, com Desfazer no aviso. O "⋯" abre o painel completo. Os padrões são os mesmos do painel. O repasse de comissão do corretor continua no painel dele, por causa do ajuste do brinde.
- **Os números rolam** até o valor novo quando mudam (`useRolagem`), e as barras se preenchem ao abrir. Tudo desliga com "reduzir movimento".
- **Peças novas** em `components/ui` e `components/graficos`: `FaixaDeMetricas` com célula líder, `ListaDeAcoes`, `Regua`, `FolhaDeEscolha`, `GraficoCaixaPrevisto`, `GraficoAnoEmBarras` e `BaixaNaLinha` (em `admin`).
- **Login:** o painel da marca virou tinta chapada, sem degradê.

## Telas recompostas

- **Início (admin):**
  - A frase diz quantas coisas pedem você e quantos meses o caixa cobre.
  - A faixa de saldos tem o Saldo hoje como número líder.
  - Caixa previsto para 6 meses: a linha do saldo e, embaixo, o que entra e sai em cada mês.
  - "Pede você", com o botão de cada item.
  - Próximos recebimentos e a régua da comissão.
  - Saíram do Início: Evolução 12 meses (Relatórios › Fluxo), Desempenho (Metas), Orçamento (agora em Despesas), Nota fiscal (virou item do "Pede você") e Pessoa física (Minhas comissões).
- **A receber:**
  - A frase traz o previsto e o que está em atraso.
  - Botão "Ver no calendário", que leva à antiga Agenda.
  - O total clicável fica no cabeçalho da lista, com "Recebi" na linha.
- **A pagar:** "Paguei" na linha para imposto e despesa.
- **Despesas:** recebeu o cartão do orçamento do mês.
- **Início do corretor:**
  - A frase traz o que está liberado para ele e o próximo recebimento.
  - A faixa tem o "Liberada, a receber" como número líder.
  - O ano aparece em barras: recebida em marinho, liberada em tinta, prevista em cinza.
  - "Próximos passos", a régua "Quanto já caiu" e a produção.

Segunda leva (02/11/2026, depois de "tem coisas que ainda não mudou"): todas as outras telas foram recompostas pelo [GUIA-DE-TELA.md](GUIA-DE-TELA.md). Cada uma ganhou a frase no título, uma faixa com o número líder no lugar do herói e cartões com uma pergunta cada.

- **Vendas:** "Próxima ação" e a régua "De quem é a carteira".
- **Ficha da venda:** "A conta da comissão" no alto.
- **Despesas:** "Paguei" na linha.
- **Contas:** o extrato ao lado do fechamento do mês.
- **A pagar:** uma faixa com devido, comissão, imposto e despesas.
- **Agenda:** o calendário em marinho, âmbar e cinza.
- **Relatórios:** a biblioteca virou listas por pergunta, e DRE, Fluxo e os outros ganharam faixa e régua.
- **Fluxo de caixa:** um gráfico novo de 12 meses.
- **Projeções:** os campos à esquerda e os resultados à direita.
- **Metas:** a meta do mês como líder, com barra.
- **Corretores:** "Por corretor" e "Acessos".
- **Configurações:** 4 abas em vez de 7, com Cadastros juntando contas, construtoras, empreendimentos e categorias, em duas colunas.
- **Corretor:** Minhas vendas, Recebimentos (o ano em barras) e Metas e nível.
- **Menu:** "Minhas comissões" virou um item só no rodapé.

## O que não mudou

- O tema escuro continua com os tokens antigos. O sistema abre no claro.
- As regras de "devido agora", de "em atraso" × "vencida" e da cascata da parcela.
