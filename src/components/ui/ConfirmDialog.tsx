import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import { Button } from './Button'
import { IconeTom } from './IconeTom'
import { useArmadilhaDeFoco } from './SidePanel'
import { usePresenca } from '@/lib/usePresenca'

export interface ConfirmDialogProps {
  aberto: boolean
  aoFechar: () => void
  titulo: string
  /** O que acontece, com números, e o que não volta. */
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
 * CONFIRMAÇÃO (7.11) — o único modal do sistema.
 *
 * Véu `veu-modal` com a caixa no centro (computador) ou encostada embaixo
 * (celular, <640). `IconeTom md` → título → o que acontece → `[Voltar]
 * [confirmar]`. O foco nasce em "Voltar": um Enter distraído não cancela uma
 * venda. Com `ocupado` nada fecha: a caixa só some quando o banco respondeu
 * (quem chama fecha no sucesso). Entra com `modalEntra` e sai em 150ms
 * (`usePresenca`); o foco volta a quem abriu. Sem `data-caixa`.
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
  const presenca = usePresenca(aberto, 180)
  const fecharSeLivre = () => {
    if (!ocupado) aoFechar()
  }
  useArmadilhaDeFoco(aberto, caixaRef, fecharSeLivre)

  if (!presenca.montado) return null

  return createPortal(
    <div
      {...presenca.props}
      className="veu fixed inset-0 z-modal grid place-items-center bg-[color:var(--veu-modal)] p-4 max-sm:place-items-end max-sm:p-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) fecharSeLivre()
      }}
    >
      <div
        ref={caixaRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${uid}-t`}
        aria-describedby={descricao ? `${uid}-d` : undefined}
        aria-busy={ocupado || undefined}
        tabIndex={-1}
        data-estado={presenca.estado}
        className="modal w-full max-w-[25rem] rounded-caixa border border-fio-caixa bg-surface p-6 shadow-modal outline-none max-sm:max-w-none max-sm:rounded-b-none max-sm:rounded-t-sobreposicao max-sm:border-b-0 max-sm:pb-seguro"
      >
        {/* Cor nunca sozinha: o triângulo diz "risco" também em escala de cinza. */}
        <IconeTom icone={tom === 'risco' ? AlertTriangle : HelpCircle} tom={tom} tamanho="md" />
        <h2 id={`${uid}-t`} className="mt-4 font-heading text-titulo-painel text-t1">
          {titulo}
        </h2>
        {descricao && (
          <div id={`${uid}-d`} className="mt-2 text-texto-corrido text-t2">
            {descricao}
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {/* "Voltar", e não "Cancelar": numa caixa que pergunta "Cancelar esta
              venda?", dois botões com a palavra cancelar é convite ao erro. */}
          <Button variant="secundario" onClick={aoFechar} disabled={ocupado} data-foco-inicial>
            Voltar
          </Button>
          <Button variant={tom === 'risco' ? 'perigo' : 'primario'} onClick={aoConfirmar} carregando={ocupado}>
            {rotuloConfirmar}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
