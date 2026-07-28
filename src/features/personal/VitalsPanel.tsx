import { PiggyBank, ShieldCheck, Receipt } from 'lucide-react'
import { Section } from '@/components/ui/Section'
import { Progress } from '@/components/ui/Progress'
import { Tip } from '@/components/ui/Tip'
import { formatCurrency, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PersonalVitals } from '@/lib/personal'

/** Meta de reserva considerada saudável para quem tem renda variável. */
const RESERVE_TARGET_MONTHS = 6

/**
 * Os três números de planejamento: quanto sobra do que entra, quanto custa
 * viver, e por quantos meses dá para viver sem receber nada. É o que separa
 * "lista de gastos" de gestão financeira.
 */
export function VitalsPanel({ vitals }: { vitals: PersonalVitals }) {
  const { savingsRateMonth, savingsRateAvg, livingCostAvg, monthsUsed, liquid, reserveMonths } =
    vitals

  // Abaixo de 3 meses fechados, média é chute — melhor dizer isso do que
  // mostrar um número com cara de verdade.
  const thin = monthsUsed < 3

  return (
    <Section
      title="Sua saúde financeira"
      subtitle={
        monthsUsed === 0
          ? 'Os números aparecem conforme você lança'
          : `Médias de ${monthsUsed} ${monthsUsed === 1 ? 'mês fechado' : 'meses fechados'}`
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Vital
          icon={<PiggyBank className="h-4 w-4" />}
          label="Taxa de poupança"
          tip="Quanto sobra de tudo que entra. Abaixo de 10% a vida financeira não avança; acima de 20% você constrói patrimônio de verdade."
          value={savingsRateMonth === null ? '—' : formatPercent(savingsRateMonth, 0)}
          hint={
            savingsRateAvg !== null
              ? `Média: ${formatPercent(savingsRateAvg, 0)}`
              : 'Sem renda registrada no mês'
          }
          tone={
            savingsRateMonth === null
              ? 'neutral'
              : savingsRateMonth >= 0.2
                ? 'good'
                : savingsRateMonth >= 0.1
                  ? 'warn'
                  : 'bad'
          }
        />

        <Vital
          icon={<Receipt className="h-4 w-4" />}
          label="Custo de vida"
          tip="Quanto sua vida custa por mês, em média, sem contar o que você guardou. É a régua de tudo: da reserva de emergência ao quanto você precisa tirar das empresas."
          value={livingCostAvg > 0 ? formatCurrency(livingCostAvg) : '—'}
          hint={
            livingCostAvg > 0
              ? thin
                ? 'Poucos meses ainda — a média vai firmar'
                : 'por mês, fora investimentos'
              : 'Lance seus gastos para calcular'
          }
          tone="neutral"
        />

        <Vital
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Reserva de emergência"
          tip={`Por quantos meses você viveria sem receber nada, usando o dinheiro líquido de hoje. A meta saudável para renda variável é ${RESERVE_TARGET_MONTHS} meses.`}
          value={reserveMonths === null ? '—' : `${reserveMonths.toFixed(1).replace('.', ',')} meses`}
          hint={
            reserveMonths === null
              ? 'Depende do custo de vida'
              : `${formatCurrency(liquid)} líquido disponível`
          }
          tone={
            reserveMonths === null
              ? 'neutral'
              : reserveMonths >= RESERVE_TARGET_MONTHS
                ? 'good'
                : reserveMonths >= 3
                  ? 'warn'
                  : 'bad'
          }
        >
          {reserveMonths !== null && (
            <div className="mt-2">
              <Progress
                value={reserveMonths / RESERVE_TARGET_MONTHS}
                color={
                  reserveMonths >= RESERVE_TARGET_MONTHS
                    ? '#059669'
                    : reserveMonths >= 3
                      ? '#B45309'
                      : '#DC2626'
                }
              />
              <p className="mt-1 text-[11px] text-content-faint">
                Meta: {RESERVE_TARGET_MONTHS} meses ({formatCurrency(livingCostAvg * RESERVE_TARGET_MONTHS)})
              </p>
            </div>
          )}
        </Vital>
      </div>
    </Section>
  )
}

function Vital({
  icon,
  label,
  tip,
  value,
  hint,
  tone,
  children,
}: {
  icon: React.ReactNode
  label: string
  tip: string
  value: string
  hint: string
  tone: 'good' | 'warn' | 'bad' | 'neutral'
  children?: React.ReactNode
}) {
  const toneClass =
    tone === 'good'
      ? 'text-income'
      : tone === 'warn'
        ? 'text-pending'
        : tone === 'bad'
          ? 'text-expense'
          : 'text-content'

  return (
    <div className="rounded-xl border border-line bg-surface-2/50 p-3.5">
      <div className="flex items-center gap-1.5 text-content-muted">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
        <Tip label={label}>{tip}</Tip>
      </div>
      <p className={cn('tnum mt-1.5 text-2xl font-bold', toneClass)}>{value}</p>
      <p className="mt-0.5 text-xs text-content-faint">{hint}</p>
      {children}
    </div>
  )
}
