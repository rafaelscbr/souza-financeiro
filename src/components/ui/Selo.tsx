import { Check } from 'lucide-react'
import { VOCABULARIO, type Situacao } from '@/lib/situacao'
import { ICONE_DA_SITUACAO } from './Situacao'
import { TOM, TOM_DA_SITUACAO } from './tom'
import { cn } from '@/lib/utils'

/*
 * O SELO — a situação na goteira da linha, com o ORDINAL REAL da parcela.
 *
 * Funde duas informações num objeto que se varre sem ler: QUAL parcela é (o
 * "3" de 3/9) e O QUE o dinheiro é. Numa venda de 9 parcelas irregulares, é a
 * diferença entre procurar e reconhecer.
 *
 * Tem a geometria do IconeTom sm (28px, raio 9px) e as cores do tom da
 * situação, pelo mesmo mapeamento do chip. Sem ordinal, mostra o ícone da
 * situação. O selo é reforço: a palavra e a frase de tempo ao lado dizem o
 * mesmo, então ele fica fora da árvore de acessibilidade.
 */
export function Selo({
  situacao,
  idx,
  count,
  /**
   * Linhas sem ordinal — guia de imposto, despesa. 'traco' mostra o ícone da
   * situação (o traço solto não dizia nada); 'check' força o check.
   */
  glifo,
  className,
}: {
  situacao: Situacao
  idx?: number | null
  count?: number | null
  glifo?: 'traco' | 'check'
  className?: string
}) {
  const v = VOCABULARIO[situacao]
  const t = TOM[TOM_DA_SITUACAO[situacao]]
  const temOrdinal = typeof idx === 'number' && typeof count === 'number' && count > 1
  const Icone =
    glifo === 'check' || (glifo === 'traco' && situacao === 'recebida')
      ? Check
      : ICONE_DA_SITUACAO[situacao]
  return (
    <span
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border font-heading text-xs font-bold tabular-nums',
        t.fundo,
        t.borda,
        t.texto,
        situacao === 'cancelada' && 'line-through',
        className,
      )}
      aria-hidden
      title={`${v.palavra}${temOrdinal ? ` · parcela ${idx}/${count}` : ''}`}
    >
      {temOrdinal ? idx : <Icone size={13} strokeWidth={1.6} />}
    </span>
  )
}

/**
 * O marcador solto — anel, disco, quadrado, check, riscado.
 *
 * Usado onde não há ordinal e o selo seria pesado (numa legenda). Reconhecível
 * por silhueta, sem depender de cor nenhuma: pinta com a cor de quem o contém.
 */
export function Marcador({ situacao }: { situacao: Situacao }) {
  const m = VOCABULARIO[situacao].marcador
  const base = 'inline-block h-2.5 w-2.5 shrink-0'
  if (m === 'anel') return <span className={cn(base, 'rounded-full border-[1.5px] border-current')} aria-hidden />
  if (m === 'disco') return <span className={cn(base, 'rounded-full bg-current')} aria-hidden />
  if (m === 'quadrado') return <span className={cn(base, 'rounded-[2px] bg-current')} aria-hidden />
  if (m === 'check') return <Check size={12} strokeWidth={1.6} className="shrink-0" aria-hidden />
  return <span className={cn(base, 'rounded-full border-[1.5px] border-current opacity-60')} aria-hidden />
}
