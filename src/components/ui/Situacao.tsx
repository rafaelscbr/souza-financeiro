import { VOCABULARIO, fraseDeTempo, type Situacao } from '@/lib/situacao'
import { Marcador } from './Selo'
import { cn } from '@/lib/utils'

/*
 * O chip de situação. Quatro sinais redundantes, e a cor é o quarto:
 * forma do marcador + preenchimento do selo + a palavra + a frase de tempo.
 *
 * O par tinta+fundo de cada estado é declarado explicitamente em
 * src/lib/situacao.ts — nunca uma cor com alpha. Era assim que os selos
 * antigos ficavam presos em 2,71:1: `bg-pending/12 text-pending` parece
 * elegante e produz um contraste que ninguém calculou.
 */
export function ChipSituacao({
  situacao,
  perfil = 'admin',
  className,
}: {
  situacao: Situacao
  /** "Liberada" não existe no vocabulário do corretor — ele lê "A receber". */
  perfil?: 'admin' | 'corretor'
  className?: string
}) {
  const v = VOCABULARIO[situacao]
  const palavra = perfil === 'corretor' ? v.palavraCorretor : v.palavra
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
        v.selo,
        className,
      )}
    >
      <Marcador situacao={situacao} />
      {palavra}
    </span>
  )
}

/**
 * A frase de tempo, sozinha. Data nunca aparece sem verbo neste sistema:
 * em 13px a 5,90:1 (contra os 11px a 2,56:1 de antes), e sempre dizendo o que
 * aconteceu — "liberada em 02/09 · 10 dias esperando".
 */
export function FraseDeTempo({
  situacao,
  prevista,
  liberada,
  recebida,
  className,
}: {
  situacao: Situacao
  prevista: string
  liberada?: string | null
  recebida?: string | null
  className?: string
}) {
  return (
    <span className={cn('text-sm text-content-faint', className)}>
      {fraseDeTempo(situacao, { prevista, liberada, recebida })}
    </span>
  )
}
