import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from './Button'
import { Icone } from './Icone'
import { Valor } from './Valor'
import { cn } from '@/lib/utils'

/*
 * LISTA DE AÇÕES (Souza 3.0, 02/11/2026) — o "Pede você".
 *
 * Cada item é uma coisa com dono hoje: o que é, por que pede atenção, quanto
 * e o botão que leva a resolver. O motivo leva a cor da dívida: vermelho é
 * nosso (imposto vencido, repasse parado), âmbar é da construtora ("em
 * atraso"), cinza é rotina. Os itens entram em escada.
 */
export interface ItemDeAcao {
  id: string
  titulo: string
  detalhe: ReactNode
  valor?: number
  tom?: 'risco' | 'atraso' | 'neutro'
  /** Com rótulo: botão à direita. Sem rótulo: a linha toda é o link (seta). */
  acao?: { rotulo: string; aoClicar: () => void }
  para?: string
}

export function ListaDeAcoes({ itens, rotuloAcessivel }: { itens: ItemDeAcao[]; rotuloAcessivel: string }) {
  return (
    <ul aria-label={rotuloAcessivel} className="flex flex-col pb-2">
      {itens.map((p, i) => {
        const tom = p.tom ?? 'neutro'
        const corpo = (
          <>
            <span className="min-w-0 truncate font-medium text-t1 text-texto" title={p.titulo}>
              {p.titulo}
            </span>
            {p.valor !== undefined ? <Valor valor={p.valor} posto="linha" className="justify-self-end" /> : <span />}
            <span
              className={cn(
                'min-w-0 truncate text-texto-meta',
                tom === 'risco' && 'text-error-ink',
                tom === 'atraso' && 'text-warning-ink',
                tom === 'neutro' && 'text-t4',
              )}
            >
              {p.detalhe}
            </span>
            {p.acao ? (
              <Button variant="secundario" size="sm" onClick={p.acao.aoClicar} className="justify-self-end">
                {p.acao.rotulo}
              </Button>
            ) : (
              <Icone icone={ArrowRight} tamanho={16} className="justify-self-end text-t4" />
            )}
          </>
        )
        const grade = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-recuo py-3'
        return (
          <li
            key={p.id}
            className="border-t border-fio-linha"
            style={{ animation: `sobe var(--dur-lista) var(--curva-entra) ${i * 40}ms backwards` }}
          >
            {p.para && !p.acao ? (
              <Link to={p.para} className={cn(grade, 'transition-colors hover:bg-s2')}>
                {corpo}
              </Link>
            ) : (
              <div className={grade}>{corpo}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
