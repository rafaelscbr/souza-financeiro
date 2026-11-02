import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CircleCheck, Handshake } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Cartao } from '@/components/ui/Cartao'
import { Valor } from '@/components/ui/Valor'
import { Tabela } from '@/components/ui/Tabela'
import { ChipSituacao } from '@/components/ui/Situacao'
import { EstadoVazio } from '@/components/ui/Estados'
import { ListaDeAcoes } from '@/components/ui/ListaDeAcoes'
import { PartesDaRegua, Regua } from '@/components/ui/Regua'
import { FaixaDeMetricas } from '@/components/ui/FaixaDeMetricas'
import { GraficoCaixaPrevisto } from '@/components/graficos/GraficoCaixaPrevisto'
import { formatCurrency, formatDateShort, formatMonthTiny, formatMonthYear } from '@/lib/format'
import { monthKey } from '@/lib/finance'
import { folegoDoCaixa, previsaoDeCaixa, resultadoDoMes } from '@/lib/painel'
import { accountBalance } from '@/lib/treasury'
import { situacaoDeTela } from '@/lib/situacao'
import { etapaDaParcela, fraseDaEtapa } from '@/lib/etapas'
import { useRolagem } from '@/lib/useRolagem'
import type { MoneyItem, SaleView } from '@/lib/sales'
import type { SaleInstallment } from '@/types'

/*
 * INÍCIO — Souza 3.0 (02/11/2026, docs/redesenho-3/PLANO.md).
 *
 * A pergunta da tela: "quanto eu tenho e o que precisa de mim agora?". A
 * frase debaixo do título responde; o saldo é o maior número; e cada bloco
 * responde a próxima pergunta:
 *
 *   1. Faixa de saldos — saldo hoje (líder), comissões a receber, contas a
 *      pagar (a definição de "devido agora" de sempre) e o resultado do mês.
 *   2. Caixa previsto — a linha do saldo nos próximos 6 meses, com o razão
 *      do que entra e sai embaixo. Ao lado, "Pede você": o que tem dono hoje,
 *      cada item com o botão que leva a resolver.
 *   3. Próximos recebimentos e a régua da comissão (para onde vai cada real).
 *
 * Saíram daqui (e moram onde fazem sentido): a evolução de 12 meses
 * (Relatórios › Fluxo de caixa), o desempenho e a meta de VGV (Metas), o
 * orçamento do mês (Despesas), a pessoa física (Minhas comissões). A fila da
 * nota virou item do "Pede você".
 *
 * Nenhuma conta nova: tudo lê `receber`, `pagar`, `atencao` e lib/painel.ts,
 * as mesmas fontes de antes.
 */

const r2 = (v: number) => Math.round(v * 100) / 100

/* O que o botão de cada pendência diz, pela natureza dela. */
function acaoDaPendencia(id: string): string {
  if (id === 'receber-mais') return 'Ver todas'
  if (id.startsWith('receber-')) return 'Ver parcela'
  if (id.startsWith('nota-')) return 'Emitir nota'
  if (id.startsWith('comissao-') || id === 'imposto' || id === 'despesa-vencida') return 'Pagar'
  return 'Abrir'
}

interface Pendencia {
  id: string
  titulo: string
  detalhe: string
  valor: number
  /** risco = dívida da imobiliária (vermelho); atraso = da construtora (âmbar). */
  tom: 'risco' | 'atraso' | 'neutro'
  para: string
}

