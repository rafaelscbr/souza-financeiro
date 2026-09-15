import {
  Children,
  Fragment,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useId,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Icone } from './Icone'
import { ParNoGrupoContext } from './ParAgoraPrevisto'
import { useSuperficie } from './Painel'
import { indiceEscada, useEscada } from '@/lib/animar'
import { cn } from '@/lib/utils'

/*
 * LISTA E LINHA (7.2).
 *
 * A Lista declara as colunas UMA vez (`--colunas`); cabeçalho e linhas leem a
 * mesma variável, então a borda direita de todos os valores difere em 0px (P4).
 * O recuo lateral da linha vem da Lista pelo `data-contexto` (receita `.lista`
 * em index.css), nunca do filho, e nada usa margem negativa (P1).
 *
 * Cada célula leva `data-coluna` (goteira | texto | titulo | meta | situacao |
 * valor | acao | fim): é o contrato que a forma estreita (< 40rem do cartão)
 * usa para mandar cada coisa para a sua área.
 */

export type ContextoLista = 'cartao' | 'sobreposicao'

export interface ColunasLista {
  /** 28px para `Selo` ou `IconeTom sm`. Sem ícone com significado, a coluna não existe. */
  goteira?: boolean
  /** Largura da situação; `true` usa `--col-situacao` (7.5rem). */
  situacao?: string | boolean
  /** Largura do valor; `true` usa `--col-valor` (9rem). */
  valor?: string | boolean
  /** Largura declarada da ação (ex.: '7rem'). */
  acao?: string
  /** 16px para o chevron. Se alguma linha abre, a coluna existe em todas. */
  fim?: boolean
}

interface ContextoListaValor {
  contexto: ContextoLista
  /** Colunas declaradas pela Lista; `null` na transição (Lista sem `colunas`). */
  colunas: ColunasLista | null
  /** Com cabeçalho, a lista é `table` e cada linha é `row`. */
  tabela: boolean
}

const ListaContext = createContext<ContextoListaValor | null>(null)

const DEV = import.meta.env.DEV

function larguraDe(v: string | boolean | undefined, padrao: string): string | null {
  if (!v) return null
  return v === true ? padrao : v
}

/** A declaração de `grid-template-columns` que cabeçalho e linhas compartilham. */
export function montarColunas(c: ColunasLista): string {
  return [
    c.goteira ? '28px' : null,
    'minmax(0,1fr)',
    larguraDe(c.situacao, 'var(--col-situacao)'),
    larguraDe(c.valor, 'var(--col-valor)'),
    c.acao ?? null,
    c.fim ? '16px' : null,
  ]
    .filter(Boolean)
    .join(' ')
}

/** O que fica à direita da coluna de valor (ação, fim e os vãos de 16): o par do LinhaGrupo alinha por isso. */
function depoisDoValor(c: ColunasLista): string {
  const partes: string[] = []
  if (c.acao) partes.push(c.acao, '16px')
  if (c.fim) partes.push('16px', '16px')
  return partes.length ? `calc(${partes.join(' + ')})` : '0px'
}

/** Nome de exibição de um elemento React (função, memo ou forwardRef). */
function nomeDe(el: ReactElement): string | undefined {
  const t = el.type as { displayName?: string; name?: string } | string
  if (typeof t === 'string') return t
  return t?.displayName ?? t?.name
}

/** Filhos achatados, abrindo arrays e Fragments. */
export function filhosAchatados(children: ReactNode): ReactNode[] {
  const saida: ReactNode[] = []
  Children.forEach(children, (filho) => {
    if (isValidElement(filho) && filho.type === Fragment) {
      saida.push(...filhosAchatados((filho.props as { children?: ReactNode }).children))
    } else if (filho !== null && filho !== undefined && filho !== false && filho !== true && filho !== '') {
      saida.push(filho)
    }
  })
  return saida
}

/**
 * Em desenvolvimento, avisa quando um filho não é um dos componentes aceitos
 * (7.1: o TypeScript não restringe o tipo de elemento de `children`).
 */
export function validarFilhos(children: ReactNode, aceitos: string[], onde: string): void {
  if (!DEV) return
  for (const filho of filhosAchatados(children)) {
    const nome = isValidElement(filho) ? nomeDe(filho) : typeof filho
    if (!nome || !aceitos.includes(nome)) {
      console.error(`[${onde}] filho não aceito: <${nome ?? '?'}>. Aceitos: ${aceitos.join(', ')}.`)
    }
  }
}

const NOMES_DE_LINHA = ['Linha', 'LinhaGrupo', 'Parcela', 'CabecalhoParcelas', 'LinhaDeHoje']

