import type { CSSProperties, ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Situacao } from '@/lib/situacao'
import type { Perfil, ResumoDaParcela } from '@/lib/linhasDaVenda'
import { Valor } from './Valor'
import { Selo } from './Selo'
import { Icone } from './Icone'
import { Rotulo } from './Rotulo'
import { ChipSituacao } from './Situacao'
import { Demonstrativo } from './Demonstrativo'
import { cn } from '@/lib/utils'
import { indiceEscada } from '@/lib/animar'

/*
 * PARCELA (7.3.3): item de uma `.lista`, a forma vem da LARGURA DO CARTÃO
 * (container query em src/index.css, `.linha[data-parcela]`):
 *
 *   A  ≥ 65rem  tabela comparável: # · Parcela · Valor · Impostos · Corretor · Fica · ação · fim
 *   B  30–65rem linha em duas partes: a 2ª parte com três células (data-celulas)
 *   C  < 30rem  celular: cabeça, Demonstrativo resumido, ações em largura total
 *
 * Todas as células ficam no DOM na ordem do contrato do CSS; cada forma mostra
 * só as suas. O componente não decide regra: a situação vem de
 * situacaoDeTela() e os números de resumoDaParcela() (src/lib/linhasDaVenda.ts).
 * Perfil corretor: não há coluna "Fica" (resumo.fica é null).
 */

/** As colunas da forma A, para `--colunas` da `.lista` que tem o cabeçalho. */
export const COLUNAS_PARCELA = '28px minmax(9rem,1fr) 9rem 8rem 9rem 9rem 8rem 16px'

export interface ParcelaProps {
  perfil: Perfil
  idx: number
  count: number
  /** Padrão "Parcela 1 de 3". */
  titulo?: string
  /** Situação de tela da parcela (situacaoDeTela()). */
  situacao: Situacao
  /** Frase de tempo e fatos: "recebida em 02/09 · caíram R$ 16.509,75". */
  meta: ReactNode
  resumo: ResumoDaParcela
  /** A única ação principal (Button sm, nunca brand-fill). */
  acao?: ReactNode
  /** O menu "⋯" com o resto (Reagendar, Desfazer recebimento). */
  menu?: ReactNode
  /** Tocar na parcela abre o painel com o Demonstrativo completo. */
  aoAbrir?: () => void
  /** Linha de chegada (?parcela=), 5.5. */
  chegada?: boolean | 'saindo'
  /** Posição na escada de entrada (8.2); a Lista preenche. */
  indice?: number
  className?: string
  style?: CSSProperties
}

