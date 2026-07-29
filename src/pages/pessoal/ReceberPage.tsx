import { useMemo } from 'react'
import { ArrowDownCircle, Handshake, TrendingUp, AlertTriangle } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { EmptyState } from '@/components/ui/EmptyState'
import { InvoiceForecastChart } from '@/features/dashboard/Charts'
import { ownerReceivables, receivablesByMonth } from '@/lib/commissions'
import { formatCurrency, formatDateShort, formatMonthShort, parseDateOnly, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Previsão dos recebimentos do Rafael: o que as empresas ainda devem a ele,
 * por corretagem ou como fatia do lucro.
 *
 * Os lançamentos vivem no razão das EMPRESAS — o dinheiro ainda é delas e só
 * vira receita dele quando sai. Espelhar no razão pessoal contaria a mesma
 * entrada duas vezes na hora da baixa.
 */
export function ReceberPage() {
  const { businessTransactions, companies } = useAppData()
  const hoje = toDateOnly(new Date())

  const itens = useMemo(
    () => ownerReceivables(businessTransactions, hoje),
    [businessTransactions, hoje],
  )
  const porMes = useMemo(() => receivablesByMonth(itens), [itens])

  const total = itens.reduce((s, i) => s + i.amount, 0)
  const vencidos = itens.filter((i) => i.overdue)
  const corretagem = itens.filter((i) => i.kind === 'corretagem').reduce((s, i) => s + i.amount, 0)
  const lucro = itens.filter((i) => i.kind === 'lucro').reduce((s, i) => s + i.amount, 0)

  const grafico = porMes.slice(0, 12).map((m) => ({
    label: formatMonthShort(parseDateOnly(`${m.month}-01`)),
    valor: m.amount,
    futura: m.month > hoje.slice(0, 7),
  }))

  if (itens.length === 0) {
    return (
      <EmptyState
        icon={<ArrowDownCircle className="h-8 w-8" />}
        title="Nada a receber das empresas"
        description="Comissões suas e distribuições de lucro aparecem aqui assim que forem lançadas nas vendas."
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Bloco label="Total a receber" valor={total} tom="income" nota={`${itens.length} lançamentos`} />
        <Bloco
          label="Como corretor"
          valor={corretagem}
          nota="vendas que você fez"
          icone={<Handshake className="h-3 w-3" />}
        />
        <Bloco
          label="Como sócio"
          valor={lucro}
          nota="sua fatia do lucro"
          icone={<TrendingUp className="h-3 w-3" />}
        />
        <Bloco
          label="Vencido"
          valor={vencidos.reduce((s, i) => s + i.amount, 0)}
          tom={vencidos.length > 0 ? 'expense' : undefined}
          nota={vencidos.length > 0 ? `${vencidos.length} atrasado(s)` : 'nada em atraso'}
          icone={vencidos.length > 0 ? <AlertTriangle className="h-3 w-3" /> : undefined}
        />
      </div>

      {grafico.length > 1 && (
        <Section title="Previsão de recebimentos" subtitle="Quanto entra em cada mês">
          <InvoiceForecastChart data={grafico} />
        </Section>
      )}

      <Section title="Um a um" subtitle="Na ordem em que entram">
        <ul className="divide-y divide-line">
          {itens.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-3">
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  i.kind === 'corretagem' ? 'bg-emerald/10 text-emerald' : 'bg-withdrawal/12 text-withdrawal',
                )}
              >
                {i.kind === 'corretagem' ? (
                  <Handshake className="h-4 w-4" />
                ) : (
                  <TrendingUp className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-content">{i.label}</p>
                <p
                  className={cn(
                    'truncate text-xs',
                    i.overdue ? 'font-medium text-expense' : 'text-content-faint',
                  )}
                >
                  {i.overdue ? 'Venceu' : 'Entra'} {formatDateShort(i.date)}
                  {' · '}
                  {i.kind === 'corretagem' ? 'corretagem' : 'lucro'}
                  {' · '}
                  {companies.find((c) => c.id === i.companyId)?.name ?? 'Empresa'}
                </p>
              </div>
              <span className="tnum shrink-0 text-sm font-semibold text-income">
                {formatCurrency(i.amount)}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

function Bloco({
  label,
  valor,
  nota,
  tom,
  icone,
}: {
  label: string
  valor: number
  nota: string
  tom?: 'income' | 'expense'
  icone?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
      <p className="flex items-center gap-1 text-xs text-content-faint">
        {icone}
        {label}
      </p>
      <p
        className={cn(
          'tnum text-lg font-bold',
          tom === 'income' ? 'text-income' : tom === 'expense' ? 'text-expense' : 'text-content',
        )}
      >
        {formatCurrency(valor)}
      </p>
      <p className="text-[10px] text-content-faint">{nota}</p>
    </div>
  )
}
