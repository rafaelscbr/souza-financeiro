import { useEffect, useState } from 'react'
import { Building2, Plus, MapPin, Calendar, Home, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToastActions } from '@/components/ui/toast'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Development } from '@/types'

const statusVariant: Record<string, 'success' | 'blue' | 'destructive'> = {
  active: 'success',
  delivered: 'blue',
  cancelled: 'destructive',
}
const statusLabel: Record<string, string> = {
  active: 'Ativo',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  developer_name: z.string().optional(),
  location: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  total_units: z.coerce.number().optional(),
  delivery_date: z.string().optional(),
  status: z.enum(['active', 'delivered', 'cancelled']).default('active'),
})
type FormData = z.infer<typeof schema>

export function DevelopmentsPage() {
  const toast = useToastActions()
  const [developments, setDevelopments] = useState<Development[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Development | null>(null)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { status: 'active' },
  })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('developments').select('*').order('created_at', { ascending: false })
    setDevelopments(data || [])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    reset({ status: 'active' })
    setDialogOpen(true)
  }

  function openEdit(dev: Development) {
    setEditing(dev)
    reset({
      name: dev.name,
      developer_name: dev.developer_name ?? '',
      location: dev.location ?? '',
      city: dev.city ?? '',
      state: dev.state ?? '',
      total_units: dev.total_units ?? undefined,
      delivery_date: dev.delivery_date ?? '',
      status: dev.status,
    })
    setDialogOpen(true)
  }

  async function onSubmit(data: FormData) {
    setSaving(true)
    const payload = {
      name: data.name,
      developer_name: data.developer_name || null,
      location: data.location || null,
      city: data.city || null,
      state: data.state || null,
      total_units: data.total_units || null,
      delivery_date: data.delivery_date || null,
      status: data.status,
    }

    if (editing) {
      const { error } = await supabase.from('developments').update(payload).eq('id', editing.id)
      if (error) { toast.error('Erro ao salvar'); setSaving(false); return }
      toast.success('Empreendimento atualizado!')
    } else {
      const { error } = await supabase.from('developments').insert(payload)
      if (error) { toast.error('Erro ao salvar'); setSaving(false); return }
      toast.success('Empreendimento cadastrado!')
    }
    setSaving(false)
    setDialogOpen(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este empreendimento?')) return
    const { error } = await supabase.from('developments').delete().eq('id', id)
    if (error) { toast.error('Não foi possível excluir'); return }
    toast.success('Excluído com sucesso')
    load()
  }

  const filtered = developments.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.developer_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (d.city ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <PageHeader
        title="Empreendimentos"
        description="Lançamentos e projetos de construtoras"
        action={
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" /> Novo
          </Button>
        }
      />

      <div className="px-4 md:px-6 pb-6 space-y-4">
        <Input
          placeholder="Buscar por nome, construtora ou cidade..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          leftIcon={<Building2 className="h-4 w-4" />}
        />

        {loading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-7 w-7" />}
            title="Nenhum empreendimento"
            description="Cadastre lançamentos e projetos de construtoras para vincular às suas vendas."
            action={{ label: 'Cadastrar empreendimento', onClick: openNew }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(dev => (
              <Card key={dev.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm leading-tight">{dev.name}</p>
                      {dev.developer_name && (
                        <p className="text-xs text-muted-foreground mt-0.5">{dev.developer_name}</p>
                      )}
                    </div>
                    <Badge variant={statusVariant[dev.status]}>{statusLabel[dev.status]}</Badge>
                  </div>

                  <div className="space-y-1.5">
                    {(dev.city || dev.state) && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span>{[dev.city, dev.state].filter(Boolean).join(' - ')}</span>
                      </div>
                    )}
                    {dev.location && (
                      <p className="text-xs text-muted-foreground pl-5">{dev.location}</p>
                    )}
                    {dev.delivery_date && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>Entrega prevista: {formatDate(dev.delivery_date)}</span>
                      </div>
                    )}
                    {dev.total_units && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Home className="h-3.5 w-3.5 shrink-0" />
                        <span>{dev.total_units} unidades</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-1.5 mt-4 pt-3 border-t border-border">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(dev)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(dev.id)}
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar' : 'Novo'} Empreendimento</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do empreendimento *</Label>
              <Input placeholder="Ex: Residencial Jardins" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Construtora</Label>
              <Input placeholder="Ex: MRV, Cyrela, Even..." {...register('developer_name')} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input placeholder="São Paulo" {...register('city')} />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Input placeholder="SP" maxLength={2} {...register('state')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Endereço / Bairro</Label>
              <Input placeholder="Rua, bairro ou região" {...register('location')} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Total de unidades</Label>
                <Input type="number" placeholder="120" {...register('total_units')} />
              </div>
              <div className="space-y-1.5">
                <Label>Entrega prevista</Label>
                <Input type="date" {...register('delivery_date')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Controller name="status" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="delivered">Entregue</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
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
