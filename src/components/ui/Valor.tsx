import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Icone } from './Icone'
import { Rotulo } from './Rotulo'
import { cn } from '@/lib/utils'

/*
 * Dinheiro na tela (6.2 e 6.3): a única forma de desenhar um valor.
 *
 * `formatToParts` do Intl pt-BR/BRL vira quatro spans (sinal, moeda, inteiro,
 * centavos) dentro de `.valor .num` com `data-valor`. Sempre Sora, algarismo
 * tabular, `nowrap`, com centavos, nunca abreviado. O componente mostra o
 * número que recebe; não decide regra.
 *
 * POSTOS (6.3)       dígitos                 "R$"
 *   heroi  28/34     800 brand-text          17px 600, mesma cor; centavos 0.6em
 *   kpi    22/28     700 t1                  15px 600 t2
 *   destaque 17      600 t1                  13px 500 t2
 *   linha  15        600 t1                  12px 500 t2
 *   fato   14        500 t2                  12px 400 t-meta
 *
 * Sinal "−" (U+2212), positivo sem sinal, dedução não é vermelha. Zero em
 * t-meta (no herói continua ouro). Cor por `estado`; `previsto` (t2) é
 * mutuamente exclusivo com `estado` e com o herói NO TIPO. O herói tem
 * `variante` 'ouro' ou 'previsto' (7.5).
 */

export type PostoValor = 'heroi' | 'kpi' | 'destaque' | 'linha' | 'fato'
export type EstadoValor = 'recebido' | 'vencido' | 'negativo'
export type VarianteHeroi = 'ouro' | 'previsto'

interface ValorBase {
  valor: number
  /** Desenha o "−" do negativo. `false` no Demonstrativo, onde o sinal tem coluna própria. */
  sinal?: boolean
  className?: string
  /** DEPRECADO — apagar na limpeza final. Classe de cor solta; use `estado` ou `previsto`. */
  tinta?: string
  /** DEPRECADO — apagar na limpeza final. Sem efeito: positivo não tem sinal (6.3). */
  comSinal?: boolean
}

/** O herói: único por tela. Só ele conta (8.3). */
export interface ValorHeroiProps extends ValorBase {
  posto: 'heroi'
  /** Obrigatória no uso final; opcional só na transição (padrão 'ouro', com aviso). */
  variante?: VarianteHeroi
  /** Só o negativo real troca o ouro por error-ink (6.3). */
  estado?: 'negativo'
  previsto?: never
  forte?: never
  /** Conta de 0 até o valor na 1ª exibição do herói nesta rota, na sessão (8.3). */
  contar?: boolean
}

export interface ValorComumProps extends ValorBase {
  posto?: Exclude<PostoValor, 'heroi'>
  /** Dígitos em t1 no posto `fato` (o "agora" do par, 7.3.4). */
  forte?: boolean
  variante?: never
  contar?: never
  estado?: EstadoValor
  previsto?: never
}

export interface ValorPrevistoProps extends ValorBase {
  posto?: Exclude<PostoValor, 'heroi'>
  variante?: never
  contar?: never
  estado?: never
  forte?: never
  /** Previsão: t2, nunca ouro, nunca herói. */
  previsto: true
}

export type ValorProps = ValorHeroiProps | ValorComumProps | ValorPrevistoProps

// ─── Partes ──────────────────────────────────────────────────────────────────

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

interface Partes {
  negativo: boolean
  zero: boolean
  moeda: string
  inteiro: string
  centavos: string
}

function partes(valor: number): Partes {
  const v = Number.isFinite(valor) ? valor : 0
  const centavosTotais = Math.round(Math.abs(v) * 100)
  const zero = centavosTotais === 0
  let moeda = ''
  let inteiro = ''
  let centavos = ''
  for (const p of BRL.formatToParts(centavosTotais / 100)) {
    if (p.type === 'currency') moeda = p.value
    else if (p.type === 'integer' || p.type === 'group') inteiro += p.value
    else if (p.type === 'decimal' || p.type === 'fraction') centavos += p.value
  }
  return { negativo: v < 0 && !zero, zero, moeda, inteiro, centavos }
}

