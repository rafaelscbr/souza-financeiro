import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Ban, CalendarClock, CheckCircle2, Clock, Pencil, Undo2,
} from 'lucide-react'
import { useAdmin } from '../AdminData'
import { ReceberParcela } from '../ReceberParcela'
import { PagarComissao, type ComissaoAPagar } from '../PagarComissao'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { FormField, Input, Textarea } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { Progress } from '@/components/ui/Progress'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { brokerStatusOf } from '@/lib/sales'
import { formatCurrency, formatDate, formatDateShort, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SaleInstallment } from '@/types'

/**
 * A ficha da venda: tudo de um negócio numa tela, com as ações onde a pergunta
 * aparece. "Já recebi esta parcela?" e "o corretor já foi pago?" se respondem
 * aqui, sem passar pelo razão.
 */
export function Venda() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { vendas, transactions, desfazerRecebimento, reagendarParcela, cancelarVenda, editarVenda } = useAdmin()

  const [recebendo, setRecebendo] = useState<SaleInstallment | null>(null)
  const [pagando, setPagando] = useState<ComissaoAPagar[] | null>(null)
  const [reagendando, setReagendando] = useState<SaleInstallment | null>(null)
  const [novaData, setNovaData] = useState('')
  const [notaReagendar, setNotaReagendar] = useState('')
  const [cancelando, setCancelando] = useState(false)
  const [notaCancelar, setNotaCancelar] = useState('')
  const [editando, setEditando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const venda = vendas.find((v) => v.id === id)
  const statusPorTx = useMemo(() => new Map(transactions.map((t) => [t.id, t.status])), [transactions])
  const valorPorTx = useMemo(() => new Map(transactions.map((t) => [t.id, t.amount])), [transactions])

  if (!venda) {
    return (
      <EmptyState
        title="Venda não encontrada"
        description="Ela pode ter sido removida."
        action={
          <Link to="/vendas">
            <Button variant="secondary">Voltar para Vendas</Button>
          </Link>
        }
      />
    )
  }

  const c = venda.cascade

  async function acao(fn: () => Promise<void>, msg: string) {
    setErro(null)
    setOcupado(true)
    try {
      await fn()
      showToast({ message: msg })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para completar.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-4">
      <Link to="/vendas" className="inline-flex items-center gap-1.5 text-sm text-content-muted hover:text-content">
        <ArrowLeft className="h-4 w-4" />
        Vendas
      </Link>

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-content">{venda.title}</h1>
              {venda.status === 'cancelada' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-semibold text-content-muted">
                  <Ban className="h-2.5 w-2.5" />
                  cancelada
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-content-muted">
              {[
                venda.client_name,
                venda.development,
                `vendida em ${formatDate(venda.sale_date)}`,
                venda.property_value != null ? `imóvel ${formatCurrency(venda.property_value)}` : 'imóvel sem valor informado',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="mt-0.5 text-xs text-content-faint">
              {[
                venda.brokerName ? `${venda.brokerName} ${venda.broker_pct ?? 0}%` : 'sem corretor',
                venda.issues_invoice ? `Simples ${venda.simples_pct}%` : 'sem nota fiscal',
                venda.retains_iss ? `ISS retido ${venda.iss_pct}%` : null,
                venda.partner_name ? `parceria ${venda.partner_name} (${venda.partner_share_pct}% da Souza)` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          {venda.status !== 'cancelada' && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditando(true)}>
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Button>
              <Button variant="danger" size="sm" onClick={() => setCancelando(true)}>
                Cancelar venda
              </Button>
            </div>
          )}
        </div>

        {venda.notes && (
          <p className="mt-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-xs text-content-muted">{venda.notes}</p>
        )}
      </div>

      {/* A cascata */}
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-content">Resultado da venda</h2>
        <Linha rotulo="Comissão da imobiliária" valor={c.commission} forte />
        {c.iss > 0 && <Linha rotulo={`(−) ISS retido ${venda.iss_pct}%`} valor={-c.iss} />}
        {c.simples > 0 && <Linha rotulo={`(−) Simples ${venda.simples_pct}%`} valor={-c.simples} />}
        {c.broker > 0 && (
          <Linha
            rotulo={`(−) Comissão ${venda.brokerName ?? 'do corretor'} ${venda.broker_pct ?? 0}%`}
            valor={-c.broker}
            nota={c.brokerAdjustment > 0 ? `desconto de ${formatCurrency(c.brokerAdjustment)}` : undefined}
          />
        )}
        {c.owner > 0 && <Linha rotulo="(−) Fatia do sócio" valor={-c.owner} />}
        <div className="my-2 border-t border-line" />
        <Linha rotulo="Fica para a imobiliária" valor={c.net} forte destaque />
        <p className="mt-1 text-right text-[11px] text-content-faint">
          {Math.round(c.netShare * 100)}% da comissão
        </p>

        {venda.status !== 'cancelada' && (
          <>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-[11px] text-content-faint">
                <span>Recebido {formatCurrency(venda.received)}</span>
                <span>falta {formatCurrency(venda.toReceive)}</span>
              </div>
              <Progress value={venda.progress} color="#059669" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Mini rotulo="Recebido" valor={venda.received} tom="text-income" />
              <Mini rotulo="A receber" valor={venda.toReceive} tom="text-pending" />
              <Mini rotulo="Comissão paga" valor={venda.brokerPaid} tom="text-content-muted" />
              <Mini rotulo="Comissão a pagar" valor={venda.brokerToPay} tom="text-expense" />
            </div>
          </>
        )}
      </div>

      {/* Parcelas */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <h2 className="px-5 pb-2 pt-4 text-sm font-semibold text-content">Parcelas</h2>
        <div className="divide-y divide-line">
          {venda.installments.map((p) => {
            const st = brokerStatusOf(p, statusPorTx)
            const vencida = p.status === 'prevista' && p.expected_date < toDateOnly(new Date())
            const pago = p.broker_tx_id ? valorPorTx.get(p.broker_tx_id) ?? p.broker_amount : p.broker_amount
            return (
              <div key={p.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <div className="flex items-center gap-2">
                    <span className="tnum text-xs font-semibold text-content-faint">
                      {p.idx}/{p.count}
                    </span>
                    <span className="text-sm font-medium text-content">
                      {p.status === 'recebida' && p.received_date
                        ? `recebida em ${formatDate(p.received_date)}`
                        : p.status === 'cancelada'
                          ? 'cancelada'
                          : `prevista para ${formatDate(p.expected_date)}`}
                    </span>
                    {p.status === 'recebida' && <CheckCircle2 className="h-4 w-4 text-income" />}
                    {vencida && <AlertTriangle className="h-4 w-4 text-critical" />}
                    {p.status === 'prevista' && !vencida && <Clock className="h-4 w-4 text-pending" />}
                  </div>
                  <span className="tnum text-sm font-bold text-content">{formatCurrency(p.amount)}</span>
                </div>

                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-content-faint">
                  {p.iss_amount > 0 && <span>ISS {formatCurrency(p.iss_amount)}</span>}
                  {p.simples_amount > 0 && <span>Simples {formatCurrency(p.simples_amount)}</span>}
                  {p.broker_amount > 0 && (
                    <span
                      className={cn(
                        st === 'liberada' && 'font-semibold text-pending',
                        st === 'recebida' && 'text-content-muted',
                      )}
                    >
                      {venda.brokerName ?? 'corretor'} {formatCurrency(st === 'recebida' ? pago : p.broker_amount)}
                      {st === 'liberada' ? ' · liberada' : st === 'recebida' ? ' · paga' : ' · prevista'}
                      {p.broker_adjustment > 0 ? ` (desconto ${formatCurrency(p.broker_adjustment)})` : ''}
                    </span>
                  )}
                  {p.status === 'recebida' && p.received_amount != null && p.received_amount !== p.amount && (
                    <span>caiu {formatCurrency(p.received_amount)}</span>
                  )}
                  <span className="font-medium text-content-muted">líquido {formatCurrency(p.net_amount)}</span>
                </div>

                {p.notes && <p className="mt-1 text-[11px] text-content-faint">{p.notes}</p>}

                {venda.status !== 'cancelada' && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {p.status === 'prevista' && (
                      <>
                        <Button size="sm" onClick={() => setRecebendo(p)} disabled={ocupado}>
                          Recebi
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setReagendando(p)
                            setNovaData(p.expected_date)
                            setNotaReagendar('')
                          }}
                          disabled={ocupado}
                        >
                          <CalendarClock className="h-3.5 w-3.5" />
                          Reagendar
                        </Button>
                      </>
                    )}
                    {st === 'liberada' && p.broker_amount > 0 && (
                      <Button
                        size="sm"
                        onClick={() =>
                          setPagando([
                            {
                              installmentId: p.id,
                              brokerName: venda.brokerName ?? 'corretor',
                              saleTitle: venda.title,
                              parcela: `parcela ${p.idx}/${p.count}`,
                              amount: p.broker_amount,
                              dueDate: p.received_date ?? p.expected_date,
                            },
                          ])
                        }
                        disabled={ocupado}
                      >
                        Pagar comissão
                      </Button>
                    )}
                    {p.status === 'recebida' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          acao(() => desfazerRecebimento(p.id), 'Recebimento desfeito')
                        }
                        disabled={ocupado}
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        Desfazer recebimento
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {erro && (
        <p className="rounded-xl bg-expense/10 px-3.5 py-2.5 text-sm text-expense" role="alert">
          {erro}
        </p>
      )}

      <ReceberParcela venda={venda} parcela={recebendo} onFechar={() => setRecebendo(null)} />
      <PagarComissao itens={pagando} onFechar={() => setPagando(null)} />

      {/* Reagendar */}
      <Modal
        open={!!reagendando}
        onClose={() => setReagendando(null)}
        title="Reagendar parcela"
        description="A data anterior fica registrada, e o corretor vê a nova na hora."
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setReagendando(null)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={ocupado || !novaData}
              onClick={async () => {
                const p = reagendando!
                await acao(
                  () => reagendarParcela(p.id, novaData, notaReagendar || undefined),
                  'Parcela reagendada',
                )
                setReagendando(null)
              }}
            >
              {ocupado ? <Spinner className="h-5 w-5" /> : 'Reagendar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField label="Nova data prevista" htmlFor="rg-data">
            <Input id="rg-data" type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} autoFocus />
          </FormField>
          <FormField label="Motivo" htmlFor="rg-nota" hint="opcional">
            <Input
              id="rg-nota"
              value={notaReagendar}
              onChange={(e) => setNotaReagendar(e.target.value)}
              placeholder="Ex.: construtora adiou a medição"
            />
          </FormField>
          {reagendando && (
            <p className="text-xs text-content-faint">
              Estava prevista para {formatDateShort(reagendando.expected_date)}.
            </p>
          )}
        </div>
      </Modal>

      {/* Cancelar */}
      <Modal
        open={cancelando}
        onClose={() => setCancelando(false)}
        title="Cancelar esta venda?"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setCancelando(false)}>
              Não cancelar
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={ocupado}
              onClick={async () => {
                await acao(() => cancelarVenda(venda.id, notaCancelar || undefined), 'Venda cancelada')
                setCancelando(false)
                navigate('/vendas')
              }}
            >
              {ocupado ? <Spinner className="h-5 w-5" /> : 'Sim, cancelar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-content">
            Vão ser canceladas{' '}
            <strong>
              {venda.installments.filter((p) => p.status === 'prevista').length} parcela(s) prevista(s)
            </strong>{' '}
            no valor de{' '}
            <strong className="tnum">{formatCurrency(venda.toReceive)}</strong>, e as comissões ainda não
            pagas dessas parcelas.
          </p>
          <p className="text-sm text-content-muted">
            O que já foi recebido e pago continua registrado — e o imposto de parcela já recebida
            continua devido. Se houver devolução, lance como despesa depois.
          </p>
          <FormField label="Motivo" htmlFor="cc-nota" hint="opcional">
            <Textarea
              id="cc-nota"
              value={notaCancelar}
              onChange={(e) => setNotaCancelar(e.target.value)}
              placeholder="Ex.: distrato assinado em 10/09"
            />
          </FormField>
        </div>
      </Modal>

      <EditarVenda
        aberto={editando}
        onFechar={() => setEditando(false)}
        venda={venda}
        onSalvar={async (dados) => {
          await acao(() => editarVenda(venda.id, dados), 'Venda atualizada')
          setEditando(false)
        }}
        ocupado={ocupado}
      />
    </div>
  )
}

/**
 * Editar só o que não mexe em dinheiro. Valor de comissão, percentual e
 * parcelas não entram aqui de propósito: mudá-los depois de lançado exigiria
 * reescrever o razão, e a saída honesta é cancelar e registrar de novo.
 */
function EditarVenda({
  aberto,
  onFechar,
  venda,
  onSalvar,
  ocupado,
}: {
  aberto: boolean
  onFechar: () => void
  venda: { title: string; client_name: string | null; unit: string | null; notes: string | null; property_value: number | null }
  onSalvar: (dados: Record<string, unknown>) => Promise<void>
  ocupado: boolean
}) {
  const [titulo, setTitulo] = useState(venda.title)
  const [cliente, setCliente] = useState(venda.client_name ?? '')
  const [unidade, setUnidade] = useState(venda.unit ?? '')
  const [nota, setNota] = useState(venda.notes ?? '')

  return (
    <Modal
      key={aberto ? 'aberto' : 'fechado'}
      open={aberto}
      onClose={onFechar}
      title="Editar dados da venda"
      description="Valores e parcelas não mudam por aqui."
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={ocupado}
            onClick={() =>
              onSalvar({
                title: titulo,
                client_name: cliente || null,
                unit: unidade || null,
                notes: nota || null,
              })
            }
          >
            {ocupado ? <Spinner className="h-5 w-5" /> : 'Salvar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="Título" htmlFor="e-tit">
          <Input id="e-tit" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Unidade" htmlFor="e-unid">
            <Input id="e-unid" value={unidade} onChange={(e) => setUnidade(e.target.value)} />
          </FormField>
          <FormField label="Comprador" htmlFor="e-cli">
            <Input id="e-cli" value={cliente} onChange={(e) => setCliente(e.target.value)} />
          </FormField>
        </div>
        <FormField label="Observação" htmlFor="e-nota">
          <Textarea id="e-nota" value={nota} onChange={(e) => setNota(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  )
}

function Linha({
  rotulo,
  valor,
  forte,
  destaque,
  nota,
}: {
  rotulo: string
  valor: number
  forte?: boolean
  destaque?: boolean
  nota?: string
}) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className={cn('text-sm', forte ? 'font-semibold text-content' : 'text-content-muted')}>
        {rotulo}
        {nota && <span className="ml-1.5 text-[11px] text-content-faint">({nota})</span>}
      </span>
      <span
        className={cn(
          'tnum shrink-0 font-semibold',
          destaque ? 'text-lg text-income' : valor < 0 ? 'text-expense' : 'text-content',
        )}
      >
        {formatCurrency(valor)}
      </span>
    </div>
  )
}

function Mini({ rotulo, valor, tom }: { rotulo: string; valor: number; tom: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/60 p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-content-faint">{rotulo}</p>
      <p className={cn('tnum text-sm font-bold', tom)}>{formatCurrency(valor)}</p>
    </div>
  )
}
