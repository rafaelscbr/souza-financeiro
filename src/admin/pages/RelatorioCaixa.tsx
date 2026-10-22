import { useMemo, useState } from 'react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Heroi } from '@/components/ui/Heroi'
import { Cartao } from '@/components/ui/Cartao'
import { Linha } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { Dica } from '@/components/ui/Dica'
import { ContaDoRelatorio, FiltrosDePeriodo, variacaoEmPalavras } from '../RelatorioPecas'
import { dreGroupOf } from '@/lib/finance'
import { periodosDoDre, type PeriodoDre, type TipoPeriodo } from '@/lib/dre'
import { montarFluxoDeCaixa, type LinhaDoCaixa } from '@/lib/fluxoDeCaixa'
import { formatCurrency, formatDate } from '@/lib/format'
import type { Transaction } from '@/types'

/*
 * FLUXO DE CAIXA — o dinheiro de verdade (22/10/2026).
 *
 * O par do DRE: lá, quanto a imobiliária ganhou; aqui, quanto dinheiro
 * entrou e saiu das contas dela, e com quanto ela começou e terminou. Os
 * números vêm de `montarFluxoDeCaixa` (lib/fluxoDeCaixa.ts), que fecha com o
 * saldo do banco por construção. Todo valor abre no que o forma.
 */

const EM_PALAVRAS: Record<string, string> = {
  'saldo-inicial': 'O dinheiro em conta na véspera do período',
  recebimentos: 'O dinheiro que entrou nas contas',
  pagamentos: 'O dinheiro que saiu para tocar o negócio',
  gerado: 'O caixa que o próprio negócio produziu',
  retiradas: 'O que o sócio tirou da empresa',
  transferencias: 'Fatura do cartão e outras contas',
  abertura: 'Conta que começou no sistema neste período',
  variacao: 'Quanto o dinheiro em conta subiu ou desceu',
  'saldo-final': 'O dinheiro em conta no último dia do período',
}

