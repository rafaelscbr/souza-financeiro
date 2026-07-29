import { ShieldAlert, ShieldCheck, Shield, CalendarClock, Lock, Scale } from 'lucide-react'
import { Section } from '@/components/ui/Section'
import { Progress } from '@/components/ui/Progress'
import { formatCurrency, formatDateShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { NextObligation, Survival } from '@/lib/survival'

const FAIXA = {
  critico: { icon: ShieldAlert, cor: 'text-expense', bg: 'bg-expense/10', barra: '#DC2626' },
  atencao: { icon: Shield, cor: 'text-pending', bg: 'bg-pending/10', barra: '#B45309' },
  saudavel: { icon: ShieldCheck, cor: 'text-income', bg: 'bg-income/10', barra: '#059669' },
} as const

/**
 * O bloco que abre o módulo pessoal: por quanto tempo o Rafael aguenta sem
 * receber nada.
 *
 * Fica no topo e sozinho porque é o único número que muda decisão. Saldo em
 * conta não diz nada sem o custo de vida ao lado; autonomia diz tudo.
 */
export function SurvivalPanel({
  s,
  proximas,
}: {
  s: Survival
  proximas: NextObligation[]
}) {
  const f = FAIXA[s.faixa]
  const Icon = f.icon
  const pctMeta = s.runwayMonths != null ? Math.min(1, s.runwayMonths / s.targetMonths) : 0

  return (
    <Section
      title="Fôlego financeiro"
      subtitle="O pior cenário e o cenário real, lado a lado"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', f.bg, f.cor)}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            {s.runwayMonths == null ? (
              <p className="text-sm text-content-muted">
                Ainda sem custo de vida apurado — lance alguns meses para o cálculo aparecer.
              </p>
            ) : (
              <>
                <p className="flex items-baseline gap-2">
                  <span className={cn('tnum text-3xl font-bold', f.cor)}>
                    {s.runwayMonths < 1
                      ? `${s.runwayDays} dias`
                      : `${s.runwayMonths.toFixed(1).replace('.', ',')} meses`}
                  </span>
                  <span className="text-xs text-content-faint">de autonomia</span>
                </p>
                <p className="mt-0.5 text-xs text-content-muted">
                  {formatCurrency(s.liquid)} líquidos ÷ {formatCurrency(s.livingCost)} por mês
                </p>
              </>
            )}
          </div>
        </div>

        {/* Com o que está contratado para entrar — o número honesto para renda
            por comissão. O de cima é o pior cenário: ninguém te paga nada. */}
        {s.withReceipts != null && s.withReceipts.incoming > 0 && (
          <div className="rounded-xl border border-income/25 bg-income/5 px-3.5 py-3">
            <p className="flex items-baseline gap-2">
              <span className="tnum text-2xl font-bold text-income">
                {s.withReceipts.months == null
                  ? 'mais de 24 meses'
                  : s.withReceipts.months < 1
                    ? `${Math.round(s.withReceipts.months * 30)} dias`
                    : `${s.withReceipts.months.toFixed(1).replace('.', ',')} meses`}
              </span>
              <span className="text-xs text-content-muted">contando o que já está contratado</span>
            </p>
            <p className="mt-0.5 text-xs text-content-muted">
              {formatCurrency(s.withReceipts.incoming)} a receber das empresas
              {s.withReceipts.breaksAt && (
                <> · o caixa aperta em {mesLegivel(s.withReceipts.breaksAt)}</>
              )}
            </p>
          </div>
        )}

        {s.businessOnCard > 0 && (
          <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-xs text-content-muted">
            <strong className="text-content">{formatCurrency(s.businessOnCard)}</strong> da sua
            fatura são gastos da imobiliária. Não entram no seu custo de vida e somem do seu cartão
            quando a PJ assumir — por isso o fôlego acima já os desconsidera.
          </p>
        )}

        {s.runwayMonths != null && (
          <div>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="text-content-muted">Meta: {s.targetMonths} meses de reserva</span>
              <span className="tnum text-content-faint">{Math.round(pctMeta * 100)}%</span>
            </div>
            <Progress value={pctMeta} color={f.barra} />
            {s.reserveGap > 0 && (
              <p className="mt-1 text-xs text-content-muted">
                Faltam <strong className="text-content">{formatCurrency(s.reserveGap)}</strong> para
                chegar lá.
              </p>
            )}
          </div>
        )}

        <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Bloco
            icon={<Lock className="h-3 w-3" />}
            label="Compromisso fixo"
            value={`${formatCurrency(s.fixedCommitment)}/mês`}
            nota={`${Math.round(s.fixedShare * 100)}% do custo`}
          />
          <Bloco
            icon={<Shield className="h-3 w-3" />}
            label="Cortando tudo"
            value={s.runwayIfCutToBone != null ? `${s.runwayIfCutToBone.toFixed(1).replace('.', ',')} meses` : '—'}
            nota="só com o fixo"
          />
          <Bloco
            icon={<Scale className="h-3 w-3" />}
            label="Endividamento"
            value={s.leverage != null ? `${Math.round(s.leverage * 100)}%` : '—'}
            nota="dívida ÷ bens"
          />
          <Bloco
            icon={<CalendarClock className="h-3 w-3" />}
            label="Próximo vencimento"
            value={proximas[0] ? formatCurrency(proximas[0].amount) : '—'}
            nota={proximas[0] ? `em ${proximas[0].daysAway} dias` : 'nada previsto'}
          />
        </dl>

        {proximas.length > 0 && (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {proximas.map((p) => (
              <li key={`${p.label}-${p.date}`} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm text-content">{p.label}</span>
                <span className="shrink-0 text-xs text-content-faint">
                  {formatDateShort(p.date)} · {p.daysAway}d
                </span>
                <span className="tnum shrink-0 text-sm font-semibold text-content">
                  {formatCurrency(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  )
}

/** '2026-11' → 'nov/26'. */
function mesLegivel(ym: string): string {
  const [y, m] = ym.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(m) - 1]}/${y.slice(2)}`
}

function Bloco({
  icon,
  label,
  value,
  nota,
}: {
  icon: React.ReactNode
  label: string
  value: string
  nota: string
}) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <dt className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-content-faint">
        {icon}
        {label}
      </dt>
      <dd className="tnum mt-0.5 text-sm font-bold text-content">{value}</dd>
      <dd className="text-[10px] text-content-faint">{nota}</dd>
    </div>
  )
}
