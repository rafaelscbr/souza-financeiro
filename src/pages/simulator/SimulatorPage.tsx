import { useEffect, useState, useCallback } from 'react'
import { Calculator, TrendingUp, TrendingDown, DollarSign, RefreshCw, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToastActions } from '@/components/ui/toast'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface ScenarioInput {
  name: string
  vgl: number
  commissionPct: number
  extraExpenses: number
}

interface ScenarioResult {
  name: string
  vgl: number
  grossCommission: number
  netCommission: number
  totalExpenses: number
  netProfit: number
  margin: number
}

function calcScenario(input: ScenarioInput, baseExpenses: number): ScenarioResult {
  const grossCommission = (input.vgl * input.commissionPct) / 100
  const netCommission = grossCommission // simplified — in real: minus broker payout
  const totalExpenses = baseExpenses + input.extraExpenses
  const netProfit = netCommission - totalExpenses
  const margin = netCommission > 0 ? (netProfit / netCommission) * 100 : 0
  return {
    name: input.name,
    vgl: input.vgl,
    grossCommission,
    netCommission,
    totalExpenses,
    netProfit,
    margin,
  }
}

const DEFAULT_SCENARIOS: ScenarioInput[] = [
  { name: 'Pessimista', vgl: 800_000, commissionPct: 6, extraExpenses: 0 },
  { name: 'Realista', vgl: 1_500_000, commissionPct: 6, extraExpenses: 0 },
  { name: 'Otimista', vgl: 3_000_000, commissionPct: 6, extraExpenses: 0 },
]

