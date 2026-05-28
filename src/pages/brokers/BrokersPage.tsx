import { useEffect, useState } from 'react'
import { Users, Plus, Phone, Mail, Edit2, Trash2, Award } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToastActions } from '@/components/ui/toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Broker } from '@/types'

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  creci: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  pix_key: z.string().optional(),
  bank_name: z.string().optional(),
  commission_default_pct: z.coerce.number().min(0).max(100).default(6),
  active: z.boolean().default(true),
})
type FormData = z.infer<typeof schema>

interface BrokerWithStats extends Broker {
  total_sales?: number
  total_commission?: number
}

export function BrokersPage() {
  const toast = useToastActions()
  const [brokers, setBrokers] = useState<BrokerWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Broker | null>(null)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { commission_default_pct: 6, active: true },
  })
  const activeVal = watch('active')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: brokersData } = await supabase
      .from('brokers')
      .select('*')
      .order('name')

    if (!brokersData) { setLoading(false); return }

    // Get commission totals per broker
    const { data: commData } = await supabase
      .from('sale_brokers')
      .select('broker_id, commission_value')

    const commMap: Record<string, number> = {}
    const countMap: Record<string, number> = {}
    ;(commData || []).forEach((c: any) => {
      commMap[c.broker_id] = (commMap[c.broker_id] || 0) + (c.commission_value || 0)
      countMap[c.broker_id] = (countMap[c.broker_id] || 0) + 1
    })

    const enriched = brokersData.map(b => ({
      ...b,
      total_sales: countMap[b.id] || 0,
      total_commission: commMap[b.id] || 0,
    }))
    setBrokers(enriched)
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    reset({ commission_default_pct: 6, active: true })
    setDialogOpen(true)
  }

  function openEdit(b: Broker) {
    setEditing(b)
    reset({
      name: b.name,
      creci: b.creci ?? '',
      email: b.email ?? '',
      phone: b.phone ?? '',
      pix_key: b.pix_key ?? '',
      bank_name: b.bank_name ?? '',
      commission_default_pct: b.commission_default_pct,
      active: b.active,
    })
    setDialogOpen(true)
  }

  async function onSubmit(data: FormData) {
    setSaving(true)
    const payload = {
      name: data.name,
      creci: data.creci || null,
      email: data.email || null,
      phone: data.phone || null,
      pix_key: data.pix_key || null,
      bank_name: data.bank_name || null,
      commission_default_pct: data.commission_default_pct,
      active: data.active,
    }

    if (editing) {
      const { error } = await supabase.from('brokers').update(payload).eq('id', editing.id)
      if (error) { toast.error('Erro ao salvar'); setSaving(false); return }
      toast.success('Corretor atualizado!')
    } else {
      const { error } = await supabase.from('brokers').insert(payload)
      if (error) { toast.error('Erro ao salvar'); setSaving(false); return }
      toast.success('Corretor cadastrado!')
    }
    setSaving(false)
    setDialogOpen(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este corretor?')) return
    const { error } = await supabase.from('brokers').delete().eq('id', id)
    if (error) { toast.error('Não foi possível excluir'); return }
    toast.success('Excluído')
    load()
  }

  const filtered = brokers.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    (b.creci ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <PageHeader
        title="Corretores"
        description={`${brokers.filter(b => b.active).length} corretores ativos`}
        action={<Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> Novo</Button>}
      />

      <div className="px-4 md:px-6 pb-6 space-y-4">
        <Input
          placeholder="Buscar por nome ou CRECI..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          leftIcon={<Users className="h-4 w-4" />}
        />

        {loading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map(i => <div key={i} className="h-36 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="h-7 w-7" />}
            title="Nenhum corretor"
            description="Cadastre seus corretores para vincular às vendas e comissões."
            action={{ label: 'Cadastrar corretor', onClick: openNew }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(broker => (
              <Card key={broker.id} className={`hover:shadow-md transition-shadow ${!broker.active ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold text-sm">
                        {broker.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground text-sm truncate">{broker.name}</p>
                        {!broker.active && <Badge variant="gray">Inativo</Badge>}
                      </div>
                      {broker.creci && <p className="text-xs text-muted-foreground">CRECI: {broker.creci}</p>}
                    </div>
                  </div>

                  <div className="space-y-1 mb-3">
                    {broker.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />{broker.phone}
                      </div>
                    )}
                    {broker.email && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />{broker.email}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-border my-3">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Vendas</p>
                      <p className="text-sm font-semibold text-foreground">{broker.total_sales ?? 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Comissão</p>
                      <p className="text-xs font-semibold text-foreground">{formatCurrency(broker.total_commission ?? 0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">% padrão</p>
                      <p className="text-sm font-semibold text-foreground">{formatPercent(broker.commission_default_pct)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(broker)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(broker.id)}
                      className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar' : 'Novo'} Corretor</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome completo *</Label>
              <Input placeholder="João Silva" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>CRECI</Label>
                <Input placeholder="123456-F" {...register('creci')} />
              </div>
              <div className="space-y-1.5">
                <Label>Comissão padrão (%)</Label>
                <Input type="number" step="0.1" placeholder="6" {...register('commission_default_pct')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Telefone / WhatsApp</Label>
                <Input placeholder="(11) 99999-9999" {...register('phone')} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="corretor@email.com" {...register('email')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Banco</Label>
                <Input placeholder="Nubank, Itaú..." {...register('bank_name')} />
              </div>
              <div className="space-y-1.5">
                <Label>Chave PIX</Label>
                <Input placeholder="CPF, email ou telefone" {...register('pix_key')} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={activeVal} onCheckedChange={v => setValue('active', v)} />
              <Label>Corretor ativo</Label>
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