// ─── Por extenso (aria-label) ────────────────────────────────────────────────

const UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
  'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos',
  'setecentos', 'oitocentos', 'novecentos']

function ate999(n: number): string {
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100)
  const resto = n % 100
  const fim = resto < 20 ? UNIDADES[resto] : DEZENAS[Math.floor(resto / 10)] + (resto % 10 ? ` e ${UNIDADES[resto % 10]}` : '')
  if (!c) return fim
  return resto ? `${CENTENAS[c]} e ${fim}` : CENTENAS[c]
}

function extenso(n: number): string {
  if (n === 0) return 'zero'
  const grupos: [number, string, string][] = [
    [1e9, 'bilhão', 'bilhões'],
    [1e6, 'milhão', 'milhões'],
    [1e3, 'mil', 'mil'],
  ]
  const pedacos: string[] = []
  let resto = n
  for (const [base, um, varios] of grupos) {
    const q = Math.floor(resto / base)
    resto %= base
    if (!q) continue
    pedacos.push(base === 1e3 && q === 1 ? 'mil' : `${ate999(q)} ${q === 1 ? um : varios}`)
  }
  if (resto) pedacos.push(ate999(resto))
  return pedacos.join(' e ')
}

/** "menos 17 mil e 20 reais e 36 centavos" (6.3). */
export function valorPorExtenso(valor: number): string {
  const v = Number.isFinite(valor) ? valor : 0
  const total = Math.round(Math.abs(v) * 100)
  const reais = Math.floor(total / 100)
  const cent = total % 100
  const trechos: string[] = []
  if (reais || !cent) {
    const redondo = reais >= 1e6 && reais % 1e6 === 0
    trechos.push(`${extenso(reais)}${redondo ? ' de' : ''} ${reais === 1 ? 'real' : 'reais'}`)
  }
  if (cent) trechos.push(`${extenso(cent)} ${cent === 1 ? 'centavo' : 'centavos'}`)
  return `${v < 0 && total ? 'menos ' : ''}${trechos.join(' e ')}`
}

// ─── Movimento ───────────────────────────────────────────────────────────────

const CONSULTA_REDUZIDO = '(prefers-reduced-motion: reduce)'

function assinarReduzido(avisar: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia(CONSULTA_REDUZIDO)
  mq.addEventListener('change', avisar)
  return () => mq.removeEventListener('change', avisar)
}

/** Escuta `prefers-reduced-motion` e acompanha a troca em tempo real (8.5). */
export function useMovimentoReduzido(): boolean {
  return useSyncExternalStore(
    assinarReduzido,
    () => typeof window !== 'undefined' && Boolean(window.matchMedia?.(CONSULTA_REDUZIDO).matches),
    () => false,
  )
}

/* Rotas cujo herói já contou nesta sessão (8.3: só na 1ª exibição por rota). */
const rotasQueContaram = new Set<string>()

/**
 * Contagem do herói (8.3): 700ms, ease-out cúbico, rAF, só na 1ª exibição do
 * herói naquela rota na sessão. Com movimento reduzido, mostra o final. O
 * último quadro devolve o alvo EXATO. Troca de valor depois disso não conta:
 * devolve `trocas` para o chamador aplicar `numero-trocou`.
 */
