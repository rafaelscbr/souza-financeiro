import { type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/*
 * TABELA (7.6): relatórios, DRE, doze meses. Mora dentro de `Cartao`, sem
 * borda própria. Sem zebra, sem cabeçalho grudado, hover só se a linha abre
 * algo. Coluna vazia em todas as linhas não é renderizada. A 1ª coluna gruda
 * à esquerda abaixo de 768px, quando a tabela precisa rolar.
 */

export interface ColunaTabela<T> {
  id: string
  rotulo: ReactNode
  /** Coluna numérica: rótulo e célula à direita. */
  numerica?: boolean
  /** Conteúdo da célula (valor com `Valor posto="linha"`). `null`/`undefined`/'' = vazia. */
  celula: (linha: T) => ReactNode
  /** Célula do total (`Valor posto="destaque"`). */
  total?: ReactNode
}

export interface TabelaProps<T> {
  colunas: ColunaTabela<T>[]
  linhas: T[]
  chave: (linha: T) => string
  /** Legenda para leitor de tela. */
  rotuloAcessivel: string
  /** A linha abre algo (composição, venda): ganha hover, foco e Enter. */
  aoAbrirLinha?: (linha: T) => void
  /** Nome acessível da ação de abrir a linha. */
  rotuloAbrir?: (linha: T) => string
  /** Rótulo da 1ª célula da linha de total (padrão "Total"). */
  rotuloTotal?: ReactNode
  className?: string
}

function vazia(v: ReactNode): boolean {
  return v === null || v === undefined || v === false || v === ''
}

const CELULA = 'h-12 px-3 first:pl-recuo last:pr-recuo'
const PRIMEIRA = 'max-md:sticky max-md:left-0 max-md:min-w-[10rem] max-md:bg-surface'

export function Tabela<T>({
  colunas,
  linhas,
  chave,
  rotuloAcessivel,
  aoAbrirLinha,
  rotuloAbrir,
  rotuloTotal = 'Total',
  className,
}: TabelaProps<T>) {
  const visiveis = colunas.filter(
    (c, i) => i === 0 || c.total !== undefined || linhas.some((l) => !vazia(c.celula(l))),
  )
  const temTotal = visiveis.some((c) => c.total !== undefined)

  const aoTeclar = (linha: T) => (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      aoAbrirLinha?.(linha)
    }
  }

  return (
    <div data-rolagem="" className={cn('min-w-0 overflow-x-auto first:pt-2 last:pb-2', className)}>
      <table className="w-full border-collapse">
        <caption className="sr-only">{rotuloAcessivel}</caption>
        <thead>
          <tr>
            {visiveis.map((c, i) => (
              <th
                key={c.id}
                scope="col"
                className={`${cn(
                  'h-10 whitespace-nowrap border-b border-fio-caixa px-3 font-label uppercase text-t-meta first:pl-recuo last:pr-recuo',
                  c.numerica ? 'text-right' : 'text-left',
                  i === 0 && PRIMEIRA,
                )} text-rotulo`}
              >
                {c.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr
              key={chave(l)}
              data-clicavel={aoAbrirLinha ? '' : undefined}
              tabIndex={aoAbrirLinha ? 0 : undefined}
              aria-label={aoAbrirLinha && rotuloAbrir ? rotuloAbrir(l) : undefined}
              onClick={aoAbrirLinha ? () => aoAbrirLinha(l) : undefined}
              onKeyDown={aoAbrirLinha ? aoTeclar(l) : undefined}
              className={cn(aoAbrirLinha && 'group cursor-pointer')}
            >
              {visiveis.map((c, i) => (
                <td
                  key={c.id}
                  className={`${cn(
                    CELULA,
                    'border-t border-fio-linha text-t2',
                    c.numerica ? 'whitespace-nowrap text-right' : 'text-left',
                    aoAbrirLinha && 'group-hover:bg-linha-hover group-active:bg-linha-press',
                    i === 0 && PRIMEIRA,
                    i === 0 && 'text-t1',
                  )} text-texto`}
                >
                  {c.celula(l)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {temTotal && (
          <tfoot>
            <tr>
              {visiveis.map((c, i) => (
                <td
                  key={c.id}
                  className={`${cn(
                    CELULA,
                    'border-t border-fio-caixa font-semibold text-t1',
                    c.numerica ? 'whitespace-nowrap text-right' : 'text-left',
                    i === 0 && PRIMEIRA,
                  )} text-texto`}
                >
                  {i === 0 && c.total === undefined ? rotuloTotal : c.total}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
Tabela.displayName = 'Tabela'
