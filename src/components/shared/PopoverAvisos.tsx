import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Info,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Icone } from '@/components/ui/Icone'
import { IconeTom } from '@/components/ui/IconeTom'
import { Rotulo } from '@/components/ui/Rotulo'
import { type Tom } from '@/components/ui/tom'
import { usePresenca } from '@/lib/usePresenca'
import { cn } from '@/lib/utils'

/*
 * O SINO — popover de avisos (5.2 nível 2; 7.7 Badge; 8.3 salto do badge).
 *
 * Avisos iguais são AGRUPADOS: "Parcelas vencidas · 12", nunca doze linhas
 * idênticas. Cada aviso leva ao lugar já filtrado (`para`), porque aviso que
 * não leva à ação é só ansiedade.
 *
 * Sino 40 (44 no toque e abaixo de 1024). O contador é o Badge (7.7), em risco
 * quando o aviso mais grave é risco, no máximo "9+"; salta (`saltoBadge`
 * 500ms) só quando a contagem AUMENTA. A contagem vai também no rótulo
 * acessível. O popover entra esmaecendo em 150ms e sai em 180ms
 * (`usePresenca`); `z-popover`; sem `data-caixa`.
 */

export interface Aviso {
  id: string
  tom: Tom
  titulo: string
  detalhe?: string
  quantidade?: number
  para?: string
}

interface GrupoAviso {
  chave: string
  tom: Tom
  titulo: string
  detalhe?: string
  quantidade: number
  para?: string
}

// Ícone por tom: o estado lido também em escala de cinza.
const ICONE: Record<Tom, LucideIcon> = {
  risco: AlertTriangle,
  atencao: Clock,
  marca: CircleDollarSign,
  info: Info,
  sucesso: CheckCircle2,
  neutro: Bell,
}

const GRAVIDADE: Record<Tom, number> = { risco: 0, atencao: 1, marca: 2, info: 3, sucesso: 4, neutro: 5 }

/*
 * Mesmo tom + mesmo título + mesmo destino = o mesmo aviso. As quantidades se
 * somam. O detalhe só sobrevive se for igual em todos; se variar, mostrar um
 * deles afirmaria mais do que o grupo diz.
 */
function agrupar(avisos: Aviso[]): GrupoAviso[] {
  const mapa = new Map<string, GrupoAviso & { detalhes: Set<string | undefined> }>()
  for (const a of avisos) {
    // Quantidade zero não é aviso. Zero nunca é vermelho.
    if (a.quantidade === 0) continue
    const chave = `${a.tom}|${a.titulo}|${a.para ?? ''}`
    const qtd = Math.max(1, a.quantidade ?? 1)
    const atual = mapa.get(chave)
    if (atual) {
      atual.quantidade += qtd
      atual.detalhes.add(a.detalhe)
    } else {
      mapa.set(chave, {
        chave,
        tom: a.tom,
        titulo: a.titulo,
        quantidade: qtd,
        para: a.para,
        detalhes: new Set([a.detalhe]),
      })
    }
  }
  return Array.from(mapa.values())
    .map(({ detalhes, ...g }) => ({
      ...g,
      detalhe: detalhes.size === 1 ? [...detalhes][0] : undefined,
    }))
    .sort((a, b) => GRAVIDADE[a.tom] - GRAVIDADE[b.tom] || b.quantidade - a.quantidade)
}

const LARGURA = 352 // 22rem
const MARGEM = 16

const ENTRADA: CSSProperties = { animation: 'esmaeceEntra var(--dur-micro) linear backwards' }
const SAIDA: CSSProperties = { animation: 'esmaeceSai var(--dur-saida) linear both' }
const SALTO: CSSProperties = { animation: 'saltoBadge 500ms var(--curva-entra)' }
/* Controle isolado: cor em 150ms (8.4). Inline porque aqui não é components/ui. */
const TRANSICAO_COR: CSSProperties = {
  transition: 'background-color var(--dur-micro) var(--curva-cor), color var(--dur-micro) var(--curva-cor)',
}

/* Hover de item de fila (8.3): `::before` com opacidade em 150ms, sem mexer no texto. */
const ITEM =
  'relative flex min-h-11 items-center gap-3 rounded-controle px-2 py-2 before:absolute before:inset-0 before:rounded-controle before:bg-linha-hover before:opacity-0 before:transition-opacity hover:before:opacity-100 active:before:bg-linha-press active:before:opacity-100'