export function Inicio() {
  const { transactions, transfers, accounts, atencao, receber, pagar, vendas, installments, orcamento, company, hoje, mes } =
    useAdmin()
  const { abrir } = useComposicao()
  const navigate = useNavigate()

  const chaveMes = monthKey(mes)
  const mesAnterior = new Date(mes.getFullYear(), mes.getMonth() - 1, 1)
  const chaveAnterior = monthKey(mesAnterior)
  const parcelas = useMemo(() => new Map(installments.map((p) => [p.id, p])), [installments])
  const soma = (l: { amount: number }[]) => r2(l.reduce((s, i) => s + i.amount, 0))

  /* ------------------------------------------------ 1. faixa de saldos */

  const contasAtivas = useMemo(() => accounts.filter((a) => a.is_active && a.type !== 'credit_card'), [accounts])
  const saldo = useMemo(
    () => r2(contasAtivas.reduce((s, a) => s + accountBalance(a, transactions, transfers, hoje).balance, 0)),
    [contasAtivas, transactions, transfers, hoje],
  )
  /* A janela de Receber: o mês da tela mais o que está em atraso de qualquer mês. */
  const aReceber = useMemo(() => receber.filter((i) => i.date.slice(0, 7) === chaveMes || i.overdue), [receber, chaveMes])
  const emAtraso = useMemo(() => aReceber.filter((i) => i.overdue), [aReceber])
  /* A definição de Pagar de sempre: devido agora é o liberado (decisão pendente desde 13/09, não mexer). */
  const devido = useMemo(() => pagar.filter((i) => i.released), [pagar])
  const vencidoAPagar = useMemo(() => devido.filter((i) => i.overdue), [devido])

  const resultado = useMemo(() => resultadoDoMes(transactions, parcelas, chaveMes), [transactions, parcelas, chaveMes])
  const resultadoAntes = useMemo(() => resultadoDoMes(transactions, parcelas, chaveAnterior), [transactions, parcelas, chaveAnterior])
  const diferencaResultado = r2(resultado.lucro - resultadoAntes.lucro)

  /* ------------------------------------------------ 2. caixa previsto */

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
  const ultimo = previsao[previsao.length - 1]
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

  /* ------------------------------------------------ pede você */

  const porVenda = useMemo(() => new Map(vendas.map((v) => [v.id, v])), [vendas])
  const pendencias = useMemo<Pendencia[]>(() => {
    const lista: Pendencia[] = atencao.map((a) => ({
      id: a.id,
      titulo: a.id === 'receber-mais' ? `Mais ${a.title.replace(/^mais /, '')}` : a.title,
      detalhe: a.detail,
      valor: a.amount,
      // Parcela que a construtora não pagou é "em atraso" (âmbar); o resto crítico é dívida nossa.
      tom: a.id.startsWith('receber-') ? 'atraso' : a.tone === 'info' ? 'neutro' : 'risco',
      para: a.to,
    }))
    for (const p of installments) {
      if (p.status !== 'prevista' || porVenda.get(p.sale_id)?.is_personal) continue
      if (etapaDaParcela(p).etapa !== 'a_emitir_nota') continue
      const v = porVenda.get(p.sale_id)
      lista.push({
        id: `nota-${p.id}`,
        titulo: `Nota de ${v?.title ?? 'parcela de comissão'}`,
        detalhe: fraseDaEtapa(p, hoje),
        valor: p.amount,
        tom: 'neutro',
        para: v ? `/vendas/${v.id}?parcela=${p.id}` : '/receber',
      })
    }
    const ordem = { risco: 0, atraso: 1, neutro: 2 }
    return lista.sort((a, b) => ordem[a.tom] - ordem[b.tom])
  }, [atencao, installments, porVenda, hoje])

  /* ------------------------------------------------ 3. recebimentos e comissão */

  type Recebivel = { i: MoneyItem; venda: SaleView | null; p: SaleInstallment | null }
  const proximos = useMemo<Recebivel[]>(
    () =>
      [...receber]
        .sort((a, b) => (a.overdue === b.overdue ? a.date.localeCompare(b.date) : a.overdue ? -1 : 1))
        .slice(0, 4)
        .map((i) => ({ i, venda: i.sale, p: i.installment })),
    [receber],
  )

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

  const n = pendencias.length
  const frase = (
    <>
      <b>{n === 0 ? 'Nada pendente' : `${n} ${n === 1 ? 'coisa pede' : 'coisas pedem'} você hoje`}</b>
      {folego != null
        ? ` · o caixa cobre ${folego.toLocaleString('pt-BR')} ${folego === 1 ? 'mês' : 'meses'} de estrutura sem venda nova`
        : ` · ${formatMonthYear(mes).toLowerCase()}`}
    </>
  )

  return (
    <PageLayout subtitulo={frase}>
      <FaixaDeMetricas
        rotuloAcessivel="Saldos do mês"
        metricas={[
          {
            rotulo: 'Saldo hoje',
            valor: saldo,
            lider: true,
            estado: saldo < 0 ? 'negativo' : undefined,
            nota: `em ${contasAtivas.length} ${contasAtivas.length === 1 ? 'conta' : 'contas'}${
              contasAtivas.length <= 3 && contasAtivas.length > 0 ? ` · ${contasAtivas.map((c) => c.name).join(' e ')}` : ''
            }`,
            para: '/contas',
          },
          {
            rotulo: 'Comissões a receber',
            valor: soma(aReceber),
            nota:
              emAtraso.length > 0 ? (
                <span className="font-medium text-warning-ink">
                  <Valor valor={soma(emAtraso)} posto="fato" tinta="text-warning-ink" /> em atraso
                </span>
              ) : (
                'no mês, nada em atraso'
              ),
            para: '/receber',
          },
          {
            rotulo: 'Contas a pagar',
            valor: soma(devido),
            nota:
              devido.length === 0 ? (
                'nada devido agora'
              ) : (
                <>
                  {devido.length} {devido.length === 1 ? 'item devido' : 'itens devidos'} agora
                  {vencidoAPagar.length > 0 && (
                    <>
                      {' · '}
                      <span className="font-medium text-error-ink">
                        <Valor valor={soma(vencidoAPagar)} posto="fato" tinta="text-error-ink" /> vencidos
                      </span>
                    </>
                  )}
                </>
              ),
            para: '/pagar',
          },
          {
            rotulo: 'Resultado do mês',
            valor: resultado.lucro,
            estado: resultado.lucro < 0 ? 'negativo' : undefined,
            tendencia:
              diferencaResultado === 0
                ? null
                : {
                    texto: `${diferencaResultado > 0 ? '+' : '−'}${formatCurrency(Math.abs(diferencaResultado))}`,
                    tom: diferencaResultado > 0 ? 'sucesso' : 'risco',
                  },
            nota: `vs ${formatMonthYear(mesAnterior).split(' ')[0].toLowerCase()}`,
            para: '/relatorios/dre',
          },
        ]}
      />

      {/* items-start: o "Pede você" tem o tamanho das pendências do dia, sem faixa vazia embaixo. */}
      <div className="grid items-start gap-bloco lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Cartao>
          <Cartao.Cabecalho
            titulo="Caixa previsto"
            meta={
              ultimo ? (
                <>
                  Em {formatMonthYear(new Date(`${ultimo.mes}-01T12:00:00`)).toLowerCase()}, sem venda nova:{' '}
                  <Valor valor={ultimo.saldoFim} posto="fato" forte estado={ultimo.saldoFim < 0 ? 'negativo' : undefined} />
                </>
              ) : undefined
            }
            extra={<span className="text-t4 text-texto-meta max-sm:hidden">próximos 6 meses</span>}
          />
          <GraficoCaixaPrevisto
            aoClicar={abrirPrevisao}
            rotuloAcessivel="Saldo previsto no fim de cada um dos próximos 6 meses. Toque num mês para ver o que entra e o que sai."
            meses={previsao.map((p) => {
              const d = new Date(`${p.mes}-01T12:00:00`)
              return { rotulo: formatMonthTiny(d), titulo: formatMonthYear(d), entra: p.entra, sai: p.sai, saldoFim: p.saldoFim }
            })}
          />
          {menorSaldo < 0 && (
            <Cartao.Rodape>
              <span className="text-error-ink">Em algum mês o caixa fica negativo: antecipe recebimento ou segure gasto antes de chegar lá.</span>
            </Cartao.Rodape>
          )}
        </Cartao>

        <PedeVoce pendencias={pendencias} aoAbrir={(p) => navigate(p.para)} />
      </div>

      <div className="grid items-stretch gap-bloco lg:grid-cols-2">
        <Cartao>
          <Cartao.Cabecalho titulo="Próximos recebimentos" meta="da construtora para a Souza, por data prevista" />
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
                        {r.p && r.p.count > 1 ? `parcela ${r.p.idx} de ${r.p.count}` : 'parcela única'}
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
          <Cartao.Rodape>
            <Link to="/receber" className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline hover:underline-offset-4">
              Ver as {receber.length} {receber.length === 1 ? 'parcela' : 'parcelas'}
              <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
            </Link>
            <span>
              <Valor valor={soma(receber)} posto="fato" /> na carteira
            </span>
          </Cartao.Rodape>
        </Cartao>

        <ReguaDaComissao carteira={carteira} />
      </div>
    </PageLayout>
  )
}

