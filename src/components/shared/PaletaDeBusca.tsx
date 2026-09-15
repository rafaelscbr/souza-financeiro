import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as KeyboardEventReact,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowRight, ArrowUp, CornerDownLeft, Search, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Icone } from '@/components/ui/Icone'
import { IconeTom } from '@/components/ui/IconeTom'
import { Rotulo } from '@/components/ui/Rotulo'
import { useArmadilhaDeFoco } from '@/components/ui/SidePanel'
import { usePresenca, type Presenca } from '@/lib/usePresenca'
import { cn } from '@/lib/utils'

/*
 * BUSCA GLOBAL (⌘K) — 5.2 nível 2, `z-paleta`.
 *
 * Paleta centralizada no alto, resultados agrupados por tipo, setas e Enter,
 * e um rodapé que ensina os atalhos. Quem monta os grupos é a casca; a paleta
 * só filtra o que recebeu, sem ir ao banco a cada tecla.
 *
 * Véu `veu-painel` 200ms; caixa com `modalEntra`, sai em 150ms
 * (`usePresenca`). Cada abertura começa com a busca limpa; o foco volta a
 * quem abriu.
 */

export interface ItemBusca {
  id: string
  titulo: string
  descricao?: string
  icone?: LucideIcon
  aoEscolher: () => void
}

export interface GrupoBusca {
  rotulo: string
  itens: ItemBusca[]
}

export interface PaletaDeBuscaProps {
  aberto: boolean
  aoFechar: () => void
  grupos: GrupoBusca[]
}

/* "Itajai" encontra "Itajaí", "joao" encontra "João". */
function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function Tecla({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-badge border border-fio-linha bg-s2 px-1 font-label text-chip text-t3">
      {children}
    </kbd>
  )
}

export function PaletaDeBusca({ aberto, aoFechar, grupos }: PaletaDeBuscaProps) {
  const presenca = usePresenca(aberto, 180)
  // Cada abertura remonta o conteúdo: busca limpa e o primeiro resultado ativo.
  const aberturas = useRef(0)
  const estavaAberto = useRef(false)
  if (aberto && !estavaAberto.current) aberturas.current += 1
  estavaAberto.current = aberto

  if (!presenca.montado) return null
  return (
    <PaletaAberta
      key={aberturas.current}
      aberto={aberto}
      presenca={presenca}
      aoFechar={aoFechar}
      grupos={grupos}
    />
  )
}

interface PaletaAbertaProps extends PaletaDeBuscaProps {
  presenca: Presenca
}

