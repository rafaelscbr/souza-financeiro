import { useMemo, useState } from 'react'
import {
  Search,
  Handshake,
  ChevronDown,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Input } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tip } from '@/components/ui/Tip'
import { Progress } from '@/components/ui/Progress'
import { deriveDeals, type Deal } from '@/lib/deals'
import { inScope } from '@/lib/finance'
import { formatCurrency, formatDate, formatDateShort, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'

export function VendasPage() {
  const { businessTransactions, businessCompanies, contacts, scopeCompanyId, activeCompany } =
    useAppData()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const today = toDateOnly(new Date())

  const deals = useMemo(() => {
    const scoped = businessTransactions.filter((t) => inScope(t, scopeCompanyId))
    return deriveDeals(scoped, businessCompanies, today)
  }, [businessTransactions, businessCompanies, scopeCompanyId, today])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return deals
    return deals.filter((d) => `${d.title} ${d.client ?? ''}`.toLowerCase().includes(q))
  }, [deals, search])

  // Totais da carteira (todas as vendas do escopo).
  const totals = useMemo(() => {
    return filtered.reduce(
      (a, d) => ({
        gross: a.gross + d.grossRevenue,
        net: a.net + d.netToCompany,
        toReceive: a.toReceive + d.toReceive,
        toPayCommission: a.toPayCommission + d.commissionToPay,
      }),
      { gross: 0, net: 0, toReceive: 0, toPayCommission: 0 },
    )
  }, [filtered])

  const scopeName = activeCompany ? activeCompany.name : 'Grupo'

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-content">
          Vendas
          <Tip label="Para que serve esta tela" align="start">
            Cada venda reúne suas parcelas a receber (as <strong className="text-content">duplicatas</strong>)
            e os repasses ao corretor num só lugar. A conta desce até o que fica limpo para a
            imobiliária, depois do imposto e da comissão. É a ficha do negócio, não do mês.
          </Tip>
        </h1>
        <p className="text-sm text-content-faint">
          {scopeName} · {filtered.length} {filtered.length === 1 ? 'operação' : 'operações'}
        </p>
      </div>

      {deals.length === 0 ? (
        <EmptyState
          icon={<Handshake className="h-8 w-8" />}
          title="Nenhuma venda registrada"
          description="Lance uma comissão de venda e ela aparece aqui como uma operação: parcelas, repasses, imposto e o líquido da imobiliária, tudo agrupado."
        />
      ) : (
        <>
          {/* Carteira */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <PortfolioStat
              label="Receita bruta"
              value={totals.gross}
              tip="Soma das comissões de todas as vendas do escopo, antes de imposto e repasse."
            />
            <PortfolioStat
              label="Líquido da imobiliária"
              value={totals.net}
              tone="text-income"
              tip="O que sobra de todas as vendas depois de tirar imposto e comissão de corretor."
            />
            <PortfolioStat
              label="Ainda a receber"
              value={totals.toReceive}
              tone="text-pending"
              tip="Duplicatas em aberto — dinheiro contratado que ainda não caiu."
            />
            <PortfolioStat
              label="Comissão a pagar"
              value={totals.toPayCommission}
              tone="text-expense"
              tip="Repasses a corretores que ainda vão sair, ligados a essas vendas."
            />
          </div>

          {/* Busca */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
            <Input
              className="pl-9"
              placeholder="Buscar venda por nome ou cliente… (ex.: Porto Velas, Urban Club)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Lista de vendas */}
          <div className="space-y-3">
            {filtered.map((d) => (
              <DealCard
                key={d.key}
                deal={d}
                brokerName={contacts.find((c) => c.id === d.brokerId)?.name ?? null}
                expanded={open === d.key}
                onToggle={() => setOpen(open === d.key ? null : d.key)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function PortfolioStat({
  label,
  value,
  tone = 'text-content',
  tip,
}: {
  label: string
  value: number
  tone?: string
  tip: string
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-content-faint">
          {label}
        </span>
        <Tip label={label}>{tip}</Tip>
      </div>
      <p className={cn('tnum mt-1 text-lg font-bold', tone)}>{formatCurrency(value)}</p>
    </div>
  )
}

function DealCard({
  deal: d,
  brokerName,
  expanded,
  onToggle,
}: {
  deal: Deal
  brokerName: string | null
  expanded: boolean
  onToggle: () => void
}) {
  const paidPct = d.grossRevenue > 0 ? d.received / d.grossRevenue : 0

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      {/* Cabeçalho clicável */}
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-surface-2/50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-bold text-content">{d.title}</h2>
            {d.hasOverdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-critical/12 px-1.5 py-0.5 text-[10px] font-semibold text-critical">
                <AlertTriangle className="h-2.5 w-2.5" />
                Vencida
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-content-faint">
            {d.client && (
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3" />
                {d.client}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(d.saleDate)}
            </span>
            <span>
              {d.installments.length} {d.installments.length === 1 ? 'parcela' : 'parcelas'}
            </span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[11px] uppercase tracking-wide text-content-faint">Líquido</p>
          <p className="tnum text-lg font-bold text-income">{formatCurrency(d.netToCompany)}</p>
        </div>
        <ChevronDown
          className={cn(
            'h-5 w-5 shrink-0 text-content-faint transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {/* Barra de recebimento (sempre visível) */}
      <div className="px-4 pb-3">
        <div className="mb-1 flex justify-between text-[11px] text-content-faint">
          <span>Recebido {formatCurrency(d.received)}</span>
          <span>de {formatCurrency(d.grossRevenue)}</span>
        </div>
        <Progress value={paidPct} color="#059669" />
      </div>

      {/* Ficha detalhada */}
      {expanded && (
        <div className="animate-fade-in border-t border-line bg-surface-2/30 p-4">
          {/* Cascata CFO */}
          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-content-muted">
              Resultado da operação
              <Tip label="Como o resultado é calculado" align="start">
                Da comissão cheia saem o imposto sobre o faturamento e a comissão do corretor. O que
                resta é o que a operação deixa para a imobiliária.
              </Tip>
            </h3>
            <CascadeLine label="Comissão bruta (sua parte)" value={d.grossRevenue} bold />
            <CascadeLine
              label="(−) Imposto sobre faturamento"
              value={-d.tax}
              hint={
                d.taxConfigured
                  ? `Alíquota ${d.taxRate?.toLocaleString('pt-BR')}%`
                  : 'alíquota não configurada'
              }
              warn={!d.taxConfigured}
            />
            <CascadeLine label="(−) Comissão de corretor" value={-d.commissionCost} />
            <div className="my-2 border-t border-line" />
            <CascadeLine label="Fica para a imobiliária" value={d.netToCompany} bold accent />
            <p className="mt-1.5 text-right text-[11px] text-content-faint">
              margem {(d.netMargin * 100).toFixed(0)}% da comissão
            </p>
          </div>

          {/* Situação financeira */}
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniStat label="Recebido" value={d.received} tone="text-income" />
            <MiniStat label="A receber" value={d.toReceive} tone="text-pending" />
            <MiniStat label="Comissão paga" value={d.commissionPaid} tone="text-content-muted" />
            <MiniStat label="Comissão a pagar" value={d.commissionToPay} tone="text-expense" />
          </div>

          {/* Duplicatas */}
          <div className="mt-4">
            <h3 className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-content-muted">
              Duplicatas
              <Tip label="O que são duplicatas" align="start">
                Cada parcela a receber da venda. Aqui você acompanha o vencimento, o que já entrou e
                o repasse de comissão ligado a ela.
              </Tip>
            </h3>
            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[10px] uppercase tracking-wide text-content-faint">
                    <th className="px-3 py-2 font-medium">Pc</th>
                    <th className="px-3 py-2 font-medium">Vencimento</th>
                    <th className="px-3 py-2 text-right font-medium">Receita</th>
                    <th className="px-3 py-2 text-right font-medium">Imposto</th>
                    <th className="px-3 py-2 text-right font-medium">Comissão</th>
                    <th className="px-3 py-2 text-right font-medium">Líquido</th>
                    <th className="px-3 py-2 text-center font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {d.installments.map((p) => (
                    <tr key={p.index}>
                      <td className="px-3 py-2.5 text-content-muted">
                        {p.index}/{p.count}
                      </td>
                      <td className="tnum px-3 py-2.5 text-content">{formatDateShort(p.date)}</td>
                      <td className="tnum px-3 py-2.5 text-right text-income">
                        {formatCurrency(p.revenue)}
                      </td>
                      <td className="tnum px-3 py-2.5 text-right text-content-muted">
                        {p.tax > 0 ? `−${formatCurrency(p.tax)}` : '—'}
                      </td>
                      <td className="tnum px-3 py-2.5 text-right text-content-muted">
                        {p.commission > 0 ? `−${formatCurrency(p.commission)}` : '—'}
                      </td>
                      <td className="tnum px-3 py-2.5 text-right font-semibold text-content">
                        {formatCurrency(p.net)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <InstallmentStatus p={p} today={toDateOnly(new Date())} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {brokerName && (
              <p className="mt-2 px-1 text-[11px] text-content-faint">
                Corretor do repasse: <span className="text-content-muted">{brokerName}</span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function InstallmentStatus({
  p,
  today,
}: {
  p: { revenueSettled: boolean; date: string }
  today: string
}) {
  if (p.revenueSettled)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-income">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Recebida
      </span>
    )
  const overdue = p.date < today
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-medium',
        overdue ? 'text-critical' : 'text-pending',
      )}
    >
      {overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
      {overdue ? 'Vencida' : 'A receber'}
    </span>
  )
}

function CascadeLine({
  label,
  value,
  hint,
  bold,
  accent,
  warn,
}: {
  label: string
  value: number
  hint?: string
  bold?: boolean
  accent?: boolean
  warn?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span
        className={cn(
          'text-sm',
          bold ? 'font-semibold text-content' : 'text-content-muted',
        )}
      >
        {label}
        {hint && (
          <span className={cn('ml-1.5 text-[11px]', warn ? 'text-pending' : 'text-content-faint')}>
            ({hint})
          </span>
        )}
      </span>
      <span
        className={cn(
          'tnum shrink-0 font-semibold',
          accent ? 'text-lg text-income' : value < 0 ? 'text-expense' : 'text-content',
        )}
      >
        {formatCurrency(value)}
      </span>
    </div>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-content-faint">{label}</p>
      <p className={cn('tnum text-sm font-bold', tone)}>{formatCurrency(value)}</p>
    </div>
  )
}
