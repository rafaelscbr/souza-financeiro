import { useEffect, useState } from 'react'
import { Award, CheckCircle2, Clock, DollarSign, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { KpiCard } from '@/components/ui/kpi-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToastActions } from '@/components/ui/toast'

interface CommissionItem {
  id: string
  sale_id: string
  broker_id: string
  broker_name: string
  sale_buyer: string
  development_name: string | null
  role: string
  commission_pct: number
  commission_value: number
  paid: boolean
  due_date: string | null
  paid_date: string | null
  type: 'upfront' | 'installment'
}

export function CommissionsPage() {
  const toast = useToastActions()
  const [items, setItems] = useState<CommissionItem[]>([])
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    // Fetch from sale_brokers (upfront commissions)
    const { data: sbData } = await supabase
      .from('sale_brokers')
      .select('*, broker:brokers(name), sale:sales(buyer_name, sale_date, status, development:developments(name))')
      .order('created_at', { ascending: false })

    // Fetch commission_installments
    const { data: ciData } = await supabase
      .from('commission_installments')
      .select('*, broker:brokers(name), sale:sales(buyer_name, development:developments(name))')
      .order('due_date')

    const upfront: CommissionItem[] = (sbData || []).map((sb: any) => ({
      id: `sb-${sb.id}`,
      sale_id: sb.sale_id,
      broker_id: sb.broker_id,
      broker_name: sb.broker?.name ?? '-',
      sale_buyer: sb.sale?.buyer_name ?? '-',
      development_name: sb.sale?.development?.name ?? null,
      role: sb.role ?? 'vendedor',
      commission_pct: sb.commission_pct ?? 0,
      commission_value: sb.commission_value ?? 0,
      paid: false, // upfront tracked differently - simplified for now
      due_date: sb.sale?.sale_date ?? null,
      paid_date: null,
      type: 'upfront' as const,
    }))

    const installments: CommissionItem[] = (ciData || []).map((ci: any) => ({
      id: `ci-${ci.id}`,
      sale_id: ci.sale_id,
      broker_id: ci.broker_id,
      broker_name: ci.broker?.name ?? '-',
      sale_buyer: ci.sale?.buyer_name ?? '-',
      development_name: ci.sale?.development?.name ?? null,
      role: '-',
      commission_pct: 0,
      commission_value: ci.amount ?? 0,
      paid: ci.paid ?? false,
      due_date: ci.due_date,
      paid_date: ci.paid_date,
      type: 'installment' as const,
    }))

    setItems([...upfront, ...installments])
    setLoading(false)
  }

  async function markPaid(item: CommissionItem) {
    if (item.type === 'installment') {
      const id = item.id.replace('ci-', '')
      await supabase.from('commission_installments').update({
        paid: !item.paid,
        paid_date: !item.paid ? today : null,
      }).eq('id', id)
      toast.success(!item.paid ? 'Comissão paga!' : 'Desmarcado')
      load()
    }
  }

  const pending = items.filter(i => !i.paid)
  const paid = items.filter(i => i.paid)
  const totalPending = pending.reduce((s, i) => s + i.commission_value, 0)
  const totalPaid = paid.reduce((s, i) => s + i.commission_value, 0)
  const totalAll = items.reduce((s, i) => s + i.commission_value, 0)

  // Group by broker
  const byBroker = items.reduce<Record<string, { name: string; total: number; paid: number; count: number }>>((acc, item) => {
    if (!acc[item.broker_id]) acc[item.broker_id] = { name: item.broker_name, total: 0, paid: 0, count: 0 }
    acc[item.broker_id].total += item.commission_value
    if (item.paid) acc[item.broker_id].paid += item.commission_value
    acc[item.broker_id].count += 1
    return acc
  }, {})

  function CommissionCard({ item }: { item: CommissionItem }) {
    return (
      <Card className={item.paid ? 'opacity-60' : ''}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {item.type === 'installment' && (
              <button
                onClick={() => markPaid(item)}
                className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                  item.paid ? 'bg-green-500 border-green-500 text-white' : 'border-border hover:border-green-500'
                }`}
              >
                {item.paid && <CheckCircle2 className="h-4 w-4" />}
              </button>
            )}
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-primary text-xs font-bold">
                {item.broker_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{item.broker_name}</p>
              <p className="text-xs text-muted-foreground">
                {item.sale_buyer}
                {item.development_name && ` • ${item.development_name}`}
                {item.due_date && ` • ${formatDate(item.due_date)}`}
              </p>
              <p className="text-xs text-muted-foreground capitalize">{item.role}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-primary">{formatCurrency(item.commission_value)}</p>
              {item.paid
                ? <Badge variant="success">Pago</Badge>
                : item.due_date && item.due_date < today
                  ? <Badge variant="destructive">Vencido</Badge>
                  : <Badge variant="warning">Pendente</Badge>
              }
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <PageHeader title="Comissões" description="Controle de comissões dos corretores" />

      <div className="px-4 md:px-6 pb-6 space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <KpiCard label="Total Comissões" value={totalAll} icon={<Award className="h-4 w-4" />} color="blue" loading={loading} />
          <KpiCard label="A Pagar" value={totalPending} icon={<Clock className="h-4 w-4" />} color="amber" loading={loading} />
          <KpiCard label="Pago" value={totalPaid} icon={<CheckCircle2 className="h-4 w-4" />} color="green" loading={loading} />
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pendentes ({pending.length})</TabsTrigger>
            <TabsTrigger value="paid">Pagas ({paid.length})</TabsTrigger>
            <TabsTrigger value="brokers">Por Corretor</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            {loading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>
            ) : pending.length === 0 ? (
              <EmptyState icon={<Award className="h-7 w-7" />} title="Nenhuma comissão pendente" description="Todas as comissões estão pagas." />
            ) : (
              <div className="space-y-2">{pending.map(i => <CommissionCard key={i.id} item={i} />)}</div>
            )}
          </TabsContent>

          <TabsContent value="paid">
            {paid.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="h-7 w-7" />} title="Nenhuma comissão paga ainda" />
            ) : (
              <div className="space-y-2">{paid.map(i => <CommissionCard key={i.id} item={i} />)}</div>
            )}
          </TabsContent>

          <TabsContent value="brokers">
            <div className="space-y-2">
              {Object.entries(byBroker).map(([id, b]) => (
                <Card key={id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-primary text-sm font-bold">
                          {b.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">{b.name}</p>
                        <p className="text-xs text-muted-foreground">{b.count} comissão(ões)</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{formatCurrency(b.total)}</p>
                        <p className="text-xs text-green-600">Pago: {formatCurrency(b.paid)}</p>
                        <p className="text-xs text-amber-600">Pendente: {formatCurrency(b.total - b.paid)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