type IdColuna = 'goteira' | 'texto' | 'situacao' | 'valor' | 'acao' | 'fim'

function idsDasColunas(c: ColunasLista): IdColuna[] {
  const ids: IdColuna[] = []
  if (c.goteira) ids.push('goteira')
  ids.push('texto')
  if (c.situacao) ids.push('situacao')
  if (c.valor) ids.push('valor')
  if (c.acao) ids.push('acao')
  if (c.fim) ids.push('fim')
  return ids
}

/** Transição: sem `colunas`, a Lista deduz a goteira das linhas (só o `data-com-goteira` depende disso). */
function temGoteiraNosFilhos(filhos: ReactNode[]): boolean {
  return filhos.some((f) => {
    if (!isValidElement(f)) return false
    const p = f.props as { goteira?: ReactNode; selo?: ReactNode }
    return Boolean(p.goteira ?? p.selo)
  })
}

export interface ListaProps {
  /**
   * `'cartao'`: a linha recebe `--recuo` dos lados. `'sobreposicao'`: painel ou
   * modal, cujo corpo já tem recuo (linha com 0). Obrigatória no uso final;
   * opcional só na transição, com aviso em desenvolvimento.
   */
  contexto?: ContextoLista
  /** As colunas, declaradas uma vez. Obrigatória no uso final (sem ela, cada linha deduz as suas). */
  colunas?: ColunasLista
  /** Rótulos do cabeçalho, um por coluna declarada, na ordem (goteira e fim com ''). Só aparece com o cartão ≥ 40rem. */
  cabecalho?: ReactNode[]
  /** Nome da lista para leitor de tela. */
  rotuloAcessivel?: string
  /** Chave da escada de entrada (anima uma vez por rota + chave). */
  chaveEscada?: string
  /** Desliga a escada (ex.: lista que recarrega em tempo real). */
  semEscada?: boolean
  className?: string
  children: ReactNode
}

export function Lista({
  contexto,
  colunas,
  cabecalho,
  rotuloAcessivel,
  chaveEscada,
  semEscada = false,
  className,
  children,
}: ListaProps) {
  const superficie = useSuperficie()
  if (DEV && !contexto) {
    console.error('[Lista] a prop `contexto` é obrigatória (7.2): "cartao" ou "sobreposicao".')
  }
  // Transição: sem contexto, a superfície antiga decide; fora de qualquer
  // cartão, a lista antiga desenhava a própria caixa, e continua desenhando.
  const ctx: ContextoLista = contexto ?? (superficie === 'plano' ? 'sobreposicao' : 'cartao')
  const solta = !contexto && superficie === 'solta'

  const idEscada = useId()
  const escada = useEscada(chaveEscada ?? idEscada, semEscada)
  const filhos = filhosAchatados(children)
  validarFilhos(filhos, NOMES_DE_LINHA, 'Lista')
  // A Parcela tem grade própria (7.3.3): lista só de Parcelas não declara colunas.
  const soParcelas = filhos.every((f) => isValidElement(f) && ['Parcela', 'CabecalhoParcelas', 'LinhaGrupo'].includes((f.type as { displayName?: string }).displayName ?? ''))
  if (DEV && !colunas && !soParcelas) {
    console.error('[Lista] declare `colunas` uma vez na Lista (7.2).')
  }

  const comGoteira = colunas ? Boolean(colunas.goteira) : temGoteiraNosFilhos(filhos)
  const tabela = Boolean(colunas && cabecalho)

  const estilo = colunas
    ? ({ '--colunas': montarColunas(colunas), '--depois-valor': depoisDoValor(colunas) } as CSSProperties)
    : undefined

  let i = 0
  const linhas = filhos.map((f, n) => {
    if (!isValidElement(f)) return f
    const props = f.props as { indice?: number }
    const indice = props.indice ?? i
    i += 1
    return cloneElement(f as ReactElement<{ indice?: number }>, { key: f.key ?? n, indice })
  })

  return (
    <ListaContext.Provider value={{ contexto: ctx, colunas: colunas ?? null, tabela }}>
      <div
        className={cn(
          'lista escada flex flex-col',
          solta && 'rounded-caixa border border-fio-caixa bg-surface py-2 shadow-card',
          className,
        )}
        data-caixa={solta ? '' : undefined}
        data-contexto={ctx}
        data-com-goteira={comGoteira ? '' : undefined}
        role={tabela ? 'table' : 'list'}
        aria-label={rotuloAcessivel}
        style={estilo}
        {...escada}
      >
        {tabela && colunas && cabecalho && <CabecalhoLista colunas={colunas} rotulos={cabecalho} />}
        {linhas}
      </div>
    </ListaContext.Provider>
  )
}

