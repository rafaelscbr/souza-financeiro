import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Building2, Calendar, User, Award, Edit2, Trash2, CheckCircle2, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, formatPercent } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToastActions } from '@/components/ui/toast'
import type { Sale, Receivable, CommissionInstallment } from '@/types'

const statusConfig: Record<string, { label: string; variant: 'blue' | 'success' | 'destructive' }> = {
  contracted: { label: 'Contratado', variant: 'blue' },
  completed: { label: 'Concluído', variant: 'success' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
}

export function SaleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToastActions()
  const [sale, setSale] = useState<Sale | null>(null)
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [commissions, setCommissions] = useState<CommissionInstallment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (id) load(id) }, [id])

  async function load(saleId: string) {
    setLoading(true)
    const [saleRes, recRes, commRes] = await Promise.all([
      supabase.from('sales').select('*, development:developments(*), sale_brokers(*, broker:brokers(*))').eq('id', saleId).single(),
      supabase.from('receivables').select('*').eq('sale_id', saleId).order('due_date'),
      supabase.from('commission_installments').select('*, broker:brokers(name)').eq('sale_id', saleId).order('due_date'),
    ])
    setSale(saleRes.data)
    setReceivables(recRes.data || [])
    setCommissions(commRes.data || [])
    setLoading(false)
  }

  async function markReceivable(recId: string, received: boolean) {
    const { error } = await supabase.from('receivables').update({
      received,
      received_date: received ? new Date().toISOString().split('T')[0] : null,
    }).eq('id', recId)
    if (error) { toast.error('Erro ao atualizar'); return }
    toast.success(received ? 'Marcado como recebido!' : 'Desmarcado')
    if (id) load(id)
  }

  async function markCommission(commId: string, paid: boolean) {
    const { error } = await supabase.from('commission_installments').update({
      paid,
      paid_date: paid ? new Date().toISOString().split('T')[0] : null,
    }).eq('id', commId)
    if (error) { toast.error('Erro ao atualizar'); return }
    toast.success(paid ? 'Comissão marcada como paga!' : 'Desmarcado')
    if (id) load(id)
  }

  async function deleteSale() {
    if (!confirm('Excluir esta venda? Todos os dados vinculados serão removidos.')) return
    const { error } = await supabase.from('sales').delete().eq('id', id!)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Venda excluída')
    navigate('/vendas')
  }

  if (loading) return (
    <div className="p-6 space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
    </div>
  )

  if (!sale) return (
    <div className="p-6 text-center text-muted-foreground">Venda não encontrada</div>
  )

  const cfg = statusConfig[sale.status]
  const dev = sale.development as any
  const saleBrokers = (sale.sale_brokers as any[]) || []
  const totalReceivable = receivables.reduce((s, r) => s + r.amount, 0)
  const totalReceived = receivables.filter(r => r.received).reduce((s, r) => s + r.amount, 0)

  return (
    <div>
      <div className="flex items-center justify-between px-4 pt-5 pb-4 md:px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{sale.buyer_name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={cfg.variant}>{cfg.label}</Badge>
              {dev?.name && <span className="text-xs text-muted-foreground">{dev.name}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" onClick={deleteSale} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="px-4 md:px-6 pb-8 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Valor de venda</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(sale.total_price)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">VGL</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(sale.vgl ?? sale.total_price)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Comissão total</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(sale.commission_total ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Recebido</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(totalReceived)}</p>
              <p className="text-xs text-muted-foreground">de {formatCurrency(totalReceivable)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" /> Comprador
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-0">
              <p className="text-sm font-medium text-foreground">{sale.buyer_name}</p>
              {sale.buyer_cpf && <p className="text-sm text-muted-foreground">CPF: {sale.buyer_cpf}</p>}
              {sale.buyer_phone && <p className="text-sm text-muted-foreground">Tel: {sale.buyer_phone}</p>}
              {sale.buyer_email && <p className="text-sm text-muted-foreground">{sale.buyer_email}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" /> Imóvel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-0">
              {dev && <p className="text-sm font-medium text-foreground">{dev.name}</p>}
              {sale.unit_number && <p className="text-sm text-muted-foreground">Apt {sale.unit_number} — {sale.unit_type}</p>}
              {sale.floor_number && <p className="text-sm text-muted-foreground">{sale.floor_number}º andar</p>}
              {sale.area_m2 && <p className="text-sm text-muted-foreground">{sale.area_m2} m²</p>}
              <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Data da venda</p>
                  <p className="text-sm text-foreground">{formatDate(sale.sale_date)}</p>
                </div>
                {sale.contract_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">Contrato</p>
                    <p className="text-sm text-foreground">{formatDate(sale.contract_date)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Corretores */}
        {saleBrokers.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Award className="h-4 w-4 text-muted-foreground" /> Corretores
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {saleBrokers.map((sb: any) => (
                <div key={sb.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">{sb.broker?.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{sb.role}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary">{formatCurrency(sb.commission_value)}</p>
                    <p className="text-xs text-muted-foreground">{formatPercent(sb.commission_pct)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Receivables */}
        {receivables.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Contas a Receber</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {receivables.map((rec) => (
                <div key={rec.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border">
                  <button
                    onClick={() => markReceivable(rec.id, !rec.received)}
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                      rec.received ? 'bg-green-500 border-green-500 text-white' : 'border-border hover:border-primary'
                    }`}
                  >
                    {rec.received && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{rec.description}</p>
                    <p className="text-xs text-muted-foreground">Vence: {formatDate(rec.due_date)}</p>
                  </div>
                  <p className={`text-sm font-semibold shrink-0 ${rec.received ? 'text-green-600' : 'text-foreground'}`}>
                    {formatCurrency(rec.amount)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Commission installments */}
        {commissions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Comissões a Pagar</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {commissions.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border">
                  <button
                    onClick={() => markCommission(c.id, !c.paid)}
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                      c.paid ? 'bg-green-500 border-green-500 text-white' : 'border-border hover:border-primary'
                    }`}
                  >
                    {c.paid && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{(c.broker as any)?.name}</p>
                    <p className="text-xs text-muted-foreground">Vence: {formatDate(c.due_date)}</p>
                  </div>
                  <p className={`text-sm font-semibold shrink-0 ${c.paid ? 'text-green-600' : 'text-amber-600'}`}>
                    {formatCurrency(c.amount)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {sale.notes && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" /> Observações
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground">{sale.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
