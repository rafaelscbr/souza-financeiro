import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { IconeTom } from '@/components/ui/IconeTom'
import { Rotulo } from '@/components/ui/Rotulo'
import { TOM, type Tom } from '@/components/ui/tom'
import { cn } from '@/lib/utils'

/*
 * O SINO — popover de avisos (Souza OS, seções 6 e 8).
 *
 * Avisos iguais são AGRUPADOS: "Parcelas vencidas · 12", nunca doze linhas
 * idênticas. Uma lista de linhas repetidas não diz mais do que o número, e
 * esconde o aviso diferente que estava no meio delas.
 *
 * Cada aviso leva ao lugar já filtrado (`para`, ex.: /pagar?foco=vencidas),
 * porque aviso que não leva à ação é só ansiedade.
 *
 * O ponto do sino salta quando a contagem muda — o único bounce do sistema — e
 * leva a cor do aviso mais grave. A contagem vai no rótulo acessível e no topo
 * do popover; o ponto nunca é o único sinal.
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

export function PopoverAvisos({ avisos }: { avisos: Aviso[] }) {
  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; largura: number; alturaMax: number } | null>(
    null,
  )
  const botaoRef = useRef<HTMLButtonElement>(null)
  const painelRef = useRef<HTMLDivElement>(null)
  const uid = useId()

  const grupos = useMemo(() => agrupar(avisos), [avisos])
  const total = grupos.reduce((s, g) => s + g.quantidade, 0)
  const tomTopo: Tom = grupos[0]?.tom ?? 'neutro'

  // O salto: remonta o ponto com a animação a cada mudança real de contagem.
  const [salto, setSalto] = useState(0)
  const anterior = useRef(total)
  useEffect(() => {
    if (anterior.current === total) return
    anterior.current = total
    if (total > 0) setSalto((s) => s + 1)
  }, [total])

  /*
   * Portal com posição fixa: o sino mora no trilho, que recolhe para 68px e
   * corta o que transborda. Abre para o lado onde há espaço — para a direita se
   * o sino está na metade esquerda da tela, para a esquerda se está no
   * cabeçalho — e nunca sai da tela no celular.
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
        className={cn(
          // 30px e raio 9px, os botões-ícone do topo do trilho (seção 6). O
          // ::before estende a área tocável a 40px sem mudar o desenho (seção 12).
          'relative flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] text-nav-text transition-colors duration-150',
          'before:absolute before:-inset-[5px] hover:bg-nav-hover hover:text-nav-active-text',
          aberto && 'bg-nav-active-bg text-nav-active-text',
        )}
      >
        <Bell className="h-4 w-4" strokeWidth={1.6} aria-hidden />
        {total > 0 && (
          <span
            key={salto}
            aria-hidden
            className={cn(
              'absolute right-[5px] top-[5px] h-2 w-2 rounded-full ring-2 ring-nav-surface',
              TOM[tomTopo].ponto,
              salto > 0 && 'badge-bounce',
            )}
          />
        )}
      </button>

      {aberto &&
        pos &&
        createPortal(
          <div
            ref={painelRef}
            id={`${uid}-painel`}
            role="dialog"
            aria-label="Avisos"
            tabIndex={-1}
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
            style={{ top: pos.top, left: pos.left, width: pos.largura, maxHeight: pos.alturaMax }}
            className="fixed z-[55] flex flex-col overflow-hidden rounded-[14px] border border-line bg-[color:var(--nav-elev)] shadow-dropdown outline-none animate-[slideUp_180ms_cubic-bezier(0.16,1,0.3,1)_backwards]"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
              <Rotulo as="h2">Avisos</Rotulo>
              {total > 0 && (
                <span className="text-xs text-t3 tabular-nums">
                  {total} pendente{total === 1 ? '' : 's'}
                </span>
              )}
            </div>

            {grupos.length === 0 ? (
              // Sem pendência, nunca silêncio (seção 10).
              <div className="flex items-center gap-3 px-4 py-5">
                <IconeTom icone={CheckCircle2} tom="sucesso" tamanho="md" />
                <div className="min-w-0">
                  <p className="font-heading text-sm font-bold text-t1">Tudo em dia</p>
                  <p className="text-xs text-t3">Nenhum aviso pede ação agora.</p>
                </div>
              </div>
            ) : (
              <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1.5">
                {grupos.map((g) => {
                  const conteudo = (
                    <>
                      <IconeTom icone={ICONE[g.tom]} tom={g.tom} tamanho="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-snug text-t1">{g.titulo}</span>
                        {g.detalhe && (
                          <span className="mt-0.5 block truncate text-xs text-t4">{g.detalhe}</span>
                        )}
                      </span>
                      {g.quantidade > 1 && (
                        <Badge tom={g.tom}>
                          <span className="tabular-nums">{g.quantidade}</span>
                        </Badge>
                      )}
                      {g.para && (
                        <ChevronRight className="h-4 w-4 shrink-0 text-t4" strokeWidth={1.6} aria-hidden />
                      )}
                    </>
                  )
                  const linha = 'mx-1.5 flex min-h-[44px] items-center gap-3 rounded-lg px-2.5 py-2'
                  return (
                    <li key={g.chave}>
                      {g.para ? (
                        <Link
                          to={g.para}
                          onClick={() => setAberto(false)}
                          className={cn(linha, 'transition-colors duration-150 hover:bg-s3/50')}
                        >
                          {conteudo}
                        </Link>
                      ) : (
                        <div className={linha}>{conteudo}</div>
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
