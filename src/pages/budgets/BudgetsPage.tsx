import { useEffect, useState } from 'react'
import { PiggyBank, Plus, Trash2, Edit2, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, formatPercent, EXPENSE_CATEGORIES } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToastActions } from '@/components/ui/toast'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Budget, ExpenseCategory } from '@/types'

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  period_start: z.string().min(1, 'Data inicial obrigatória'),
  period_end: z.string().min(1, 'Data final obrigatória'),
  category: z.string().optional(),
  budgeted_amount: z.coerce.number().min(0.01, 'Valor obrigatório'),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface BudgetWithActual extends Budget {
  actual_amount?: number
}

export function BudgetsPage() {
  const toast = useToastActions()
  const [budgets, setBudgets] = useState<BudgetWithActual[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [saving, setSaving] = useState(false)

  const now = new Date()
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { period_start: defaultStart, period_end: defaultEnd },
  })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: budgetData } = await supabase.from('budgets').select('*').order('period_start', { ascending: false })
    if (!budgetData) { setLoading(false); return }

    // Load actual expenses per budget period / category
    const enriched = await Promise.all(budgetData.map(async (b) => {
      let query = supabase.from('expenses').select('amount').gte('due_date', b.period_start).lte('due_date', b.period_end)
      if (b.category) query = query.eq('category', b.category)
      const { data: expData } = await query
      const actual = (expData || []).reduce((s: number, e: any) => s + e.amount, 0)
      return { ...b, actual_amount: actual }
    }))

    setBudgets(enriched)
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    reset({ period_start: defaultStart, period_end: defaultEnd })
    setDialogOpen(true)
  }

  function openEdit(b: Budget) {
    setEditing(b)
    reset({
      name: b.name,
      period_start: b.period_start,
      period_end: b.period_end,
      category: b.category ?? '',
      budgeted_amount: b.budgeted_amount,
      notes: b.notes ?? '',
    })
    setDialogOpen(true)
  }

  async function onSubmit(data: FormData) {
    setSaving(true)
    const payload = {
      name: data.name,
      period_start: data.period_start,
      period_end: data.period_end,
      category: data.category || null,
      budgeted_amount: data.budgeted_amount,
      notes: data.notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('budgets').update(payload).eq('id', editing.id)
      if (error) { toast.error('Erro ao salvar'); setSaving(false); return }
      toast.success('Orçamento atualizado!')
    } else {
      const { error } = await supabase.from('budgets').insert(payload)
      if (error) { toast.error('Erro ao salvar'); setSaving(false); return }
      toast.success('Orçamento criado!')
    }
    setSaving(false)
    setDialogOpen(false)
    load()
  }

  async function deleteBudget(id: string) {
    if (!confirm('Excluir este orçamento?')) return
    await supabase.from('budgets').delete().eq('id', id)
    toast.success('Excluído')
    load()
  }

  // Group by period
  const grouped = budgets.reduce<Record<string, BudgetWithActual[]>>((acc, b) => {
    const key = `${b.period_start}|${b.period_end}`
    if (!acc[key]) acc[key] = []
    acc[key].push(b)
    return acc
  }, {})

  return (
    <div>
      <PageHeader
        title="Orçamentos"
        description="Planejamento e controle de gastos por categoria"
        action={<Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> Novo orçamento</Button>}
      />

      <div className="px-4 md:px-6 pb-6 space-y-5">
        {/* What-if tip */}
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-sm text-blue-700 dark:text-blue-300">
          <strong>Dica:</strong> Use orçamentos para simular "e se o aluguel subir?" ou "quanto posso gastar com marketing neste mês?".
          O sistema mostra automaticamente quanto já foi realizado vs. o orçado.
        </div>

        {loading ? (
          <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}</div>
        ) : budgets.length === 0 ? (
          <EmptyState
            icon={<PiggyBank className="h-7 w-7" />}
            title="Nenhum orçamento criado"
            description="Crie orçamentos para controlar quanto pode gastar em cada categoria e comparar com o realizado."
            action={{ label: 'Criar orçamento', onClick: openNew }}
          />
        ) : (
          Object.entries(grouped).map(([key, items]) => {
            const [start, end] = key.split('|')
            const totalBudget = items.reduce((s, i) => s + i.budgeted_amount, 0)
            const totalActual = items.reduce((s, i) => s + (i.actual_amount ?? 0), 0)

            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {formatDate(start)} — {formatDate(end)}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Total: {formatCurrency(totalActual)} / {formatCurrency(totalBudget)}
                  </span>
                </div>

                {/* Period total bar */}
                <div className="mb-3">
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${totalActual > totalBudget ? 'bg-red-500' : 'bg-primary'}`}
                      style={{ width: `${Math.min(100, totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  {items.map(b => {
                    const pct = b.budgeted_amount > 0 ? ((b.actual_amount ?? 0) / b.budgeted_amount) * 100 : 0
                    const over = (b.actual_amount ?? 0) > b.budgeted_amount
                    const diff = b.budgeted_amount - (b.actual_amount ?? 0)

                    return (
                      <Card key={b.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground">{b.name}</p>
                              {b.category && (
                                <p className="text-xs text-muted-foreground">
                                  {EXPENSE_CATEGORIES[b.category as ExpenseCategory] ?? b.category}
                                </p>
                              )}
                              {b.notes && <p className="text-xs text-muted-foreground mt-1">{b.notes}</p>}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon-sm" onClick={() => openEdit(b)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon-sm" onClick={() => deleteBudget(b.id)}
                                className="text-destructive hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="space-y-1.5">
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-2 rounded-full transition-all ${over ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-primary'}`}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                Realizado: <strong className={`${over ? 'text-red-500' : 'text-foreground'}`}>
                                  {formatCurrency(b.actual_amount ?? 0)}
                                </strong>
                              </span>
                              <span className="text-muted-foreground">
                                Orçado: <strong className="text-foreground">{formatCurrency(b.budgeted_amount)}</strong>
                              </span>
                            </div>
                            <div className={`text-xs font-medium ${over ? 'text-red-500' : 'text-green-600'}`}>
                              {over
                                ? `⚠ Acima do orçado em ${formatCurrency(Math.abs(diff))}`
                                : `✓ Disponível: ${formatCurrency(diff)} (${formatPercent(100 - pct)} restante)`
                              }
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar' : 'Novo'} Orçamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do orçamento *</Label>
              <Input placeholder="Ex: Marketing — Maio, Aluguel Q2" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Início *</Label>
                <Input type="date" {...register('period_start')} />
              </div>
              <div className="space-y-1.5">
                <Label>Fim *</Label>
                <Input type="date" {...register('period_end')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Categoria (opcional — para comparar com despesas)</Label>
              <Controller name="category" control={control} render={({ field }) => (
                <Select value={field.value || '__all__'} onValueChange={(v) => field.onChange(v === '__all__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">— Todas as categorias —</SelectItem>
                    {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </div>

            <div className="space-y-1.5">
              <Label>Valor orçado (R$) *</Label>
              <Input type="number" step="0.01" placeholder="5000" {...register('budgeted_amount')} />
              {errors.budgeted_amount && <p className="text-xs text-destructive">{errors.budgeted_amount.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea placeholder="Detalhes do orçamento..." {...register('notes')} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={saving}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