function CabecalhoLista({ colunas, rotulos }: { colunas: ColunasLista; rotulos: ReactNode[] }) {
  const ids = idsDasColunas(colunas)
  if (DEV && rotulos.length !== ids.length) {
    console.error(`[Lista] cabecalho tem ${rotulos.length} rótulos para ${ids.length} colunas.`)
  }
  return (
    <div
      role="row"
      data-cabecalho-lista
      className="grid h-10 items-center gap-x-3 border-t border-fio-linha font-label uppercase text-t-meta"
      style={{ paddingInline: 'var(--recuo-linha)', ...indiceEscada(0) }}
    >
      {ids.map((id, n) => (
        <span
          key={id}
          role="columnheader"
          data-coluna={id}
          className={`${cn('min-w-0 truncate', id === 'valor' && 'justify-self-end text-right')} text-rotulo`}
        >
          {rotulos[n]}
        </span>
      ))}
    </div>
  )
}

export interface LinhaProps {
  /** `Selo` ordinal 28 ou `IconeTom sm`, com significado. Uma lista usa um só dos dois. */
  goteira?: ReactNode
  /** Título: `texto-titulo`, até 2 linhas. */
  titulo: ReactNode
  /** Meta: frase de tempo, empreendimento, "base × %". Texto, não pílula. */
  meta?: ReactNode
  /** `Chip` de situação. */
  situacao?: ReactNode
  /** `Valor posto="linha"`. Pousa sempre na mesma borda direita. */
  valor?: ReactNode
  /** Nota curta sob o valor, à direita. */
  metaValor?: ReactNode
  /** Ação principal, SEMPRE visível (`Button size="sm"`), e o menu "⋯" se houver. */
  acao?: ReactNode
  /** A linha abre esta rota (link cobrindo a linha, com o título como nome). */
  para?: string
  /** A linha abre algo nesta tela (painel, composição). */
  aoClicar?: () => void
  /** Destaque de chegada (?parcela=): `true` acende, `'saindo'` apaga em 520ms. */
  chegada?: boolean | 'saindo'
  /** Posição na escada de entrada; a Lista preenche. */
  indice?: number
  className?: string
  /** DEPRECADO — apagar na limpeza final. Use `goteira`. */
  selo?: ReactNode
  /** DEPRECADO — apagar na limpeza final. Use `chegada`. */
  recibo?: boolean
}

export function Linha({
  goteira,
  titulo,
  meta,
  situacao,
  valor,
  metaValor,
  acao,
  para,
  aoClicar,
  chegada,
  indice,
  className,
  selo,
  recibo,
}: LinhaProps) {
  const lista = useContext(ListaContext)
  const tabela = lista?.tabela ?? false
  const celula = tabela ? 'cell' : undefined
  const gut = goteira ?? selo
  const clicavel = Boolean(para || aoClicar)
  const destaque = chegada ?? (recibo ? true : undefined)

  // Colunas: as da Lista; na transição (Lista sem `colunas`), as da própria linha.
  const colunas: ColunasLista = lista?.colunas ?? {
    goteira: Boolean(gut),
    situacao: Boolean(situacao),
    valor: Boolean(valor),
    acao: acao ? 'auto' : undefined,
    fim: clicavel && !acao,
  }
  const proprias = !lista?.colunas

  const estilo = {
    ...(proprias ? { '--colunas': montarColunas(colunas) } : {}),
    ...(indice !== undefined ? indiceEscada(indice) : {}),
  } as CSSProperties

  const tituloClasses = 'min-w-0 line-clamp-2 font-medium text-t1 text-texto-titulo'
  const tituloEl = para ? (
    <Link to={para} className={`${tituloClasses} after:absolute after:inset-0`}>
      {titulo}
    </Link>
  ) : aoClicar ? (
    <button
      type="button"
      onClick={aoClicar}
      className={`${tituloClasses} text-left after:absolute after:inset-0`}
    >
      {titulo}
    </button>
  ) : (
    <span className={tituloClasses}>{titulo}</span>
  )

  if (DEV && lista?.colunas && valor && !lista.colunas.valor) {
    console.error('[Linha] a linha tem valor, mas a Lista não declarou a coluna `valor`.')
  }

  return (
    <div
      className={cn('linha', clicavel && 'cursor-pointer', acao && 'pb-4', className)}
      data-linha=""
      data-clicavel={clicavel ? '' : undefined}
      data-chegada={destaque === 'saindo' ? 'saindo' : destaque ? '' : undefined}
      role={tabela ? 'row' : 'listitem'}
      style={estilo}
    >
      {colunas.goteira && (
        <span role={celula} data-coluna="goteira" data-goteira="" className="flex w-7 justify-center self-start">
          {gut}
        </span>
      )}
      <span role={celula} data-coluna="texto" className="flex min-w-0 flex-col gap-1">
        <span data-coluna="titulo" className="flex min-w-0">
          {tituloEl}
        </span>
        {meta && (
          <span data-coluna="meta" className="min-w-0 text-texto-meta text-t-meta">
            {meta}
          </span>
        )}
      </span>
      {colunas.situacao && (
        <span role={celula} data-coluna="situacao" className="flex min-w-0 justify-start">
          {situacao}
        </span>
      )}
      {colunas.valor && (
        <span role={celula} data-coluna="valor" className="flex flex-col items-end justify-self-end text-right">
          {valor}
          {metaValor && (
            <span className="text-nota text-t-meta">{metaValor}</span>
          )}
        </span>
      )}
      {colunas.acao && (
        <span role={celula} data-coluna="acao" data-acao="" className="flex items-center justify-end gap-3">
          {acao}
        </span>
      )}
      {colunas.fim && (
        <span role={celula} data-coluna="fim" className="flex w-4 justify-end text-t3" aria-hidden>
          {clicavel && <Icone icone={ChevronRight} tamanho={16} />}
        </span>
      )}
    </div>
  )
}
Linha.displayName = 'Linha'

