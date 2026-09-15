import { useRef, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAdmin } from './AdminData'
import { formatMonthYear } from '@/lib/format'
import { cn } from '@/lib/utils'

/*
 * O NAVEGADOR DE MÊS do administrador (docs/souza-os-fundamentos.md, 7.15 e
 * 8.3 "Trocar mês").
 *
 * `inline-flex items-center rounded-controle border border-fio-controle
 * bg-surface`: [‹ quadrado] · rótulo `texto-titulo num min-w-[9rem]
 * text-center` · [› quadrado]. Sem sombra, sem overflow-hidden, sem ícone de
 * calendário. Em 390 ocupa a largura toda. Altura da faixa: 44 abaixo de 1024
 * ou com toque, 40 com ponteiro fino ≥1024. Pressionar: `linha-press`, sem
 * escala.
 *
 * Trocar mês: o rótulo entra com `avanca` (seguinte) ou `recua` (anterior) em
 * 200ms `curva-entra`. Na 1ª montagem não anima. Quem lê e muda o mês continua
 * sendo o AdminData; aqui não há estado de dado.
 */
const QUADRADO =
  'flex size-11 shrink-0 select-none items-center justify-center rounded-controle text-t2 ' +
  'lg:[@media(pointer:fine)]:size-10 hover:bg-linha-hover hover:text-t1 active:bg-linha-press'

/*
 * Transição de cor de controle isolado (8.4), escrita como estilo: a trava só
 * aceita a classe `transition-colors` em components/ui e components/layout.
 */
const COR: CSSProperties = {
  transitionProperty: 'color, background-color, border-color',
  transitionDuration: 'var(--dur-micro)',
  transitionTimingFunction: 'var(--curva-cor)',
}

export interface SeletorMesProps {
  className?: string
  /**
   * Controle externo (o Kit, que não tem banco). Sem estas props o mês vem do
   * AdminData, como sempre. Passe as quatro juntas.
   */
  mes?: Date
  aoAnterior?: () => void
  aoSeguinte?: () => void
  aoAtual?: () => void
}

export function SeletorMes(props: SeletorMesProps) {
  return props.mes ? <SeletorMesDesenho {...props} mes={props.mes} /> : <SeletorMesDoAdmin className={props.className} />
}

function SeletorMesDoAdmin({ className }: { className?: string }) {
  const { mes, mesAnterior, mesSeguinte, irParaMes } = useAdmin()
  return (
    <SeletorMesDesenho
      className={className}
      mes={mes}
      aoAnterior={mesAnterior}
      aoSeguinte={mesSeguinte}
      aoAtual={() => irParaMes(new Date())}
    />
  )
}

function SeletorMesDesenho({ className, mes, aoAnterior, aoSeguinte, aoAtual }: SeletorMesProps & { mes: Date }) {
  const mesAnterior = () => aoAnterior?.()
  const mesSeguinte = () => aoSeguinte?.()
  const agora = new Date()
  const noMesAtual = mes.getFullYear() === agora.getFullYear() && mes.getMonth() === agora.getMonth()
  const nome = formatMonthYear(mes)

  /* Direção da última troca, calculada no render (sem efeito, sem estado). */
  const chave = mes.getFullYear() * 12 + mes.getMonth()
  const anterior = useRef(chave)
  const direcao = useRef<'avanca' | 'recua' | null>(null)
  if (anterior.current !== chave) {
    direcao.current = chave > anterior.current ? 'avanca' : 'recua'
    anterior.current = chave
  }

  return (
    <div
      role="group"
      aria-label="Mês"
      data-seletor-mes
      className={cn(
        'flex w-full items-center rounded-controle border border-fio-controle bg-surface sm:inline-flex sm:w-auto',
        className,
      )}
    >
      <button type="button" onClick={mesAnterior} aria-label="Mês anterior" className={QUADRADO} style={COR}>
        <ChevronLeft size={16} strokeWidth={1.6} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => aoAtual?.()}
        title={noMesAtual ? 'Mês atual' : 'Voltar para o mês atual'}
        aria-label={noMesAtual ? `${nome}, mês atual` : `${nome}. Voltar para o mês atual`}
        style={COR}
        className="text-texto-titulo num flex h-11 min-w-[9rem] flex-1 select-none items-center justify-center rounded-controle px-3 text-center text-t1 hover:bg-linha-hover active:bg-linha-press lg:[@media(pointer:fine)]:h-10"
      >
        {/* A região viva não remonta; o rótulo visível remonta para animar. */}
        <span aria-live="polite" className="sr-only">
          {nome}
        </span>
        <span
          key={chave}
          aria-hidden
          className="whitespace-nowrap"
          style={direcao.current ? { animation: `${direcao.current} var(--dur-pagina) var(--curva-entra)` } : undefined}
        >
          {nome}
        </span>
      </button>
      <button type="button" onClick={mesSeguinte} aria-label="Mês seguinte" className={QUADRADO} style={COR}>
        <ChevronRight size={16} strokeWidth={1.6} aria-hidden />
      </button>
    </div>
  )
}
