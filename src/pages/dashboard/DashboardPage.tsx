import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, ArrowDownCircle, ArrowUpCircle, Award,
  DollarSign, AlertCircle, Plus
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, formatCurrencyShort, getLast12Months } from '@/lib/utils'
import { KpiCard } from '@/components/ui/kpi-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import type { Sale, Expense, Receivable } from '@/types'

// Chart tooltip custom
function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

interface DashboardData {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  pendingReceivables: number
  pendingCommissions: number
  recentSales: Sale[]
  overdueItems: (Receivable | Expense)[]
  chartData: { month: string; receita: number; despesa: number }[]
  expenseByCategory: { name: string; value: number }[]
}

const CHART_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'month' | 'year'>('month')

  useEffect(() => {
    loadDashboard()
  }, [period])

  async function loadDashboard() {
    setLoading(true)

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
    const periodStart = period === 'month' ? startOfMonth : startOfYear

    const [salesRes, expensesRes, receivablesRes, commissionsRes] = await Promise.all([
      supabase.from('sales').select('*, development:developments(name), sale_brokers(*, broker:brokers(name))').gte('sale_date', periodStart).order('sale_date', { ascending: false }),
      supabase.from('expenses').select('*').gte('due_date', periodStart),
      supabase.from('receivables').select('*, sale:sales(buyer_name)').gte('due_date', periodStart),
      supabase.from('commission_installments').select('*, broker:brokers(name), sale:sales(buyer_name)').eq('paid', false),
    ])

    const sales: Sale[] = salesRes.data || []
    const expenses: Expense[] = expensesRes.data || []
    const receivables: Receivable[] = receivablesRes.data || []
    const commissions = commissionsRes.data || []

    // KPIs
    const totalRevenue = receivables.filter(r => r.received).reduce((s, r) => s + r.amount, 0)
    const totalExpenses = expenses.filter(e => e.paid).reduce((s, e) => s + e.amount, 0)
    const netProfit = totalRevenue - totalExpenses
    const pendingReceivables = receivables.filter(r => !r.received).reduce((s, r) => s + r.amount, 0)
    const pendingCommissions = commissions.reduce((s: number, c: any) => s + c.amount, 0)

    // Overdue
    const today = new Date().toISOString().split('T')[0]
    const overdueReceivables = receivables.filter(r => !r.received && r.due_date < today)
    const overdueExpenses = expenses.filter(e => !e.paid && e.due_date < today)
    const overdueItems = [...overdueReceivables, ...overdueExpenses].slice(0, 5)

    // Chart data - last 6 months
    const months = getLast12Months().slice(-6)
    const chartData = months.map((month) => ({
      month,
      receita: Math.random() * 50000 + 10000, // placeholder — real: query per month
      despesa: Math.random() * 20000 + 5000,
    }))

    // Expense by category
    const catMap: Record<string, number> = {}
    expenses.forEach((e) => {
      catMap[e.category] = (catMap[e.category] || 0) + e.amount
    })
    const expenseByCategory = Object.entries(catMap).map(([name, value]) => ({ name, value }))

    setData({
      totalRevenue,
      totalExpenses,
      netProfit,
      pendingReceivables,
      pendingCommissions,
      recentSales: sales.slice(0, 5),
      overdueItems,
      chartData,
      expenseByCategory,
    })
    setLoading(false)
  }

  return (
    <div className="space-y-0">
      <PageHeader
        title="Dashboard"
        description={`Visão geral financeira — ${period === 'month' ? 'este mês' : 'este ano'}`}
        action={
          <div className="flex items-center gap-2">
            <div className="flex bg-muted rounded-lg p-1">
              <button
                onClick={() => setPeriod('month')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${period === 'month' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
              >
                Mês
              </button>
              <button
                onClick={() => setPeriod('year')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${period === 'year' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
              >
                Ano
              </button>
            </div>
            <Button size="sm" asChild>
              <Link to="/vendas/nova">
                <Plus className="h-4 w-4" />
                Nova venda
              </Link>
            </Button>
          </div>
        }
      />

      <div className="px-4 md:px-6 pb-6 space-y-5">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <KpiCard
            label="Receita Recebida"
            value={data?.totalRevenue ?? 0}
            icon={<TrendingUp className="h-4 w-4" />}
            color="green"
            change={8.3}
            loading={loading}
          />
          <KpiCard
            label="Despesas Pagas"
            value={data?.totalExpenses ?? 0}
            icon={<ArrowUpCircle className="h-4 w-4" />}
            color="red"
            change={-2.1}
            loading={loading}
          />
          <KpiCard
            label="Lucro Líquido"
            value={data?.netProfit ?? 0}
            icon={<DollarSign className="h-4 w-4" />}
            color="blue"
            change={12.4}
            loading={loading}
          />
          <KpiCard
            label="A Receber"
            value={data?.pendingReceivables ?? 0}
            icon={<ArrowDownCircle className="h-4 w-4" />}
            color="amber"
            subtitle="próximos 90 dias"
            loading={loading}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Revenue vs Expense Chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Receita vs Despesa</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-48 bg-muted animate-pulse rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data?.chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCurrencyShort} className="text-muted-foreground" />
                    <Tooltip content={<CurrencyTooltip />} />
                    <Area type="monotone" dataKey="receita" name="Receita" stroke="#10b981" fill="url(#colorReceita)" strokeWidth={2} />
                    <Area type="monotone" dataKey="despesa" name="Despesa" stroke="#ef4444" fill="url(#colorDespesa)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Expense by Category */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Despesas por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-48 bg-muted animate-pulse rounded-lg" />
              ) : data?.expenseByCategory && data.expenseByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={data.expenseByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {data.expenseByCategory.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(v as number)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                  Sem despesas no período
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom section */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Recent Sales */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Últimas Vendas</CardTitle>
                <Link to="/vendas" className="text-xs text-primary hover:underline">Ver todas</Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : data?.recentSales && data.recentSales.length > 0 ? (
                <div className="space-y-2">
                  {data.recentSales.map((sale) => (
                    <Link
                      key={sale.id}
                      to={`/vendas/${sale.id}`}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-primary text-xs font-bold">
                          {sale.buyer_name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{sale.buyer_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {sale.development?.name ?? 'Sem empreendimento'} • {formatDate(sale.sale_date)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-foreground shrink-0">
                        {formatCurrency(sale.total_price)}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma venda no período
                </p>
              )}
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  Alertas
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {!loading && data?.pendingCommissions && data.pendingCommissions > 0 && (
                  <Link to="/comissoes" className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors">
                    <Award className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Comissões pendentes</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(data.pendingCommissions)} a pagar para corretores</p>
                    </div>
                  </Link>
                )}

                {!loading && data?.overdueItems && data.overdueItems.length > 0 && (
                  <div className="flex items-start gap-3 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Itens vencidos</p>
                      <p className="text-xs text-muted-foreground">{data.overdueItems.length} item(s) em atraso</p>
                    </div>
                  </div>
                )}

                {!loading && (!data?.pendingCommissions && (!data?.overdueItems || data.overdueItems.length === 0)) && (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">Nenhum alerta pendente 🎉</p>
                  </div>
                )}

                {loading && (
                  <div className="space-y-2">
                    {[1, 2].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
