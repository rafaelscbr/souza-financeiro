import { type ReactNode } from 'react'
import { AlertCircle, RotateCcw, type LucideIcon } from 'lucide-react'
import { Button } from './Button'
import { Esqueleto, LinhaEsqueleto } from './Esqueleto'
import { IconeTom } from './IconeTom'
import { cn } from '@/lib/utils'

/*
 * OS TRÊS ESTADOS DE TODA TELA QUE LÊ DO BANCO (7.13), nesta precedência:
 * carregando → erro → vazio.
 *
 * FALHA NUNCA VIRA VAZIO. Uma consulta que falhou e diz "Nenhuma parcela" é
 * uma mentira com cara de boa notícia. Erro e vazio moram DENTRO do cartão que
 * leu o dado, nunca a tela toda nem um cartão só para eles; o cabeçalho da
 * página continua. Os dois têm a mesma geometria:
 *   IconeTom lg → título (titulo-painel) → texto (texto-corrido, 48ch) → ação.
 * O componente mostra o que recebe: título, motivo e ação vêm da tela.
 */

function Quadro({
  icone,
  tom,
  titulo,
  texto,
  acao,
  alerta,
}: {
  icone: LucideIcon
  tom: 'neutro' | 'risco'
  titulo: ReactNode
  texto?: ReactNode
  acao?: ReactNode
  alerta?: boolean
}) {
  return (
    <div role={alerta ? 'alert' : undefined} className="flex flex-col items-center px-recuo py-12 text-center">
      <IconeTom icone={icone} tom={tom} tamanho="lg" />
      <h3 className="mt-4 text-titulo-painel text-t1">{titulo}</h3>
      {texto && <p className="mt-1 max-w-[48ch] text-texto-corrido text-t3">{texto}</p>}
      {acao && <div className="mt-6">{acao}</div>}
    </div>
  )
}

/** Vazio (7.13). Por filtro: título do filtro + ação "Ver todas". */
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
  return <Quadro icone={icone} tom="neutro" titulo={titulo} texto={descricao} acao={acao} />
}

/**
 * Erro (7.13): `AlertCircle` em risco + título + motivo + "Tentar de novo"
 * (Button secundário). `role="alert"` para o leitor de tela anunciar.
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
    <Quadro
      alerta
      icone={AlertCircle}
      tom="risco"
      titulo={titulo}
      texto={motivo}
      acao={
        <Button type="button" variant="secundario" icone={RotateCcw} onClick={aoTentarDeNovo}>
          Tentar de novo
        </Button>
      }
    />
  )
}

/**
 * Lista carregando COM caixa própria (cartão de lista), para quando a tela
 * ainda não tem o cartão montado. Dentro de um cartão, use `ListaCarregando`.
 */
export function EsqueletoLista({ linhas = 5, goteira = true }: { linhas?: number; goteira?: boolean }) {
  return (
    <div
      data-caixa
      className="lista rounded-caixa border border-fio-caixa bg-surface py-2 shadow-card"
      data-contexto="cartao"
      data-com-goteira={goteira ? '' : undefined}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Carregando…</span>
      {Array.from({ length: linhas }).map((_, i) => (
        <LinhaEsqueleto key={i} goteira={goteira} />
      ))}
    </div>
  )
}

/** Grade de KPIs carregando (7.4): rótulo, número e nota, na caixa do KPI. */
export function EsqueletoCards({ quantos = 4 }: { quantos?: number }) {
  return (
    <div className="grid grid-cols-2 gap-bloco lg:grid-cols-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      {Array.from({ length: quantos }).map((_, i) => (
        <div key={i} data-caixa className="flex flex-col gap-3 rounded-caixa border border-fio-caixa bg-surface p-recuo shadow-card" aria-hidden>
          <Esqueleto className="h-3 w-20" />
          <Esqueleto className="h-7 w-3/4" />
          <Esqueleto className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}

/*
 * Carregando uma TELA inteira (portão do App, rota preguiçosa): a forma da
 * composição típica (título, herói, KPIs, lista), na receita da casca
 * (`.conteudo`, `gap-secao`, `pt-topo`), sem spinner. O rótulo existe para o
 * leitor de tela.
 */
export function CarregandoPagina({ rotulo = 'Carregando…', className }: { rotulo?: string; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={cn('conteudo flex flex-col gap-secao pt-topo pb-barra-inferior', className)}>
      <span className="sr-only">{rotulo}</span>
      <div className="flex flex-col gap-2" aria-hidden>
        <Esqueleto className="h-5 w-44 max-w-full" />
        <Esqueleto className="h-3 w-64 max-w-full" />
      </div>
      <div data-caixa className="flex flex-col gap-3 rounded-caixa border border-fio-caixa bg-surface p-recuo shadow-card lg:p-8" aria-hidden>
        <Esqueleto className="h-3 w-28" />
        <Esqueleto className="h-9 w-60 max-w-full" />
        <Esqueleto className="h-1.5 w-full" />
      </div>
      <EsqueletoCards quantos={4} />
      <EsqueletoLista linhas={5} />
    </div>
  )
}
