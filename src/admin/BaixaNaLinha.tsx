import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useAdmin } from './AdminData'
import { formatCurrency, toDateOnly } from '@/lib/format'
import type { SaleInstallment, Transaction } from '@/types'
import type { SaleView } from '@/lib/sales'

/*
 * BAIXA NA LINHA (Souza 3.0, decisão 4 do plano de 02/11/2026).
 *
 * "Recebi" e "Paguei" gravam na própria linha, em dois toques: o primeiro
 * arma ("Confirmar"), o segundo grava. Depois vem o aviso com Desfazer, no
 * lugar do antigo "tem certeza?". O "⋯" abre o painel completo de sempre,
 * para quando o valor, a data ou a conta forem outros.
 *
 * Os padrões são OS MESMOS do painel (ReceberParcela, BaixarLancamento):
 * hoje, a primeira conta ativa e, na parcela com ISS retido, o líquido que
 * vai cair. Nenhuma regra nova; é o painel confirmado sem mexer em nada.
 * Comissão de corretor NÃO passa por aqui: o repasse tem ajuste (brinde) e
 * continua no painel dele.
 */

type Baixa = () => Promise<{ mensagem: string; detalhe?: string; desfazer: () => Promise<void> }>

export function BaixaNaLinha({ rotulo, baixar, aoDetalhar }: { rotulo: string; baixar: Baixa; aoDetalhar: () => void }) {
  const { showToast } = useToast()
  const [armado, setArmado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Armado e esquecido: desarma em 6s ou ao clicar fora.
  useEffect(() => {
    if (!armado) return
    const t = window.setTimeout(() => setArmado(false), 6000)
    const fora = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setArmado(false)
    }
    document.addEventListener('pointerdown', fora)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('pointerdown', fora)
    }
  }, [armado])

  async function confirmar() {
    setSalvando(true)
    try {
      const r = await baixar()
      showToast({
        message: r.mensagem,
        detail: r.detalhe,
        actionLabel: 'Desfazer',
        onAction: async () => {
          try {
            await r.desfazer()
            showToast({ message: 'Desfeito. Voltou como estava.' })
          } catch (e) {
            showToast({ tone: 'error', message: e instanceof Error ? `Não deu para desfazer: ${e.message}` : 'Não deu para desfazer.' })
          }
        },
      })
    } catch (e) {
      showToast({ tone: 'error', message: e instanceof Error ? `Nada foi gravado: ${e.message}` : 'Nada foi gravado. Tente de novo.' })
    } finally {
      setSalvando(false)
      setArmado(false)
    }
  }

  return (
    <div ref={ref} className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {armado || salvando ? (
        <Button
          size="sm"
          variant="primario"
          carregando={salvando}
          onClick={confirmar}
          style={{ animation: 'avanca var(--dur-pagina) var(--curva-entra)' }}
        >
          Confirmar
        </Button>
      ) : (
        <Button size="sm" variant="secundario" onClick={() => setArmado(true)}>
          {rotulo}
        </Button>
      )}
      <Button size="icone" variant="fantasma" icone={MoreHorizontal} aria-label={`${rotulo}: escolher valor, data e conta`} onClick={aoDetalhar} />
    </div>
  )
}

/* ------------------------------------------------------------------ as baixas */

/** A conta padrão dos painéis: a primeira ativa que não é cartão. */
function contaPadrao(accounts: { id: string; name: string; is_active: boolean; type: string }[]) {
  return accounts.find((a) => a.is_active && a.type !== 'credit_card') ?? null
}

/** Recebi a parcela: os mesmos padrões de ReceberParcela. */
export function useBaixaDeParcela() {
  const { accounts, receberParcela, desfazerRecebimento } = useAdmin()
  return (venda: SaleView, p: SaleInstallment): Baixa =>
    async () => {
      const conta = contaPadrao(accounts)
      const issPrevisto = venda.retains_iss ? Math.round(p.amount * (venda.iss_pct ?? 0)) / 100 : 0
      const recebido = Math.round((p.amount - issPrevisto) * 100) / 100
      await receberParcela({
        installmentId: p.id,
        date: toDateOnly(new Date()),
        accountId: conta?.id ?? null,
        received: recebido,
        iss: Math.max(0, Math.round((p.amount - recebido) * 100) / 100),
        other: 0,
        note: null,
      })
      return {
        mensagem: `Recebido ${formatCurrency(recebido)}${conta ? ` em ${conta.name}` : ''}`,
        detalhe: issPrevisto > 0 ? `ISS de ${formatCurrency(issPrevisto)} retido pela construtora` : undefined,
        desfazer: () => desfazerRecebimento(p.id),
      }
    }
}

/** Recebi/Paguei um lançamento avulso (ou vários): os mesmos padrões de BaixarLancamento. */
export function useBaixaDeLancamento() {
  const { accounts, baixarLancamento, estornarLancamento } = useAdmin()
  return (txs: Transaction[]): Baixa =>
    async () => {
      const conta = accounts.find((a) => a.is_active) ?? null
      const hoje = toDateOnly(new Date())
      const antes = txs.map((t) => ({ id: t.id, venc: t.due_date ?? t.competence_date }))
      for (const t of txs) await baixarLancamento(t.id, hoje, conta?.id ?? null)
      const total = Math.round(txs.reduce((s, t) => s + t.amount, 0) * 100) / 100
      const entrada = txs[0]?.kind === 'income'
      return {
        mensagem: `${entrada ? 'Recebido' : 'Pago'} ${formatCurrency(total)}${conta ? ` ${entrada ? 'em' : 'de'} ${conta.name}` : ''}`,
        desfazer: async () => {
          for (const a of antes) await estornarLancamento(a.id, a.venc)
        },
      }
    }
}
