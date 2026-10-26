import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CircleCheck, FileBarChart, Handshake } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useAdmin } from '../AdminData'
import { CartaoDoTeto } from '../CartaoDoTeto'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Cartao } from '@/components/ui/Cartao'
import { Button } from '@/components/ui/Button'
import { Barra } from '@/components/ui/Barra'
import { Linha, LinhaGrupo } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { Selo } from '@/components/ui/Selo'
import { Tabela } from '@/components/ui/Tabela'
import { ChipSituacao } from '@/components/ui/Situacao'
import { EstadoVazio } from '@/components/ui/Estados'
import { FiltrosRapidos } from '@/components/ui/FiltrosRapidos'
import { FaixaDeMetricas, textoDaVariacao } from '@/components/ui/FaixaDeMetricas'
import { GraficoArea, GraficoEvolucao, GraficoRosca, Legenda, LegendaDeComposicao, useCoresDoGrafico } from '@/components/graficos/Graficos'
import { formatCurrency, formatDateShort, formatMonthTiny, formatMonthYear } from '@/lib/format'
import { monthKey } from '@/lib/finance'
import { evolucaoMensal, folegoDoCaixa, previsaoDeCaixa, resultadoDoMes, variacao } from '@/lib/painel'
import { situacaoDaMeta, vendaConta, vgvDaVenda } from '@/lib/comissao'
import { accountBalance } from '@/lib/treasury'
import { situacaoDeTela } from '@/lib/situacao'
import { etapaDaParcela, fraseDaEtapa } from '@/lib/etapas'
import type { MoneyItem, SaleView } from '@/lib/sales'
import type { SaleInstallment, Transaction } from '@/types'

/*
 * VISÃO FINANCEIRA — o painel executivo (Souza 2.0, 24/10/2026).
 *
 * Redesenho radical pedido pelo Rafael: "a tela mais bonita, clara e bem
 * resolvida do sistema", composição editorial, não uma sequência de cartões.
 * Cinco seções, nesta ordem de pergunta:
 *
 *   1. Resumo do negócio — uma faixa só: saldo, recebido, a receber,
 *      resultado, a pagar. Tendência discreta contra o mês anterior.
 *   2. Evolução financeira — 12 meses, caixa OU competência (nunca somados),
 *      e ao lado para onde vai cada real de comissão.
 *   3. Próximos recebimentos — tabela curta; ao lado, o desempenho da operação.
 *   4. Caixa nos próximos 6 meses e os alertas que pedem decisão.
 *   5. O orçamento do mês, a fila da nota e o que é pessoa física.
 *
 * A regra de antes continua: o painel não inventa número. Lê `receber`,
 * `pagar` e `atencao` do contexto, e as contas moram em lib/painel.ts,
 * lib/comissao.ts e lib/treasury.ts.
 */

type Regime = 'caixa' | 'competencia'
const r2 = (v: number) => Math.round(v * 100) / 100

function saudacaoDoDia(nome: string | undefined): string {
  const h = new Date().getHours()
  const quando = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  const primeiro = nome?.trim().split(/\s+/)[0]
  return primeiro ? `${quando}, ${primeiro}` : quando
}