export function PopoverAvisos({ avisos }: { avisos: Aviso[] }) {
  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; largura: number; alturaMax: number } | null>(
    null,
  )
  const botaoRef = useRef<HTMLButtonElement>(null)
  const painelRef = useRef<HTMLDivElement>(null)
  const uid = useId()
  const presenca = usePresenca(aberto, 180)

  const grupos = useMemo(() => agrupar(avisos), [avisos])
  const total = grupos.reduce((s, g) => s + g.quantidade, 0)
  const tomTopo: Tom = grupos[0]?.tom ?? 'neutro'

  // O salto: remonta o contador com a animação só quando a contagem aumenta.
  const [salto, setSalto] = useState(0)
  const anterior = useRef(total)
  useEffect(() => {
    if (total > anterior.current) setSalto((s) => s + 1)
    anterior.current = total
  }, [total])

  /*
   * Portal com posição fixa: abre para o lado onde há espaço e nunca sai da
   * tela no celular.
   */
  const posicionar = useCallback(() => {
    const b = botaoRef.current
    if (!b) return
    const r = b.getBoundingClientRect()
    const vw = window.innerWidth
    const largura = Math.min(LARGURA, vw - MARGEM * 2)
    const aEsquerda = r.left + r.width / 2 < vw / 2
    let left = aEsquerda ? r.left : r.right - largura
    left = Math.max(MARGEM, Math.min(left, vw - largura - MARGEM))
    const top = r.bottom + 8
    setPos({ top, left, largura, alturaMax: Math.max(200, window.innerHeight - top - MARGEM) })
  }, [])

  useLayoutEffect(() => {
    if (!aberto) return
    posicionar()
    window.addEventListener('resize', posicionar)
    window.addEventListener('scroll', posicionar, true)
    return () => {
      window.removeEventListener('resize', posicionar)
      window.removeEventListener('scroll', posicionar, true)
    }
  }, [aberto, posicionar])

  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node
      if (painelRef.current?.contains(alvo) || botaoRef.current?.contains(alvo)) return
      setAberto(false)
    }
    document.addEventListener('pointerdown', fora)
    const t = window.setTimeout(() => painelRef.current?.focus({ preventScroll: true }), 0)
    return () => {
      document.removeEventListener('pointerdown', fora)
      window.clearTimeout(t)
    }
  }, [aberto])

  const fecharEVoltar = () => {
    setAberto(false)
    botaoRef.current?.focus()
  }

  const rotuloBotao =
    total === 0 ? 'Avisos: nenhum pendente' : `Avisos: ${total} pendente${total === 1 ? '' : 's'}`

  const contador = total > 9 ? '9+' : String(total)

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={() => setAberto((a) => !a)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && aberto) {
            e.preventDefault()
            setAberto(false)
          }
        }}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls={aberto ? `${uid}-painel` : undefined}
        aria-label={rotuloBotao}
        title={rotuloBotao}
        style={TRANSICAO_COR}
        className={cn(
          'relative flex size-10 shrink-0 items-center justify-center rounded-controle text-t2 hover:bg-linha-hover hover:text-t1 active:bg-linha-press max-lg:size-11 [@media(pointer:coarse)]:size-11',
          aberto && 'bg-linha-press text-t1',
        )}
      >
        <Icone icone={Bell} tamanho={16} />
        {total > 0 && (
          <span key={salto} aria-hidden className="absolute right-0 top-0 flex" style={salto > 0 ? SALTO : undefined}>
            <Badge risco={tomTopo === 'risco'}>{contador}</Badge>
          </span>
        )}
      </button>

      {presenca.montado &&
        pos &&
        createPortal(
          <div
            ref={painelRef}
            id={`${uid}-painel`}
            role="dialog"
            aria-label="Avisos"
            tabIndex={-1}
            data-popover
            {...presenca.props}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                fecharEVoltar()
              }
            }}
            onBlur={(e) => {
              const para = e.relatedTarget as Node | null
              if (para && (painelRef.current?.contains(para) || botaoRef.current?.contains(para))) return
              if (para) setAberto(false)
            }}
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.largura,
              maxHeight: pos.alturaMax,
              ...(presenca.estado === 'saindo' ? SAIDA : ENTRADA),
            }}
            className="fixed z-popover flex flex-col rounded-caixa border border-fio-caixa bg-surface shadow-dropdown outline-none"
          >
            <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-fio-linha px-4">
              <Rotulo as="h2">Avisos</Rotulo>
              {total > 0 && (
                <span className="num text-texto-meta text-t-meta">
                  {total} pendente{total === 1 ? '' : 's'}
                </span>
              )}
            </div>

            {grupos.length === 0 ? (
              // Sem pendência, nunca silêncio.
              <div className="flex items-center gap-3 p-4">
                <IconeTom icone={CheckCircle2} tom="sucesso" tamanho="md" />
                <div className="flex min-w-0 flex-col">
                  <p className="text-texto-titulo text-t1">Tudo em dia</p>
                  <p className="text-texto-meta text-t-meta">Nenhum aviso pede ação agora.</p>
                </div>
              </div>
            ) : (
              <ul data-rolagem className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-2">
                {grupos.map((g) => {
                  const conteudo = (
                    <>
                      <span className="relative flex">
                        <IconeTom icone={ICONE[g.tom]} tom={g.tom} tamanho="sm" />
                      </span>
                      <span className="relative flex min-w-0 flex-1 flex-col">
                        <span className="text-texto text-t1">{g.titulo}</span>
                        {g.detalhe && <span className="truncate text-texto-meta text-t-meta">{g.detalhe}</span>}
                      </span>
                      {g.quantidade > 1 && (
                        <span className="relative flex">
                          <Badge risco={g.tom === 'risco'}>{g.quantidade}</Badge>
                        </span>
                      )}
                      {g.para && <Icone icone={ChevronRight} tamanho={16} className="relative text-t-meta" />}
                    </>
                  )
                  return (
                    <li key={g.chave}>
                      {g.para ? (
                        <Link to={g.para} onClick={() => setAberto(false)} className={ITEM}>
                          {conteudo}
                        </Link>
                      ) : (
                        <div className="flex min-h-11 items-center gap-3 px-2 py-2">{conteudo}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
