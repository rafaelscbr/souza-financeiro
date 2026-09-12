import { useEffect, useMemo, useState } from 'react'
import { useAdmin } from './AdminData'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, toDateOnly } from '@/lib/format'
import type { Transaction } from '@/types'

/**
 * Baixa de um lançamento que não é parcela de venda: imposto, despesa,
 * entrada avulsa. Parcela de venda tem fluxo próprio, porque ali a baixa
 * dispara a cascata (imposto recalculado, comissão liberada).
 */
export function BaixarLancamento({ tx, onFechar }: { tx: Transaction | null; onFechar: () => void }) {
  const { accounts, baixarLancamento } = useAdmin()
  const { showToast } = useToast()
  const [data, setData] = useState(toDateOnly(new Date()))
  const [contaId, setContaId] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const contas = useMemo(() => accounts.filter((a) => a.is_active), [accounts])
  const entrada = tx?.kind === 'income'

  useEffect(() => {
    if (!tx) return
    setData(toDateOnly(new Date()))
    setContaId(contas[0]?.id ?? '')
    setErro(null)
  }, [tx, contas])

  if (!tx) return null

  return (
    <Modal
      open={!!tx}
      onClose={onFechar}
      title={entrada ? 'Confirmar recebimento' : 'Confirmar pagamento'}
      description={`${tx.description || tx.category} · ${formatCurrency(tx.amount)}`}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={salvando}
            onClick={async () => {
              setErro(null)
              setSalvando(true)
              try {
                await baixarLancamento(tx.id, data, contaId || null)
                showToast({
                  message: entrada ? 'Recebimento confirmado' : 'Pagamento confirmado',
                  detail: formatCurrency(tx.amount),
                })
                onFechar()
              } catch (e) {
                setErro(e instanceof Error ? e.message : 'Não deu para dar baixa.')
              } finally {
                setSalvando(false)
              }
            }}
          >
            {salvando ? <Spinner className="h-5 w-5" /> : 'Confirmar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Data" htmlFor="b-data" hint={entrada ? 'quando caiu' : 'quando saiu'}>
            <Input id="b-data" type="date" value={data} onChange={(e) => setData(e.target.value)} autoFocus />
          </FormField>
          <FormField label="Conta" htmlFor="b-conta" hint={contas.length === 0 ? 'nenhuma cadastrada' : undefined}>
            <Select
              id="b-conta"
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
              disabled={contas.length === 0}
            >
              <option value="">Definir depois</option>
              {contas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        {erro && (
          <p className="text-sm text-expense" role="alert">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}