export function Inicio() {
  const {
    sales, metas, perfis, company, orcamento, transactions, transfers, accounts, atencao, receber, pagar, vendas,
    installments, hoje, mes,
  } = useAdmin()
  const { profile } = useAuth()
  const { abrir } = useComposicao()
  const navigate = useNavigate()
  const cores = useCoresDoGrafico()
  const [regime, setRegime] = useState<Regime>('competencia')

  const chaveMes = monthKey(mes)
  const chaveAnterior = monthKey(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))
  const nomeDoMes = formatMonthYear(mes)
  const parcelas = useMemo(() => new Map(installments.map((p) => [p.id, p])), [installments])
  const soma = (l: { amount: number }[]) => r2(l.reduce((s, i) => s + i.amount, 0))

  /* ------------------------------------------------ 1. resumo do negócio */

  const contasAtivas = useMemo(() => accounts.filter((a) => a.is_active && a.type !== 'credit_card'), [accounts])
  const saldo = useMemo(
    () => r2(contasAtivas.reduce((s, a) => s + accountBalance(a, transactions, transfers, hoje).balance, 0)),
    [contasAtivas, transactions, transfers, hoje],
  )
  const saldoNoFimDoMesPassado = useMemo(() => {
    const h = new Date(`${hoje}T12:00:00`)
    const fim = new Date(h.getFullYear(), h.getMonth(), 0)
    const ate = `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, '0')}-${String(fim.getDate()).padStart(2, '0')}`
    return r2(contasAtivas.filter((a) => a.opening_date <= ate).reduce((s, a) => s + accountBalance(a, transactions, transfers, ate).balance, 0))
  }, [contasAtivas, transactions, transfers, hoje])

  /** Parcela recebida no mês (a comissão que caiu), pela data do dinheiro. */
  const recebidoNo = (chave: string) => {
    const l = vendas
      .filter((v) => !v.is_personal)
      .flatMap((v) => v.installments)
      .filter((i) => i.status === 'recebida' && (i.received_date ?? '').slice(0, 7) === chave)
    return { total: soma(l), n: l.length }
  }
  const recebido = useMemo(() => recebidoNo(chaveMes), [vendas, chaveMes]) // eslint-disable-line react-hooks/exhaustive-deps
  const recebidoAntes = useMemo(() => recebidoNo(chaveAnterior), [vendas, chaveAnterior]) // eslint-disable-line react-hooks/exhaustive-deps

  /* A janela de Receber: o mês da tela mais o que está em atraso de qualquer mês. */
  const aReceber = useMemo(() => receber.filter((i) => i.date.slice(0, 7) === chaveMes || i.overdue), [receber, chaveMes])
  const emAtraso = useMemo(() => aReceber.filter((i) => i.overdue), [aReceber])
  /* A definição de Pagar: devido agora é o liberado (comissão de parcela recebida, imposto, despesa). */
  const devido = useMemo(() => pagar.filter((i) => i.released), [pagar])

  const resultado = useMemo(() => resultadoDoMes(transactions, parcelas, chaveMes), [transactions, parcelas, chaveMes])
  const resultadoAntes = useMemo(() => resultadoDoMes(transactions, parcelas, chaveAnterior), [transactions, parcelas, chaveAnterior])

  const tendencia = (agora: number, antes: number, custo = false) => {
    const texto = textoDaVariacao(variacao(agora, antes))
    if (!texto) return null
    const sobe = agora > antes
    return { texto, tom: agora === antes ? ('neutro' as const) : sobe !== custo ? ('sucesso' as const) : ('risco' as const) }
  }

  /* ---------------------------------------------- 2. evolução financeira */

  const evolucao = useMemo(() => evolucaoMensal(transactions, parcelas, mes), [transactions, parcelas, mes])
  const pontos = evolucao.map((e) => {
    const d = new Date(`${e.mes}-01T12:00:00`)
    const x = regime === 'caixa' ? e.caixa : null
    return {
      rotulo: formatMonthTiny(d),
      titulo: formatMonthYear(d),
      entra: x ? x.entra : e.competencia.receita,
      sai: x ? x.sai : e.competencia.custos,
      resultado: x ? x.resultado : e.competencia.resultado,
    }
  })
  const nomes =
    regime === 'caixa'
      ? { entra: 'Entrou', sai: 'Saiu', resultado: 'Saldo do mês' }
      : { entra: 'Receita', sai: 'Custos e despesas', resultado: 'Resultado' }
  const doze = evolucao.reduce(
    (t, e) => ({
      receita: t.receita + e.competencia.receita,
      resultado: t.resultado + e.competencia.resultado,
      entra: t.entra + e.caixa.entra,
      sai: t.sai + e.caixa.sai,
    }),
    { receita: 0, resultado: 0, entra: 0, sai: 0 },
  )

  const sinal = (t: Transaction) => (t.kind === 'income' ? t.amount : -t.amount)
  const abrirMes = (i: number) => {
    const e = evolucao[i]
    const nome = formatMonthYear(new Date(`${e.mes}-01T12:00:00`))
    const lancs = regime === 'caixa' ? [...e.caixa.entradas, ...e.caixa.saidas] : e.competencia.lancamentos
    abrir({
      rotulo: regime === 'caixa' ? 'Caixa do mês' : 'Resultado do mês',
      titulo: `${nome} · ${regime === 'caixa' ? 'caixa' : 'competência'}`,
      explica:
        regime === 'caixa'
          ? 'O dinheiro que entrou e saiu no mês, pela data da baixa. Retirada do sócio fica de fora.'
          : 'O DRE realizado do mês: a comissão que ficou devida (nota, gatilho ou dinheiro) e o que ela custou, mais as despesas.',
      total: regime === 'caixa' ? e.caixa.resultado : e.competencia.resultado,
      itens: lancs
        .filter((t) => t.kind !== 'withdrawal')
        .map((t) => ({
          id: t.id,
          titulo: t.description || t.category,
          meta: t.category,
          valor: sinal(t),
          para: t.sale_id ? `/vendas/${t.sale_id}` : undefined,
        })),
      vazio: 'Nada neste mês.',
    })
  }

  /* Para onde vai cada real de comissão contratada (a carteira ativa, gravada na cascata). */
  const carteira = useMemo(() => {
    const ativas = vendas.filter((v) => !v.is_personal && v.status !== 'cancelada')
    const comissao = r2(ativas.reduce((s, v) => s + v.cascade.commission, 0))
    const imposto = r2(ativas.reduce((s, v) => s + v.cascade.iss + v.cascade.simples, 0))
    const corretores = r2(ativas.reduce((s, v) => s + v.cascade.broker + v.cascade.manager, 0))
    const fica = r2(ativas.reduce((s, v) => s + v.cascade.net, 0))
    const porConstrutora = new Map<string, number>()
    for (const v of ativas) {
      const nome = v.developer ?? v.development ?? 'Sem construtora'
      porConstrutora.set(nome, (porConstrutora.get(nome) ?? 0) + v.cascade.commission)
    }
    const maior = [...porConstrutora.entries()].sort((a, b) => b[1] - a[1])[0]
    return { comissao, imposto, corretores, fica, maior, vendas: ativas.length }
  }, [vendas])
  const pct = (v: number) => (carteira.comissao > 0 ? Math.round((v / carteira.comissao) * 100) : 0)

  /* ------------------------------------------ 3. próximos recebimentos */

  type Recebivel = { i: MoneyItem; venda: SaleView | null; p: SaleInstallment | null }
  const proximos = useMemo<Recebivel[]>(
    () =>
      [...receber]
        .sort((a, b) => (a.overdue === b.overdue ? a.date.localeCompare(b.date) : a.overdue ? -1 : 1))
        .slice(0, 7)
        .map((i) => ({ i, venda: i.sale, p: i.installment })),
    [receber],
  )

  /* Desempenho: meta de VGV, o que se vendeu, a comissão que isso contratou e a margem dos 12 meses. */
  const meta = useMemo(() => situacaoDaMeta({ sales, perfis, metas, mes: chaveMes, contactId: null }), [sales, perfis, metas, chaveMes])
  const vendasDoMes = useMemo(() => vendas.filter((v) => vendaConta(v) && v.sale_date.slice(0, 7) === chaveMes), [vendas, chaveMes])
  const vgvDoMes = vendasDoMes.reduce((s, v) => s + vgvDaVenda(v), 0)
  const comissaoDoMes = r2(vendasDoMes.reduce((s, v) => s + v.cascade.commission, 0))
  const margem12 = doze.receita > 0 ? doze.resultado / doze.receita : null

  /* -------------------------------------------- 4. caixa e alertas */

  const teto = company?.monthly_budget ?? null
  const inicioDaPrevisao = useMemo(() => {
    const h = new Date(`${hoje}T12:00:00`)
    return new Date(h.getFullYear(), h.getMonth(), 1)
  }, [hoje])
  const previsao = useMemo(
    () => previsaoDeCaixa({ saldo, receber, pagar, orcamento, teto, transactions, parcelas, inicio: inicioDaPrevisao }),
    [saldo, receber, pagar, orcamento, teto, transactions, parcelas, inicioDaPrevisao],
  )
  const folego = folegoDoCaixa(saldo, teto)
  const menorSaldo = previsao.reduce((m, p) => Math.min(m, p.saldoFim), saldo)

  const comp = (l: MoneyItem[], negativo = false) =>
    l.map((i) => ({
      id: i.tx.id,
      titulo: i.label,
      meta: i.sale?.development ?? i.tx.category,
      valor: negativo ? -i.amount : i.amount,
      situacao: i.installment ? situacaoDeTela(i.installment.status, i.installment.expected_date, hoje) : undefined,
      idx: i.installment?.idx,
      count: i.installment?.count,
      para: i.sale ? `/vendas/${i.sale.id}` : undefined,
    }))

  const abrirPrevisao = (k: number) => {
    const p = previsao[k]
    const nome = formatMonthYear(new Date(`${p.mes}-01T12:00:00`))
    abrir({
      rotulo: 'Entra menos sai',
      titulo: `O caixa em ${nome}`,
      explica: `Parcelas a receber, contas e comissões a pagar e o orçamento ainda não lançado. O saldo termina o mês em ${formatCurrency(p.saldoFim)}. A data das parcelas depende da construtora.`,
      total: r2(p.entra - p.sai),
      itens: [
        ...comp(p.entradas),
        ...comp(p.saidas, true),
        ...(p.reservado > 0
          ? [{ id: `reservado-${p.mes}`, titulo: 'Orçamento ainda não lançado', meta: 'gastos fixos confirmados', valor: -p.reservado }]
          : []),
      ],
      nota: k === 0 ? 'O primeiro mês inclui o que está em atraso, a receber e a pagar.' : undefined,
      vazio: 'Nada previsto para este mês.',
    })
  }

  /* ------------------------------------------ 5. nota fiscal e pessoa física */

  const porVenda = useMemo(() => new Map(vendas.map((v) => [v.id, v])), [vendas])
  const filaDaNota = useMemo(() => {
    const emitir: { p: SaleInstallment; venda: SaleView | undefined }[] = []
    const esperando: { p: SaleInstallment; venda: SaleView | undefined }[] = []
    for (const p of installments) {
      if (p.status !== 'prevista') continue
      if (porVenda.get(p.sale_id)?.is_personal) continue
      const { etapa } = etapaDaParcela(p)
      if (etapa === 'a_emitir_nota') emitir.push({ p, venda: porVenda.get(p.sale_id) })
      else if (etapa === 'nota_emitida' && p.expected_date < hoje) esperando.push({ p, venda: porVenda.get(p.sale_id) })
    }
    return { emitir, esperando }
  }, [installments, porVenda, hoje])
  const pessoais = useMemo(() => {
    const linhas = vendas
      .filter((v) => v.is_personal && v.status !== 'cancelada')
      .flatMap((v) => v.installments.filter((p) => p.status === 'prevista').map((p) => ({ v, p })))
      .sort((a, b) => (a.p.expected_date < b.p.expected_date ? -1 : 1))
    return { linhas, total: r2(linhas.reduce((s, l) => s + l.p.amount, 0)) }
  }, [vendas])

  const vendasAtivas = vendas.filter((v) => v.status !== 'cancelada' && !v.is_personal)
  if (vendasAtivas.length === 0 && transactions.length === 0) {
    return (
      <PageLayout subtitulo="Nenhuma venda registrada ainda.">
        <Cartao rotuloAcessivel="Primeira venda">
          <Cartao.Corpo>
            <EstadoVazio
              icone={Handshake}
              titulo="Tudo pronto para a primeira venda"
              descricao="Registre uma venda e o sistema cuida do resto: parcelas a receber, imposto na hora certa e a comissão do corretor liberada quando o dinheiro entrar."
            />
          </Cartao.Corpo>
        </Cartao>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      saudacao={saudacaoDoDia(profile?.name ?? undefined)}
      subtitulo={`Como está o dinheiro da imobiliária em ${nomeDoMes.toLowerCase()}.`}
      acoes={
        <Button variant="secundario" size="md" icone={FileBarChart} onClick={() => navigate('/relatorios')}>
          Relatórios
        </Button>
      }
    >
      {/* 1. Resumo do negócio */}
      <FaixaDeMetricas
        rotuloAcessivel="Resumo do negócio"
        metricas={[
          {
            rotulo: 'Saldo disponível',
            valor: saldo,
            estado: saldo < 0 ? 'negativo' : undefined,
            tendencia: saldoNoFimDoMesPassado > 0 ? tendencia(saldo, saldoNoFimDoMesPassado) : null,
            nota: `${contasAtivas.length} ${contasAtivas.length === 1 ? 'conta' : 'contas'} · hoje`,
            para: '/contas',
          },
          {
            rotulo: 'Comissões recebidas',
            valor: recebido.total,
            tendencia: tendencia(recebido.total, recebidoAntes.total),
            nota: recebido.n === 0 ? 'nenhuma parcela no mês' : `${recebido.n} ${recebido.n === 1 ? 'parcela' : 'parcelas'} no mês`,
            para: '/recebimentos-imobiliaria',
          },
          {
            rotulo: 'Comissões a receber',
            valor: soma(aReceber),
            nota: emAtraso.length > 0 ? `${formatCurrency(soma(emAtraso))} em atraso` : 'no mês, nada em atraso',
            para: '/receber',
          },
          {
            rotulo: 'Resultado operacional',
            valor: resultado.lucro,
            estado: resultado.lucro < 0 ? 'negativo' : undefined,
            tendencia: tendencia(resultado.lucro, resultadoAntes.lucro),
            nota: 'lucro do mês no DRE',
            para: '/relatorios/dre',
          },
          {
            rotulo: 'Contas a pagar',
            valor: soma(devido),
            nota: devido.length === 0 ? 'nada devido agora' : `${devido.length} ${devido.length === 1 ? 'item devido' : 'itens devidos'} agora`,
            para: '/pagar',
          },
        ]}
      />

      {/* 2. Evolução financeira + composição */}
      <div className="grid items-stretch gap-bloco lg:grid-cols-12">
        <Cartao className="lg:col-span-8">
          <Cartao.Cabecalho
            titulo="Evolução financeira"
            meta={
              regime === 'caixa'
                ? `Últimos 12 meses pela data do dinheiro · ${formatCurrency(r2(doze.entra - doze.sai))} de saldo gerado`
                : `Últimos 12 meses por competência · ${formatCurrency(r2(doze.resultado))} de resultado`
            }
            extra={
              <FiltrosRapidos
                rotuloAcessivel="Regime do gráfico"
                ativo={regime}
                aoMudar={setRegime}
                filtros={[
                  { id: 'competencia', rotulo: 'Competência' },
                  { id: 'caixa', rotulo: 'Caixa' },
                ]}
              />
            }
          />
          <Cartao.Corpo>
            <Legenda
              itens={[
                { nome: nomes.entra, cor: cores.entra },
                { nome: nomes.sai, cor: cores.sai },
                { nome: nomes.resultado, cor: cores.resultado, linha: true },
              ]}
            />
            <GraficoEvolucao
              pontos={pontos}
              nomes={nomes}
              aoClicar={abrirMes}
              rotuloAcessivel={`Evolução de ${nomes.entra.toLowerCase()}, ${nomes.sai.toLowerCase()} e ${nomes.resultado.toLowerCase()} nos últimos 12 meses. Toque num mês para ver os lançamentos.`}
            />
          </Cartao.Corpo>
        </Cartao>

        <Cartao className="lg:col-span-4">
          <Cartao.Cabecalho
            titulo="Para onde vai a comissão"
            meta={`${carteira.vendas} ${carteira.vendas === 1 ? 'venda ativa' : 'vendas ativas'} · ${formatCurrency(carteira.comissao)} contratados`}
          />
          <Cartao.Corpo className="items-center gap-5">
            <GraficoRosca
              rotuloAcessivel={`De cada R$ 100 de comissão contratada, ${pct(carteira.fica)} ficam com a imobiliária, ${pct(carteira.corretores)} vão para corretores e gestão e ${pct(carteira.imposto)} para impostos.`}
              centro={{ rotulo: 'fica com a Souza', valor: `${pct(carteira.fica)}%` }}
              fatias={[
                { nome: 'Fica com a imobiliária', valor: carteira.fica, cor: cores.entra },
                { nome: 'Corretores e gestão', valor: carteira.corretores, cor: cores.sai },
                { nome: 'Impostos', valor: carteira.imposto, cor: cores.suave },
              ]}
            />
            <LegendaDeComposicao
              itens={[
                { nome: 'Fica com a imobiliária', valor: carteira.fica, pct: pct(carteira.fica), cor: cores.entra },
                { nome: 'Corretores e gestão', valor: carteira.corretores, pct: pct(carteira.corretores), cor: cores.sai },
                { nome: 'Impostos', valor: carteira.imposto, pct: pct(carteira.imposto), cor: cores.suave },
              ]}
            />
          </Cartao.Corpo>
          {carteira.maior && (
            <Cartao.Rodape>
              <span>
                {Math.round((carteira.maior[1] / Math.max(carteira.comissao, 1)) * 100)}% da carteira depende de{' '}
                {carteira.maior[0]}
              </span>
            </Cartao.Rodape>
          )}
        </Cartao>
      </div>

      {/* 3. Próximos recebimentos + desempenho */}
      <div className="grid items-stretch gap-bloco lg:grid-cols-12">
        <Cartao className="lg:col-span-7">
          <Cartao.Cabecalho
            titulo="Próximos recebimentos"
            meta={`${receber.length} ${receber.length === 1 ? 'parcela' : 'parcelas'} na carteira · ${formatCurrency(soma(receber))} a receber`}
            extra={
              <Link to="/receber" className="font-medium text-brand text-texto-meta hover:text-brand-dark">
                Ver tudo
              </Link>
            }
          />
          {proximos.length === 0 ? (
            <Cartao.Corpo>
              <EstadoVazio icone={CircleCheck} titulo="Nada a receber" descricao="Toda a comissão contratada já entrou." />
            </Cartao.Corpo>
          ) : (
            <Tabela
              rotuloAcessivel="Próximos recebimentos"
              linhas={proximos}
              chave={(r) => r.i.tx.id}
              aoAbrirLinha={(r) => r.venda && navigate(`/vendas/${r.venda.id}${r.p ? `?parcela=${r.p.id}` : ''}`)}
              rotuloAbrir={(r) => `Abrir ${r.i.label}`}
              colunas={[
                {
                  id: 'venda',
                  rotulo: 'Venda',
                  celula: (r) => (
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-t1">{r.venda?.title ?? r.i.label}</span>
                      <span className="truncate text-t4 text-nota">
                        {r.p && r.p.count > 1 ? `Parcela ${r.p.idx} de ${r.p.count}` : 'Parcela única'}
                        {r.venda?.development ? ` · ${r.venda.development}` : ''}
                      </span>
                    </span>
                  ),
                },
                { id: 'data', rotulo: 'Previsão', celula: (r) => <span className="num whitespace-nowrap text-t3">{formatDateShort(r.i.date)}</span> },
                {
                  id: 'situacao',
                  rotulo: 'Situação',
                  celula: (r) => (r.p ? <ChipSituacao situacao={situacaoDeTela(r.p.status, r.p.expected_date, hoje)} /> : null),
                },
                { id: 'valor', rotulo: 'Valor', numerica: true, celula: (r) => <Valor valor={r.i.amount} posto="linha" /> },
              ]}
            />
          )}
        </Cartao>

        <Cartao className="lg:col-span-5">
          <Cartao.Cabecalho titulo="Desempenho da operação" meta={nomeDoMes} />
          <Cartao.Corpo className="gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-t3 text-texto-meta">Meta de VGV da imobiliária</span>
              <span className="num text-t4 text-texto-meta">
                {meta.meta ? `${Math.round((meta.atingido ?? 0) * 100)}% de ${formatCurrency(meta.meta)}` : 'sem meta'}
              </span>
            </div>
            <Barra
              rotuloAcessivel={`${Math.round((meta.atingido ?? 0) * 100)}% da meta de VGV do mês`}
              valor={meta.atingido ?? 0}
              tom={meta.bateu ? 'sucesso' : 'marca'}
            />
          </Cartao.Corpo>
          <Cartao.Lista colunas={{ valor: '9rem', fim: true }} rotuloAcessivel="Desempenho da operação">
            <Linha
              titulo="VGV vendido"
              meta={`${vendasDoMes.length} ${vendasDoMes.length === 1 ? 'venda' : 'vendas'} no mês`}
              valor={<Valor valor={vgvDoMes} posto="linha" />}
              para="/metas"
            />
            <Linha
              titulo="Comissão contratada"
              meta="o que as vendas do mês vão pagar"
              valor={<Valor valor={comissaoDoMes} posto="linha" />}
              para="/vendas"
            />
            <Linha
              titulo="Margem líquida · 12 meses"
              meta="resultado ÷ receita, por competência"
              valor={
                <span className={`num text-valor-linha ${margem12 != null && margem12 < 0 ? 'text-error-ink' : 'text-t1'}`}>
                  {margem12 == null ? '—' : `${Math.round(margem12 * 100)}%`}
                </span>
              }
              para="/relatorios/indicadores"
            />
          </Cartao.Lista>
        </Cartao>
      </div>

      {/* 4. Caixa nos próximos 6 meses + alertas e decisões */}
      <div className="grid items-stretch gap-bloco lg:grid-cols-12">
        <Cartao className="lg:col-span-7">
          <Cartao.Cabecalho
            titulo="Caixa nos próximos 6 meses"
            meta={
              folego == null
                ? 'o saldo de hoje mais o que entra, menos o que sai'
                : `o caixa de hoje paga ${folego.toLocaleString('pt-BR')} ${folego === 1 ? 'mês' : 'meses'} de estrutura sem venda nova`
            }
          />
          <Cartao.Corpo>
            <GraficoArea
              nome="Saldo no fim do mês"
              aoClicar={abrirPrevisao}
              rotuloAcessivel="Saldo previsto no fim de cada um dos próximos 6 meses. Toque num mês para ver o que entra e o que sai."
              pontos={previsao.map((p) => {
                const d = new Date(`${p.mes}-01T12:00:00`)
                return { rotulo: formatMonthTiny(d), titulo: formatMonthYear(d), valor: p.saldoFim }
              })}
            />
          </Cartao.Corpo>
          <Cartao.Rodape>
            <span>
              {menorSaldo < 0
                ? 'Em algum mês o caixa fica negativo: antecipe recebimento ou segure gasto antes de chegar lá.'
                : 'Previsão: a data das parcelas depende da construtora. Retirada do sócio fica de fora.'}
            </span>
          </Cartao.Rodape>
        </Cartao>

        <Cartao className="lg:col-span-5">
          <Cartao.Cabecalho
            titulo="Alertas e decisões"
            meta={atencao.length === 0 ? 'nada pedindo ação' : `${atencao.length} ${atencao.length === 1 ? 'item pede' : 'itens pedem'} ação`}
          />
          {atencao.length === 0 ? (
            <Cartao.Corpo>
              <EstadoVazio
                icone={CircleCheck}
                titulo="Tudo em dia"
                descricao="Nada vencido, nenhuma comissão liberada esperando e nenhum imposto em aberto."
              />
            </Cartao.Corpo>
          ) : (
            <Cartao.Lista colunas={{ goteira: true, valor: true, fim: true }} rotuloAcessivel="Alertas e decisões">
              {atencao.slice(0, 6).map((a) => (
                <Linha
                  key={a.id}
                  goteira={<Selo situacao={a.tone === 'critical' ? 'vencida' : a.tone === 'warning' ? 'liberada' : 'prevista'} />}
                  titulo={a.title}
                  meta={a.detail}
                  valor={<Valor valor={a.amount} posto="linha" />}
                  para={a.to}
                />
              ))}
            </Cartao.Lista>
          )}
          {menorSaldo < 0 && (
            <Cartao.Rodape>
              <span className="text-error-ink">Risco de caixa: o saldo previsto fica negativo nos próximos meses.</span>
            </Cartao.Rodape>
          )}
        </Cartao>
      </div>

      {/* 5. Orçamento, nota fiscal e pessoa física */}
      <div className="grid items-start gap-bloco lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-bloco lg:col-span-5">
          <CartaoDoTeto />
        </div>
        <div className="flex min-w-0 flex-col gap-bloco lg:col-span-7">
          {(filaDaNota.emitir.length > 0 || filaDaNota.esperando.length > 0) && (
            <Cartao>
              <Cartao.Cabecalho
                titulo="Nota fiscal"
                meta="a comissão liberada só vira dinheiro depois da nota"
              />
              <Cartao.Lista colunas={{ valor: true, fim: true }} rotuloAcessivel="Fila da nota fiscal">
                {filaDaNota.emitir.length > 0 && <LinhaGrupo rotulo="Emitir nota" contador={`${filaDaNota.emitir.length}`} />}
                {filaDaNota.emitir.map(({ p, venda }) => (
                  <Linha
                    key={p.id}
                    titulo={venda?.title ?? 'Parcela de comissão'}
                    meta={fraseDaEtapa(p, hoje)}
                    valor={<Valor valor={p.amount} posto="linha" />}
                    para={venda ? `/vendas/${venda.id}?parcela=${p.id}` : undefined}
                  />
                ))}
                {filaDaNota.esperando.length > 0 && (
                  <LinhaGrupo rotulo="Nota emitida, passou do prazo" contador={`${filaDaNota.esperando.length}`} />
                )}
                {filaDaNota.esperando.map(({ p, venda }) => (
                  <Linha
                    key={p.id}
                    titulo={venda?.title ?? 'Parcela de comissão'}
                    meta={fraseDaEtapa(p, hoje)}
                    valor={<Valor valor={p.amount} posto="linha" />}
                    para={venda ? `/vendas/${venda.id}?parcela=${p.id}` : undefined}
                  />
                ))}
              </Cartao.Lista>
            </Cartao>
          )}
          {pessoais.linhas.length > 0 && (
            <Cartao>
              <Cartao.Cabecalho
                titulo="Entra para você"
                meta={`pessoa física · ${formatCurrency(pessoais.total)} previstos, fora do caixa da imobiliária`}
              />
              <Cartao.Lista colunas={{ valor: true, fim: true }} rotuloAcessivel="Comissão de pessoa física">
                {pessoais.linhas.map(({ v, p }) => (
                  <Linha
                    key={p.id}
                    titulo={v.title}
                    meta={fraseDaEtapa(p, hoje)}
                    valor={<Valor valor={p.amount} posto="linha" previsto />}
                    para={`/vendas/${v.id}`}
                  />
                ))}
              </Cartao.Lista>
            </Cartao>
          )}
        </div>
      </div>
    </PageLayout>
  )
}
