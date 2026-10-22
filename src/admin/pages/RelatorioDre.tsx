import { useMemo, useState } from 'react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Heroi } from '@/components/ui/Heroi'
import { Cartao } from '@/components/ui/Cartao'
import { Linha } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { ContaDoRelatorio, FiltrosDePeriodo, variacaoEmPalavras } from '../RelatorioPecas'
import { dreGroupOf } from '@/lib/finance'
import {
  competenciaNoDre,
  contaDoDre,
  montarDre,
  noPeriodo,
  periodosDoDre,
  type LinhaDoDre,
  type PeriodoDre,
  type TipoPeriodo,
} from '@/lib/dre'
import { formatCurrency, formatDate } from '@/lib/format'
import type { Transaction } from '@/types'

/*
 * DRE — a demonstração do resultado da imobiliária (22/10/2026).
 *
 * Sempre por competência: mostra quanto a empresa GANHOU no período, com a
 * comissão contada quando fica devida (gatilho e nota), não quando o
 * dinheiro cai. O dinheiro que de fato entrou e saiu é o outro relatório, o
 * Fluxo de caixa. Os dois juntos dizem se a imobiliária dá lucro e se tem
 * caixa — decisão do Rafael em 22/10/2026.
 *
 * Feita para ler de cima para baixo sem saber contabilidade: o herói diz
 * quanto sobrou, a conta abaixo mostra como se chegou nele, linha por linha,
 * em palavras simples, e o último cartão compara com o período anterior.
 *
 * Os números vêm inteiros de `montarDre` (lib/dre.ts), que só abre o que
 * `computeKpis` já somou. Esta tela não soma nada por fora. Todo valor abre
 * nos lançamentos que o formam, e o lançamento de venda leva à venda.
 */

/** A frase curta embaixo de cada linha principal: o que ela é, sem jargão. */
const EM_PALAVRAS: Record<string, string> = {
  bruta: 'Tudo o que a imobiliária faturou',
  impostos: 'Simples Nacional e ISS sobre a comissão',
  liquida: 'O que fica depois dos impostos',
  corretores: 'A parte de cada corretor nas vendas',
  bruto: 'O que sobra das vendas para pagar a estrutura',
  despesas: 'Marketing, brindes, sistemas e estrutura',
  liquido: 'O resultado da imobiliária. Não é saldo em conta',
  distribuicao: 'O que o sócio retirou',
  retido: 'O que fica na imobiliária depois das retiradas',
}