export function RelatorioCaixa() {
  const { transactions, accounts, transfers, mes } = useAdmin()
  const { abrir } = useComposicao()
  const [tipo, setTipo] = useState<TipoPeriodo>('mes')

  const periodos = useMemo(() => periodosDoDre(mes, tipo), [mes, tipo])
  const fluxoDe = (p: PeriodoDre) => montarFluxoDeCaixa({ accounts, transactions, transfers, periodo: p })
  const atual = useMemo(() => fluxoDe(periodos.atual), [accounts, transactions, transfers, periodos]) // eslint-disable-line react-hooks/exhaustive-deps
  const anterior = useMemo(() => fluxoDe(periodos.anterior), [accounts, transactions, transfers, periodos]) // eslint-disable-line react-hooks/exhaustive-deps

  const valorDe = (id: string, f = atual) => f.linhas.find((l) => l.id === id)?.valor ?? 0
  const linhaDe = (id: string, f = atual) => f.linhas.find((l) => l.id === id)!

  // Conta zerada e linha que não se aplica (abertura, transferência) não ocupam lugar.
  const linhas = atual.linhas.filter(
    (l) => !(l.valor === 0 && (l.tipo === 'conta' || l.id === 'abertura' || l.id === 'transferencias')),
  )

  /* ------------------------------------------------------------ abrir */

  const frase = (t: Transaction) =>
    `${dreGroupOf(t) === 'revenue' ? 'recebido' : 'pago'} em ${formatDate(t.settled_date ?? t.competence_date)}`
  const itens = (txs: Transaction[]) =>
    [...txs]
      .sort((a, b) => (a.settled_date ?? a.competence_date).localeCompare(b.settled_date ?? b.competence_date))
      .map((t) => ({
        id: t.id,
        titulo: t.description || t.category,
        meta: `${frase(t)} · ${t.category}`,
        valor: dreGroupOf(t) === 'revenue' ? t.amount : -t.amount,
        para: t.sale_id ? `/vendas/${t.sale_id}` : undefined,
      }))

  const abrirLinha = (l: LinhaDoCaixa, p: PeriodoDre) => {
    const nome = l.rotulo.replace(/^\([−+±]\) /, '')
    abrir({
      rotulo: nome,
      titulo: `${nome} · ${p.rotulo}`,
      explica: l.explica,
      total: l.valor,
      itens: l.saldos
        ? l.saldos.map((s) => ({ id: s.conta.id, titulo: s.conta.name, meta: 'saldo da conta', valor: s.saldo }))
        : itens(l.lancamentos),
      vazio: l.saldos ? 'Nenhuma conta de dinheiro neste período.' : 'Nenhum movimento neste período.',
    })
  }

  const entradasFora = atual.foraDoSaldo.filter((t) => dreGroupOf(t) === 'revenue')
  const saidasFora = atual.foraDoSaldo.filter((t) => dreGroupOf(t) !== 'revenue')
  const somar = (txs: Transaction[]) => Math.round(txs.reduce((s, t) => s + t.amount, 0) * 100) / 100
  const abrirFora = (titulo: string, txs: Transaction[], sinal: 1 | -1) =>
    abrir({
      rotulo: titulo,
      titulo: `${titulo} · ${periodos.atual.rotulo}`,
      explica:
        'Movimento liquidado que não passou por uma conta de dinheiro da imobiliária no sistema: recebido direto na conta pessoal, pago do bolso do sócio ou anterior à abertura da conta.',
      total: sinal * somar(txs),
      itens: itens(txs),
      vazio: 'Nada fora das contas neste período.',
    })

  /* ------------------------------------------------------------ texto */

  const inicial = valorDe('saldo-inicial')
  const final = valorDe('saldo-final')
  const entrou = valorDe('recebimentos')
  const saiu = valorDe('pagamentos') + valorDe('retiradas')
  const gerado = valorDe('gerado')

  const fraseDoHeroi = (
    <>
      Começou com <Valor valor={inicial} posto="fato" />.{' '}
      {gerado >= 0 ? 'O negócio gerou caixa no período.' : 'O negócio gastou mais do que recebeu no período.'}
    </>
  )

  const comecaDepois = atual.contasDesde !== null && atual.contasDesde > `${periodos.atual.de}-01`

  const comparar = [
    { id: 'recebimentos', rotulo: 'Recebimentos', custo: false },
    { id: 'gerado', rotulo: 'Caixa gerado pela operação', custo: false },
    { id: 'saldo-final', rotulo: 'Saldo no fim', custo: false },
  ]

  return (
    <PageLayout
      subtitulo="Quanto dinheiro entrou, quanto saiu e quanto ficou em conta."
      faixa={<FiltrosDePeriodo ativo={tipo} aoMudar={setTipo} />}
    >
      <Heroi
        variante="ouro"
        estado={final < 0 ? 'negativo' : undefined}
        rotulo={`Saldo no fim · ${periodos.atual.rotulo}`}
        valor={final}
        rotuloAcessivel={`Ver o saldo de cada conta no fim de ${periodos.atual.rotulo}`}
        aoAbrir={() => abrirLinha(linhaDe('saldo-final'), periodos.atual)}
        frase={fraseDoHeroi}
        apoios={[
          {
            rotulo: 'Entrou',
            valor: entrou,
            rotuloAcessivel: 'Ver o que entrou',
            aoAbrir: () => abrirLinha(linhaDe('recebimentos'), periodos.atual),
          },
          {
            rotulo: 'Saiu',
            valor: saiu,
            rotuloAcessivel: 'Ver o que saiu',
            aoAbrir: () =>
              abrirLinha(
                {
                  ...linhaDe('pagamentos'),
                  rotulo: 'Saiu',
                  valor: saiu,
                  explica: 'Pagamentos da operação e retiradas do sócio.',
                  lancamentos: [...linhaDe('pagamentos').lancamentos, ...linhaDe('retiradas').lancamentos],
                },
                periodos.atual,
              ),
          },
          {
            rotulo: 'Gerado pela operação',
            valor: gerado,
            rotuloAcessivel: 'Ver o caixa gerado pela operação',
            aoAbrir: () => abrirLinha(linhaDe('gerado'), periodos.atual),
          },
          // Apoio zerado não aparece: abriria uma folha vazia.
        ].filter((a) => a.valor !== 0)}
      />

      {comecaDepois && atual.contasDesde && (
        <Dica tom="info">
          O saldo das contas da imobiliária começa no sistema em {formatDate(atual.contasDesde)}. O que se moveu
          antes disso aparece em "Fora das contas da imobiliária", abaixo.
        </Dica>
      )}

      <Cartao>
        <Cartao.Cabecalho
          titulo="Como o dinheiro se moveu"
          meta="Dinheiro de verdade, nas contas da imobiliária. Toque em qualquer valor para ver os lançamentos."
        />
        <Cartao.Corpo>
          <ContaDoRelatorio
            linhas={linhas}
            emPalavras={EM_PALAVRAS}
            aoAbrir={(l) => abrirLinha(l, periodos.atual)}
            rotuloAcessivel={`Fluxo de caixa de ${periodos.atual.rotulo}`}
          />
        </Cartao.Corpo>
      </Cartao>

      {atual.foraDoSaldo.length > 0 && (
        <Cartao>
          <Cartao.Cabecalho
            titulo="Fora das contas da imobiliária"
            meta="Movimentos do período que não passaram por uma conta dela no sistema. Não entram no saldo."
          />
          <Cartao.Lista colunas={{ valor: true, fim: true }} rotuloAcessivel="Movimentos fora das contas">
            {entradasFora.length > 0 && (
              <Linha
                titulo="Entradas"
                meta={`${entradasFora.length} ${entradasFora.length === 1 ? 'lançamento' : 'lançamentos'}`}
                valor={<Valor valor={somar(entradasFora)} posto="linha" />}
                aoClicar={() => abrirFora('Entradas fora das contas', entradasFora, 1)}
              />
            )}
            {saidasFora.length > 0 && (
              <Linha
                titulo="Saídas"
                meta={`${saidasFora.length} ${saidasFora.length === 1 ? 'lançamento' : 'lançamentos'}`}
                valor={<Valor valor={-somar(saidasFora)} posto="linha" estado="negativo" />}
                aoClicar={() => abrirFora('Saídas fora das contas', saidasFora, -1)}
              />
            )}
          </Cartao.Lista>
        </Cartao>
      )}

      <Cartao>
        <Cartao.Cabecalho titulo={`Comparado com ${periodos.anterior.rotulo}`} />
        <Cartao.Lista colunas={{ valor: true, fim: true }} rotuloAcessivel="Comparação com o período anterior">
          {comparar.map((c) => {
            const agora = valorDe(c.id)
            const antes = valorDe(c.id, anterior)
            return (
              <Linha
                key={c.id}
                titulo={c.rotulo}
                meta={`${periodos.anterior.rotulo}: ${formatCurrency(antes)} · ${variacaoEmPalavras(agora, antes, c.custo)}`}
                valor={<Valor valor={agora} posto="linha" estado={agora < 0 ? 'negativo' : undefined} />}
                aoClicar={() => abrirLinha(linhaDe(c.id, anterior), periodos.anterior)}
              />
            )
          })}
        </Cartao.Lista>
      </Cartao>
    </PageLayout>
  )
}
