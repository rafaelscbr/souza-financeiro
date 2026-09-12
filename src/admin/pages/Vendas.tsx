import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Ban, Calendar, Handshake, Search, User } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { Input, Select } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { Progress } from '@/components/ui/Progress'
import { Segmented } from '@/components/ui/Segmented'
import { formatCurrency, formatDate, formatDateShort } from '@/lib/format'
import { cn } from '@/lib/utils'

/** A carteira: cada venda com o que falta receber e o que falta pagar. */
export function Vendas() {
  const { vendas, contacts, costCenters } = useAdmin()
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState<'andamento' | 'concluidas' | 'canceladas' | 'todas'>('andamento')
  const [corretor, setCorretor] = useState('')
  const [empreendimento, setEmpreendimento] = useState('')

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return vendas.filter((v) => {
      if (situacao === 'andamento' && v.status !== 'ativa') return false
      if (situacao === 'concluidas' && v.status !== 'concluida') return false
      if (situacao === 'canceladas' && v.status !== 'cancelada') return false
      if (corretor && v.broker_id !== corretor) return false
      if (empreendimento && v.cost_center_id !== empreendimento) return false
      if (q && !`${v.title} ${v.client_name ?? ''} ${v.development ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [vendas, busca, situacao, corretor, empreendimento])

  const totais = useMemo(
    () =>
      filtradas.reduce(
        (a, v) => ({
          comissao: a.comissao + v.cascade.commission,
          recebido: a.recebido + v.received,
          aReceber: a.aReceber + v.toReceive,
          comissaoAPagar: a.comissaoAPagar + v.brokerToPay,
        }),
        { comissao: 0, recebido: 0, aReceber: 0, comissaoAPagar: 0 },
      ),
    [filtradas],
  )

  if (vendas.length === 0) {
    return (
      <EmptyState
        icon={<Handshake className="h-8 w-8" />}
        title="Nenhuma venda registrada"
        description="Registre a primeira e ela aparece aqui com as parcelas, o imposto e a comissão do corretor já organizados."
      />
    )
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h1 className="text-xl font-bold text-content">Vendas</h1>
        <p className="text-sm text-content-faint">
          {filtradas.length} de {vendas.length}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Total rotulo="Comissão contratada" valor={totais.comissao} />
        <Total rotulo="Já recebido" valor={totais.recebido} tom="text-income" />
        <Total rotulo="Ainda a receber" valor={totais.aReceber} tom="text-pending" />
        <Total rotulo="Comissão a pagar" valor={totais.comissaoAPagar} tom="text-expense" />
      </div>

      <div className="space-y-2">
        <Segmented
          ariaLabel="Situação"
          value={situacao}
          onChange={setSituacao}
          options={[
            { value: 'andamento', label: 'Em andamento' },
            { value: 'concluidas', label: 'Concluídas' },
            { value: 'canceladas', label: 'Canceladas' },
            { value: 'todas', label: 'Todas' },
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
            <Input
              className="pl-9"
              placeholder="Buscar por unidade, comprador ou empreendimento"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Select
            value={corretor}
            onChange={(e) => setCorretor(e.target.value)}
            aria-label="Filtrar por corretor"
            className="sm:w-44"
          >
            <option value="">Todos os corretores</option>
            {contacts
              .filter((c) => c.type === 'broker')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
          <Select
            value={empreendimento}
            onChange={(e) => setEmpreendimento(e.target.value)}
            aria-label="Filtrar por empreendimento"
            className="sm:w-44"
          >
            <option value="">Todos os empreendimentos</option>
            {costCenters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {filtradas.length === 0 ? (
        <EmptyState title="Nada com esse filtro" description="Ajuste a busca ou troque a situação." />
      ) : (
        <ul className="space-y-3">
          {filtradas.map((v) => (
            <li key={v.id}>
              <Link
                to={`/vendas/${v.id}`}
                className="block overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-colors hover:border-brandblue/40"
              >
                <div className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[15px] font-bold text-content">{v.title}</h2>
                      {v.status === 'cancelada' && (
                        <Selo tom="neutro" icone={<Ban className="h-2.5 w-2.5" />}>
                          cancelada
                        </Selo>
                      )}
                      {v.status !== 'cancelada' && v.hasOverdue && (
                        <Selo tom="critico" icone={<AlertTriangle className="h-2.5 w-2.5" />}>
                          vencida
                        </Selo>
                      )}
                      {v.status === 'concluida' && <Selo tom="ok">recebida</Selo>}
                      {v.brokerReleased > 0 && <Selo tom="alerta">comissão liberada</Selo>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-content-faint">
                      {v.client_name && (
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {v.client_name}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(v.sale_date)}
                      </span>
                      {v.brokerName && <span>{v.brokerName}</span>}
                      {v.nextDate && v.status !== 'cancelada' && (
                        <span>próxima {formatDateShort(v.nextDate)}</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] uppercase tracking-wide text-content-faint">Fica limpo</p>
                    <p className="tnum text-lg font-bold text-income">{formatCurrency(v.cascade.net)}</p>
                  </div>
                </div>

                {v.status !== 'cancelada' && (
                  <div className="px-4 pb-3">
                    <div className="mb-1 flex justify-between text-[11px] text-content-faint">
                      <span>Recebido {formatCurrency(v.received)}</span>
                      <span>de {formatCurrency(v.cascade.commission)}</span>
                    </div>
                    <Progress value={v.progress} color="#059669" />
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Total({ rotulo, valor, tom = 'text-content' }: { rotulo: string; valor: number; tom?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <p className="text-[11px] font-medium uppercase tracking-wide text-content-faint">{rotulo}</p>
      <p className={cn('tnum mt-1 text-lg font-bold', tom)}>{formatCurrency(valor)}</p>
    </div>
  )
}

function Selo({
  children,
  tom,
  icone,
}: {
  children: React.ReactNode
  tom: 'critico' | 'alerta' | 'ok' | 'neutro'
  icone?: React.ReactNode
}) {
  const cores = {
    critico: 'bg-critical/12 text-critical',
    alerta: 'bg-pending/15 text-pending',
    ok: 'bg-income/12 text-income',
    neutro: 'bg-surface-3 text-content-muted',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
        cores[tom],
      )}
    >
      {icone}
      {children}
    </span>
  )
}
