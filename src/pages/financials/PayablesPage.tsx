import { useEffect, useState } from 'react'
import { ArrowUpCircle, CheckCircle2, Clock, AlertCircle, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, EXPENSE_CATEGORIES, EXPENSE_SUBCATEGORIES } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { KpiCard } from '@/components/ui/kpi-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToastActions } from '@/components/ui/toast'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Expense, ExpenseCategory, Development } from '@/types'

type FilterType = 'all' | 'pending' | 'paid' | 'overdue'

const NONE_VALUE = '__none__'

const schema = z.object({
  description: z.string().min(2, 'Descrição obrigatória'),
  category: z.string().min(1, 'Categoria obrigatória'),
  subcategory: z.string().optional(),
  development_id: z.string().optional(),
  amount: z.coerce.number().min(0.01, 'Valor obrigatório'),
  due_date: z.string().min(1, 'Vencimento obrigatório'),
  recurring: z.boolean().default(false),
  recurring_months: z.coerce.number().min(1).max(24).default(3),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

// Gera data no mesmo dia do mês, i meses à frente (corrige fim de mês)
function addMonths(baseDateStr: string, months: number): string {
  const base = new Date(baseDateStr + 'T00:00:00')
  const baseDay = base.getDate()
  const d = new Date(base)
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(baseDay, lastDay))
  return d.toISOString().split('T')[0]
}

export function PayablesPage() {
  const toast = useToastActions()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [developments, setDevelopments] = useState<Development[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { recurring: false, recurring_months: 3, due_date: today },
  })
  const categoryVal = watch('category') as ExpenseCategory
  const recurringVal = watch('recurring')
  const recurringMonths = watch('recurring_months') || 3

  useEffect(() => {
    load()
    supabase.from('developments').select('id, name').eq('status', 'active').then(({ data }) => setDevelopments((data || []) as any))
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('expenses')
      .select('*, development:developments(name)')
      .order('due_date')
    setExpenses(data || [])
    setLoading(false)
  }

  async function togglePaid(exp: Expense) {
    const newVal = !exp.paid
    await supabase.from('expenses').update({
      paid: newVal,
      paid_date: newVal ? today : null,
    }).eq('id', exp.id)
    toast.success(newVal ? 'Marcado como pago!' : 'Desmarcado')
    load()
  }

  async function deleteExpense(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    await supabase.from('expenses').delete().eq('id', id)
    toast.success('Excluído')
    load()
  }

  async function onSubmit(data: FormData) {
    setSaving(true)
    const devId = data.development_id && data.development_id !== NONE_VALUE ? data.development_id : null

    if (data.recurring) {
      // Gera lançamento do mês atual + N meses futuros
      const totalMonths = data.recurring_months ?? 3
      const entries = Array.from({ length: totalMonths + 1 }, (_, i) => ({
        description: data.description,
        category: data.category,
        subcategory: data.subcategory || null,
        development_id: devId,
        amount: data.amount,
        due_date: addMonths(data.due_date, i),
        paid: false,
        recurring: true,
        recurring_day: new Date(data.due_date + 'T00:00:00').getDate(),
        notes: data.notes || null,
      }))

      const { error } = await supabase.from('expenses').insert(entries)
      setSaving(false)
      if (error) { toast.error('Erro ao salvar', error.message); return }
      toast.success(`${entries.length} lançamentos criados!`, `Despesa fixa gerada para ${totalMonths} meses`)
    } else {
      const { error } = await supabase.from('expenses').insert({
        description: data.description,
        category: data.category,
        subcategory: data.subcategory || null,
        development_id: devId,
        amount: data.amount,
        due_date: data.due_date,
        paid: false,
        recurring: false,
        notes: data.notes || null,
      })
      setSaving(false)
      if (error) { toast.error('Erro ao salvar', error.message); return }
      toast.success('Despesa lançada!')
    }

    setDialogOpen(false)
    reset()
    load()
  }

  const filtered = expenses.filter(e => {
    if (filter === 'paid') return e.paid
    if (filter === 'pending') return !e.paid && e.due_date >= today
    if (filter === 'overdue') return !e.paid && e.due_date < today
    return true
  })

  const totalPending = expenses.filter(e => !e.paid).reduce((s, e) => s + e.amount, 0)
  const totalPaid = expenses.filter(e => e.paid).reduce((s, e) => s + e.amount, 0)
  const totalOverdue = expenses.filter(e => !e.paid && e.due_date < today).reduce((s, e) => s + e.amount, 0)

  const subcategories = EXPENSE_SUBCATEGORIES[categoryVal] || []

  function getExpBadge(exp: Expense) {
    if (exp.paid) return <Badge variant="success">Pago</Badge>
    if (exp.due_date < today) return <Badge variant="destructive">Vencido</Badge>
    if (exp.due_date === today) return <Badge variant="warning">Vence hoje</Badge>
    return <Badge variant="blue">Pendente</Badge>
  }

  return (
    <div>
      <PageHeader
        title="Contas a Pagar"
        description="Despesas e custos operacionais"
        action={
          <Button size="sm" onClick={() => { reset({ recurring: false, recurring_months: 3, due_date: today }); setDialogOpen(true) }}>
            <Plus className="h-4 w-4" /> Nova despesa
          </Button>
        }
      />

      <div className="px-4 md:px-6 pb-6 space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <KpiCard label="A Pagar" value={totalPending} icon={<Clock className="h-4 w-4" />} color="amber" loading={loading} />
          <KpiCard label="Pago" value={totalPaid} icon={<CheckCircle2 className="h-4 w-4" />} color="green" loading={loading} />
          <KpiCard label="Vencido" value={totalOverdue} icon={<AlertCircle className="h-4 w-4" />} color="red" loading={loading} />
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {([['all', 'Todos'], ['pending', 'Pendentes'], ['overdue', 'Vencidos'], ['paid', 'Pagos']] as [FilterType, string][]).map(
            ([val, label]) => (
              <button key={val} onClick={() => setFilter(val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  filter === val ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>

        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ArrowUpCircle className="h-7 w-7" />}
            title="Nenhuma despesa encontrada"
            description="Lance suas despesas fixas e variáveis aqui."
          />
        ) : (
          <div className="space-y-2">
            {filtered.map(exp => {
              const dev = exp.development as any
              return (
                <Card key={exp.id} className={exp.paid ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => togglePaid(exp)}
                        className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                          exp.paid ? 'bg-green-500 border-green-500 text-white' : 'border-border hover:border-green-500'
                        }`}
                      >
                        {exp.paid && <CheckCircle2 className="h-4 w-4" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-medium ${exp.paid ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {exp.description}
                          </p>
                          {exp.recurring && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                              <RefreshCw className="h-2.5 w-2.5" /> Fixa
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {EXPENSE_CATEGORIES[exp.category as ExpenseCategory] ?? exp.category}
                          {exp.subcategory && ` • ${exp.subcategory}`}
                          {dev?.name && ` • ${dev.name}`}
                          {' • '}Vence {formatDate(exp.due_date)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <p className="text-sm font-semibold text-foreground">{formatCurrency(exp.amount)}</p>
                        <div className="flex items-center gap-1">
                          {getExpBadge(exp)}
                          <button
                            onClick={() => deleteExpense(exp.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Despesa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Descrição *</Label>
              <Input placeholder="Ex: Aluguel do escritório, Meta Ads..." {...register('description')} />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria *</Label>
                <Controller name="category" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => { field.onChange(v); setValue('subcategory', '') }}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
                {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
              </div>

              {subcategories.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Subcategoria</Label>
                  <Controller name="subcategory" control={control} render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>
                        {subcategories.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Empreendimento (opcional)</Label>
              <Controller name="development_id" control={control} render={({ field }) => (
                <Select
                  value={field.value || NONE_VALUE}
                  onValueChange={(v) => field.onChange(v === NONE_VALUE ? '' : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Vincular a um empreendimento..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>— Nenhum —</SelectItem>
                    {developments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor *</Label>
                <Input type="number" step="0.01" placeholder="0,00" {...register('amount')} />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Primeiro vencimento *</Label>
                <Input type="date" {...register('due_date')} />
              </div>
            </div>

            {/* Despesa fixa */}
            <div className="space-y-3 p-3 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center gap-3">
                <Controller name="recurring" control={control} render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )} />
                <div>
                  <p className="text-sm font-medium text-foreground">Despesa fixa / recorrente</p>
                  <p className="text-xs text-muted-foreground">Gera lançamentos automáticos para os próximos meses</p>
                </div>
              </div>

              {recurringVal && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Gerar para quantos meses à frente?</Label>
                      <Controller name="recurring_months" control={control} render={({ field }) => (
                        <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 9, 12, 24].map(n => (
                              <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'mês' : 'meses'}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )} />
                    </div>
                  </div>
                  <p className="text-xs text-primary font-medium">
                    Serão criados {recurringMonths + 1} lançamentos no total (mês atual + {recurringMonths} seguintes)
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea placeholder="Notas adicionais..." {...register('notes')} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={saving}>
                {recurringVal ? `Criar ${recurringMonths + 1} lançamentos` : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