function PaletaAberta({ aberto, presenca, aoFechar, grupos }: PaletaAbertaProps) {
  const [consulta, setConsulta] = useState('')
  const [ativo, setAtivo] = useState(0)
  const caixaRef = useRef<HTMLDivElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const uid = useId()
  useArmadilhaDeFoco(aberto, caixaRef, aoFechar)

  // Todos os termos precisam aparecer, em qualquer ordem: "vitta 302" acha
  // "Apto 302 · Residencial Vitta".
  const filtrados = useMemo(() => {
    const termos = normalizar(consulta).split(/\s+/).filter(Boolean)
    return grupos
      .map((g) => ({
        rotulo: g.rotulo,
        itens:
          termos.length === 0
            ? g.itens
            : g.itens.filter((i) => {
                const alvo = normalizar(`${i.titulo} ${i.descricao ?? ''}`)
                return termos.every((t) => alvo.includes(t))
              }),
      }))
      .filter((g) => g.itens.length > 0)
  }, [grupos, consulta])

  const planos = useMemo(() => filtrados.flatMap((g) => g.itens), [filtrados])
  const inicios = useMemo(() => {
    let acc = 0
    return filtrados.map((g) => {
      const inicio = acc
      acc += g.itens.length
      return inicio
    })
  }, [filtrados])

  const indice = planos.length === 0 ? -1 : Math.min(ativo, planos.length - 1)
  const idOpcao = (i: number) => `${uid}-op-${i}`

  useEffect(() => {
    if (indice < 0) return
    listaRef.current
      ?.querySelector<HTMLElement>(`[data-indice="${indice}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [indice])

  const escolher = (item: ItemBusca) => {
    // Fecha antes: se a escolha abre um painel, o painel precisa encontrar o
    // foco livre, e não disputá-lo com a paleta que ainda estava no topo.
    aoFechar()
    item.aoEscolher()
  }

  const onKeyDown = (e: KeyboardEventReact<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    const n = planos.length
    if (e.key === 'ArrowDown' && n > 0) {
      e.preventDefault()
      setAtivo((indice + 1) % n)
    } else if (e.key === 'ArrowUp' && n > 0) {
      e.preventDefault()
      setAtivo((indice - 1 + n) % n)
    } else if (e.key === 'Enter' && indice >= 0) {
      e.preventDefault()
      escolher(planos[indice])
    }
  }

  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

  return createPortal(
    <div className="fixed inset-0 z-paleta flex items-start justify-center px-4 pt-4 sm:pt-16">
      <div
        aria-hidden
        {...presenca.props}
        className="veu absolute inset-0 bg-[color:var(--veu-painel)]"
        onClick={aoFechar}
      />
      <div
        ref={caixaRef}
        role="dialog"
        aria-modal="true"
        aria-label="Buscar"
        data-paleta-busca
        data-estado={presenca.estado}
        tabIndex={-1}
        className="modal relative flex max-h-[min(34rem,76vh)] w-full max-w-[38rem] flex-col rounded-caixa border border-fio-caixa bg-surface shadow-modal outline-none"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-fio-linha px-4">
          <Icone icone={Search} tamanho={16} className="text-t-meta" />
          <input
            data-foco-inicial
            type="text"
            role="combobox"
            aria-expanded={planos.length > 0}
            aria-controls={`${uid}-lista`}
            aria-autocomplete="list"
            aria-activedescendant={indice >= 0 ? idOpcao(indice) : undefined}
            aria-label="Buscar"
            placeholder="Buscar no sistema"
            autoComplete="off"
            spellCheck={false}
            value={consulta}
            onChange={(e) => {
              setConsulta(e.target.value)
              setAtivo(0)
            }}
            onKeyDown={onKeyDown}
            // A paleta inteira é o lugar do foco; o cursor piscando já diz onde se digita.
            className="h-14 min-w-0 flex-1 bg-transparent text-texto-titulo text-t1 placeholder:text-t-meta focus:outline-none"
          />
          <span className="hidden sm:flex">
            <Tecla>Esc</Tecla>
          </span>
          {/* No celular não existe Esc: o fechar precisa ser um botão de verdade. */}
          <Button variant="fantasma" size="sm" onClick={aoFechar} className="sm:hidden">
            Cancelar
          </Button>
        </div>

        <div
          ref={listaRef}
          id={`${uid}-lista`}
          role="listbox"
          aria-label="Resultados"
          data-rolagem
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-2"
        >
          {planos.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
              <p className="text-texto text-t2">
                {consulta.trim() ? `Nada encontrado para “${consulta.trim()}”` : 'Nada para buscar ainda'}
              </p>
              {consulta.trim() && (
                <p className="text-texto-meta text-t-meta">Tente outra palavra ou só parte do nome.</p>
              )}
            </div>
          ) : (
            filtrados.map((grupo, g) => (
              <div key={grupo.rotulo} role="group" aria-label={grupo.rotulo} className="flex flex-col">
                <div aria-hidden className="px-2 pb-1 pt-3">
                  <Rotulo as="span">{grupo.rotulo}</Rotulo>
                </div>
                {grupo.itens.map((item, k) => {
                  const i = inicios[g] + k
                  const selecionado = i === indice
                  return (
                    <div
                      key={item.id}
                      id={idOpcao(i)}
                      role="option"
                      aria-selected={selecionado}
                      data-indice={i}
                      // mousemove, e não mouseenter: a lista rolando pelas setas
                      // sob um mouse parado não deve roubar a seleção.
                      onMouseMove={() => {
                        if (!selecionado) setAtivo(i)
                      }}
                      onClick={() => escolher(item)}
                      className={cn(
                        'flex min-h-11 cursor-pointer items-center gap-3 rounded-controle px-2 py-2',
                        selecionado && 'bg-linha-press',
                      )}
                    >
                      <IconeTom icone={item.icone ?? ArrowRight} tom="neutro" tamanho="sm" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-texto text-t1">{item.titulo}</span>
                        {item.descricao && (
                          <span className="truncate text-texto-meta text-t-meta">{item.descricao}</span>
                        )}
                      </span>
                      {selecionado && (
                        <span className="hidden sm:flex">
                          <Icone icone={CornerDownLeft} tamanho={16} className="text-t-meta" />
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Atalhos só onde há teclado físico. */}
        <div
          aria-hidden
          className="hidden h-11 shrink-0 items-center gap-4 border-t border-fio-linha px-4 text-texto-meta text-t-meta sm:flex"
        >
          <span className="inline-flex items-center gap-2">
            <Tecla>
              <Icone icone={ArrowUp} tamanho={12} />
            </Tecla>
            <Tecla>
              <Icone icone={ArrowDown} tamanho={12} />
            </Tecla>
            navegar
          </span>
          <span className="inline-flex items-center gap-2">
            <Tecla>
              <Icone icone={CornerDownLeft} tamanho={12} />
            </Tecla>
            abrir
          </span>
          <span className="inline-flex items-center gap-2">
            <Tecla>Esc</Tecla>
            fechar
          </span>
          <span className="flex-1" />
          <span className="inline-flex items-center gap-2">
            <Tecla>{mac ? '⌘K' : 'Ctrl K'}</Tecla>
            de qualquer tela
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
const NAO_TEXTO = new Set(['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file', 'image'])

function ehCampoDeTexto(el: HTMLElement) {
  if (el.isContentEditable) return true
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement) return !NAO_TEXTO.has(el.type)
  return false
}

/**
 * ⌘K no Mac, Ctrl+K no resto. Ignorado quando o foco está num campo de texto
 * que não é a própria paleta: quem digita a observação de uma venda não pode
 * perder o que escreveu para uma paleta que abriu sozinha.
 */
export function useAtalhoBusca(abrir: () => void) {
  const abrirRef = useRef(abrir)
  useEffect(() => {
    abrirRef.current = abrir
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.shiftKey) return
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return
      const alvo = e.target instanceof HTMLElement ? e.target : null
      if (alvo && ehCampoDeTexto(alvo) && !alvo.closest('[data-paleta-busca]')) return
      e.preventDefault()
      abrirRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
