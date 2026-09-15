import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Layers } from 'lucide-react'
import { SidePanel } from '@/components/ui/SidePanel'
import { Rotulo } from '@/components/ui/Rotulo'
import { Dica } from '@/components/ui/Dica'
import { Valor } from '@/components/ui/Valor'
import { Selo } from '@/components/ui/Selo'
import { Linha, Lista } from '@/components/ui/Lista'
import { Demonstrativo } from '@/components/ui/Demonstrativo'
import { EstadoVazio } from '@/components/ui/Estados'
import { ChipSituacao } from '@/components/ui/Situacao'
import { useAuth } from '@/auth/AuthContext'
import type { Situacao } from '@/lib/situacao'
import type { LinhaDemonstrativo } from '@/lib/linhasDaVenda'

/*
 * NENHUM NÚMERO SEM ORIGEM (7.10).
 *
 * Todo valor na tela pode ser aberto no que o compõe, até a parcela da venda
 * que o produziu. Vive num provider para toda tela ganhar o mesmo painel:
 * `SidePanel md` à direita (folha no celular), corpo sem cartão, a conta em
 * `Demonstrativo` quando a tela a manda e a lista em `Lista
 * contexto="sobreposicao"`.
 *
 * O fim do drill-down é a venda: item que é parcela vira link para
 * `/vendas/:id?parcela=<id>` (admin) ou `/minhas-vendas?venda=<id>&parcela=<id>`
 * (corretor); a troca de rota fecha o painel com a saída de 180ms.
 *
 * Só apresentação: total, itens e situações chegam prontos da tela.
 */

export interface ItemComposicao {
  id: string
  titulo: string
  /** A frase de tempo, o empreendimento, "base × %". */
  meta?: string
  valor: number
  situacao?: Situacao
  idx?: number | null
  count?: number | null
  /** Rota da venda de origem. Um toque e ele está na ficha. */
  para?: string
  /** A parcela de origem: o link ganha `parcela=<id>` e a ficha chega com ela destacada (5.5). */
  parcelaId?: string
}

export interface Composicao {
  /** O rótulo acima do número. Curto. */
  rotulo: string
  titulo: string
  /** O que este número é e, principalmente, o que ele NÃO é. */
  explica?: string
  total: number
  itens: ItemComposicao[]
  /** A conta de cima para baixo (7.3.2), quando o número é uma conta. */
  linhas?: LinhaDemonstrativo[]
  /** Ressalva quando parte do total é previsão. */
  nota?: string
  vazio?: string
}

interface Ctx {
  abrir: (c: Composicao) => void
}

const ComposicaoContext = createContext<Ctx | null>(null)

/*
 * Quem está olhando decide a palavra ("Liberada" é "A receber" para o
 * corretor). Fora do AuthProvider (Kit), cai no vocabulário do administrador.
 */
function usePerfil(): 'admin' | 'corretor' {
  try {
    const { profile } = useAuth()
    return profile?.role === 'admin' ? 'admin' : 'corretor'
  } catch {
    return 'admin'
  }
}