export function Parcela({
  perfil,
  idx,
  count,
  titulo,
  situacao,
  meta,
  resumo,
  acao,
  menu,
  aoAbrir,
  chegada,
  indice,
  className,
  style,
}: ParcelaProps) {
  const nome = titulo ?? `Parcela ${idx} de ${count}`
  const fica = perfil === 'admin' ? resumo.fica : null
  const corretor = resumo.corretor
  return (
    <div
      role="listitem"
      data-linha
      data-parcela
      data-clicavel={aoAbrir ? '' : undefined}
      data-chegada={chegada === 'saindo' ? 'saindo' : chegada ? '' : undefined}
      className={cn('linha min-h-16 py-4', className)}
      style={indice != null ? { ...indiceEscada(indice), ...style } : style}
    >
      <span data-coluna="goteira" className="flex items-start">
        <Selo situacao={situacao} idx={idx} count={count} />
      </span>

      <div data-coluna="texto" className="flex min-w-0 flex-col gap-1">
        {aoAbrir ? (
          <button
            type="button"
            data-coluna="titulo"
            onClick={aoAbrir}
            className="min-w-0 truncate text-left font-medium text-t1 after:absolute after:inset-0"
          >
            <span className="text-texto-titulo">{nome}</span>
          </button>
        ) : (
          <span data-coluna="titulo" className="min-w-0 truncate font-medium text-t1">
            <span className="text-texto-titulo">{nome}</span>
          </span>
        )}
        <span data-coluna="meta" className="min-w-0 text-texto-meta text-t-meta">
          {meta}
        </span>
      </div>

      <span data-coluna="situacao" className="flex">
        <ChipSituacao situacao={situacao} perfil={perfil} />
      </span>

      <span data-coluna="valor" className="flex justify-end">
        <Valor valor={resumo.valor} posto="fato" />
      </span>

      <span data-coluna="impostos" className="flex justify-end">
        <Valor valor={-resumo.impostos} posto="fato" />
      </span>

      <span data-coluna="corretor" className="flex flex-col items-end gap-1">
        {corretor && (
          <>
            <Valor valor={perfil === 'admin' ? -corretor.valor : corretor.valor} posto="fato" />
            {corretor.situacao && <ChipSituacao situacao={corretor.situacao} perfil={perfil} />}
          </>
        )}
      </span>

      <span data-coluna="fica" className="flex justify-end">
        {fica != null && <Valor valor={fica} posto="linha" />}
      </span>

      <Celulas perfil={perfil} resumo={resumo} fica={fica} />

      <div data-coluna="demonstrativo" className="min-w-0">
        <Demonstrativo linhas={resumo.linhas} perfil={perfil} rotuloAcessivel={`Conta da ${nome.toLowerCase()}`} />
      </div>

      <div data-coluna="acao" data-acao className="flex items-center justify-end gap-2 [&>*:not(:last-child)]:flex-1">
        {acao}
        {menu}
      </div>

      <span data-coluna="fim" aria-hidden className="flex justify-end text-t-meta">
        {aoAbrir && <Icone icone={ChevronRight} tamanho={16} />}
      </span>
    </div>
  )
}
Parcela.displayName = 'Parcela'

/* Forma B, 2ª parte: IMPOSTOS · CORRETOR · FICA, cada um com rótulo em cima e valor à direita. */
function Celulas({ perfil, resumo, fica }: { perfil: Perfil; resumo: ResumoDaParcela; fica: number | null }) {
  const corretor = resumo.corretor
  return (
    <dl data-celulas className="grid grid-cols-3 gap-4 border-t border-fio-linha pt-3">
      <div className="flex flex-col items-end gap-1">
        <Rotulo as="dt">Impostos</Rotulo>
        <dd>
          <Valor valor={-resumo.impostos} posto="fato" />
        </dd>
      </div>
      <div className="flex min-w-0 flex-col items-end gap-1">
        <dt className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <Rotulo as="span">{perfil === 'admin' ? 'Corretor' : 'Sua comissão'}</Rotulo>
          {corretor?.situacao && <ChipSituacao situacao={corretor.situacao} perfil={perfil} />}
        </dt>
        {corretor && perfil === 'admin' && (
          <dd className="min-w-0 truncate text-texto-meta text-t-meta">{corretor.nome}</dd>
        )}
        <dd>{corretor && <Valor valor={perfil === 'admin' ? -corretor.valor : corretor.valor} posto="fato" />}</dd>
      </div>
      {fica != null && (
        <div className="flex flex-col items-end gap-1">
          <Rotulo as="dt">Fica</Rotulo>
          <dd>
            <Valor valor={fica} posto="linha" />
          </dd>
        </div>
      )}
    </dl>
  )
}

/* Cabeçalho da forma A, uma vez por lista (text-rotulo, h-10). Some abaixo de 65rem pelo CSS da régua. */
export function CabecalhoParcelas({ perfil }: { perfil: Perfil }) {
  return (
    <div role="row" data-cabecalho-parcelas className="h-10 items-center" style={{ paddingInline: 'var(--recuo-linha)' }}>
      <Rotulo as="span">#</Rotulo>
      <Rotulo as="span">Parcela</Rotulo>
      <Rotulo as="span" className="text-right">Valor</Rotulo>
      <Rotulo as="span" className="text-right">Impostos</Rotulo>
      <Rotulo as="span" className="text-right">{perfil === 'admin' ? 'Corretor' : 'Sua comissão'}</Rotulo>
      <Rotulo as="span" className="text-right">{perfil === 'admin' ? 'Fica' : ''}</Rotulo>
      <span />
      <span />
    </div>
  )
}
CabecalhoParcelas.displayName = 'CabecalhoParcelas'
