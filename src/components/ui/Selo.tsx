import { Check } from 'lucide-react'
import { VOCABULARIO, type Situacao } from '@/lib/situacao'
import { ICONE_DA_SITUACAO } from './Situacao'
import { TOM, TOM_DA_SITUACAO } from './tom'
import { cn } from '@/lib/utils'

/*
 * Selo ordinal (7.7): 28×28, raio `controle`, `valor-fato` centrado, na
 * goteira de 28. Mostra o ORDINAL REAL da parcela (o "3" de 3/9) nas cores do
 * tom da situação; sem ordinal, o ícone da situação. Não existe glifo de
 * traço. É reforço (a palavra ao lado diz o mesmo), então fica fora da árvore
 * de acessibilidade.
 */
export interface SeloProps {
  situacao: Situacao
  idx?: number | null
  count?: number | null
  /**
   * 'check' força o check. 'traco' é DEPRECADO — apagar na limpeza final:
   * não desenha traço nenhum, mostra o ícone da situação.
   */
  glifo?: 'check' | 'traco'
  className?: string
}

export function Selo({ situacao, idx, count, glifo, className }: SeloProps) {
  if (import.meta.env.DEV && glifo === 'traco') {
    console.error('[Selo] o glifo de traço não existe mais (7.7); remova a prop `glifo`.')
  }
  const v = VOCABULARIO[situacao]
  const t = TOM[TOM_DA_SITUACAO[situacao]]
  const temOrdinal = typeof idx === 'number' && typeof count === 'number' && count > 1
  const Glifo = glifo === 'check' ? Check : ICONE_DA_SITUACAO[situacao]
  return (
    <span
      data-selo
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-controle border font-heading text-valor-fato num',
        t.fundo,
        t.borda,
        t.texto,
        situacao === 'cancelada' && 'line-through',
        className,
      )}
      aria-hidden
      title={`${v.palavra}${temOrdinal ? ` · parcela ${idx}/${count}` : ''}`}
    >
      {temOrdinal ? idx : <Glifo size={14} strokeWidth={1.6} focusable="false" />}
    </span>
  )
}

/**
 * DEPRECADO — apagar na limpeza final (usado por admin/pages/Inicio.tsx e
 * kit/Kit.tsx). O marcador solto de legenda; 7.7 fica com um glifo por
 * significado. Pinta com a cor de quem o contém.
 */
export function Marcador({ situacao }: { situacao: Situacao }) {
  const m = VOCABULARIO[situacao].marcador
  const base = 'inline-block h-2.5 w-2.5 shrink-0'
  if (m === 'anel') return <span className={cn(base, 'rounded-full border-2 border-current')} aria-hidden />
  if (m === 'disco') return <span className={cn(base, 'rounded-full bg-current')} aria-hidden />
  if (m === 'quadrado') return <span className={cn(base, 'rounded-none bg-current')} aria-hidden />
  if (m === 'check') return <Check size={12} strokeWidth={1.6} className="shrink-0" aria-hidden />
  return <span className={cn(base, 'rounded-full border-2 border-current opacity-60')} aria-hidden />
}
