import { isValidElement, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { type Tom } from './Assinatura'
import { Lista, filhosAchatados } from './Lista'
import { Painel, PainelTitulo, SuperficieContext } from './Painel'
import { SecaoTitulo } from './SecaoTitulo'
import { normalizarTom } from './tom'
import { cn } from '@/lib/utils'

/*
 * DEPRECADO — apagar na limpeza final. Use `Cartao` (7.1) com
 * `Cartao.Cabecalho`, `Cartao.Corpo` e `Cartao.Lista`.
 *
 * Mantido para as telas antigas até a Fase 6, já sem sangria: a Lista que é
 * filho direto sai do corpo com padding e encosta de borda a borda com o
 * próprio recuo (contexto "cartao"); o resto do conteúdo vai em blocos
 * `px-recuo` (3.3). Nenhuma margem negativa. A margem de cima entre seções
 * continua só porque as telas antigas não têm `gap` no pai.
 */
export function Secao({
  titulo,
  tom = 'neutro',
  icone,
  acao,
  /** Subtotal em DUAS parcelas, nunca uma. Ver `SubtotalDuplo`. */
  subtotal,
  children,
  className,
  variante = 'bloco',
}: {
  titulo?: string
  tom?: Tom
  icone?: LucideIcon
  acao?: ReactNode
  subtotal?: ReactNode
  children: ReactNode
  className?: string
  variante?: 'bloco' | 'simples'
}) {
  const temCabecalho = Boolean(titulo || acao || subtotal)
  const t = normalizarTom(tom)

  if (variante === 'simples') {
    return (
      <section className={cn('mt-6 flex flex-col gap-3 first:mt-0', className)}>
        {temCabecalho && (
          <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {titulo ? <SecaoTitulo titulo={titulo} icone={icone} tom={t} descricao={subtotal} /> : subtotal}
            {acao && <div className="flex shrink-0 items-center gap-3">{acao}</div>}
          </header>
        )}
        <SuperficieContext.Provider value="plano">{children}</SuperficieContext.Provider>
      </section>
    )
  }

  // Agrupa: cada Lista direta fica solta no cartão; o resto vai em blocos com recuo.
  const blocos: ReactNode[] = []
  let solto: ReactNode[] = []
  const fecharSolto = () => {
    if (!solto.length) return
    blocos.push(
      <div key={`b${blocos.length}`} className="flex min-w-0 flex-col gap-3 px-recuo pb-recuo first:pt-recuo">
        {solto}
      </div>,
    )
    solto = []
  }
  filhosAchatados(children).forEach((f, i) => {
    if (isValidElement(f) && f.type === Lista) {
      fecharSolto()
      blocos.push(
        <div key={f.key ?? `l${i}`} className="min-w-0 first:pt-2 last:pb-2">
          {f}
        </div>,
      )
    } else {
      solto.push(isValidElement(f) && f.key === null ? <FragmentoChave key={`s${i}`}>{f}</FragmentoChave> : f)
    }
  })
  fecharSolto()

  return (
    <Painel className={cn('mt-4 first:mt-0', className)}>
      {temCabecalho && <PainelTitulo titulo={titulo} icone={icone} tom={t} descricao={subtotal} extra={acao} />}
      <SuperficieContext.Provider value="sangria">{blocos}</SuperficieContext.Provider>
    </Painel>
  )
}

function FragmentoChave({ children }: { children: ReactNode }) {
  return <>{children}</>
}

/**
 * DEPRECADO — apagar na limpeza final. Use `ParAgoraPrevisto` (7.3.4).
 *
 * O subtotal de grupo, SEMPRE em duas parcelas: um total único somaria o que
 * já existe com o que se espera. O previsto fica sem cor tônica e sem peso.
 */
export function SubtotalDuplo({
  agora,
  previsto,
  rotuloAgora = 'agora',
}: {
  agora: ReactNode
  previsto: ReactNode
  rotuloAgora?: string
}) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 normal-case tracking-normal text-t3 text-texto-meta">
      <span>{rotuloAgora}</span>
      <span className="num font-semibold text-t1">{agora}</span>
      <span aria-hidden className="text-t5">
        ·
      </span>
      <span>previsto</span>
      <span className="num">{previsto}</span>
    </p>
  )
}
