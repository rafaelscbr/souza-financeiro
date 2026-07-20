/**
 * Glossário do sistema. Cada verbete tem: o que é, por que importa e um
 * exemplo com números de imobiliária — porque conceito financeiro só entra
 * quando a pessoa vê a conta acontecendo com o dinheiro dela.
 */
export interface GlossaryEntry {
  id: string
  term: string
  /** Termos alternativos para a busca encontrar. */
  aliases?: string[]
  group: GlossaryGroup
  what: string
  why: string
  example?: string
}

export type GlossaryGroup =
  | 'Como o sistema conta o dinheiro'
  | 'O resultado da empresa'
  | 'Decisão e planejamento'
  | 'Contas e caixa'

export const GLOSSARY: GlossaryEntry[] = [
  // ---------------------------------------------------------------------
  {
    id: 'regime',
    term: 'Regime de caixa × competência',
    aliases: ['caixa', 'competência', 'regime'],
    group: 'Como o sistema conta o dinheiro',
    what: 'São duas formas de decidir em qual mês um lançamento conta. No regime de caixa, ele conta no mês em que o dinheiro se move. No de competência, no mês em que o negócio aconteceu.',
    why: 'Sem escolher um dos dois, você não sabe se está olhando o que produziu ou o que recebeu. É a chave no topo da tela, e ela muda todos os números.',
    example:
      'Você fecha uma venda em julho e recebe a comissão em setembro. Em CAIXA, ela aparece em setembro. Em COMPETÊNCIA, aparece em julho, marcada como “a receber”.',
  },
  {
    id: 'competencia-data',
    term: 'Data de competência',
    aliases: ['competencia'],
    group: 'Como o sistema conta o dinheiro',
    what: 'A data em que o negócio aconteceu — a assinatura do contrato, a prestação do serviço. Não é a data do pagamento.',
    why: 'É o que o contador usa para apurar imposto e o que mostra o desempenho real do mês, sem distorção de prazo de pagamento.',
  },
  {
    id: 'liquidado',
    term: 'Liquidado, a receber, a pagar, vencido',
    aliases: ['pendente', 'baixa', 'atrasado'],
    group: 'Como o sistema conta o dinheiro',
    what: 'Liquidado é o que já entrou ou saiu da conta. A receber e a pagar são compromissos com data prevista. Vencido é o compromisso cuja data passou e ninguém deu baixa.',
    why: 'Só o liquidado vira saldo. Confundir compromisso com dinheiro em conta é a forma mais comum de uma empresa lucrativa quebrar.',
    example:
      'Clique no ✓ ao lado de um lançamento pendente para dar baixa: você informa a data e a conta, e ele vira saldo.',
  },

  // ---------------------------------------------------------------------
  {
    id: 'receita-bruta',
    term: 'Receita bruta',
    aliases: ['faturamento'],
    group: 'O resultado da empresa',
    what: 'Tudo que você faturou, antes de qualquer desconto. Na imobiliária é a comissão cheia da venda.',
    why: 'É a base de cálculo do imposto no Simples Nacional. Mesmo que metade vá para o corretor, o imposto incide sobre o valor inteiro.',
    example:
      'Venda de R$ 500.000 com 6% de comissão = R$ 30.000 de receita bruta. É sobre esses R$ 30.000 que o DAS é calculado — não sobre a sua metade.',
  },
  {
    id: 'deducoes',
    term: 'Deduções da receita',
    aliases: ['imposto', 'simples nacional', 'das', 'aliquota'],
    group: 'O resultado da empresa',
    what: 'Os impostos que incidem sobre o faturamento: no Simples Nacional, o DAS. Saem da receita bruta antes de qualquer conta de lucro.',
    why: 'Sem essa linha, o lucro que aparece na tela é maior do que o que existe na sua conta.',
    example:
      'Alíquota efetiva de 8% sobre R$ 30.000 = R$ 2.400 de imposto. Configure a sua em Relatórios → Configuração tributária.',
  },
  {
    id: 'aliquota-efetiva',
    term: 'Alíquota efetiva',
    aliases: ['aliquota', 'pgdas'],
    group: 'O resultado da empresa',
    what: 'O percentual que você realmente paga de imposto sobre o faturamento — não o da tabela do Simples, que é o nominal.',
    why: 'A tabela do Simples tem faixas e deduções. A alíquota efetiva já considera tudo isso e é sempre menor que a nominal.',
    example:
      'Pegue o DAS pago e divida pela receita do mês. Ou consulte direto: Receita Federal → Simples Nacional → PGDAS-D → extrato do período.',
  },
  {
    id: 'csp',
    term: 'Custo dos Serviços Prestados (CSP)',
    aliases: ['comissão de corretor', 'repasse', 'custo direto'],
    group: 'O resultado da empresa',
    what: 'O gasto que só existe porque houve venda. Na imobiliária, é a comissão paga ao corretor.',
    why: 'Muita gente chama de “repasse” e acha que não é custo. É custo, sim — e é o maior deles. Repasse de verdade seria dinheiro que só transita por você e é faturado por outra pessoa.',
    example:
      'Comissão de R$ 30.000, corretor fica com 50% = R$ 15.000 de CSP. Esse valor reduz seu lucro, mas não reduz sua base de imposto.',
  },
  {
    id: 'lucro-bruto',
    term: 'Lucro bruto',
    group: 'O resultado da empresa',
    what: 'O que sobra depois de tirar o imposto e o custo direto. É o dinheiro disponível para pagar a estrutura da empresa.',
    why: 'Mostra se o seu modelo de negócio funciona antes de considerar despesas fixas. Lucro bruto baixo significa que o problema está na precificação ou na comissão, não no aluguel.',
    example: 'R$ 30.000 − R$ 2.400 de imposto − R$ 15.000 de corretor = R$ 12.600 de lucro bruto.',
  },
  {
    id: 'despesa-fixa-variavel',
    term: 'Despesa fixa × variável',
    aliases: ['custo fixo', 'custo variável'],
    group: 'O resultado da empresa',
    what: 'Fixa é a que você paga independente de vender: aluguel, salário, contador, sistema. Variável acompanha o movimento: anúncio, comissão, taxa.',
    why: 'É a separação que permite responder “quanto sobra se eu faturar X”. Sem ela, qualquer projeção é chute.',
  },
  {
    id: 'ebitda',
    term: 'EBITDA',
    group: 'O resultado da empresa',
    what: 'O resultado da operação antes de juros, impostos sobre lucro, depreciação e amortização. Na prática, o quanto o negócio gera de caixa operando.',
    why: 'É o número que investidor e banco olham, porque mostra a operação limpa de decisões financeiras e contábeis.',
  },
  {
    id: 'lucro-liquido',
    term: 'Lucro líquido e margem líquida',
    aliases: ['margem'],
    group: 'O resultado da empresa',
    what: 'O que sobra no fim de tudo. A margem líquida é esse valor dividido pela receita bruta.',
    why: 'Responde “de cada R$ 100 que entram, quanto é meu de verdade”. É o indicador mais honesto da saúde do negócio.',
    example: 'R$ 12.600 de lucro bruto − R$ 8.000 de estrutura = R$ 4.600. Margem líquida = 15,3%.',
  },
  {
    id: 'prolabore',
    term: 'Pró-labore × distribuição de lucros',
    aliases: ['retirada', 'prolabore', 'dividendo'],
    group: 'O resultado da empresa',
    what: 'Pró-labore é o salário do sócio pelo trabalho que ele faz. Distribuição de lucros é o retorno pelo capital investido.',
    why: 'São coisas diferentes e ficam em lugares diferentes. Pró-labore é despesa e entra antes do lucro; distribuição sai depois. Somar os dois esconde o custo real de operar.',
    example:
      'Se você tirasse R$ 8.000 por mês e chamasse tudo de “retirada”, a empresa pareceria mais lucrativa do que é — porque o seu trabalho estaria saindo de graça no papel.',
  },
  {
    id: 'lucro-retido',
    term: 'Lucro retido',
    group: 'O resultado da empresa',
    what: 'O lucro que ficou na empresa depois de você retirar a sua parte.',
    why: 'É o que financia crescimento sem empréstimo. Empresa que distribui 100% do lucro todo mês nunca acumula capital para crescer nem para aguentar um ano ruim.',
  },

  // ---------------------------------------------------------------------
  {
    id: 'margem-contribuicao',
    term: 'Margem de contribuição',
    group: 'Decisão e planejamento',
    what: 'Quanto de cada real faturado sobra depois dos custos variáveis, para pagar os custos fixos e virar lucro.',
    why: 'É o motor do simulador. Com ela você calcula ponto de equilíbrio e sabe quanto precisa vender para bancar qualquer despesa nova.',
    example:
      'Se de cada R$ 100 faturados sobram R$ 42 depois de imposto, corretor e marketing, sua margem de contribuição é 42%.',
  },
  {
    id: 'ponto-equilibrio',
    term: 'Ponto de equilíbrio',
    aliases: ['break even', 'equilibrio'],
    group: 'Decisão e planejamento',
    what: 'O faturamento mínimo para não ter prejuízo — onde o resultado é exatamente zero.',
    why: 'É o número mais importante que um dono precisa saber de cor. Abaixo dele você está pagando para trabalhar.',
    example:
      'Custo fixo de R$ 8.000 com margem de contribuição de 42% → ponto de equilíbrio = 8.000 ÷ 0,42 = R$ 19.048 por mês.',
  },
  {
    id: 'reserva',
    term: 'Reserva de emergência',
    aliases: ['runway', 'caixa mínimo'],
    group: 'Decisão e planejamento',
    what: 'Dinheiro guardado suficiente para bancar os custos fixos por alguns meses sem faturar nada.',
    why: 'Comissão é receita irregular. Três meses de custo fixo guardados é o piso para assumir qualquer compromisso novo com segurança.',
  },
  {
    id: 'objetivo',
    term: 'Objetivo com custo',
    aliases: ['meta', 'sala comercial'],
    group: 'Decisão e planejamento',
    what: 'Algo que você quer conquistar, com o custo de entrada e o custo mensal informados.',
    why: 'O sistema cruza com o seu resultado real e responde três coisas: cabe no orçamento? quanto preciso faturar para sustentar? em quantos meses fica seguro?',
    example:
      'Alugar uma sala: R$ 6.000 de caução (entrada) + R$ 2.500 por mês. O sistema julga contra o seu PIOR mês, não a média — porque é no mês fraco que o compromisso quebra.',
  },

  // ---------------------------------------------------------------------
  {
    id: 'conta',
    term: 'Conta',
    aliases: ['banco', 'saldo inicial'],
    group: 'Contas e caixa',
    what: 'Onde o dinheiro fica de verdade: cada banco, a caixinha em espécie, os investimentos.',
    why: 'Sem conta cadastrada o sistema conhece o movimento mas não o patrimônio. O saldo inicial é o que faz o número passar a bater com o extrato.',
    example:
      'Ao cadastrar, abra o app do banco e copie o saldo atual. Movimentos anteriores à data informada são ignorados, porque já estão dentro desse saldo.',
  },
  {
    id: 'transferencia',
    term: 'Transferência',
    group: 'Contas e caixa',
    what: 'Dinheiro movido entre contas suas — da conta corrente para a poupança, por exemplo.',
    why: 'Não é receita nem despesa e não pode aparecer no resultado. Se você lançar como despesa, seu lucro fica artificialmente menor.',
  },
  {
    id: 'sem-conta',
    term: 'Lançamento sem conta',
    group: 'Contas e caixa',
    what: 'Um lançamento já liquidado, mas em que você ainda não indicou de qual conta o dinheiro saiu ou entrou.',
    why: 'Ele fica de fora do saldo total de propósito — somá-lo daria um total que não corresponde a banco nenhum. O aviso na tela de Contas mostra quantos faltam classificar.',
  },
  {
    id: 'extrato',
    term: 'Extrato',
    group: 'Contas e caixa',
    what: 'A lista de movimentos de uma conta, do mais antigo ao mais recente, com o saldo acumulado a cada linha.',
    why: 'É o formato que permite conferir contra o extrato do banco linha a linha e achar exatamente onde a diferença começou.',
  },
]

export const GLOSSARY_GROUPS: GlossaryGroup[] = [
  'Como o sistema conta o dinheiro',
  'O resultado da empresa',
  'Decisão e planejamento',
  'Contas e caixa',
]

/** Busca por termo, apelido ou conteúdo. */
export function searchGlossary(query: string): GlossaryEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return GLOSSARY
  return GLOSSARY.filter((e) => {
    const hay = [e.term, ...(e.aliases ?? []), e.what, e.why, e.example ?? '']
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}
