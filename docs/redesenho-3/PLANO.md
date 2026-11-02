# Souza 3.0: plano do redesenho

*02/11/2026 · pedido do Rafael: "refaça todo o design e o layout, mude tudo… fácil de mexer, fluido, poucos cliques, minimalista, objetivo, lindo, animado, claro"*

Protótipo navegável: [`prototipo.html`](prototipo.html). Com o `npm run dev` ligado, abra `http://localhost:5173/docs/redesenho-3/prototipo.html`. Ele usa os dados de exemplo da vitrine e não grava nada.
Antes e depois: `antes-1440.jpg` × `depois-1440.jpg`, `antes-390.jpg` × `depois-390.jpg`.

Nada de banco, cálculo, regra ou vocabulário muda. "Devido agora" continua com a definição de hoje, porque essa regra segue pendente.

---

## 1. O que muda, em seis decisões

1. **Cada tela responde uma pergunta logo abaixo do título.** O Início não abre com "Boa noite" e sim com "4 coisas pedem você hoje · o caixa cobre 15,7 meses de estrutura". O número maior da tela é o que responde essa frase: o saldo.
2. **A cor fica só nos números que importam.** Menu, botões e moldura não levam cor. O botão principal é preto. O marinho da Souza aparece só no dado principal de cada tela (a linha do caixa, a parte que fica com a Souza). Verde e vermelho indicam se um número está bom ou ruim. Âmbar marca só o que está "em atraso" com a construtora.
3. **Menos cliques:**
   - Um botão **Novo lançamento** (tecla **N**) para tudo. Para lançar uma despesa: N → D → valor → Enter, com categoria, data e conta já preenchidas.
   - **A ação fica na linha.** "Recebi" confirma na própria linha (valor e conta já preenchidos), sem abrir outra tela.
   - **Desfazer no lugar de "tem certeza?"**: toda ação mostra um aviso com Desfazer por 5 segundos.
   - **O detalhe abre numa gaveta lateral**, sem sair da lista. Para fechar, Esc ou clique fora.
   - **⌘K** leva a qualquer tela, venda ou ação.
4. **A animação mostra o que mudou:** os números rolam até o valor novo quando você troca o mês ou lança algo, a linha do caixa se desenha, a régua da comissão se preenche, a gaveta desliza e o item concluído some da lista. Tudo desliga quando o aparelho pede movimento reduzido.
5. **Letra nova (Geist)** com números alinhados em coluna. O "R$" fica menor e cinza, para o valor aparecer primeiro.
6. **No celular**, a barra do polegar fica embaixo e o botão + no topo. As tabelas viram linhas, com a situação ("em atraso · 18 d") no subtítulo.

## 2. O Início novo

| Bloco | Que pergunta responde |
|---|---|
| Faixa de saldos (Saldo hoje em destaque, Comissões a receber, Contas a pagar, Resultado do mês) | Quanto tenho e como está o mês? |
| **Caixa previsto, 6 meses** (linha do saldo + tabela "Entra / Sai" alinhada aos meses) | Vou ter dinheiro sem venda nova? |
| **Pede você** (repassar ao corretor, imposto vencido, nota a emitir, cobrar construtora), com o botão da ação em cada item | O que eu preciso fazer agora? |
| Próximos recebimentos (4 parcelas e "Ver as 7") | O que a construtora vai pagar? |
| **Régua da comissão** (fica com a Souza, corretores, impostos) | Para onde vai cada real de comissão? |

**Saem do Início** e vão para onde já fazem sentido: Evolução de 12 meses (Relatórios), Desempenho e meta de VGV (Metas), Orçamento do mês (Despesas), Nota fiscal (vira item do "Pede você"), Entra para você (Minhas comissões).

## 3. O que acontece com cada tela

- **A receber:** filtros (Todas · Em atraso · Novembro · Depois) com contagem, "Recebi" na linha, gaveta com a cascata da parcela (ISS → Simples → corretor → fica com a Souza) e as parcelas da venda. A **Agenda de recebimentos** passa a ser o botão "Ver no calendário" dentro de A receber, e o menu perde esse item.
- **A pagar e Despesas:** a mesma tabela, com "Paguei" na linha e Desfazer.
- **Vendas e Venda:** tabela com gaveta. A ficha completa da venda leva a cascata no topo.
- **Contas:** a faixa de saldos por conta e o extrato em tabela.
- **Relatórios, DRE e Fluxo:** demonstrativos em tabela, com o gráfico do Fluxo no novo estilo de linha.
- **Metas, Projeções e Corretores:** as mesmas peças (título com frase, faixa, tabela, gaveta).
- **Configurações:** duas colunas, com a explicação à esquerda e os campos à direita.
- **Área do corretor e login:** a mesma casca e as mesmas peças.

## 4. Fases da execução

1. **Fundação:** tokens, Geist, casca (menu, topo do celular, barra do polegar) e as peças base (Título com frase, Faixa de saldos, Cartão, Tabela com ação na linha, Gaveta, Aviso com Desfazer, Novo lançamento, ⌘K). Também ajustar o `verificar-design.mjs` às regras novas.
2. **Início, A receber e A pagar**, as telas de todo dia.
3. **Vendas, Venda, Despesas e Contas.**
4. **Relatórios, Metas, Projeções, Corretores e Configurações.**
5. **Área do corretor e login.**
6. **Conferência:** todas as telas a 1440, 820 e 375, antes e depois, verificador, `tsc` e build, com um commit por fase.

## 5. Para decidir antes de executar

1. **A direção visual** (claro, chrome sem cor, botão preto, marinho só no dado principal) está aprovada?
2. **O Início enxuto** pode ficar como na seção 2, com os blocos que saem indo para as outras telas?
3. **A Agenda de recebimentos** pode virar a vista "calendário" dentro de A receber?
4. **As ações de um clique** ("Pagar", "Emitida", "Cobrar", "Recebi") podem gravar direto, com Desfazer, em vez de abrir um formulário de confirmação?
5. **A letra** passa a ser Geist, ou fica a Inter?