export function useContagemHeroi(alvo: number, ativo: boolean): { exibido: number; contando: boolean; trocas: number } {
  const reduzido = useMovimentoReduzido()
  const [rota] = useState(() => (typeof window === 'undefined' ? '' : window.location.pathname))
  // Aba escondida não roda quadros (rAF parado): não conta, mostra o valor final (8.2).
  const visivel = typeof document === 'undefined' || document.visibilityState === 'visible'
  const deveContar = ativo && !reduzido && visivel && !rotasQueContaram.has(rota)
  const [exibido, setExibido] = useState(() => (deveContar ? 0 : alvo))
  const [contando, setContando] = useState(deveContar)
  const [trocas, setTrocas] = useState(0)
  const anterior = useRef(alvo)
  const alvoRef = useRef(alvo)
  alvoRef.current = alvo

  useEffect(() => {
    if (!deveContar) return
    rotasQueContaram.add(rota)
    const inicio = performance.now()
    let raf = 0
    let terminou = false
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / 700)
      const final = alvoRef.current
      if (t >= 1) {
        terminou = true
        setExibido(final)
        setContando(false)
        return
      }
      setExibido(final * (1 - Math.pow(1 - t, 3)))
      raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    return () => {
      cancelAnimationFrame(raf)
      // StrictMode e desmontagem no meio: a rota ainda não contou de verdade.
      if (!terminou) rotasQueContaram.delete(rota)
    }
    // Só na montagem: trocar o valor depois não recomeça a contagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (anterior.current === alvo) return
    anterior.current = alvo
    if (contando) return
    setExibido(alvo)
    if (!reduzido) setTrocas((n) => n + 1)
  }, [alvo, contando, reduzido])

  return { exibido: contando ? exibido : alvo, contando, trocas }
}

// ─── Desenho ─────────────────────────────────────────────────────────────────

const TAMANHO_DIGITOS: Record<PostoValor, string> = {
  heroi: 'text-numero-heroi-m lg:text-numero-heroi',
  kpi: 'text-numero-kpi-m lg:text-numero-kpi',
  destaque: 'text-valor-destaque',
  linha: 'text-valor-linha',
  fato: 'text-valor-fato',
}

const TAMANHO_MOEDA: Record<PostoValor, string> = {
  heroi: 'text-valor-destaque',
  kpi: 'text-valor-linha',
  destaque: 'text-texto-meta font-medium',
  linha: 'text-nota font-medium',
  fato: 'text-nota font-normal',
}

const COR_DIGITOS: Record<PostoValor, string> = {
  heroi: 'text-brand-text',
  kpi: 'text-t1',
  destaque: 'text-t1',
  linha: 'text-t1',
  fato: 'text-t2',
}

const COR_MOEDA: Record<PostoValor, string> = {
  heroi: 'text-brand-text',
  kpi: 'text-t2',
  destaque: 'text-t2',
  linha: 'text-t2',
  fato: 'text-t-meta',
}

const COR_ESTADO: Record<EstadoValor, string> = {
  recebido: 'text-success-ink',
  vencido: 'text-error-ink',
  negativo: 'text-error-ink',
}

function cores(props: ValorProps, p: Partes): { digitos: string; moeda: string } {
  const posto = props.posto ?? 'linha'
  if (props.tinta) return { digitos: '', moeda: '' }
  if (props.posto === 'heroi') {
    if (props.estado === 'negativo') return { digitos: 'text-error-ink', moeda: 'text-error-ink' }
    if (props.variante === 'previsto') return { digitos: 'text-t1', moeda: 'text-t1' }
    return { digitos: COR_DIGITOS.heroi, moeda: COR_MOEDA.heroi }
  }
  if (props.estado) return { digitos: COR_ESTADO[props.estado], moeda: COR_ESTADO[props.estado] }
  if (p.zero) return { digitos: 'text-t-meta', moeda: 'text-t-meta' }
  if (props.previsto) return { digitos: 'text-t2', moeda: 'text-t2' }
  if (!props.previsto && (props as ValorComumProps).forte) return { digitos: 'text-t1', moeda: 'text-t2' }
  return { digitos: COR_DIGITOS[posto], moeda: COR_MOEDA[posto] }
}

function Desenho({ p, posto, cor, sinal }: { p: Partes; posto: PostoValor; cor: { digitos: string; moeda: string }; sinal: boolean }) {
  return (
    <>
      {p.negativo && sinal && <span className={cn('valor-sinal', cor.digitos)}>−</span>}
      <span className={cn('valor-moeda', TAMANHO_MOEDA[posto], cor.moeda)}>{p.moeda}</span>
      <span className={cn('valor-inteiro', cor.digitos)}>{p.inteiro}</span>
      <span
        className={cn('valor-centavos', cor.digitos)}
        style={posto === 'heroi' ? { fontSize: '0.6em' } : undefined}
      >
        {p.centavos}
      </span>
    </>
  )
}

