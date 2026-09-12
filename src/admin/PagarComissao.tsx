import { useEffect, useMemo, useState } from 'react'
import { useAdmin } from './AdminData'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate, toDateOnly } from '@/lib/format'

export interface ComissaoAPagar {
  installmentId: string
  brokerName: string
  saleTitle: string
  parcela: string
  amount: number
  dueDate: string
}

/**
 * Pagar comissão liberada.
 *
 * Aceita várias parcelas do mesmo corretor de uma vez, porque é assim que
 * acontece na prática. O desconto combinado só é oferecido quando há uma
 * parcela só: aplicar um desconto sobre um lote seria ambíguo, e foi um
 * desconto desses (a cesta de R$ 399,44 na 414-D) que já ficou registrado
 * apenas na descrição do lançamento, sem campo próprio.
 */
export function PagarComissao({
  itens,
  onFechar,
}: {
  itens: ComissaoAPagar[] | null
  onFechar: () => void
}) {
  const { accounts, pagarComissoes } = useAdmin()
  const { showToast } = useToast()

  const [data, setData] = useState(toDateOnly(new Date()))
  const [contaId, setContaId] = useState('')
  const [desconto, setDesconto] = useState<number | null>(null)
  const [nota, setNota] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const contas = useMemo(() => accounts.filter((a) => a.is_active && a.type !== 'credit_card'), [accounts])
  const unica = itens?.length === 1

  useEffect(() => {
    if (!itens) return
    setData(toDateOnly(new Date()))
    setContaId(contas[0]?.id ?? '')
    setDesconto(null)
    setNota('')
    setErro(null)
  }, [itens, contas])

  if (!itens || itens.length === 0) return null

  const total = Math.round(itens.reduce((s, i) => s + i.amount, 0) * 100) / 100
  const aPagar = Math.round((total - (unica ? desconto ?? 0 : 0)) * 100) / 100
  const corretor = itens[0].brokerName

  async function confirmar() {
    setErro(null)
    if (aPagar < 0) return setErro('O desconto é maior que a comissão.')
    setSalvando(true)
    try {
      await pagarComissoes({
        installmentIds: itens!.map((i) => i.installmentId),
        date: data,
        accountId: contaId || null,
        adjustment: unica ? desconto ?? 0 : 0,
        note: nota || null,
      })
      showToast({
        message: `Comissão paga a ${corretor}`,
        detail: `${formatCurrency(aPagar)} em ${itens!.length} parcela(s)`,
      })
      onFechar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para pagar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      open={!!itens}
      onClose={onFechar}
      title="Pagar comissão"
      description={corretor}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={confirmar} disabled={salvando}>
            {salvando ? <Spinner className="h-5 w-5" /> : `Pagar ${formatCurrency(aPagar)}`}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {itens.map((i) => (
            <li key={i.installmentId} className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-content">{i.saleTitle}</p>
                <p className="text-xs text-content-faint">
                  {i.parcela} · liberada em {formatDate(i.dueDate)}
                </p>
              </div>
              <span className="tnum shrink-0 text-sm font-semibold text-content">
                {formatCurrency(i.amount)}
              </span>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Data do pagamento" htmlFor="p-data">
            <Input id="p-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </FormField>
          <FormField label="Conta" htmlFor="p-conta" hint={contas.length === 0 ? 'nenhuma cadastrada' : 'de onde saiu'}>
            <Select
              id="p-conta"
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

        {unica ? (
          <>
            <FormField
              label="Desconto combinado"
              htmlFor="p-desc"
              hint="opcional — sai do valor pago e fica registrado"
            >
              <CurrencyInput id="p-desc" value={desconto} onChange={setDesconto} />
            </FormField>
            {(desconto ?? 0) > 0 && (
              <FormField label="Do que foi o desconto" htmlFor="p-nota">
                <Input
                  id="p-nota"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Ex.: cesta de Natal"
                />
              </FormField>
            )}
          </>
        ) : (
          <p className="text-xs text-content-faint">
            Para aplicar desconto, pague uma parcela por vez.
          </p>
        )}

        <div className="flex items-baseline justify-between rounded-xl bg-surface-2 px-4 py-3">
          <span className="text-sm text-content-muted">
            {(desconto ?? 0) > 0 ? 'Total com desconto' : 'Total'}
          </span>
          <span className="tnum text-lg font-bold text-content">{formatCurrency(aPagar)}</span>
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
