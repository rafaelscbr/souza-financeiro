import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as KeyboardEventReact } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowRight, ArrowUp, CornerDownLeft, Search, type LucideIcon } from 'lucide-react'
import { IconeTom } from '@/components/ui/IconeTom'
import { Rotulo } from '@/components/ui/Rotulo'
import { useArmadilhaDeFoco } from '@/components/ui/SidePanel'
import { cn } from '@/lib/utils'

/*
 * BUSCA GLOBAL (⌘K) — Souza OS, seção 8.
 *
 * Paleta centralizada, resultados agrupados por tipo com rótulo de seção,
 * setas e Enter, e um rodapé que ensina os atalhos. Quem monta os grupos é a
 * casca (vendas, corretores, telas); a paleta só filtra o que recebeu, sem ir
 * ao banco a cada tecla (seção 1.12: o custo faz parte do desenho).
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

const KBD =
  'inline-flex h-5 min-w-[20px] items-center justify-center rounded-md border border-line bg-s2 px-1 font-label text-[11px] font-medium text-t3'

export function PaletaDeBusca({ aberto, aoFechar, grupos }: PaletaDeBuscaProps) {
  // Montar só aberta: cada abertura começa com a busca limpa e o primeiro
  // resultado ativo, sem efeito de "resetar ao abrir".
  if (!aberto) return null
  return <PaletaAberta aoFechar={aoFechar} grupos={grupos} />
}

function PaletaAberta({ aoFechar, grupos }: Omit<PaletaDeBuscaProps, 'aberto'>) {
  const [consulta, setConsulta] = useState('')
  const [ativo, setAtivo] = useState(0)
  const caixaRef = useRef<HTMLDivElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const uid = useId()
  useArmadilhaDeFoco(true, caixaRef, aoFechar)

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
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]">
      <div aria-hidden className="overlay-entra absolute inset-0 bg-black/25" onClick={aoFechar} />
      <div
        ref={caixaRef}
        role="dialog"
        aria-modal="true"
        aria-label="Buscar"
        data-paleta-busca
        tabIndex={-1}
        className="modal-surface relative flex max-h-[min(34rem,76vh)] w-full max-w-[38rem] flex-col overflow-hidden rounded-[16px] shadow-modal outline-none animate-[slideUp_220ms_cubic-bezier(0.16,1,0.3,1)_backwards]"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-4">
          <Search className="h-[18px] w-[18px] shrink-0 text-t4" strokeWidth={1.6} aria-hidden />
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
            // O contorno de foco some aqui de propósito: a paleta inteira é o
            // lugar do foco, e o cursor piscando já diz onde se digita.
            className="min-h-[52px] min-w-0 flex-1 bg-transparent text-[15px] text-t1 placeholder:text-t4 focus:outline-none"
          />
          <kbd className={cn(KBD, 'hidden sm:inline-flex')}>Esc</kbd>
          {/* No celular não existe Esc: o fechar precisa ser um botão de verdade. */}
          <button
            type="button"
            onClick={aoFechar}
            className="-mr-2 min-h-10 px-2 text-[13px] font-medium text-t3 sm:hidden"
          >
            Cancelar
          </button>
        </div>

        <div
          ref={listaRef}
          id={`${uid}-lista`}
          role="listbox"
          aria-label="Resultados"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1.5"
        >
          {planos.length === 0 ? (
            <div className="px-4 py-9 text-center">
              <p className="text-sm text-t2">
                {consulta.trim() ? `Nada encontrado para “${consulta.trim()}”` : 'Nada para buscar ainda'}
              </p>
              {consulta.trim() && (
                <p className="mt-1 text-xs text-t4">Tente outra palavra ou só parte do nome.</p>
              )}
            </div>
          ) : (
            filtrados.map((grupo, g) => (
              <div key={grupo.rotulo} role="group" aria-label={grupo.rotulo} className="pb-1">
                <div aria-hidden className="px-4 pb-1.5 pt-2.5">
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
                        'mx-1.5 flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2',
                        selecionado ? 'bg-s3/60' : 'hover:bg-s3/40',
                      )}
                    >
                      <IconeTom icone={item.icone ?? ArrowRight} tom="neutro" tamanho="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-t1">{item.titulo}</span>
                        {item.descricao && (
                          <span className="block truncate text-xs text-t4">{item.descricao}</span>
                        )}
                      </span>
                      {selecionado && (
                        <CornerDownLeft
                          className="hidden h-3.5 w-3.5 shrink-0 text-t4 sm:block"
                          strokeWidth={1.6}
                          aria-hidden
                        />
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
          className="hidden shrink-0 items-center gap-4 border-t border-line px-4 py-2.5 text-xs text-t4 sm:flex"
        >
          <span className="inline-flex items-center gap-1.5">
            <kbd className={KBD}>
              <ArrowUp className="h-3 w-3" strokeWidth={1.6} />
            </kbd>
            <kbd className={KBD}>
              <ArrowDown className="h-3 w-3" strokeWidth={1.6} />
            </kbd>
            navegar
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className={KBD}>
              <CornerDownLeft className="h-3 w-3" strokeWidth={1.6} />
            </kbd>
            abrir
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className={KBD}>Esc</kbd>
            fechar
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <kbd className={KBD}>{mac ? '⌘K' : 'Ctrl K'}</kbd>
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
