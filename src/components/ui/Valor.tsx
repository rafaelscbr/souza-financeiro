import { type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { useContagem } from './KpiCard'
import { Rotulo } from './Rotulo'
import { partesDoValor } from '@/lib/format'
import { cn } from '@/lib/utils'

/*
 * Dinheiro na tela.
 *
 * Um componente e três POSTOS, e o posto é o que codifica a hierarquia
 * (princípio 5: hierarquia é tamanho, não negrito):
 *
 *   heroi — o número que decide a ação. Um por tela, e só um. 28/34px.
 *   linha — valor que se compara dentro de uma lista. O degrau de comparação.
 *   fato  — valor que é só um dado dentro de uma conta (a cascata).
 *
 * Sempre Sora com figura tabular (princípio 6), sempre com centavos, nunca
 * abreviado. TAMANHO CODIFICA POSTO; COR NÃO: a cor só entra por `tinta`,
 * quando existe estado real.
 *
 * REGRA DURA: um valor previsto nunca usa o posto `heroi` e nunca recebe cor
 * tônica. É o que impede uma previsão de parecer um pagamento.
 */

type Posto = 'heroi' | 'linha' | 'fato'

const postos: Record<Posto, string> = {
  heroi: 'text-[28px] sm:text-[34px] font-extrabold leading-none tracking-[-0.02em]',
  linha: 'text-[15px] font-bold tracking-[-0.015em]',
  fato: 'text-sm font-semibold',
}

// O olho pousa nos dígitos, não no símbolo; os centavos ficam no corpo cheio.
const prefixos: Record<Posto, string> = {
  heroi: 'text-base',
  linha: 'text-xs',
  fato: 'text-[11px]',
}

interface ValorProps {
  valor: number
  posto?: Posto
  /** Tinta tônica. Deixe vazio para a tinta normal — o caso da previsão. */
  tinta?: string
  /** Mostra o sinal mesmo quando positivo (usado na cascata). */
  comSinal?: boolean
  /** Sobe do valor anterior até este em 700ms (seção 7). */
  contar?: boolean
  className?: string
}

export function Valor({ valor, posto = 'linha', tinta, comSinal, contar, className }: ValorProps) {
  const animado = useContagem(valor, contar ? 700 : 0)
  const { negativo, prefixo, digitos } = partesDoValor(contar ? animado : valor)
  const desenho = (
    <>
      {(negativo || comSinal) && (
        // MENOS de verdade (U+2212), em calha própria de largura fixa para que
        // o sinal não empurre dígito e a coluna continue alinhada.
        <span className="inline-block w-[0.62em] shrink-0" aria-hidden>
          {negativo ? '−' : ''}
        </span>
      )}
      <span className={cn('mr-[0.18em] font-medium text-t3', prefixos[posto])}>{prefixo}</span>
      {digitos}
    </>
  )
  const classes = cn(
    'inline-flex items-baseline whitespace-nowrap font-heading text-t1 tabular-nums',
    postos[posto],
    tinta,
    className,
  )
  if (!contar) return <span className={classes}>{desenho}</span>
  const final = partesDoValor(valor)
  return (
    <span className={classes}>
      <span aria-hidden className="inline-flex items-baseline">
        {desenho}
      </span>
      <span className="sr-only">
        {final.negativo ? '−' : ''}
        {final.prefixo} {final.digitos}
      </span>
    </span>
  )
}

/**
 * Um valor que ABRE no que o compõe.
 *
 * Este é o componente central do sistema: nenhum número fica sem origem. Toda
 * comissão, todo total, todo "a receber" pode ser aberto até a parcela da
 * venda específica que o produziu. Clicar num valor nunca é destrutivo, então
 * o alvo é generoso (44px) e o afordo é explícito: sublinhado no hover e um
 * chevron que não depende de cor.
 */
export function ValorComOrigem({
  valor,
  posto = 'linha',
  tinta,
  contar,
  aoAbrir,
  rotuloAcessivel,
  className,
}: ValorProps & { aoAbrir: () => void; rotuloAcessivel: string }) {
  return (
    <button
      type="button"
      onClick={aoAbrir}
      aria-label={rotuloAcessivel}
      className={cn(
        'group/origem -mr-2 inline-flex min-h-toque items-center gap-1.5 rounded-lg px-2',
        'transition-colors hover:bg-s3/50 focus-visible:ring-2 focus-visible:ring-brand/40',
        className,
      )}
    >
      <Valor
        valor={valor}
        posto={posto}
        tinta={tinta}
        contar={contar}
        className="decoration-1 underline-offset-4 group-hover/origem:underline"
      />
      <ChevronRight
        size={16}
        strokeWidth={1.6}
        className="shrink-0 text-t5 transition-colors group-hover/origem:text-t3"
        aria-hidden
      />
    </button>
  )
}

/**
 * Rótulo + valor, empilhados. O bloco que aparecia escrito à mão em toda tela.
 */
export function Metrica({
  rotulo,
  children,
  detalhe,
}: {
  rotulo: string
  children: ReactNode
  detalhe?: ReactNode
}) {
  return (
    <div className="min-w-0">
      <Rotulo>{rotulo}</Rotulo>
      <div className="mt-1.5">{children}</div>
      {detalhe && <p className="mt-1 text-xs text-t4">{detalhe}</p>}
    </div>
  )
}
