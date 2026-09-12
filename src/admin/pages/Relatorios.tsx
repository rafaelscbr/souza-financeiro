import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { Tip } from '@/components/ui/Tip'
import { EmptyState } from '@/components/ui/EmptyState'
import { computeKpis, dreGroupOf, lastNMonths, monthKey } from '@/lib/finance'
import { treasurySummary } from '@/lib/treasury'
import { brokerProduction, developmentResults } from '@/lib/sales'
import { formatCurrency, formatMonthShort, formatMonthYear, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/types'

type Regime = 'caixa' | 'competencia'

/**
 * Os números do negócio. A chave caixa/competência vive AQUI, e não no
 * cabeçalho do app: ela só muda o DRE, e como chave global fazia todas as
 * telas mudarem de sentido sem explicação.
 */
export function Relatorios() {
  const { transactions, accounts, transfers, mes, vendas, contacts, contatosComAcesso } = useAdmin()
  const [regime, setRegime] = useState<Regime>('caixa')

  const dataDoRegime = (t: Transaction): string | null => {
    if (regime === 'competencia') return t.competence_date
    if (t.status !== 'settled') return null
    return t.settled_date ?? t.competence_date
  }

  const doMes = useMemo(
    () => transactions.filter((t) => dataDoRegime(t)?.slice(0, 7) === monthKey(mes)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, mes, regime],
  )
  const kpis = useMemo(() => computeKpis(doMes, null), [doMes])

  const serie = useMemo(() => {
    const meses = lastNMonths(mes, 12)
    return meses.map((m) => {
      const doMes = transactions.filter((t) => dataDoRegime(t)?.slice(0, 7) === monthKey(m))
      return { mes: m, kpis: computeKpis(doMes, null) }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, mes, regime])

  const tesouraria = useMemo(
    () => treasurySummary(accounts, transactions, transfers),
    [accounts, transactions, transfers],
  )
  const porEmpreendimento = useMemo(() => developmentResults(vendas), [vendas])
  const porCorretor = useMemo(
    () => brokerProduction({ vendas, contacts, comAcesso: contatosComAcesso, year: null }),
    [vendas, contacts, contatosComAcesso],
  )

  const porCategoria = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of doMes) {
      const g = dreGroupOf(t)
      if (g === 'revenue') continue
      m.set(t.category, Math.round(((m.get(t.category) ?? 0) + t.amount) * 100) / 100)
    }
    return [...m.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor)
  }, [doMes])

  function exportarDre() {
    const linhas = [
      ['Mês', 'Receita', 'Impostos', 'Comissões', 'Despesas', 'Resultado'],
      ...serie.map((s) => [
        monthKey(s.mes),
        s.kpis.revenue,
        s.kpis.taxDeductions,
        s.kpis.costOfSale,
        s.kpis.operatingExpense + s.kpis.variableExpense + s.kpis.otherExpense,
        s.kpis.netProfit,
      ]),
    ]
    const csv = linhas
      .map((l) => l.map((c) => `"${String(c).replace('.', ',')}"`).join(';'))
      .join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `dre-12-meses-${monthKey(mes)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-content">Relatórios</h1>
          <p className="text-sm text-content-faint">{formatMonthYear(mes)}</p>
        </div>
        <div className="w-full sm:w-64">
          <Segmented
            ariaLabel="Regime"
            value={regime}
            onChange={setRegime}
            options={[
              { value: 'caixa', label: 'Caixa' },
              { value: 'competencia', label: 'Competência' },
            ]}
          />
        </div>
      </div>
      <p className="-mt-3 text-xs text-content-faint">
        {regime === 'caixa'
          ? 'Caixa: conta no mês em que o dinheiro se moveu.'
          : 'Competência: conta no mês da venda, mesmo que o dinheiro entre depois.'}
      </p>

      {/* DRE do mês */}
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-content">
          Resultado do mês
          <Tip label="Como o resultado é formado" align="start">
            Da comissão saem os impostos sobre o faturamento, depois a comissão dos corretores (custo
            direto da venda) e por fim a estrutura. O que resta é o resultado.
          </Tip>
        </h2>
        <Linha rotulo="Receita de comissões" valor={kpis.revenue} forte />
        <Linha rotulo="(−) Impostos sobre o faturamento" valor={-kpis.taxDeductions} />
        <Linha rotulo="Receita líquida" valor={kpis.netRevenue} />
        <Linha rotulo="(−) Comissões de corretores" valor={-kpis.costOfSale} />
        <Linha rotulo="Lucro bruto" valor={kpis.grossProfit} forte />
        <Linha rotulo="(−) Despesas fixas" valor={-kpis.operatingExpense} />
        <Linha rotulo="(−) Despesas variáveis" valor={-(kpis.variableExpense + kpis.otherExpense)} />
        <div className="my-2 border-t border-line" />
        <Linha rotulo="Resultado" valor={kpis.netProfit} forte destaque />
        {kpis.revenue > 0 && (
          <p className="mt-1 text-right text-[11px] text-content-faint">
            margem {formatPercent(kpis.netMargin, 0)}
          </p>
        )}
        {kpis.profitDistribution > 0 && (
          <p className="mt-2 text-xs text-content-muted">
            Retiradas do sócio no mês: {formatCurrency(kpis.profitDistribution)} (saem depois do
            resultado).
          </p>
        )}
      </section>

      {/* Saldos */}
      {tesouraria.balances.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-content">Contas</h2>
          <ul className="space-y-2">
            {tesouraria.balances.map((b) => (
              <li key={b.account.id} className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-content-muted">{b.account.name}</span>
                <span className={cn('tnum text-sm font-semibold', b.balance < 0 ? 'text-expense' : 'text-content')}>
                  {formatCurrency(b.balance)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
            <span className="text-sm font-semibold text-content">Disponível</span>
            <span className="tnum text-base font-bold text-content">{formatCurrency(tesouraria.available)}</span>
          </div>
          {tesouraria.unassignedCount > 0 && (
            <p className="mt-2 text-xs text-content-faint">
              {tesouraria.unassignedCount} lançamento(s) liquidado(s) sem conta, somando{' '}
              {formatCurrency(tesouraria.unassigned)}. Ficam fora do saldo das contas de propósito —
              incluir daria um número que não bate com banco nenhum.
            </p>
          )}
        </section>
      )}

      {/* 12 meses */}
      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="text-sm font-semibold text-content">Doze meses</h2>
          <Button variant="secondary" size="sm" onClick={exportarDre}>
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[10px] uppercase tracking-wide text-content-faint">
                <th className="py-2 font-medium">Mês</th>
                <th className="py-2 text-right font-medium">Receita</th>
                <th className="py-2 text-right font-medium">Impostos</th>
                <th className="py-2 text-right font-medium">Comissões</th>
                <th className="py-2 text-right font-medium">Despesas</th>
                <th className="py-2 text-right font-medium">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {serie
                .filter((s) => s.kpis.revenue > 0 || s.kpis.totalExpense > 0 || s.kpis.taxDeductions > 0)
                .map((s) => {
                  const despesas =
                    s.kpis.operatingExpense + s.kpis.variableExpense + s.kpis.otherExpense
                  return (
                    <tr key={monthKey(s.mes)}>
                      <td className="py-2 text-content-muted">{formatMonthShort(s.mes)}</td>
                      <td className="tnum py-2 text-right text-income">{formatCurrency(s.kpis.revenue)}</td>
                      <td className="tnum py-2 text-right text-content-muted">
                        {s.kpis.taxDeductions > 0 ? `−${formatCurrency(s.kpis.taxDeductions)}` : '—'}
                      </td>
                      <td className="tnum py-2 text-right text-content-muted">
                        {s.kpis.costOfSale > 0 ? `−${formatCurrency(s.kpis.costOfSale)}` : '—'}
                      </td>
                      <td className="tnum py-2 text-right text-content-muted">
                        {despesas > 0 ? `−${formatCurrency(despesas)}` : '—'}
                      </td>
                      <td
                        className={cn(
                          'tnum py-2 text-right font-semibold',
                          s.kpis.netProfit < 0 ? 'text-expense' : 'text-content',
                        )}
                      >
                        {formatCurrency(s.kpis.netProfit)}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Por empreendimento */}
      {porEmpreendimento.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="px-5 pb-2 pt-4">
            <h2 className="text-sm font-semibold text-content">Por empreendimento</h2>
            <p className="text-xs text-content-faint">
              Qual produto dá lucro de verdade. Considera todas as vendas, não só o mês.
            </p>
          </div>
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[10px] uppercase tracking-wide text-content-faint">
                  <th className="py-2 font-medium">Empreendimento</th>
                  <th className="py-2 text-right font-medium">Vendas</th>
                  <th className="py-2 text-right font-medium">Comissão</th>
                  <th className="py-2 text-right font-medium">Fica limpo</th>
                  <th className="py-2 text-right font-medium">Margem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {porEmpreendimento.map((d) => (
                  <tr key={d.id ?? 'sem'}>
                    <td className="py-2">
                      <span className="text-content">{d.name}</span>
                      {d.developer && <span className="ml-1 text-xs text-content-faint">{d.developer}</span>}
                    </td>
                    <td className="tnum py-2 text-right text-content-muted">{d.sales}</td>
                    <td className="tnum py-2 text-right text-content">{formatCurrency(d.commission)}</td>
                    <td className="tnum py-2 text-right font-semibold text-income">{formatCurrency(d.net)}</td>
                    <td className="tnum py-2 text-right text-content-muted">{formatPercent(d.margin, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Por corretor */}
      {porCorretor.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="px-5 pb-2 pt-4">
            <h2 className="text-sm font-semibold text-content">Por corretor</h2>
            <p className="text-xs text-content-faint">Produção e comissão, todas as vendas.</p>
          </div>
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[10px] uppercase tracking-wide text-content-faint">
                  <th className="py-2 font-medium">Corretor</th>
                  <th className="py-2 text-right font-medium">Vendas</th>
                  <th className="py-2 text-right font-medium">VGV</th>
                  <th className="py-2 text-right font-medium">Comissão</th>
                  <th className="py-2 text-right font-medium">A pagar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {porCorretor.map((p) => (
                  <tr key={p.contact.id}>
                    <td className="py-2 text-content">{p.contact.name}</td>
                    <td className="tnum py-2 text-right text-content-muted">{p.sales}</td>
                    <td className="tnum py-2 text-right text-content-muted">{formatCurrency(p.vgv)}</td>
                    <td className="tnum py-2 text-right text-content">{formatCurrency(p.commissionTotal)}</td>
                    <td className="tnum py-2 text-right font-semibold text-expense">
                      {formatCurrency(p.released + p.expected)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Despesas por categoria */}
      {porCategoria.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-content">Saídas do mês por categoria</h2>
          <ul className="space-y-1.5">
            {porCategoria.map((c) => (
              <li key={c.nome} className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm text-content-muted">{c.nome}</span>
                <span className="tnum shrink-0 text-sm text-content">{formatCurrency(c.valor)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {transactions.length === 0 && (
        <EmptyState title="Sem dados ainda" description="Registre uma venda ou uma despesa para os relatórios ganharem conteúdo." />
      )}
    </div>
  )
}

function Linha({
  rotulo,
  valor,
  forte,
  destaque,
}: {
  rotulo: string
  valor: number
  forte?: boolean
  destaque?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className={cn('text-sm', forte ? 'font-semibold text-content' : 'text-content-muted')}>{rotulo}</span>
      <span
        className={cn(
          'tnum shrink-0 font-semibold',
          destaque ? (valor < 0 ? 'text-lg text-expense' : 'text-lg text-income') : valor < 0 ? 'text-expense' : 'text-content',
        )}
      >
        {formatCurrency(valor)}
      </span>
    </div>
  )
}
