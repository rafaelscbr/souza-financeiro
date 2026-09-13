import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, CircleCheck, TriangleAlert, type LucideIcon } from 'lucide-react'
import { IconeTom } from './IconeTom'
import { Rotulo } from './Rotulo'
import { type Tom } from './tom'
import { formatCurrency, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

/*
 * CONTAGEM (seção 7): o número sobe do valor anterior até o novo em 700ms,
 * com ease-out cúbico, um quadro por vez com requestAnimationFrame.
 *
 * Nunca setInterval (princípio 12): o quadro só roda quando o navegador vai
 * pintar, e para sozinho na aba escondida. Com prefers-reduced-motion o valor
 * aparece na hora, sem nenhum quadro intermediário.
 *
 * O último quadro devolve o alvo EXATO, não o resultado da conta de ponto
 * flutuante: um saldo que termina em R$ 1.234,55 quando o banco diz 1.234,56
 * é um número inventado.
 */
function prefereMenosMovimento(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

export function useContagem(alvo: number, ms = 700): number {
  const [reduzir] = useState(prefereMenosMovimento)
  const [atual, setAtual] = useState(() => (reduzir ? alvo : 0))
  const atualRef = useRef(atual)

  useEffect(() => {
    if (reduzir || !Number.isFinite(alvo) || ms <= 0) {
      atualRef.current = alvo
      setAtual(alvo)
      return
    }
    const de = atualRef.current
    if (de === alvo) return
    const inicio = performance.now()
    let raf = 0
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / ms)
      const v = t >= 1 ? alvo : de + (alvo - de) * (1 - Math.pow(1 - t, 3))
      atualRef.current = v
      setAtual(v)
      if (t < 1) raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
  }, [alvo, ms, reduzir])

  return reduzir ? alvo : atual
}

type Formato = 'moeda' | 'numero' | 'percentual'

function formatar(valor: number, formato: Formato, inteiro: boolean): string {
  if (formato === 'moeda') return formatCurrency(valor)
  if (formato === 'percentual') return formatPercent(valor)
  // Contagem de coisas: durante a subida um "3,4 vendas" não existe.
  return (inteiro ? Math.round(valor) : valor).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

const TAMANHOS = {
  sm: 'text-[22px]',
  md: 'text-[28px]',
  lg: 'text-[34px]',
} as const

/*
 * O NÚMERO QUE DECIDE A AÇÃO (seção 4): Sora extrabold, tabular, sem entrelinha.
 * Dinheiro sempre em R$ pt-BR com centavos, nunca abreviado.
 *
 * Quando conta, o leitor de tela recebe o valor final de uma vez em vez de
 * setecentos milissegundos de números passando.
 */
export function Numero({
  valor,
  formato = 'moeda',
  tamanho = 'md',
  contar,
  className,
}: {
  valor: number
  formato?: Formato
  tamanho?: 'sm' | 'md' | 'lg'
  contar?: boolean
  className?: string
}) {
  const animado = useContagem(valor, contar ? 700 : 0)
  const inteiro = Number.isInteger(valor)
  const classes = cn(
    'whitespace-nowrap font-heading font-extrabold leading-none tracking-[-0.02em] text-t1 tabular-nums',
    TAMANHOS[tamanho],
    className,
  )
  if (!contar) return <span className={classes}>{formatar(valor, formato, inteiro)}</span>
  return (
    <span className={classes}>
      <span aria-hidden>{formatar(animado, formato, inteiro)}</span>
      <span className="sr-only">{formatar(valor, formato, inteiro)}</span>
    </span>
  )
}

/*
 * O CARD DE KPI (seção 8).
 *
 * Três regras que parecem de estética e são de honestidade:
 *   1. O tom colore o ÍCONE, nunca o número. Tom é o assunto do card.
 *   2. Número colorido só com ESTADO REAL, e o estado vem de quem conhece o
 *      dado (a tela), nunca do tom: meta batida em verde, vencido > 0 em
 *      vermelho. O estado vem com ícone junto, porque cor sozinha nunca
 *      comunica status (princípio 3).
 *   3. ZERO NUNCA É VERMELHO. "Vencido: R$ 0,00" é boa notícia; pintá-lo de
 *      risco inventaria um problema.
 *
 * O card inteiro é o alvo do toque e leva à lista já filtrada (seção 10). Com
 * `para` vira link de verdade, que abre em outra aba e aparece no histórico.
 */
export function KpiCard({
  rotulo,
  valor,
  formato = 'moeda',
  icone,
  tom = 'neutro',
  nota,
  estado = 'normal',
  para,
  aoClicar,
}: {
  rotulo: string
  valor: number
  formato?: Formato
  icone: LucideIcon
  tom?: Tom
  nota?: ReactNode
  estado?: 'normal' | 'sucesso' | 'risco'
  para?: string
  aoClicar?: () => void
}) {
  const efetivo = estado === 'risco' && valor === 0 ? 'normal' : estado
  const clicavel = Boolean(para || aoClicar)

  const conteudo = (
    <>
      <div className="flex items-center gap-2">
        <IconeTom icone={icone} tom={tom} tamanho="sm" />
        <Rotulo as="span" className="min-w-0 flex-1 truncate">
          {rotulo}
        </Rotulo>
        {clicavel && (
          <ChevronRight
            size={14}
            strokeWidth={1.6}
            className="shrink-0 text-t5 transition-colors group-hover:text-t3"
            aria-hidden
          />
        )}
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <Numero
          valor={valor}
          formato={formato}
          tamanho="md"
          className={cn(efetivo === 'sucesso' && 'text-success', efetivo === 'risco' && 'text-error')}
        />
        {efetivo === 'sucesso' && (
          <CircleCheck size={16} strokeWidth={1.6} className="shrink-0 text-success" aria-hidden />
        )}
        {efetivo === 'risco' && (
          <TriangleAlert size={16} strokeWidth={1.6} className="shrink-0 text-error" aria-hidden />
        )}
      </div>
      {nota && <div className="mt-1.5 text-[11px] text-t4">{nota}</div>}
    </>
  )

  const classes = cn(
    'group relative flex min-w-0 flex-col rounded-[14px] border border-line surface-premium p-4 text-left shadow-card',
    clicavel &&
      'transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-dropdown active:scale-[0.98]',
  )

  if (para) {
    return (
      <Link to={para} onClick={aoClicar} className={classes}>
        {conteudo}
      </Link>
    )
  }
  if (aoClicar) {
    return (
      <button type="button" onClick={aoClicar} className={cn(classes, 'w-full')}>
        {conteudo}
      </button>
    )
  }
  return <div className={classes}>{conteudo}</div>
}
