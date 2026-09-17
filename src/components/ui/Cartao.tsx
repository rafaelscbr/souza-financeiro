import { type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Icone } from './Icone'
import { Lista, validarFilhos, type ListaProps } from './Lista'
import { cn } from '@/lib/utils'

/*
 * CARTÃO (7.1). Substitui Painel + Secao + SecaoTitulo.
 *
 * A caixa: `rounded-caixa border-fio-caixa bg-surface shadow-card`, sem
 * `overflow-hidden` e sem margem (o vão vem do pai, P2). Filhos: só os quatro
 * slots (`Cabecalho`, `Corpo`, `Lista`, `Rodape`) e `Tabela`. O recuo mora nos
 * slots (3.3), então nenhum texto encosta na borda (P1).
 */

const SLOTS = ['CartaoCabecalho', 'CartaoCorpo', 'CartaoLista', 'CartaoRodape', 'Tabela']

export interface CartaoProps {
  children: ReactNode
  /** Nome da região quando não há `Cartao.Cabecalho` com título. */
  rotuloAcessivel?: string
  /** `section` (padrão) ou `div` quando o cartão não é uma região. */
  como?: 'section' | 'div'
  className?: string
}

function CartaoRaiz({ children, rotuloAcessivel, como = 'section', className }: CartaoProps) {
  validarFilhos(children, SLOTS, 'Cartao')
  const Tag = como
  return (
    <Tag
      data-caixa=""
      aria-label={rotuloAcessivel}
      className={cn('flex min-w-0 flex-col rounded-caixa border border-fio-caixa bg-surface shadow-card', className)}
    >
      {children}
    </Tag>
  )
}
CartaoRaiz.displayName = 'Cartao'

export interface CartaoCabecalhoProps {
  titulo: ReactNode
  /** Ícone 16 em t3, com significado; consistente na tela. */
  icone?: LucideIcon
  /** "3 parcelas · 1 recebida". */
  meta?: ReactNode
  /** Ações ou controles à direita (gap 12). */
  extra?: ReactNode
  /** Nível do título (padrão h2). */
  nivel?: 'h2' | 'h3'
  id?: string
  className?: string
}

function CartaoCabecalho({ titulo, icone, meta, extra, nivel = 'h2', id, className }: CartaoCabecalhoProps) {
  const H = nivel
  return (
    <div className={cn('flex min-h-14 flex-wrap items-center gap-3 px-recuo pb-3 pt-recuo', className)}>
      <div className="flex min-w-0 max-w-full items-center gap-3">
        {icone && (
          <span className="flex shrink-0 text-t3">
            <Icone icone={icone} tamanho={16} />
          </span>
        )}
        <H id={id} className="min-w-0 font-heading text-t1 text-titulo-secao">
          {titulo}
        </H>
      </div>
      {meta && <span className="min-w-0 text-t-meta text-texto-meta">{meta}</span>}
      {extra && <div className="ms-auto flex items-center gap-3">{extra}</div>}
    </div>
  )
}
CartaoCabecalho.displayName = 'CartaoCabecalho'

export interface CartaoCorpoProps {
  children: ReactNode
  className?: string
}

/** Corpo livre: `px-recuo pb-recuo`; como 1º slot (cartão sem título) ganha `pt-recuo`. */
function CartaoCorpo({ children, className }: CartaoCorpoProps) {
  return <div className={cn('flex min-w-0 flex-col gap-4 px-recuo pb-recuo first:pt-recuo', className)}>{children}</div>
}
CartaoCorpo.displayName = 'CartaoCorpo'

export type CartaoListaProps = Omit<ListaProps, 'contexto'>

/** A Lista do cartão: contexto `cartao`; 8px nas pontas quando é o 1º ou o último slot (3.3). */
function CartaoLista({ className, children, ...resto }: CartaoListaProps) {
  validarFilhos(children, ['Linha', 'LinhaGrupo', 'Parcela', 'CabecalhoParcelas'], 'Cartao.Lista')
  return (
    <Lista contexto="cartao" className={cn('first:pt-2 last:pb-2', className)} {...resto}>
      {children}
    </Lista>
  )
}
CartaoLista.displayName = 'CartaoLista'

export interface CartaoRodapeProps {
  children: ReactNode
  className?: string
}

function CartaoRodape({ children, className }: CartaoRodapeProps) {
  return (
    <div
      className={`${cn('flex flex-wrap items-center justify-between gap-3 border-t border-fio-linha px-recuo py-4 text-t-meta', className)} text-texto-meta`}
    >
      {children}
    </div>
  )
}
CartaoRodape.displayName = 'CartaoRodape'

export const Cartao = Object.assign(CartaoRaiz, {
  Cabecalho: CartaoCabecalho,
  Corpo: CartaoCorpo,
  Lista: CartaoLista,
  Rodape: CartaoRodape,
})
