import { type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { partesDoValor } from '@/lib/format'
import { cn } from '@/lib/utils'

/*
 * Dinheiro na tela.
 *
 * Antes havia cinco blocos "rótulo + valor" reimplementados em cinco arquivos
 * e quatro tamanhos diferentes de indicador (text-sm, text-lg, text-xl,
 * text-3xl) sem regra que dissesse qual usar quando. Agora existe um
 * componente e três POSTOS, e o posto é o que codifica a hierarquia:
 *
 *   heroi — a resposta da tela. Um por tela, e só um.
 *   linha — valor que se compara dentro de uma lista. O degrau de comparação.
 *   fato  — valor que é só um dado dentro de uma conta (a cascata).
 *
 * TAMANHO CODIFICA POSTO; COR NÃO. É por isso que as 16 parcelas de R$ 201,61
 * a R$ 2.692,89 passam a ser comparáveis: mesmo degrau, figura tabular, e uma
 * única borda direita onde todas pousam.
 *
 * REGRA DURA: um valor previsto nunca usa o posto `heroi` e nunca recebe cor
 * tônica. É o que impede uma previsão de parecer um pagamento.
 */

type Posto = 'heroi' | 'linha' | 'fato'

const postos: Record<Posto, string> = {
  // 34/36 no celular, 40/42 acima de 640px
  heroi: 'text-3xl sm:text-4xl font-bold',
  linha: 'text-xl font-semibold',
  fato: 'text-base font-medium',
}

const prefixos: Record<Posto, string> = {
  heroi: 'text-lg',
  linha: 'text-sm',
  fato: 'text-xs',
}

interface ValorProps {
  valor: number
  posto?: Posto
  /** Tinta tônica. Deixe vazio para a tinta normal — o caso da previsão. */
  tinta?: string
  /** Mostra o sinal mesmo quando positivo (usado na cascata). */
  comSinal?: boolean
  className?: string
}

export function Valor({ valor, posto = 'linha', tinta, comSinal, className }: ValorProps) {
  const { negativo, prefixo, digitos } = partesDoValor(valor)
  return (
    <span className={cn('cifra inline-flex items-baseline whitespace-nowrap', postos[posto], tinta, className)}>
      {(negativo || comSinal) && (
        // MENOS de verdade (U+2212), em calha própria de largura fixa para que
        // o sinal não empurre dígito e a coluna continue alinhada.
        <span className="inline-block w-[0.62em] shrink-0" aria-hidden>
          {negativo ? '−' : ''}
        </span>
      )}
      <span className={cn('mr-[0.18em] font-medium text-content-muted', prefixos[posto])}>{prefixo}</span>
      {digitos}
    </span>
  )
}

/**
 * Um valor que ABRE no que o compõe.
 *
 * Este é o componente central do sistema: nenhum número fica sem origem. Toda
 * comissão, todo total, todo "a receber" pode ser aberto até a parcela da
 * venda específica que o produziu. Clicar num valor nunca é uma ação
 * destrutiva, então o alvo é generoso (44px de altura mínima) e o afordo é
 * explícito — sublinhado no hover e um chevron que não depende de cor.
 */
export function ValorComOrigem({
  valor,
  posto = 'linha',
  tinta,
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
        'group -mr-2 inline-flex min-h-toque items-center gap-1.5 rounded-lg px-2',
        'transition-colors hover:bg-action-soft',
        className,
      )}
    >
      <Valor valor={valor} posto={posto} tinta={tinta} className="group-hover:underline" />
      <ChevronRight className="h-4 w-4 shrink-0 text-content-faint" aria-hidden />
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
      <p className="text-xs font-medium uppercase tracking-wide text-content-muted">{rotulo}</p>
      <div className="mt-1">{children}</div>
      {detalhe && <p className="mt-0.5 text-sm text-content-faint">{detalhe}</p>}
    </div>
  )
}