export function Valor(props: ValorProps) {
  const { valor, sinal = true, className, tinta } = props
  const posto: PostoValor = props.posto ?? 'linha'
  const heroi = props.posto === 'heroi'
  if (import.meta.env.DEV && heroi && !props.variante) {
    console.error('[Valor] posto="heroi" sem `variante` ("ouro" | "previsto"), 7.5.')
  }
  const { exibido, contando, trocas } = useContagemHeroi(valor, heroi && Boolean(props.contar))
  const final = partes(valor)
  const cor = cores(props, final)
  const raiz = cn('valor num font-heading', TAMANHO_DIGITOS[posto], tinta, className)
  const rotulo = valorPorExtenso(valor)

  if (contando) {
    return (
      <span data-valor role="img" aria-label={rotulo} className={raiz}>
        <span className="inline-grid">
          <span className="valor invisible" style={{ gridArea: '1 / 1' }} aria-hidden>
            <Desenho p={final} posto={posto} cor={cor} sinal={sinal} />
          </span>
          <span className="valor" style={{ gridArea: '1 / 1', justifySelf: 'end' }} aria-hidden>
            <Desenho p={partes(exibido)} posto={posto} cor={cor} sinal={sinal} />
          </span>
        </span>
      </span>
    )
  }

  return (
    <span data-valor role="img" aria-label={rotulo} className={raiz}>
      <span key={trocas} className={cn('valor', heroi && trocas > 0 && 'numero-trocou')} aria-hidden>
        <Desenho p={final} posto={posto} cor={cor} sinal={sinal} />
      </span>
    </span>
  )
}

/**
 * Um valor que ABRE no que o compõe (6.3). Nenhum número fica sem origem:
 * todo total abre até a parcela da venda.
 *
 * Só em linha NÃO clicável, herói, apoio, Demonstrativo e ParAgoraPrevisto;
 * em linha clicável use `Valor` simples (nunca dois chevrons na mesma linha).
 * Sem margem negativa: o chevron mora dentro da coluna, à direita do valor, e
 * o alvo tem 44px de altura. Hover sublinha o número e acende o chevron.
 */
export type ValorComOrigemProps = ValorProps & {
  aoAbrir: () => void
  rotuloAcessivel: string
  /** Lado do chevron: 'depois' (padrão) ou 'antes' do número, como no Demonstrativo (7.3.2). */
  chevron?: 'antes' | 'depois'
}

export function ValorComOrigem(props: ValorComOrigemProps) {
  const { aoAbrir, rotuloAcessivel, className, chevron = 'depois', ...resto } = props
  const seta = (
    <Icone
      icone={ChevronRight}
      tamanho={16}
      className="text-t-meta transition-colors duration-micro ease-cor group-hover/origem:text-t2"
    />
  )
  return (
    <button
      type="button"
      onClick={aoAbrir}
      aria-label={rotuloAcessivel}
      data-origem
      className={cn(
        'group/origem inline-flex min-h-toque shrink-0 items-center gap-1 whitespace-nowrap rounded-controle',
        'cursor-pointer text-left',
        className,
      )}
    >
      {chevron === 'antes' && seta}
      <Valor
        {...(resto as ValorProps)}
        className="decoration-1 underline-offset-4 group-hover/origem:underline"
      />
      {chevron === 'depois' && seta}
    </button>
  )
}

/**
 * DEPRECADO — apagar na limpeza final (usado só por kit/Kit.tsx).
 * Rótulo + valor empilhados; o herói e os apoios de 7.5 substituem.
 */
export function Metrica({ rotulo, children, detalhe }: { rotulo: string; children: ReactNode; detalhe?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Rotulo>{rotulo}</Rotulo>
      <div>{children}</div>
      {detalhe && <p className="font-label text-nota text-t-meta">{detalhe}</p>}
    </div>
  )
}