export interface LinhaGrupoProps {
  /** "Setembro de 2026", "Hoje". Vai em caixa alta pelo papel `rotulo`. */
  rotulo: ReactNode
  /** "3 parcelas". */
  contador?: ReactNode
  /** O par "agora · previsto" (7.3.4), alinhado à borda direita da coluna de valor. */
  par?: ReactNode
  /** Marco de hoje: rótulo em t2 e fio `fio-caixa`. */
  hoje?: boolean
  /** Posição na escada de entrada; a Lista preenche. */
  indice?: number
  className?: string
}

/**
 * O cabeçalho de um grupo dentro da lista (mês, "HOJE").
 *
 * O par à direita termina na borda direita da coluna de valor: o recuo direito
 * soma o que a Lista declarou depois do valor (ação, fim e vãos). Com o cartão
 * < 40rem a ação desce e o fim some, então essa soma vira 0 por `cqw`
 * (a `.lista` é o contêiner) e o par desce para uma 2ª linha, à direita.
 * O chevron do par (16 + 4) pende para o vão depois do valor: o NÚMERO é que
 * termina na borda da coluna. O par lê ParNoGrupoContext e esconde o lado zerado.
 */
export function LinhaGrupo({ rotulo, contador, par, hoje, indice, className }: LinhaGrupoProps) {
  const lista = useContext(ListaContext)
  const tabela = lista?.tabela ?? false
  const estilo = {
    paddingInlineStart: 'var(--recuo-linha, var(--recuo))',
    paddingInlineEnd:
      'calc(var(--recuo-linha, var(--recuo)) + clamp(0px, (100cqw - 39.99rem) * 1000, var(--depois-valor, 0px) - 20px))',
    ...(indice !== undefined ? indiceEscada(indice) : {}),
  } as CSSProperties
  return (
    <div
      className={cn(
        'flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 border-t pb-2 pt-6',
        hoje ? 'border-fio-caixa' : 'border-fio-linha',
        className,
      )}
      data-grupo=""
      role={tabela ? 'row' : 'listitem'}
      style={estilo}
    >
      <span role={tabela ? 'rowheader' : undefined} className="flex min-w-0 items-end gap-3">
        <span className={`font-label uppercase ${hoje ? 'text-t2' : 'text-t-meta'} text-rotulo`}>{rotulo}</span>
        {contador && <span className="text-texto-meta text-t-meta">{contador}</span>}
      </span>
      {par && <ParNoGrupoContext.Provider value>{par}</ParNoGrupoContext.Provider>}
    </div>
  )
}
LinhaGrupo.displayName = 'LinhaGrupo'

/**
 * DEPRECADO — apagar na limpeza final. Use `<LinhaGrupo rotulo="Hoje" hoje />`.
 * Mantido para Pagar, Receber, Venda, Recebimentos e o Kit.
 */
export function LinhaDeHoje({ rotulo = 'hoje', indice }: { rotulo?: string; indice?: number }) {
  return <LinhaGrupo rotulo={rotulo} hoje indice={indice} />
}
LinhaDeHoje.displayName = 'LinhaDeHoje'

/** Contexto da lista para quem desenha linhas próprias (ex.: `Parcela`). */
export function useContextoLista(): ContextoListaValor | null {
  return useContext(ListaContext)
}
