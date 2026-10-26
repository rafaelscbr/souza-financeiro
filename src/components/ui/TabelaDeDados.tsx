import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * TABELA DE DADOS (Souza 2.0, 24/10/2026).
 *
 * A tabela das listas grandes: cabeçalho claro, número alinhado à direita,
 * ordenação clicando no título da coluna, paginação e linha clicável que abre
 * a ficha. A busca e os filtros ficam com a tela (no cabeçalho do cartão);
 * aqui chega a lista já filtrada. Colunas secundárias somem em telas
 * estreitas (`esconder`), a primeira fica presa à esquerda ao rolar.
 */

export interface ColunaDeDados<T> {
  id: string
  rotulo: string
  numerica?: boolean
  celula: (linha: T) => ReactNode
  /** Com ela, a coluna ordena: o valor que compara (número ou texto). */
  ordenar?: (linha: T) => number | string
  /** Some abaixo desta largura. */
  esconder?: 'sm' | 'md' | 'lg'
}

export interface TabelaDeDadosProps<T> {
  colunas: ColunaDeDados<T>[]
  linhas: T[]
  chave: (linha: T) => string
  rotuloAcessivel: string
  aoAbrirLinha?: (linha: T) => void
  rotuloAbrir?: (linha: T) => string
  ordemInicial?: { coluna: string; direcao: 'asc' | 'desc' }
  porPagina?: number
  /** O que se conta no rodapé ("venda", "vendas"). */
  nomes?: [string, string]
  /** Quando a lista muda por fora (filtro, busca), volta à página 1. */
  chaveDeReinicio?: string
}

const ESCONDER = { sm: 'max-sm:hidden', md: 'max-md:hidden', lg: 'max-lg:hidden' } as const

export function TabelaDeDados<T>({
  colunas,
  linhas,
  chave,
  rotuloAcessivel,
  aoAbrirLinha,
  rotuloAbrir,
  ordemInicial,
  porPagina = 10,
  nomes = ['linha', 'linhas'],
  chaveDeReinicio,
}: TabelaDeDadosProps<T>) {
  const [ordem, setOrdem] = useState(ordemInicial ?? null)
  const [pagina, setPagina] = useState(0)
  useEffect(() => setPagina(0), [chaveDeReinicio, ordem])

  const ordenadas = useMemo(() => {
    if (!ordem) return linhas
    const col = colunas.find((c) => c.id === ordem.coluna)
    if (!col?.ordenar) return linhas
    const f = col.ordenar
    const d = ordem.direcao === 'asc' ? 1 : -1
    return [...linhas].sort((a, b) => {
      const x = f(a)
      const y = f(b)
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR')) * d
    })
  }, [linhas, colunas, ordem])

  const paginas = Math.max(1, Math.ceil(ordenadas.length / porPagina))
  const atual = Math.min(pagina, paginas - 1)
  const visiveis = ordenadas.slice(atual * porPagina, atual * porPagina + porPagina)

  const alternarOrdem = (id: string) =>
    setOrdem((o) => (o?.coluna === id ? { coluna: id, direcao: o.direcao === 'asc' ? 'desc' : 'asc' } : { coluna: id, direcao: 'desc' }))

  const aoTeclar = (l: T) => (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      aoAbrirLinha?.(l)
    }
  }

  const celulaBase = 'px-3 first:pl-recuo last:pr-recuo'

  return (
    <div className="flex min-w-0 flex-col">
      <div data-rolagem="" className="min-w-0 overflow-x-auto">
        <table className="w-full border-collapse">
          <caption className="sr-only">{rotuloAcessivel}</caption>
          <thead>
            <tr>
              {colunas.map((c, i) => {
                const ativa = ordem?.coluna === c.id
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={ativa ? (ordem!.direcao === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(
                      celulaBase,
                      'h-10 whitespace-nowrap border-b border-fio-caixa bg-s2 font-medium text-t4 text-nota',
                      c.numerica ? 'text-right' : 'text-left',
                      c.esconder && ESCONDER[c.esconder],
                      i === 0 && 'max-md:sticky max-md:left-0',
                    )}
                  >
                    {c.ordenar ? (
                      <button
                        type="button"
                        onClick={() => alternarOrdem(c.id)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-badge transition-colors hover:text-t1',
                          c.numerica && 'flex-row-reverse',
                          ativa && 'text-t1',
                        )}
                      >
                        {c.rotulo}
                        {ativa ? (
                          ordem!.direcao === 'asc' ? (
                            <ArrowUp aria-hidden size={12} strokeWidth={2} />
                          ) : (
                            <ArrowDown aria-hidden size={12} strokeWidth={2} />
                          )
                        ) : (
                          <ArrowDown aria-hidden size={12} strokeWidth={2} className="opacity-0" />
                        )}
                      </button>
                    ) : (
                      c.rotulo
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => (
              <tr
                key={chave(l)}
                tabIndex={aoAbrirLinha ? 0 : undefined}
                aria-label={aoAbrirLinha && rotuloAbrir ? rotuloAbrir(l) : undefined}
                onClick={aoAbrirLinha ? () => aoAbrirLinha(l) : undefined}
                onKeyDown={aoAbrirLinha ? aoTeclar(l) : undefined}
                className={cn('group', aoAbrirLinha && 'cursor-pointer')}
              >
                {colunas.map((c, i) => (
                  <td
                    key={c.id}
                    className={cn(
                      celulaBase,
                      'h-14 border-t border-fio-linha align-middle text-t2 text-texto',
                      c.numerica ? 'whitespace-nowrap text-right' : 'text-left',
                      c.esconder && ESCONDER[c.esconder],
                      aoAbrirLinha && 'transition-colors group-hover:bg-linha-hover',
                      i === 0 && 'max-md:sticky max-md:left-0 max-md:bg-surface',
                    )}
                  >
                    {c.celula(l)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-fio-linha px-recuo py-2.5 text-t4 text-texto-meta">
        <span className="num">
          {ordenadas.length === 0
            ? `Nenhuma ${nomes[0]}`
            : `${atual * porPagina + 1}–${Math.min(ordenadas.length, (atual + 1) * porPagina)} de ${ordenadas.length} ${ordenadas.length === 1 ? nomes[0] : nomes[1]}`}
        </span>
        {paginas > 1 && (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPagina(atual - 1)}
              disabled={atual === 0}
              aria-label="Página anterior"
              className="flex size-8 items-center justify-center rounded-controle text-t3 transition-colors hover:bg-linha-hover hover:text-t1 disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft aria-hidden size={16} strokeWidth={1.75} />
            </button>
            <span className="num px-1 text-t3">
              {atual + 1} de {paginas}
            </span>
            <button
              type="button"
              onClick={() => setPagina(atual + 1)}
              disabled={atual >= paginas - 1}
              aria-label="Próxima página"
              className="flex size-8 items-center justify-center rounded-controle text-t3 transition-colors hover:bg-linha-hover hover:text-t1 disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronRight aria-hidden size={16} strokeWidth={1.75} />
            </button>
          </span>
        )}
      </div>
    </div>
  )
}
TabelaDeDados.displayName = 'TabelaDeDados'
