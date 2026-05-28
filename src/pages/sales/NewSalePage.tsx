import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Plus, Trash2, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToastActions } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'
import type { Development, Broker } from '@/types'

const brokerSchema = z.object({
  broker_id: z.string().min(1, 'Selecione o corretor'),
  role: z.enum(['captador', 'vendedor', 'coordenador']).default('vendedor'),
  commission_pct: z.coerce.number().min(0),
})

const schema = z.object({
  // Development
  development_id: z.string().optional(),
  unit_number: z.string().optional(),
  unit_type: z.string().optional(),
  floor_number: z.coerce.number().optional(),
  area_m2: z.coerce.number().optional(),
  // Buyer
  buyer_name: z.string().min(2, 'Nome do comprador obrigatório'),
  buyer_cpf: z.string().optional(),
  buyer_phone: z.string().optional(),
  buyer_email: z.string().optional(),
  // Values
  total_price: z.coerce.number().min(1, 'Valor obrigatório'),
  vgl: z.coerce.number().optional(),
  // Dates
  sale_date: z.string().min(1, 'Data da venda obrigatória'),
  contract_date: z.string().optional(),
  // Commission
  commission_pct: z.coerce.number().min(0).max(100),
  commission_rule: z.enum(['upfront', 'installments', 'custom']).default('upfront'),
  // Brokers
  brokers: z.array(brokerSchema).min(1, 'Adicione pelo menos um corretor'),
  // Notes
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export function NewSalePage() {
  const navigate = useNavigate()
  const toast = useToastActions()
  const [developments, setDevelopments] = useState<Development[]>([])
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      sale_date: new Date().toISOString().split('T')[0],
      commission_pct: 5,
      commission_rule: 'upfront',
      brokers: [{ broker_id: '', role: 'vendedor', commission_pct: 40 }],
    },
  })

  const { fields: brokerFields, append: addBroker, remove: removeBroker } = useFieldArray({
    control,
    name: 'brokers',
  })

  const totalPrice = watch('total_price') || 0
  const vgl = watch('vgl') || totalPrice
  const commissionPct = watch('commission_pct') || 0
  const commissionTotal = (vgl * commissionPct) / 100
  const brokersWatch = watch('brokers')

  // Total que vai para os corretores (soma de cada broker_pct% da commissionTotal)
  const totalBrokers = (brokersWatch || []).reduce((sum, b) => {
    return sum + (commissionTotal * (b.commission_pct || 0)) / 100
  }, 0)
  const netImob = commissionTotal - totalBrokers

  useEffect(() => {
    Promise.all([
      supabase.from('developments').select('*').eq('status', 'active').order('name'),
      supabase.from('brokers').select('*').eq('active', true).order('name'),
    ]).then(([devRes, brokerRes]) => {
      setDevelopments(devRes.data || [])
      setBrokers(brokerRes.data || [])
    })
  }, [])

  async function onSubmit(data: FormData) {
    setSaving(true)
    // Comissão total que a imobiliária recebe (% do VGL)
    const commissionValue = ((data.vgl ?? data.total_price) * data.commission_pct) / 100

    // 1. Insert sale
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        development_id: data.development_id || null,
        unit_number: data.unit_number || null,
        unit_type: data.unit_type || null,
        floor_number: data.floor_number || null,
        area_m2: data.area_m2 || null,
        buyer_name: data.buyer_name,
        buyer_cpf: data.buyer_cpf || null,
        buyer_phone: data.buyer_phone || null,
        buyer_email: data.buyer_email || null,
        total_price: data.total_price,
        vgl: data.vgl || null,
        sale_date: data.sale_date,
        contract_date: data.contract_date || null,
        status: 'contracted',
        commission_pct: data.commission_pct,
        commission_total: commissionValue,
        commission_rule: data.commission_rule,
        notes: data.notes || null,
      })
      .select()
      .single()

    if (saleError || !saleData) {
      toast.error('Erro ao salvar a venda', saleError?.message)
      setSaving(false)
      return
    }

    // 2. Insert sale_brokers
    // commission_pct do corretor = % da comissão total (ex: 40% de R$50k = R$20k)
    const saleId = saleData.id
    const saleBrokers = data.brokers.map(b => ({
      sale_id: saleId,
      broker_id: b.broker_id,
      role: b.role,
      commission_pct: b.commission_pct,
      commission_value: (commissionValue * b.commission_pct) / 100,
    }))

    await supabase.from('sale_brokers').insert(saleBrokers)

    // 3. If upfront commission, create receivable for the company (commission income)
    if (data.commission_rule === 'upfront') {
      await supabase.from('receivables').insert({
        sale_id: saleId,
        description: `Comissão — ${data.buyer_name}`,
        due_date: data.sale_date,
        amount: commissionValue,
        received: false,
        category: 'commission',
      })
    }

    toast.success('Venda registrada com sucesso!')
    navigate(`/vendas/${saleId}`)
  }

  const roleLabels: Record<string, string> = {
    captador: 'Captador',
    vendedor: 'Vendedor',
    coordenador: 'Coordenador',
  }

  return (
    <div>
      <div className="flex items-center gap-3 px-4 pt-5 pb-4 md:px-6">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Nova Venda</h1>
          <p className="text-sm text-muted-foreground">Registre uma venda de lançamento</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="px-4 md:px-6 pb-8 space-y-5">

        {/* Empreendimento */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Empreendimento / Imóvel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Empreendimento</Label>
              <Controller name="development_id" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione o empreendimento..." /></SelectTrigger>
                  <SelectContent>
                    {developments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}{d.developer_name ? ` — ${d.developer_name}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Unidade / Apt</Label>
                <Input placeholder="101" {...register('unit_number')} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Input placeholder="2 quartos" {...register('unit_type')} />
              </div>
              <div className="space-y-1.5">
                <Label>Andar</Label>
                <Input type="number" placeholder="10" {...register('floor_number')} />
              </div>
              <div className="space-y-1.5">
                <Label>Área (m²)</Label>
                <Input type="number" step="0.01" placeholder="65.00" {...register('area_m2')} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comprador */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Comprador</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome completo *</Label>
              <Input placeholder="Nome do comprador" {...register('buyer_name')} />
              {errors.buyer_name && <p className="text-xs text-destructive">{errors.buyer_name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>CPF</Label>
                <Input placeholder="000.000.000-00" {...register('buyer_cpf')} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input placeholder="(11) 99999-9999" {...register('buyer_phone')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" placeholder="comprador@email.com" {...register('buyer_email')} />
            </div>
          </CardContent>
        </Card>

        {/* Valores */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Valores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Preço de venda *</Label>
                <Input type="number" step="0.01" placeholder="350000" {...register('total_price')} />
                {errors.total_price && <p className="text-xs text-destructive">{errors.total_price.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  VGL
                  <span className="text-xs text-muted-foreground">(Valor Geral Líquido)</span>
                </Label>
                <Input type="number" step="0.01" placeholder="Igual ao preço se em branco" {...register('vgl')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data da venda *</Label>
                <Input type="date" {...register('sale_date')} />
                {errors.sale_date && <p className="text-xs text-destructive">{errors.sale_date.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Data do contrato</Label>
                <Input type="date" {...register('contract_date')} />
              </div>
            </div>

            {/* Commission preview */}
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Comissão da imobiliária</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(commissionTotal)}</p>
                <p className="text-xs text-muted-foreground">{commissionPct}% sobre VGL de {formatCurrency(vgl)}</p>
              </div>
              {commissionTotal > 0 && (
                <div className="pt-2 border-t border-primary/20 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Corretores (previsto)</p>
                    <p className="text-sm font-semibold text-amber-600">{formatCurrency(totalBrokers)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Líquido imobiliária</p>
                    <p className="text-sm font-semibold text-green-600">{formatCurrency(netImob)}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Comissão */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Comissão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Percentual total (%)</Label>
                <Input type="number" step="0.1" {...register('commission_pct')} />
              </div>
              <div className="space-y-1.5">
                <Label>Regra de pagamento</Label>
                <Controller name="commission_rule" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upfront">À vista na assinatura</SelectItem>
                      <SelectItem value="installments">Parcelada conforme repasse</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>

            {/* Brokers */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Corretores envolvidos</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addBroker({ broker_id: '', role: 'vendedor', commission_pct: 0 })}
                >
                  <Plus className="h-4 w-4" /> Adicionar
                </Button>
              </div>

              {brokerFields.map((field, idx) => {
                const brokerPct = brokersWatch?.[idx]?.commission_pct || 0
                const brokerValue = (commissionTotal * brokerPct) / 100
                return (
                  <div key={field.id} className="p-3 rounded-xl bg-muted/50 space-y-2">
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1.5">
                        <Label>Corretor</Label>
                        <Controller
                          name={`brokers.${idx}.broker_id`}
                          control={control}
                          render={({ field: f }) => (
                            <Select value={f.value} onValueChange={f.onChange}>
                              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                              <SelectContent>
                                {brokers.map(b => (
                                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                      <div className="w-28 space-y-1.5">
                        <Label>Papel</Label>
                        <Controller
                          name={`brokers.${idx}.role`}
                          control={control}
                          render={({ field: f }) => (
                            <Select value={f.value} onValueChange={f.onChange}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="vendedor">Vendedor</SelectItem>
                                <SelectItem value="captador">Captador</SelectItem>
                                <SelectItem value="coordenador">Coord.</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                      <div className="w-24 space-y-1.5">
                        <Label className="text-xs">% da comissão</Label>
                        <Input type="number" step="1" {...register(`brokers.${idx}.commission_pct`)} />
                      </div>
                      {brokerFields.length > 1 && (
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeBroker(idx)}
                          className="text-destructive hover:text-destructive mb-0.5">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {commissionTotal > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-0.5">
                        <Info className="h-3 w-3 shrink-0" />
                        <span>
                          {brokerPct}% de {formatCurrency(commissionTotal)} ={' '}
                          <span className="font-semibold text-primary">{formatCurrency(brokerValue)}</span>
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
              {errors.brokers && <p className="text-xs text-destructive">{errors.brokers.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Observações */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea placeholder="Notas sobre a venda, condições especiais..." {...register('notes')} />
          </CardContent>
        </Card>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" loading={saving}>
            Salvar venda
          </Button>
        </div>
      </form>
    </div>
  )
}
