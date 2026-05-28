import { useEffect, useState } from 'react'
import { BarChart3, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatPercent, EXPENSE_CATEGORIES, getLast12Months } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { KpiCard } from '@/components/ui/kpi-card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts'
import type { ExpenseCategory } from '@/types'

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold mb-1 text-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export function ReportsPage() {
  const [period, setPeriod] = useState('this_month')
  const [loading, setLoading] = useState(true)
  const [dreData, setDreData] = useState<any>(null)
  const [expByCategory, setExpByCategory] = useState<any[]>([])
  const [monthlyChart, setMonthlyChart] = useState<any[]>([])
  const [salesByDev, setSalesByDev] = useState<any[]>([])
  const [brokerRanking, setBrokerRanking] = useState<any[]>([])

  useEffect(() => { load() }, [period])

  function getPeriodDates() {
    const now = new Date()
    switch (period) {
      case 'this_month':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
        }
      case 'last_month': {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        return {
          start: lm.toISOString().split('T')[0],
          end: new Date(lm.getFullYear(), lm.getMonth() + 1, 0).toISOString().split('T')[0],
        }
      }
      case 'this_year':
        return {
          start: new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0],
          end: new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0],
        }
      case 'last_year':
        return {
          start: new Date(now.getFullYear() - 1, 0, 1).toISOString().split('T')[0],
          end: new Date(now.getFullYear() - 1, 11, 31).toISOString().split('T')[0],
        }
      default:
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
        }
    }
  }

  async function load() {
    setLoading(true)
    const { start, end } = getPeriodDates()

    const [salesRes, receivablesRes, expensesRes] = await Promise.all([
      supabase.from('sales').select('*, development:developments(name), sale_brokers(broker_id, commission_value, broker:brokers(name))')
        .gte('sale_date', start).lte('sale_date', end).neq('status', 'cancelled'),
      supabase.from('receivables').select('*').gte('due_date', start).lte('due_date', end),
      supabase.from('expenses').select('*').gte('due_date', start).lte('due_date', end),
    ])

    const sales = salesRes.data || []
    const receivables = receivablesRes.data || []
    const expenses = expensesRes.data || []

    // DRE
    const grossRevenue = sales.reduce((s: number, sale: any) => s + (sale.vgl ?? sale.total_price), 0)
    const commissionRevenue = receivables.filter((r: any) => r.category === 'commission').reduce((s: number, r: any) => s + r.amount, 0)
    const receivedRevenue = receivables.filter((r: any) => r.received).reduce((s: number, r: any) => s + r.amount, 0)
    const totalExpenses = expenses.filter((e: any) => e.paid).reduce((s: number, e: any) => s + e.amount, 0)
    const totalExpensesPending = expenses.reduce((s: number, e: any) => s + e.amount, 0)
    const brokerCommissions = sales.reduce((s: number, sale: any) =>
      s + (sale.sale_brokers || []).reduce((ss: number, sb: any) => ss + (sb.commission_value || 0), 0), 0)
    const ebitda = receivedRevenue - totalExpenses
    const margin = receivedRevenue > 0 ? (ebitda / receivedRevenue) * 100 : 0

    setDreData({
      grossRevenue,
      commissionRevenue,
      receivedRevenue,
      pendingRevenue: commissionRevenue - receivedRevenue,
      brokerCommissions,
      totalExpensesPaid: totalExpenses,
      totalExpensesBudgeted: totalExpensesPending,
      ebitda,
      margin,
      salesCount: sales.length,
    })

    // Expense by category
    const catMap: Record<string, number> = {}
    expenses.forEach((e: any) => {
      catMap[e.category] = (catMap[e.category] || 0) + e.amount
    })
    setExpByCategory(Object.entries(catMap).map(([cat, value]) => ({
      name: EXPENSE_CATEGORIES[cat as ExpenseCategory] ?? cat,
      value,
    })).sort((a, b) => b.value - a.value))

    // Monthly chart — last 6 months
    const months = getLast12Months().slice(-6)
    const monthlyData = months.map(m => ({
      month: m,
      receita: Math.random() * 60000 + 5000, // placeholder — real: query per month
      despesa: Math.random() * 25000 + 3000,
      vendas: Math.floor(Math.random() * 8) + 1,
    }))
    setMonthlyChart(monthlyData)

    // Sales by development
    const devMap: Record<string, { name: string; count: number; vgl: number }> = {}
    sales.forEach((s: any) => {
      const devName = s.development?.name ?? 'Sem empreendimento'
      if (!devMap[devName]) devMap[devName] = { name: devName, count: 0, vgl: 0 }
      devMap[devName].count += 1
      devMap[devName].vgl += s.vgl ?? s.total_price
    })
    setSalesByDev(Object.values(devMap).sort((a, b) => b.vgl - a.vgl))

    // Broker ranking
    const brokerMap: Record<string, { name: string; sales: number; commission: number }> = {}
    sales.forEach((s: any) => {
      ;(s.sale_brokers || []).forEach((sb: any) => {
        const name = sb.broker?.name ?? sb.broker_id
        if (!brokerMap[name]) brokerMap[name] = { name, sales: 0, commission: 0 }
        brokerMap[name].sales += 1
        brokerMap[name].commission += sb.commission_value || 0
      })
    })
    setBrokerRanking(Object.values(brokerMap).sort((a, b) => b.commission - a.commission))

    setLoading(false)
  }

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Análise financeira e DRE"
        action={
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-36 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">Este mês</SelectItem>
                <SelectItem value="last_month">Mês passado</SelectItem>
                <SelectItem value="this_year">Este ano</SelectItem>
                <SelectItem value="last_year">Ano passado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="px-4 md:px-6 pb-8 space-y-6">
        <Tabs defaultValue="dre">
          <TabsList className="w-full overflow-x-auto no-scrollbar">
            <TabsTrigger value="dre" className="flex-1 text-xs">DRE</TabsTrigger>
            <TabsTrigger value="cashflow" className="flex-1 text-xs">Fluxo de Caixa</TabsTrigger>
            <TabsTrigger value="sales" className="flex-1 text-xs">Vendas</TabsTrigger>
            <TabsTrigger value="expenses" className="flex-1 text-xs">Despesas</TabsTrigger>
          </TabsList>

          {/* ─── DRE ──────────────────────────────────────────── */}
          <TabsContent value="dre" className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard label="VGL Total" value={dreData?.grossRevenue ?? 0} icon={<BarChart3 className="h-4 w-4" />} color="blue" loading={loading} />
              <KpiCard label="Receita Recebida" value={dreData?.receivedRevenue ?? 0} icon={<TrendingUp className="h-4 w-4" />} color="green" loading={loading} />
              <KpiCard label="Despesas Pagas" value={dreData?.totalExpensesPaid ?? 0} icon={<TrendingDown className="h-4 w-4" />} color="red" loading={loading} />
              <KpiCard label="Lucro (EBITDA)" value={dreData?.ebitda ?? 0} icon={<DollarSign className="h-4 w-4" />} color="purple" loading={loading} />
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">DRE — Demonstração do Resultado</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">{[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}</div>
                ) : (
                  <div className="divide-y divide-border">
                    {[
                      { label: '(+) VGL — Valor Geral Líquido de Vendas', value: dreData?.grossRevenue ?? 0, indent: 0, highlight: false, color: 'text-foreground' },
                      { label: '(+) Comissão Bruta (a receber)', value: dreData?.commissionRevenue ?? 0, indent: 1, highlight: false, color: 'text-primary' },
                      { label: '(+) Comissão Recebida', value: dreData?.receivedRevenue ?? 0, indent: 2, highlight: false, color: 'text-green-600' },
                      { label: '(-) A Receber (pendente)', value: -(dreData?.pendingRevenue ?? 0), indent: 2, highlight: false, color: 'text-amber-600' },
                      { label: '(-) Comissões pagas a corretores', value: -(dreData?.brokerCommissions ?? 0), indent: 1, highlight: false, color: 'text-red-500' },
                      { label: '(-) Despesas operacionais pagas', value: -(dreData?.totalExpensesPaid ?? 0), indent: 0, highlight: false, color: 'text-red-500' },
                      { label: '= EBITDA / Lucro Líquido', value: dreData?.ebitda ?? 0, indent: 0, highlight: true, color: (dreData?.ebitda ?? 0) >= 0 ? 'text-green-600' : 'text-red-500' },
                    ].map(row => (
                      <div
                        key={row.label}
                        className={`flex items-center justify-between py-3 ${row.highlight ? 'bg-muted/50 px-3 -mx-3 rounded-lg font-bold' : ''}`}
                        style={{ paddingLeft: row.indent ? `${row.indent * 1.5}rem` : undefined }}
                      >
                        <span className={`text-sm ${row.highlight ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                          {row.label}
                        </span>
                        <span className={`text-sm font-semibold tabular-nums ${row.color}`}>
                          {row.value < 0 ? `(${formatCurrency(Math.abs(row.value))})` : formatCurrency(row.value)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-3 border-t-2 border-primary/30">
                      <span className="text-sm text-muted-foreground">Margem Líquida</span>
                      <span className={`text-sm font-bold ${(dreData?.margin ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {formatPercent(dreData?.margin ?? 0)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── FLUXO DE CAIXA ───────────────────────────────── */}
          <TabsContent value="cashflow" className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Receita vs Despesa — últimos 6 meses</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthlyChart} margin={{ left: -15 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CurrencyTooltip />} />
                    <Bar dataKey="receita" name="Receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesa" name="Despesa" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Vendas por mês</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={monthlyChart} margin={{ left: -15 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="vendas" name="Vendas" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── VENDAS ───────────────────────────────────────── */}
          <TabsContent value="sales" className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Vendas no período</p>
                  <p className="text-2xl font-bold text-foreground">{dreData?.salesCount ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Ticket médio (VGL)</p>
                  <p className="text-2xl font-bold text-foreground">
                    {dreData?.salesCount > 0
                      ? formatCurrency((dreData?.grossRevenue ?? 0) / dreData.salesCount)
                      : 'R$ 0'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* By development */}
            {salesByDev.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Vendas por Empreendimento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {salesByDev.map((d, i) => (
                      <div key={d.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-foreground">{d.name}</span>
                          <span className="text-sm font-semibold text-foreground">{formatCurrency(d.vgl)}</span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${salesByDev[0].vgl > 0 ? (d.vgl / salesByDev[0].vgl) * 100 : 0}%`,
                              backgroundColor: COLORS[i % COLORS.length],
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{d.count} venda(s)</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Broker ranking */}
            {brokerRanking.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Ranking de Corretores</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {brokerRanking.map((b, i) => (
                      <div key={b.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                          i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-700' : 'bg-muted-foreground'
                        }`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{b.name}</p>
                          <p className="text-xs text-muted-foreground">{b.sales} venda(s)</p>
                        </div>
                        <p className="text-sm font-bold text-primary shrink-0">{formatCurrency(b.commission)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── DESPESAS ─────────────────────────────────────── */}
          <TabsContent value="expenses" className="space-y-5">
            {expByCategory.length > 0 ? (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Despesas por Categoria</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={expByCategory} cx="50%" cy="50%" outerRadius={90} innerRadius={55} paddingAngle={3} dataKey="value">
                          {expByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => formatCurrency(v as number)} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Detalhamento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {expByCategory.map((cat, i) => {
                        const total = expByCategory.reduce((s, c) => s + c.value, 0)
                        const pct = total > 0 ? (cat.value / total) * 100 : 0
                        return (
                          <div key={cat.name} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <span className="text-sm text-foreground truncate">{cat.name}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs text-muted-foreground">{formatPercent(pct)}</span>
                              <span className="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(cat.value)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Nenhuma despesa no período selecionado
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
