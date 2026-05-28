import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, Plus, Search, Filter, Building2, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, formatPercent } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import type { Sale } from '@/types'

const statusConfig: Record<string, { label: string; variant: 'blue' | 'success' | 'destructive' }> = {
  contracted: { label: 'Contratado', variant: 'blue' },
  completed: { label: 'Concluído', variant: 'success' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
}

export function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('sales')
      .select('*, development:developments(name), sale_brokers(*, broker:brokers(name))')
      .order('sale_date', { ascending: false })
    setSales(data || [])
    setLoading(false)
  }

  const filtered = sales.filter(s => {
    const matchSearch =
      s.buyer_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.development as any)?.name?.toLowerCase().includes(search.toLowerCase()) ||
      (s.unit_number ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || s.status === statusFilter
    return matchSearch && matchStatus
  })

  const totalVgl = filtered.reduce((s, sale) => s + (sale.vgl ?? sale.total_price), 0)
  const totalCommission = filtered.reduce((s, sale) => s + (sale.commission_total ?? 0), 0)

  return (
    <div>
      <PageHeader
        title="Vendas"
        description={`${filtered.length} venda(s) • VGL total: ${formatCurrency(totalVgl)}`}
        action={
          <Button size="sm" asChild>
            <Link to="/vendas/nova"><Plus className="h-4 w-4" /> Nova venda</Link>
          </Button>
        }
      />

      <div className="px-4 md:px-6 pb-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            className="flex-1"
            placeholder="Buscar comprador, empreendimento, unidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {['all', 'contracted', 'completed', 'cancelled'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  statusFilter === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {s === 'all' ? 'Todos' : statusConfig[s]?.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary bar */}
        {filtered.length > 0 && (
          <div className="flex items-center gap-4 p-3 rounded-xl bg-muted text-sm flex-wrap">
            <span className="text-muted-foreground">Total VGL: <strong className="text-foreground">{formatCurrency(totalVgl)}</strong></span>
            <span className="text-muted-foreground">Comissões: <strong className="text-foreground">{formatCurrency(totalCommission)}</strong></span>
            <span className="text-muted-foreground">Qtd: <strong className="text-foreground">{filtered.length}</strong></span>
          </div>
        )}

        {/* Sales list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="h-7 w-7" />}
            title="Nenhuma venda encontrada"
            description="Registre sua primeira venda de lançamento."
            action={{ label: 'Registrar venda', onClick: () => {} }}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map(sale => {
              const cfg = statusConfig[sale.status]
              const devName = (sale.development as any)?.name
              const brokers = (sale.sale_brokers as any[]) || []

              return (
                <Link key={sale.id} to={`/vendas/${sale.id}`}>
                  <Card className="hover:shadow-md transition-all hover:border-primary/30">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-primary font-bold text-xs">
                            {sale.buyer_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground text-sm truncate">{sale.buyer_name}</p>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                                {devName && (
                                  <>
                                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                                    <span>{devName}</span>
                                    {sale.unit_number && <span>• Apt {sale.unit_number}</span>}
                                  </>
                                )}
                                <Calendar className="h-3.5 w-3.5 shrink-0 ml-1" />
                                <span>{formatDate(sale.sale_date)}</span>
                              </div>
                              {brokers.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Corretor: {brokers.map((b: any) => b.broker?.name).join(', ')}
                                </p>
                              )}
                            </div>
                            <Badge variant={cfg.variant}>{cfg.label}</Badge>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-border">
                        <div>
                          <p className="text-xs text-muted-foreground">Valor de venda</p>
                          <p className="text-sm font-semibold text-foreground">{formatCurrency(sale.total_price)}</p>
                        </div>
                        {sale.vgl && (
                          <div>
                            <p className="text-xs text-muted-foreground">VGL</p>
                            <p className="text-sm font-semibold text-foreground">{formatCurrency(sale.vgl)}</p>
                          </div>
                        )}
                        {sale.commission_total && (
                          <div>
                            <p className="text-xs text-muted-foreground">Comissão</p>
                            <p className="text-sm font-semibold text-primary">
                              {formatCurrency(sale.commission_total)}
                              {sale.commission_pct && <span className="text-xs text-muted-foreground ml-1">({formatPercent(sale.commission_pct)})</span>}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
