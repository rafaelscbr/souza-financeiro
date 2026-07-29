import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts'
import { formatCurrency, formatCurrencyCompact } from '@/lib/format'

const AXIS = '#64748B'
const GRID = 'rgba(148,163,184,0.22)'

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-pop">
      {label && <p className="mb-1 text-xs font-medium text-content-muted">{label}</p>}
      <div className="space-y-0.5">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-content-muted">{entry.name}</span>
            <span className="tnum ml-auto font-semibold text-content">
              {formatCurrency(Number(entry.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export interface ComparisonDatum {
  name: string
  receita: number
  despesa: number
  lucro: number
}

/** Barras agrupadas: receita × despesa × lucro por empresa. */
export function ComparisonBarChart({ data }: { data: ComparisonDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatCurrencyCompact(Number(v))}
          width={64}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
        <Bar dataKey="receita" name="Receita" fill="#10B981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="despesa" name="Despesa" fill="#EF4444" radius={[4, 4, 0, 0]} />
        <Bar dataKey="lucro" name="Lucro" fill="#2563EB" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export interface TrendDatum {
  label: string
  lucro: number
}

export interface ForecastDatum {
  label: string
  monthKey: string
  saldo: number
  entra: number
  sai: number
  negativo: boolean
}

/**
 * Forecast de caixa: barras de entrada/saída por mês + a linha do saldo
 * acumulado. A linha do zero deixa o furo de caixa saltar aos olhos.
 * Clicar num mês dispara `onSelectMonth` para abrir as duplicatas dele.
 */
export function CashForecastChart({
  data,
  onSelectMonth,
  selectedKey,
}: {
  data: ForecastDatum[]
  onSelectMonth?: (monthKey: string) => void
  selectedKey?: string | null
}) {
  const selectedLabel = selectedKey ? data.find((d) => d.monthKey === selectedKey)?.label : null
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart
        data={data}
        margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
        onClick={(state) => {
          const p = state?.activePayload?.[0]?.payload as ForecastDatum | undefined
          if (p && onSelectMonth) onSelectMonth(p.monthKey)
        }}
        className={onSelectMonth ? 'cursor-pointer' : undefined}
      >
        <defs>
          <linearGradient id="saldoFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatCurrencyCompact(Number(v))}
          width={64}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
        {selectedLabel && (
          <ReferenceLine x={selectedLabel} stroke="rgba(37,99,235,0.5)" strokeWidth={8} />
        )}
        <ReferenceLine y={0} stroke="#DC2626" strokeWidth={1.5} strokeDasharray="4 3" />
        <Bar dataKey="entra" name="Entra" fill="#34D399" radius={[3, 3, 0, 0]} maxBarSize={22} />
        <Bar dataKey="sai" name="Sai" fill="#F87171" radius={[3, 3, 0, 0]} maxBarSize={22} />
        <Area
          type="monotone"
          dataKey="saldo"
          name="Saldo projetado"
          stroke="#2563EB"
          strokeWidth={2.5}
          fill="url(#saldoFill)"
          dot={(props) => {
            const { cx, cy, payload } = props as { cx: number; cy: number; payload: ForecastDatum }
            return (
              <circle
                key={`${cx}-${cy}`}
                cx={cx}
                cy={cy}
                r={payload.negativo ? 4.5 : 3}
                fill={payload.negativo ? '#DC2626' : '#2563EB'}
              />
            )
          }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/** Linha: evolução do lucro ao longo dos meses. */
export function ProfitTrendChart({ data }: { data: TrendDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatCurrencyCompact(Number(v))}
          width={64}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: GRID }} />
        <Line
          type="monotone"
          dataKey="lucro"
          name="Lucro"
          stroke="#10B981"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#10B981' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export interface WaterfallDatum {
  label: string
  /** Base invisível que posiciona a barra flutuante. */
  spacer: number
  /** Altura visível. */
  bar: number
  fill: string
  /** Valor real (com sinal) para o tooltip. */
  value: number
  isTotal: boolean
}

function WaterfallTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as WaterfallDatum | undefined
  if (!d) return null
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-pop">
      <p className="text-xs font-medium text-content-muted">{d.label}</p>
      <p className="tnum text-sm font-bold text-content">{formatCurrency(d.value)}</p>
    </div>
  )
}

/**
 * Cascata do DRE: a receita bruta descendo pelas deduções até o lucro.
 * Cada degrau mostra quanto some em imposto, comissão e despesa — a
 * mesma informação da tabela, mas onde o olho enxerga a queda.
 */
export function WaterfallChart({ data }: { data: WaterfallDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 10 }} tickLine={false} axisLine={false} interval={0} />
        <YAxis
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatCurrencyCompact(Number(v))}
          width={64}
        />
        <Tooltip content={<WaterfallTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
        <Bar dataKey="spacer" stackId="w" fill="transparent" />
        <Bar dataKey="bar" stackId="w" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export interface DevelopmentDatum {
  name: string
  receita: number
  resultado: number
}

/** Receita × resultado líquido por empreendimento. */
export function DevelopmentChart({ data }: { data: DevelopmentDatum[] }) {
  const height = Math.max(140, data.length * 54)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatCurrencyCompact(Number(v))}
        />
        <YAxis type="category" dataKey="name" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={130} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
        <Bar dataKey="receita" name="Receita" fill="#34D399" radius={[0, 3, 3, 0]} maxBarSize={16} />
        <Bar dataKey="resultado" name="Resultado" fill="#2563EB" radius={[0, 3, 3, 0]} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export interface CategoryDatum {
  name: string
  value: number
  color: string
}

/** Barras horizontais por categoria (receita ou despesa). */
export function CategoryBarChart({ data }: { data: CategoryDatum[] }) {
  const height = Math.max(120, data.length * 42)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatCurrencyCompact(Number(v))}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={120}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
        <Bar dataKey="value" name="Total" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export interface PersonalMonthDatum {
  label: string
  renda: number
  custo: number
  sobra: number
}

/**
 * Renda × custo de vida × sobra, mês a mês.
 *
 * As barras são o que entrou e o que a vida custou; a linha é o que sobrou.
 * É o gráfico que responde "eu estou ganhando terreno ou perdendo?" — nenhum
 * número isolado responde isso.
 */
export function PersonalTrendChart({ data }: { data: PersonalMonthDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatCurrencyCompact(Number(v))}
          width={64}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
        <ReferenceLine y={0} stroke={AXIS} strokeWidth={1} />
        <Bar dataKey="renda" name="Entrou" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={26} />
        <Bar dataKey="custo" name="Custo de vida" fill="#DC2626" radius={[4, 4, 0, 0]} maxBarSize={26} />
        <Line
          type="monotone"
          dataKey="sobra"
          name="Sobrou"
          stroke="#6366F1"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#6366F1' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export interface InvoiceDatum {
  label: string
  valor: number
  /** Fatura já fechada (passado) pinta diferente da que ainda vai fechar. */
  futura: boolean
}

/**
 * As próximas faturas do cartão, mês a mês.
 *
 * Cada parcelamento em curso é uma barra que só vai baixar quando ele acabar —
 * ver o degrau caindo é o que mostra em que mês o orçamento respira.
 */
export function InvoiceForecastChart({ data }: { data: InvoiceDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatCurrencyCompact(Number(v))}
          width={64}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
        <Bar dataKey="valor" name="Fatura" radius={[4, 4, 0, 0]} maxBarSize={34}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.futura ? '#94A3B8' : '#BE123C'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export interface StackedInvoiceDatum {
  label: string
  seu: number
  empresa: number
}

/**
 * Fatura do cartão empilhada: o que é gasto dele embaixo, o da empresa em cima.
 *
 * Uma barra só esconderia a informação que interessa — o total que o banco
 * cobra não é o custo dele.
 */
export function StackedInvoiceChart({ data }: { data: StackedInvoiceDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatCurrencyCompact(Number(v))}
          width={64}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
        <Bar dataKey="seu" name="Seu gasto" stackId="f" fill="#BE123C" maxBarSize={34} />
        <Bar dataKey="empresa" name="Da imobiliária" stackId="f" fill="#94A3B8" radius={[4, 4, 0, 0]} maxBarSize={34} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export interface CashflowDatum {
  label: string
  entrada: number
  /** Negativo, para descer no eixo. */
  saida: number
  saldo: number
}

/**
 * Entradas, saídas e o saldo que sobra — o gráfico que responde "quando aperta".
 *
 * As barras vão para lados opostos porque entrada e saída não se comparam em
 * altura: o que importa é a LINHA do saldo cruzando o zero. Uma barra
 * empilhada esconderia justamente esse cruzamento.
 */
export function CashflowChart({ data }: { data: CashflowDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }} stackOffset="sign">
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatCurrencyCompact(Number(v))}
          width={64}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
        <ReferenceLine y={0} stroke={AXIS} strokeWidth={1} />
        <Bar dataKey="entrada" name="Entra" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="saida" name="Sai" fill="#DC2626" radius={[0, 0, 4, 4]} maxBarSize={28} />
        <Line
          type="monotone"
          dataKey="saldo"
          name="Saldo no fim do mês"
          stroke="#6366F1"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#6366F1' }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
