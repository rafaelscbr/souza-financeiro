import { Ban, CalendarClock, CircleCheck, Clock, TriangleAlert, type LucideIcon } from 'lucide-react'
import { VOCABULARIO, fraseDeTempo, type Situacao } from '@/lib/situacao'
import { Chip } from './Chip'
import { TOM_DA_SITUACAO } from './tom'
import { cn } from '@/lib/utils'

/*
 * O ícone de cada situação. Cor sozinha nunca comunica status (princípio 3):
 * em escala de cinza, no sol ou impresso, o ícone e a palavra seguem dizendo
 * o que o dinheiro é.
 *
 *   prevista   calendário ... tem data, ainda não é dinheiro
 *   liberada   relógio ...... é dinheiro, esperando um humano
 *   vencida    alerta ....... o mesmo dinheiro, esperando demais
 *   recebida   check ........ o dinheiro se moveu
 *   cancelada  proibido ..... registro risca, não apaga
 */
export const ICONE_DA_SITUACAO: Record<Situacao, LucideIcon> = {
  prevista: CalendarClock,
  liberada: Clock,
  vencida: TriangleAlert,
  recebida: CircleCheck,
  cancelada: Ban,
}

/*
 * O chip de situação. O tom sai do mapeamento único (TOM_DA_SITUACAO): prevista
 * é informação, liberada é atenção, vencida é risco, recebida é sucesso e
 * cancelada é neutro. As PALAVRAS continuam as de src/lib/situacao.ts.
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
    <Chip
      tom={TOM_DA_SITUACAO[situacao]}
      icone={ICONE_DA_SITUACAO[situacao]}
      className={cn(situacao === 'cancelada' && 'line-through', className)}
    >
      {palavra}
    </Chip>
  )
}

/**
 * A frase de tempo, sozinha. Data nunca aparece sem verbo neste sistema:
 * sempre dizendo o que aconteceu — "liberada em 02/09 · 10 dias esperando".
 * É contexto, então é texto e não pílula (seção 9).
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
    <span className={cn('text-xs text-t3', className)}>
      {fraseDeTempo(situacao, { prevista, liberada, recebida })}
    </span>
  )
}