export function SimulatorPage() {
  const toast = useToastActions()

  // Simple simulator state
  const [simVgl, setSimVgl] = useState('')
  const [simCommPct, setSimCommPct] = useState('6')
  const [baseExpenses, setBaseExpenses] = useState(0)
  const [loadingExpenses, setLoadingExpenses] = useState(true)

  // Scenario inputs
  const [scenarios, setScenarios] = useState<ScenarioInput[]>(DEFAULT_SCENARIOS)

  useEffect(() => { loadMonthlyExpenses() }, [])

  async function loadMonthlyExpenses() {
    setLoadingExpenses(true)
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    const { data } = await supabase
      .from('expenses')
      .select('amount')
      .gte('due_date', start)
      .lte('due_date', end)
    const total = (data || []).reduce((s: number, e: any) => s + e.amount, 0)
    setBaseExpenses(total)
    setLoadingExpenses(false)
  }

  // Simple sim calc
  const simVglNum = parseFloat(simVgl.replace(/\./g, '').replace(',', '.')) || 0
  const simCommPctNum = parseFloat(simCommPct) || 6
  const simGross = (simVglNum * simCommPctNum) / 100
  const simNet = simGross - baseExpenses
  const simMargin = simGross > 0 ? (simNet / simGross) * 100 : 0
  const breakEvenVgl = simCommPctNum > 0 ? (baseExpenses / simCommPctNum) * 100 : 0

  // Scenario results
  const scenarioResults: ScenarioResult[] = scenarios.map(s => calcScenario(s, baseExpenses))

  function updateScenario(idx: number, field: keyof ScenarioInput, value: string) {
    setScenarios(prev => prev.map((s, i) => {
      if (i !== idx) return s
      return { ...s, [field]: field === 'name' ? value : parseFloat(value) || 0 }
    }))
  }

  const scenarioColors: Record<string, string> = {
    'Pessimista': '#ef4444',
    'Realista': '#2563eb',
    'Otimista': '#10b981',
  }

  const chartData = scenarioResults.map(s => ({
    name: s.name,
    'Comissão Bruta': s.grossCommission,
    'Despesas': s.totalExpenses,
    'Lucro Líquido': Math.max(0, s.netProfit),
  }))

  return (
    <div>
      <PageHeader
        title="Simulador VGL"
        description="Simule faturamento e analise cenários financeiros"
        action={
          <Button size="sm" variant="outline" onClick={loadMonthlyExpenses}>
            <RefreshCw className="h-4 w-4" />
            Atualizar despesas
          </Button>
        }
      />

      <div className="px-4 md:px-6 pb-8 space-y-6">
        {/* Base expenses info */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/80 border border-border text-sm">
          <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">
            Despesas do mês atual carregadas automaticamente:
            <strong className="text-foreground ml-1">
              {loadingExpenses ? '...' : formatCurrency(baseExpenses)}
            </strong>
          </span>
        </div>

        <Tabs defaultValue="simple">
          <TabsList className="w-full">
            <TabsTrigger value="simple" className="flex-1">Simulação Rápida</TabsTrigger>
            <TabsTrigger value="scenarios" className="flex-1">Cenários Comparativos</TabsTrigger>
          </TabsList>

          {/* ─── SIMULAÇÃO RÁPIDA ─────────────────────────────── */}
          <TabsContent value="simple" className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-primary" />
                  Parâmetros
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>VGL — Valor Geral Líquido de Vendas (R$)</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 2.000.000"
                      value={simVgl}
                      onChange={e => setSimVgl(e.target.value)}
                      className="text-lg font-semibold h-12"
                    />
                    <p className="text-xs text-muted-foreground">
                      Soma total dos VGLs das vendas no período simulado
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>% de Comissão da Imobiliária</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="6"
                      value={simCommPct}
                      onChange={e => setSimCommPct(e.target.value)}
                      className="text-lg font-semibold h-12"
                    />
                    <p className="text-xs text-muted-foreground">
                      Percentual médio de comissão sobre o VGL
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-muted/50 text-sm text-muted-foreground">
                  <span>Despesas do mês (base): </span>
                  <strong className="text-foreground">{formatCurrency(baseExpenses)}</strong>
                  <span className="ml-3 text-xs">(carregado automaticamente)</span>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            {simVglNum > 0 && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Comissão Bruta</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(simGross)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatPercent(simCommPctNum)} do VGL</p>
                  </CardContent>
                </Card>
                <Card className={simNet >= 0 ? 'border-green-300 bg-green-50 dark:bg-green-950/20' : 'border-red-300 bg-red-50 dark:bg-red-950/20'}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Lucro Líquido</p>
                    <p className={`text-xl font-bold ${simNet >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {formatCurrency(simNet)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {simNet >= 0 ? 'após' : 'deficit de'} despesas
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Margem Líquida</p>
                    <p className={`text-xl font-bold ${simMargin >= 0 ? 'text-foreground' : 'text-red-500'}`}>
                      {formatPercent(simMargin)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">sobre a comissão</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">VGL de Breakeven</p>
                    <p className="text-xl font-bold text-amber-600">{formatCurrency(breakEvenVgl)}</p>
                    <p className="text-xs text-muted-foreground mt-1">ponto de equilíbrio</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* DRE simplificado */}
            {simVglNum > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">DRE Simplificado da Simulação</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-0 divide-y divide-border">
                    {[
                      { label: 'VGL (Valor Geral Líquido de Vendas)', value: simVglNum, bold: false, color: '' },
                      { label: `(+) Comissão Bruta (${simCommPctNum}%)`, value: simGross, bold: true, color: 'text-primary' },
                      { label: '(-) Despesas Totais do Período', value: -baseExpenses, bold: false, color: 'text-red-500' },
                      { label: '= Lucro Líquido', value: simNet, bold: true, color: simNet >= 0 ? 'text-green-600' : 'text-red-500' },
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between py-3">
                        <span className={`text-sm ${row.bold ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                          {row.label}
                        </span>
                        <span className={`text-sm font-semibold ${row.color || 'text-foreground'}`}>
                          {formatCurrency(Math.abs(row.value))}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-3">
                      <span className="text-sm text-muted-foreground">Margem Líquida</span>
                      <span className={`text-sm font-bold ${simMargin >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {formatPercent(simMargin)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── CENÁRIOS COMPARATIVOS ────────────────────────── */}
          <TabsContent value="scenarios" className="space-y-5">
            {/* Inputs */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {scenarios.map((s, idx) => (
                <Card key={idx} className={idx === 0 ? 'border-red-200' : idx === 1 ? 'border-blue-200' : 'border-green-200'}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{s.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">VGL (R$)</Label>
                      <Input
                        type="number"
                        value={s.vgl || ''}
                        onChange={e => updateScenario(idx, 'vgl', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Comissão (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={s.commissionPct || ''}
                        onChange={e => updateScenario(idx, 'commissionPct', e.target.value)}
                        placeholder="6"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Despesas extras (R$)</Label>
                      <Input
                        type="number"
                        value={s.extraExpenses || ''}
                        onChange={e => updateScenario(idx, 'extraExpenses', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Results table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Comparativo de Cenários</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-muted-foreground font-medium">Métrica</th>
                        {scenarioResults.map(s => (
                          <th key={s.name} className="text-right py-2 font-semibold text-foreground px-3">{s.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {[
                        { label: 'VGL', key: 'vgl' as const, format: 'currency' },
                        { label: 'Comissão Bruta', key: 'grossCommission' as const, format: 'currency' },
                        { label: 'Despesas Totais', key: 'totalExpenses' as const, format: 'currency' },
                        { label: 'Lucro Líquido', key: 'netProfit' as const, format: 'currency' },
                        { label: 'Margem Líquida', key: 'margin' as const, format: 'percent' },
                      ].map(row => (
                        <tr key={row.label}>
                          <td className="py-3 text-muted-foreground">{row.label}</td>
                          {scenarioResults.map(s => {
                            const val = s[row.key]
                            const isProfit = row.key === 'netProfit' || row.key === 'margin'
                            return (
                              <td key={s.name} className={`py-3 text-right font-medium px-3 ${
                                isProfit ? (val >= 0 ? 'text-green-600' : 'text-red-500') : 'text-foreground'
                              }`}>
                                {row.format === 'currency' ? formatCurrency(val) : formatPercent(val)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Chart */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Gráfico Comparativo</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{ left: -15 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => formatCurrency(v as number)} />
                    <Bar dataKey="Comissão Bruta" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Lucro Líquido" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
