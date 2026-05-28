import { useEffect, useState } from 'react'
import { ArrowDownCircle, CheckCircle2, Clock, AlertCircle, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
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
import { useToastActions } from '@/components/ui/toast'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Receivable } from '@/types'

type FilterType = 'all' | 'pending' | 'received' | 'overdue'

const schema = z.object({
  description: z.string().min(2, 'Descrição obrigatória'),
  amount: z.coerce.number().min(0.01, 'Valor obrigatório'),
  due_date: z.string().min(1, 'Data obrigatória'),
  category: z.enum(['commission', 'fee', 'other']).default('other'),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export function ReceivablesPage() {
  const toast = useToastActions()
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { category: 'other', due_date: today },
  })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('receivables')
      .select('*, sale:sales(buyer_name, development:developments(name))')
      .order('due_date')
    setReceivables(data || [])
    setLoading(false)
  }

  async function toggleReceived(rec: Receivable) {
    const newVal = !rec.received
    await supabase.from('receivables').update({
      received: newVal,
      received_date: newVal ? today : null,
    }).eq('id', rec.id)
    toast.success(newVal ? 'Marcado como recebido!' : 'Desmarcado')
    load()
  }

  async function onSubmit(data: FormData) {
    setSaving(true)
    const { error } = await supabase.from('receivables').insert({
      description: data.description,
      amount: data.amount,
      due_date: data.due_date,
      category: data.category,
      notes: data.notes || null,
      received: false,
    })
    setSaving(false)
    if (error) { toast.error('Erro ao salvar'); return }
    toast.success('Lançamento criado!')
    setDialogOpen(false)
    reset()
    load()
  }

  const filtered = receivables.filter(r => {
    if (filter === 'received') return r.received
    if (filter === 'pending') return !r.received && r.due_date >= today
    if (filter === 'overdue') return !r.received && r.due_date < today
    return true
  })

  const totalPending = receivables.filter(r => !r.received).reduce((s, r) => s + r.amount, 0)
  const totalReceived = receivables.filter(r => r.received).reduce((s, r) => s + r.amount, 0)
  const totalOverdue = receivables.filter(r => !r.received && r.due_date < today).reduce((s, r) => s + r.amount, 0)

  function getRecBadge(rec: Receivable) {
    if (rec.received) return <Badge variant="success">Recebido</Badge>
    if (rec.due_date < today) return <Badge variant="destructive">Vencido</Badge>
    if (rec.due_date === today) return <Badge variant="warning">Vence hoje</Badge>
    return <Badge variant="blue">Pendente</Badge>
  }

  return (
    <div>
      <PageHeader
        title="Contas a Receber"
        description="Comissões e outros recebimentos"
        action={
          <Button size="sm" onClick={() => { reset({ category: 'other', due_date: today }); setDialogOpen(true) }}>
            <Plus className="h-4 w-4" /> Novo
          </Button>
        }
      />

      <div className="px-4 md:px-6 pb-6 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <KpiCard label="A Receber" value={totalPending} icon={<Clock className="h-4 w-4" />} color="amber" loading={loading} />
          <KpiCard label="Recebido" value={totalReceived} icon={<CheckCircle2 className="h-4 w-4" />} color="green" loading={loading} />
          <KpiCard label="Vencido" value={totalOverdue} icon={<AlertCircle className="h-4 w-4" />} color="red" loading={loading} />
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {([
            ['all', 'Todos'],
            ['pending', 'Pendentes'],
            ['overdue', 'Vencidos'],
            ['received', 'Recebidos'],
          ] as [FilterType, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filter === val ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ArrowDownCircle className="h-7 w-7" />}
            title="Nenhum lançamento encontrado"
            description="Os recebíveis vinculados a vendas aparecem automaticamente aqui."
          />
        ) : (
          <div className="space-y-2">
            {filtered.map(rec => {
              const sale = rec.sale as any
              return (
                <Card key={rec.id} className={rec.received ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleReceived(rec)}
                        className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                          rec.received
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-border hover:border-green-500'
                        }`}
                      >
                        {rec.received && <CheckCircle2 className="h-4 w-4" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${rec.received ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {rec.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Vence {formatDate(rec.due_date)}
                          {sale?.buyer_name && ` • ${sale.buyer_name}`}
                          {rec.received_date && ` • Recebido em ${formatDate(rec.received_date)}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <p className="text-sm font-semibold text-foreground">{formatCurrency(rec.amount)}</p>
                        {getRecBadge(rec)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Recebimento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Descrição *</Label>
              <Input placeholder="Ex: Comissão Residencial..." {...register('description')} />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor *</Label>
                <Input type="number" step="0.01" placeholder="0,00" {...register('amount')} />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Vencimento *</Label>
                <Input type="date" {...register('due_date')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Controller name="category" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="commission">Comissão</SelectItem>
                    <SelectItem value="fee">Taxa / Honorário</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              )} />
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
