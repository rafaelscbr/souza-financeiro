import { useEffect, useMemo, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { useAdmin } from './AdminData'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { Segmented } from '@/components/ui/Segmented'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate, toDateOnly } from '@/lib/format'
import { previewCascade, type SaleView } from '@/lib/sales'
import type { SaleInstallment } from '@/types'

type Diferenca = 'iss' | 'desconto'

/**
 * Confirmar que o dinheiro caiu.
 *
 * A tela parte do valor que REALMENTE entrou na conta, não do valor da
 * parcela. É o que a realidade pediu: na venda 414-D a Lotisa retém 3% de ISS
 * no ato do pagamento, então caiu R$ 16.509,75 de uma parcela de R$ 17.020,36.
 * Sem classificar essa diferença, o sistema teria um furo de R$ 510,61 sem
 * nome — e o imposto do Simples seria calculado sobre a base errada.
 */
export function ReceberParcela({
  venda,
  parcela,
  onFechar,
}: {
  venda: SaleView | null
  parcela: SaleInstallment | null
  onFechar: () => void
}) {
  const { accounts, receberParcela } = useAdmin()
  const { showToast } = useToast()

  const [data, setData] = useState(toDateOnly(new Date()))
  const [contaId, setContaId] = useState('')
  const [recebido, setRecebido] = useState<number | null>(null)
  const [tipoDiferenca, setTipoDiferenca] = useState<Diferenca>('iss')
  const [nota, setNota] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const contas = useMemo(() => accounts.filter((a) => a.is_active && a.type !== 'credit_card'), [accounts])

  useEffect(() => {
    if (!parcela) return
    setData(toDateOnly(new Date()))
    setContaId(contas[0]?.id ?? '')
    // Já sugere o líquido quando a construtora retém: é o valor que vai cair.
    const issPrevisto = venda?.retains_iss ? Math.round(parcela.amount * (venda.iss_pct ?? 0)) / 100 : 0
    setRecebido(Math.round((parcela.amount - issPrevisto) * 100) / 100)
    setTipoDiferenca('iss')
    setNota('')
    setErro(null)
  }, [parcela, venda, contas])

  if (!venda || !parcela) return null

  const valorRecebido = recebido ?? 0
  const diferenca = Math.round((parcela.amount - valorRecebido) * 100) / 100
  const iss = tipoDiferenca === 'iss' ? Math.max(0, diferenca) : 0
  const outro = tipoDiferenca === 'desconto' ? Math.max(0, diferenca) : 0
  const sobra = diferenca < -0.01

  const previa = previewCascade({
    amount: parcela.amount,
    issuesInvoice: venda.issues_invoice,
    simplesPct: venda.simples_pct,
    retainsIss: iss > 0,
    issPct: parcela.amount > 0 ? (iss / parcela.amount) * 100 : 0,
    brokerPct: venda.broker_pct,
  })

  async function confirmar() {
    setErro(null)
    if (sobra) return setErro('O valor recebido não pode ser maior que a parcela.')
    setSalvando(true)
    try {
      await receberParcela({
        installmentId: parcela!.id,
        date: data,
        accountId: contaId || null,
        received: valorRecebido,
        iss,
        other: outro,
        note: nota || null,
      })
      const efeitos = [
        previa.simples > 0 ? `Simples de ${formatCurrency(previa.simples)} a pagar` : null,
        previa.broker > 0 ? `comissão de ${venda!.brokerName ?? 'corretor'} liberada` : null,
      ].filter(Boolean)
      showToast({
        message: `Recebido ${formatCurrency(valorRecebido)}`,
        detail: efeitos.join(' · ') || undefined,
      })
      onFechar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para dar baixa.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      open={!!parcela}
      onClose={onFechar}
      title="Confirmar recebimento"
      description={`${venda.title}${parcela.count > 1 ? ` · parcela ${parcela.idx}/${parcela.count}` : ''}`}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={confirmar} disabled={salvando}>
            {salvando ? <Spinner className="h-5 w-5" /> : 'Confirmar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-2 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-content-muted">Parcela prevista</span>
            <span className="tnum text-lg font-bold text-content">{formatCurrency(parcela.amount)}</span>
          </div>
          <p className="text-xs text-content-faint">vencimento {formatDate(parcela.expected_date)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Data" htmlFor="r-data" hint="quando caiu">
            <Input id="r-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </FormField>
          <FormField
            label="Conta"
            htmlFor="r-conta"
            hint={contas.length === 0 ? 'nenhuma conta cadastrada' : 'onde entrou'}
          >
            <Select
              id="r-conta"
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

        <FormField label="Quanto caiu na conta" htmlFor="r-valor" hint="o valor do extrato, não o da parcela">
          <CurrencyInput id="r-valor" value={recebido} onChange={setRecebido} autoFocus />
        </FormField>

        {diferenca > 0.01 && (
          <div className="space-y-3 rounded-xl border border-pending/25 bg-pending/8 p-3.5">
            <p className="text-sm text-content">
              Faltaram <strong className="tnum">{formatCurrency(diferenca)}</strong>. O que foi?
            </p>
            <Segmented
              ariaLabel="Motivo da diferença"
              value={tipoDiferenca}
              onChange={setTipoDiferenca}
              options={[
                { value: 'iss', label: 'ISS retido' },
                { value: 'desconto', label: 'Desconto' },
              ]}
            />
            <p className="text-xs text-content-muted">
              {tipoDiferenca === 'iss'
                ? 'A construtora retém o ISS e recolhe no seu lugar. O Simples passa a incidir sobre a parcela líquida de ISS.'
                : 'Entra como dedução no recebimento, com a observação abaixo.'}
            </p>
            <Input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Observação (opcional)"
              aria-label="Observação"
            />
          </div>
        )}

        {sobra && (
          <p className="flex items-start gap-2 rounded-xl bg-expense/10 px-3.5 py-2.5 text-sm text-expense">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Caiu mais do que a parcela. Confira o valor: juros ou correção precisam ser lançados à parte.
          </p>
        )}

        <div className="rounded-xl border border-line bg-surface-2/60 p-3.5 text-sm">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-content-faint">
            O que acontece ao confirmar
          </p>
          <ul className="space-y-1 text-content-muted">
            <li>
              Receita de <strong className="tnum text-content">{formatCurrency(parcela.amount)}</strong> liquidada
              {contaId ? ` em ${contas.find((a) => a.id === contaId)?.name}` : ''}.
            </li>
            {iss > 0 && (
              <li>
                ISS de <strong className="tnum text-content">{formatCurrency(iss)}</strong> registrado como retido.
              </li>
            )}
            {previa.simples > 0 && (
              <li>
                Simples de <strong className="tnum text-content">{formatCurrency(previa.simples)}</strong> vai para
                A pagar, com guia no dia 20 do mês seguinte.
              </li>
            )}
            {previa.broker > 0 && (
              <li>
                Comissão de <strong className="text-content">{venda.brokerName ?? 'corretor'}</strong> de{' '}
                <strong className="tnum text-content">{formatCurrency(previa.broker)}</strong> fica liberada.
              </li>
            )}
            <li>
              Fica para a imobiliária:{' '}
              <strong className="tnum text-income">{formatCurrency(previa.net - outro)}</strong>.
            </li>
          </ul>
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
