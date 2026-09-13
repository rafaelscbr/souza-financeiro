import { type ReactNode } from 'react'
import { RotateCcw, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Button } from './Button'
import { Esqueleto, LinhaEsqueleto } from './Esqueleto'
import { IconeTom } from './IconeTom'

/*
 * OS TRÊS ESTADOS DE TODA TELA QUE LÊ DO BANCO (seção 1), nesta precedência:
 * carregando → falhou → vazio.
 *
 * FALHA NUNCA VIRA VAZIO. Uma consulta que falhou e diz "Nenhuma parcela" é
 * uma mentira com cara de boa notícia: o corretor lê que não tem nada a
 * receber quando o que houve foi uma queda de rede. Por isso o erro tem
 * componente próprio e a tela escolhe entre os três, nunca entre dois.
 */

/** Vazio (seção 8): IconeTom lg + título Sora + descrição + ação. */
export function EstadoVazio({
  icone,
  titulo,
  descricao,
  acao,
}: {
  icone: LucideIcon
  titulo: ReactNode
  descricao?: ReactNode
  acao?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <IconeTom icone={icone} tom="neutro" tamanho="lg" />
      <h3 className="mt-4 font-heading text-base font-bold tracking-[-0.015em] text-t1">{titulo}</h3>
      {descricao && <p className="mt-1 max-w-sm text-[13px] text-t3">{descricao}</p>}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  )
}

/**
 * Erro (seção 8): IconeTom risco + "Não foi possível carregar" + motivo +
 * "Tentar de novo". `role="alert"` para o leitor de tela anunciar sem a pessoa
 * procurar. O motivo diz o que houve; a desculpa vaga não entra.
 */
export function EstadoErro({
  titulo = 'Não foi possível carregar',
  motivo,
  aoTentarDeNovo,
}: {
  titulo?: ReactNode
  motivo?: ReactNode
  aoTentarDeNovo: () => void
}) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <IconeTom icone={TriangleAlert} tom="risco" tamanho="lg" />
      <h3 className="mt-4 font-heading text-base font-bold tracking-[-0.015em] text-t1">{titulo}</h3>
      {motivo && <p className="mt-1 max-w-sm text-[13px] text-t3">{motivo}</p>}
      <div className="mt-5">
        <Button type="button" variant="secondary" onClick={aoTentarDeNovo}>
          <RotateCcw size={15} strokeWidth={1.6} aria-hidden />
          Tentar de novo
        </Button>
      </div>
    </div>
  )
}

/** Lista carregando, com a própria superfície de lista (seção 9). */
export function EsqueletoLista({ linhas = 5 }: { linhas?: number }) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-line list-surface"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Carregando…</span>
      <ul>
        {Array.from({ length: linhas }).map((_, i) => (
          <LinhaEsqueleto key={i} />
        ))}
      </ul>
    </div>
  )
}

/** Grade de KPIs carregando: ícone, rótulo, número e barra, como o card real. */
export function EsqueletoCards({ quantos = 4 }: { quantos?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      {Array.from({ length: quantos }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col rounded-[14px] border border-line p-4 shadow-card surface-premium"
          aria-hidden
        >
          <div className="flex items-center gap-2">
            <Esqueleto className="h-7 w-7 shrink-0 rounded-[9px]" />
            <Esqueleto className="h-2.5 w-20" />
          </div>
          <Esqueleto className="mt-3 h-7 w-3/4 rounded-lg" />
          <Esqueleto className="mt-3 h-1.5 rounded-full" />
        </div>
      ))}
    </div>
  )
}