export function RelatorioDre() {
  const { transactions, installments, mes } = useAdmin()
  const { abrir } = useComposicao()
  const [tipo, setTipo] = useState<TipoPeriodo>('mes')

  const parcelas = useMemo(() => new Map(installments.map((p) => [p.id, p])), [installments])
  const dataDoRegime = (t: Transaction): string => competenciaNoDre(t, parcelas)

  const periodos = useMemo(() => periodosDoDre(mes, tipo), [mes, tipo])
  const doPeriodo = (p: PeriodoDre) => transactions.filter((t) => noPeriodo(dataDoRegime(t).slice(0, 7), p))

  const { atual, anterior, temPrevisto } = useMemo(
    () => {
      const txs = doPeriodo(periodos.atual)
      return {
        // Conta folha zerada não ocupa linha; total nunca some.
        atual: montarDre(txs).filter((l) => l.tipo !== 'conta' || l.valor !== 0),
        anterior: new Map(montarDre(doPeriodo(periodos.anterior)).map((l) => [l.id, l.valor])),
        temPrevisto: txs.some((t) => t.status !== 'settled'),
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, parcelas, periodos],
  )
  const valorDe = (id: string) => atual.find((l) => l.id === id)?.valor ?? 0
  const linhaDe = (id: string) => atual.find((l) => l.id === id)!

  const bruta = valorDe('bruta')
  const liquido = valorDe('liquido')
  const saiu = -(valorDe('impostos') + valorDe('corretores') + valorDe('despesas'))
  const distribuicao = -valorDe('distribuicao')

  /* ------------------------------------------------------------ abrir */

  const frase = (t: Transaction) => {
    if (t.status === 'settled') {
      const d = t.settled_date ?? t.competence_date
      return `${dreGroupOf(t) === 'revenue' ? 'recebido' : 'pago'} em ${formatDate(d)}`
    }
    return `previsto para ${formatDate(t.due_date ?? t.competence_date)}`
  }

  /** A linha aberta nos lançamentos do período; receita positiva, o resto negativo, como na conta. */
  const abrirLinha = (l: LinhaDoDre, p: PeriodoDre, total: number) => {
    const nome = l.rotulo.replace('(−) ', '')
    abrir({
      rotulo: nome,
      titulo: `${nome} · ${p.rotulo}`,
      explica: l.explica,
      total,
      itens: doPeriodo(p)
        .filter((t) => l.contas.includes(contaDoDre(t)))
        .sort((a, b) => dataDoRegime(a).localeCompare(dataDoRegime(b)))
        .map((t) => ({
          id: t.id,
          titulo: t.description || t.category,
          meta: `${frase(t)} · ${t.category}`,
          valor: dreGroupOf(t) === 'revenue' ? t.amount : -t.amount,
          para: t.sale_id ? `/vendas/${t.sale_id}` : undefined,
        })),
      vazio: 'Nenhum lançamento neste período.',
    })
  }

  /** O que saiu (impostos + corretores + despesas) como uma linha só, para o apoio do herói. */
  const linhaSaiu: LinhaDoDre = {
    id: 'saiu',
    rotulo: 'Saiu',
    tipo: 'grupo',
    valor: -saiu,
    contas: ['impostos', 'corretores', 'comerciais', 'administrativas', 'pessoal'],
    explica: 'Impostos sobre o faturamento, comissão dos corretores e despesas da imobiliária no período.',
  }

  /* ------------------------------------------------------------ texto */

  const fraseDoHeroi =
    bruta > 0 ? (
      <>
        De cada R$ 100,00 faturados, sobraram{' '}
        <strong className="font-semibold text-t1">{formatCurrency(Math.max(0, (liquido / bruta) * 100))}</strong>.
      </>
    ) : (
      <>Nenhuma comissão ficou devida neste período.</>
    )

  const rotuloHeroi = `Lucro líquido · ${periodos.atual.rotulo}`
  const heroiComum = {
    valor: liquido,
    rotuloAcessivel: `Ver os lançamentos que formam o lucro líquido de ${periodos.atual.rotulo}`,
    aoAbrir: () => abrirLinha(linhaDe('liquido'), periodos.atual, liquido),
    frase: fraseDoHeroi,
    apoios: [
      {
        rotulo: 'Entrou',
        valor: bruta,
        rotuloAcessivel: 'Ver o que entrou',
        aoAbrir: () => abrirLinha(linhaDe('bruta'), periodos.atual, bruta),
      },
      {
        rotulo: 'Saiu',
        valor: -saiu,
        rotuloAcessivel: 'Ver o que saiu',
        aoAbrir: () => abrirLinha(linhaSaiu, periodos.atual, -saiu),
      },
      {
        rotulo: 'Retirado pelo sócio',
        valor: -distribuicao,
        rotuloAcessivel: 'Ver as retiradas do sócio',
        aoAbrir: () => abrirLinha(linhaDe('distribuicao'), periodos.atual, -distribuicao),
      },
      // Apoio zerado não aparece: abriria uma folha vazia.
    ].filter((a) => a.valor !== 0),
  }

  /* --------------------------------------------------- comparação */

  const comparar = [
    { id: 'bruta', rotulo: 'Faturamento', custo: false },
    { id: 'liquido', rotulo: 'Lucro líquido', custo: false },
    { id: 'despesas', rotulo: 'Despesas da imobiliária', custo: true },
  ]

  return (
    <PageLayout
      subtitulo="Quanto entrou, quanto saiu e quanto sobrou para a imobiliária."
      faixa={<FiltrosDePeriodo ativo={tipo} aoMudar={setTipo} />}
    >
      {/*
       * Período com parcela que ainda não ficou devida inclui previsão: aí o
       * herói é previsão, rotulado e nunca ouro (regra de 13/09).
       */}
      {temPrevisto ? (
        <Heroi variante="previsto" rotulo={`${rotuloHeroi} · inclui o previsto`} {...heroiComum} />
      ) : liquido < 0 ? (
        <Heroi variante="ouro" estado="negativo" rotulo={rotuloHeroi} {...heroiComum} />
      ) : (
        <Heroi variante="ouro" rotulo={rotuloHeroi} {...heroiComum} />
      )}

      <Cartao>
        <Cartao.Cabecalho
          titulo="Como chegamos nesse número"
          meta="A comissão conta quando fica devida (gatilho e nota), não quando o dinheiro cai. Toque em qualquer valor para ver os lançamentos."
        />
        <Cartao.Corpo>
          <ContaDoRelatorio
            linhas={atual}
            base={bruta}
            emPalavras={EM_PALAVRAS}
            aoAbrir={(l) => abrirLinha(l, periodos.atual, l.valor)}
            rotuloAcessivel={`DRE de ${periodos.atual.rotulo}`}
          />
        </Cartao.Corpo>
      </Cartao>

      <Cartao>
        <Cartao.Cabecalho titulo={`Comparado com ${periodos.anterior.rotulo}`} />
        <Cartao.Lista colunas={{ valor: true, fim: true }} rotuloAcessivel="Comparação com o período anterior">
          {comparar.map((c) => {
            const agora = valorDe(c.id)
            const antes = anterior.get(c.id) ?? 0
            return (
              <Linha
                key={c.id}
                titulo={c.rotulo}
                meta={`${periodos.anterior.rotulo}: ${formatCurrency(antes)} · ${variacaoEmPalavras(agora, antes, c.custo)}`}
                valor={<Valor valor={agora} posto="linha" estado={agora < 0 ? 'negativo' : undefined} />}
                aoClicar={() => abrirLinha(linhaDe(c.id), periodos.anterior, antes)}
              />
            )
          })}
        </Cartao.Lista>
      </Cartao>
    </PageLayout>
  )
}