/* ------------------------------------------------------------------ peças */

function PedeVoce({ pendencias, aoAbrir }: { pendencias: Pendencia[]; aoAbrir: (p: Pendencia) => void }) {
  const visiveis = pendencias.slice(0, 4)
  return (
    <Cartao rotuloAcessivel="Pede você">
      <Cartao.Cabecalho
        titulo="Pede você"
        meta={pendencias.length === 0 ? 'tudo em dia' : `${pendencias.length} ${pendencias.length === 1 ? 'item' : 'itens'}, do mais urgente ao menos`}
      />
      {visiveis.length === 0 ? (
        <Cartao.Corpo>
          <EstadoVazio
            icone={CircleCheck}
            titulo="Nada esperando por você"
            descricao="Quando uma parcela atrasar, um repasse ficar liberado ou uma nota precisar sair, aparece aqui."
          />
        </Cartao.Corpo>
      ) : (
        <ListaDeAcoes
          rotuloAcessivel="O que pede você"
          itens={visiveis.map((p) => ({
            id: p.id,
            titulo: p.titulo,
            detalhe: p.detalhe,
            valor: p.valor,
            tom: p.tom,
            acao: { rotulo: acaoDaPendencia(p.id), aoClicar: () => aoAbrir(p) },
          }))}
        />
      )}
      {pendencias.length > visiveis.length && (
        <Cartao.Rodape>
          <span>e mais {pendencias.length - visiveis.length} no sino, no alto da tela</span>
        </Cartao.Rodape>
      )}
    </Cartao>
  )
}

