import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import { Button } from './Button'
import { IconeTom } from './IconeTom'
import { useArmadilhaDeFoco } from './SidePanel'

export interface ConfirmDialogProps {
  aberto: boolean
  aoFechar: () => void
  titulo: string
  descricao?: ReactNode
  /** O verbo do que acontece: "Cancelar venda", nunca "OK". */
  rotuloConfirmar: string
  /** `risco` para o que apaga ou cancela; `marca` para confirmar dinheiro. */
  tom?: 'risco' | 'marca'
  aoConfirmar: () => void
  /** Enquanto o banco responde. Trava os dois botões, o Escape e o véu. */
  ocupado?: boolean
}

/**
 * Confirmação curta — o único uso legítimo de modal central (seção 1.10).
 *
 * Uma pergunta, um porquê e dois botões. O foco nasce em "Voltar", não em
 * confirmar: um Enter distraído não pode cancelar uma venda.
 *
 * Com `ocupado`, nada fecha: o banco é a única fonte de verdade, e fechar a
 * caixa antes da resposta faria a tela afirmar um resultado que ainda não
 * existe. Quem chama fecha no sucesso e mantém aberta, com o erro, na falha.
 */
export function ConfirmDialog({
  aberto,
  aoFechar,
  titulo,
  descricao,
  rotuloConfirmar,
  tom = 'risco',
  aoConfirmar,
  ocupado = false,
}: ConfirmDialogProps) {
  const caixaRef = useRef<HTMLDivElement>(null)
  const uid = useId()
  const fecharSeLivre = () => {
    if (!ocupado) aoFechar()
  }
  useArmadilhaDeFoco(aberto, caixaRef, fecharSeLivre)

  if (!aberto) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div aria-hidden className="overlay-entra absolute inset-0 bg-black/40" onClick={fecharSeLivre} />
      <div
        ref={caixaRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${uid}-t`}
        aria-describedby={descricao ? `${uid}-d` : undefined}
        aria-busy={ocupado || undefined}
        tabIndex={-1}
        className="modal-surface relative w-full max-w-[26rem] overflow-hidden rounded-[16px] shadow-modal outline-none animate-[slideUp_240ms_cubic-bezier(0.16,1,0.3,1)_backwards]"
      >
        <div className="flex gap-3.5 px-5 pb-4 pt-5">
          {/* Cor nunca sozinha: o triângulo diz "risco" também em escala de cinza. */}
          <IconeTom icone={tom === 'risco' ? AlertTriangle : HelpCircle} tom={tom} tamanho="md" />
          <div className="min-w-0 flex-1 pt-1">
            <h2
              id={`${uid}-t`}
              className="font-heading text-[17px] font-bold leading-snug tracking-[-0.015em] text-t1"
            >
              {titulo}
            </h2>
            {descricao && (
              <div id={`${uid}-d`} className="mt-1.5 text-[13px] leading-relaxed text-t3">
                {descricao}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-3.5 sm:flex-row sm:justify-end">
          {/* "Voltar", e não "Cancelar": numa caixa que pergunta "Cancelar esta
              venda?", dois botões com a palavra cancelar é convite ao erro. */}
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={aoFechar}
            disabled={ocupado}
            data-foco-inicial
          >
            Voltar
          </Button>
          <Button
            variant={tom === 'risco' ? 'danger' : 'primary'}
            className="w-full sm:w-auto"
            onClick={aoConfirmar}
            carregando={ocupado}
          >
            {rotuloConfirmar}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