/** O link do item, com a parcela quando ela existe. */
export function destinoDoItem(item: ItemComposicao): string | undefined {
  if (!item.para) return undefined
  if (!item.parcelaId) return item.para
  const [base, hash] = item.para.split('#')
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}parcela=${encodeURIComponent(item.parcelaId)}${hash ? `#${hash}` : ''}`
}

export function ComposicaoProvider({ children }: { children: ReactNode }) {
  // O conteúdo fica guardado enquanto o painel sai (usePresenca no SidePanel).
  const [comp, setComp] = useState<Composicao | null>(null)
  const [aberto, setAberto] = useState(false)
  const perfil = usePerfil()
  const location = useLocation()
  const chaveInicial = useRef(location.key)

  const abrir = useCallback((c: Composicao) => {
    setComp(c)
    setAberto(true)
  }, [])
  const valor = useMemo(() => ({ abrir }), [abrir])
  const fechar = useCallback(() => setAberto(false), [])

  // Ir para a venda (ou qualquer navegação) fecha o painel com a saída normal.
  useEffect(() => {
    if (location.key === chaveInicial.current) return
    chaveInicial.current = location.key
    setAberto(false)
  }, [location.key])

  return (
    <ComposicaoContext.Provider value={valor}>
      {children}
      {comp && (
        <SidePanel aberto={aberto} aoFechar={fechar} titulo={comp.titulo} largura="md">
          <CorpoDaComposicao comp={comp} perfil={perfil} />
        </SidePanel>
      )}
    </ComposicaoContext.Provider>
  )
}

function CorpoDaComposicao({ comp, perfil }: { comp: Composicao; perfil: 'admin' | 'corretor' }) {
  const n = comp.itens.length
  const temDestino = comp.itens.some((i) => i.para)
  const temSituacao = comp.itens.some((i) => i.situacao)

  return (
    <>
      {/* O número que se abriu, inteiro: é o mesmo da tela de trás. */}
      <section aria-label="Valor aberto" className="flex flex-col gap-2">
        <Rotulo as="h2">{comp.rotulo}</Rotulo>
        <Valor posto="kpi" valor={comp.total} />
        {comp.explica && <p className="max-w-[62ch] text-t3 text-texto-corrido">{comp.explica}</p>}
      </section>

      {comp.linhas && comp.linhas.length > 0 && (
        <section aria-label="A conta" className="flex flex-col gap-3">
          <Rotulo as="h2">A conta</Rotulo>
          <Demonstrativo linhas={comp.linhas} perfil={perfil} rotuloAcessivel={`Conta de ${comp.titulo}`} />
        </section>
      )}

      {n === 0 ? (
        <EstadoVazio icone={Layers} titulo={comp.vazio ?? 'Nada compõe este valor agora'} />
      ) : (
        <section aria-label="De onde vem" className="flex flex-col gap-3">
          <Rotulo as="h2">{n === 1 ? 'De onde vem' : `De onde vêm os ${n} valores`}</Rotulo>
          <Lista
            contexto="sobreposicao"
            colunas={{ goteira: temSituacao, situacao: temSituacao, valor: true, fim: temDestino }}
            rotuloAcessivel={comp.titulo}
            chaveEscada={`composicao-${comp.titulo}`}
          >
            {comp.itens.map((item) => (
              <LinhaDaComposicao key={item.id} item={item} perfil={perfil} />
            ))}
          </Lista>
        </section>
      )}

      {comp.nota && <Dica tom="info">{comp.nota}</Dica>}
    </>
  )
}

/*
 * Uma linha: título, meta como texto ("parcela 2/3 · prevista para 10/10"),
 * chip de situação na coluna dele e o valor na borda direita, sem cor de
 * estado (quem diz o estado é o chip).
 */
function LinhaDaComposicao({
  item,
  perfil,
  indice,
}: {
  item: ItemComposicao
  perfil: 'admin' | 'corretor'
  /** A Lista preenche (escada). */
  indice?: number
}) {
  const s = item.situacao
  const ordinal =
    typeof item.idx === 'number' && typeof item.count === 'number' && item.count > 1
      ? `parcela ${item.idx}/${item.count}`
      : null
  const partes = [ordinal, item.meta].filter((c): c is string => Boolean(c))

  return (
    <Linha
      goteira={s ? <Selo situacao={s} idx={item.idx} count={item.count} /> : undefined}
      titulo={<span className={s === 'cancelada' ? 'text-t3 line-through' : undefined}>{item.titulo}</span>}
      meta={
        partes.length > 0 ? (
          <span className="meta">
            {partes.map((p) => (
              <span key={p}>{p}</span>
            ))}
          </span>
        ) : undefined
      }
      situacao={s ? <ChipSituacao situacao={s} perfil={perfil} /> : undefined}
      valor={<Valor posto="linha" valor={item.valor} />}
      para={destinoDoItem(item)}
      indice={indice}
    />
  )
}
// A Lista aceita só linhas pelo nome; esta é uma Linha já montada.
LinhaDaComposicao.displayName = 'Linha'

/**
 * Abre a composição de um valor. Sem provider, devolve um `abrir` inerte:
 * um valor que não abre é uma pena; um app que cai numa tela de dinheiro, não.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useComposicao(): Ctx {
  return useContext(ComposicaoContext) ?? { abrir: () => {} }
}