/*
 * A RÉGUA DA COMISSÃO: de cada real contratado, quanto fica com a Souza
 * (marinho, o dado principal), quanto vai para corretores e gestão (tinta) e
 * quanto é imposto (cinza). Uma barra de 100%, que se preenche ao abrir.
 */
function ReguaDaComissao({
  carteira,
}: {
  carteira: { comissao: number; imposto: number; corretores: number; fica: number; maior?: [string, number]; vendas: number }
}) {
  const total = useRolagem(carteira.comissao)
  const partes = [
    { nome: 'Fica com a Souza', valor: carteira.fica, cor: 'var(--g-entra)' },
    { nome: 'Corretores e gestão', valor: carteira.corretores, cor: 'var(--t3)' },
    { nome: 'Impostos (ISS e Simples)', valor: carteira.imposto, cor: 'var(--g-sai)' },
  ]
  const pct = (v: number) => (carteira.comissao > 0 ? Math.round((v / carteira.comissao) * 100) : 0)
  return (
    <Cartao rotuloAcessivel="Para onde vai a comissão">
      <Cartao.Cabecalho
        titulo="Para onde vai a comissão"
        meta={`${carteira.vendas} ${carteira.vendas === 1 ? 'venda ativa' : 'vendas ativas'}, do contrato até o último centavo`}
      />
      <Cartao.Corpo className="gap-3">
        <p className="flex items-baseline gap-2 text-t4 text-texto-meta">
          Comissão contratada <Valor valor={total} posto="destaque" />
        </p>
        <Regua
          partes={partes}
          rotuloAcessivel={`De cada R$ 100 de comissão contratada, ${pct(carteira.fica)} ficam com a Souza, ${pct(carteira.corretores)} vão para corretores e gestão e ${pct(carteira.imposto)} para impostos.`}
        />
      </Cartao.Corpo>
      <PartesDaRegua partes={partes} rotuloAcessivel="As partes da comissão" />
      {carteira.maior && carteira.comissao > 0 && (
        <Cartao.Rodape>
          <span>
            <b className="font-medium text-t1">{Math.round((carteira.maior[1] / carteira.comissao) * 100)}% da carteira</b> depende de{' '}
            {carteira.maior[0]}
          </span>
        </Cartao.Rodape>
      )}
    </Cartao>
  )
}
