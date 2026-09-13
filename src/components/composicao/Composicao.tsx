import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Layers } from 'lucide-react'
import { SidePanel } from '@/components/ui/SidePanel'
import { Button } from '@/components/ui/Button'
import { Rotulo } from '@/components/ui/Rotulo'
import { Dica } from '@/components/ui/Dica'
import { SecaoTitulo } from '@/components/ui/SecaoTitulo'
import { EstadoVazio } from '@/components/ui/Estados'
import { ChipSituacao } from '@/components/ui/Situacao'
import { useAuth } from '@/auth/AuthContext'
import type { Situacao } from '@/lib/situacao'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

/*
 * NENHUM NÚMERO SEM ORIGEM.
 *
 * Este é o mecanismo central do sistema. Todo valor na tela — uma comissão, um
 * "a receber", um total de mês, um VGV — pode ser aberto no que o compõe, até
 * a parcela da venda específica que o produziu. E de lá, um toque abre a
 * venda.
 *
 * Ele vive num provider, e não em cada tela, por uma razão prática: se cada
 * tela tivesse que montar seu próprio detalhe, metade delas não teria. Assim
 * qualquer valor, em qualquer lugar, chama `abrir()` e ganha o mesmo painel,
 * com o mesmo desenho e a mesma gramática de situação.
 *
 * Pelo Souza OS o detalhe abre À DIREITA (SidePanel largo), e não num modal
 * central: quem abre "A receber" continua vendo, atrás, a tela onde o número
 * estava. No topo, o rótulo e o número em Sora; abaixo, a lista do que o forma,
 * no desenho de lista da seção 9.
 *
 * A composição não vai para a URL (`useParamPainel`): ela carrega a lista já
 * calculada pela tela que a abriu, e um id na URL não a reconstruiria.
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
}

export interface Composicao {
  /** O rótulo da folha. Caixa alta, curto. */
  rotulo: string
  titulo: string
  /** O que este número é — e, principalmente, o que ele NÃO é. */
  explica?: string
  total: number
  itens: ItemComposicao[]
  /** Ressalva quando parte do total é previsão. */
  nota?: string
  vazio?: string
}

interface Ctx {
  abrir: (c: Composicao) => void
}

/*
 * Largura de cada coluna declarada UMA vez (seção 9): cabeçalho e linha leem
 * daqui, e por isso sempre alinham. O guia escreve px-6 no cabeçalho e px-5 na
 * linha; com essa diferença as colunas desalinham 4px, então os dois usam px-5
 * e vence a regra que o próprio guia dá ("sempre alinham").
 */
const COL = {
  origem: 'min-w-0 flex-1',
  // Some no celular: lá o chip desce para a segunda linha, junto do contexto.
  situacao: 'hidden w-[7.5rem] shrink-0 sm:flex',
  valor: 'w-[8.75rem] shrink-0 text-right',
  acao: 'flex w-4 shrink-0 justify-end',
} as const

const ComposicaoContext = createContext<Ctx | null>(null)

/*
 * Quem está olhando decide a palavra: "Liberada" não existe no vocabulário do
 * corretor, ele lê "A receber". Lido da sessão, e não passado por cada tela, para
 * nenhuma tela do corretor esquecer. Se um dia a folha for montada fora do
 * AuthProvider (a amostra do kit), cai no vocabulário do administrador em vez
 * de derrubar a tela.
 */
function usePerfil(): 'admin' | 'corretor' {
  try {
    const { profile } = useAuth()
    return profile?.role === 'admin' ? 'admin' : 'corretor'
  } catch {
    return 'admin'
  }
}

export function ComposicaoProvider({ children }: { children: ReactNode }) {
  const [comp, setComp] = useState<Composicao | null>(null)
  const navigate = useNavigate()
  const perfil = usePerfil()

  const abrir = useCallback((c: Composicao) => setComp(c), [])
  const valor = useMemo(() => ({ abrir }), [abrir])

  const fechar = () => setComp(null)

  const temDestino = comp?.itens.some((i) => i.para) ?? false
  const n = comp?.itens.length ?? 0

  return (
    <ComposicaoContext.Provider value={valor}>
      {children}
      {comp && (
        <SidePanel
          aberto
          aoFechar={fechar}
          titulo={comp.titulo}
          largura="lg"
          rodape={
            <div className="flex justify-end">
              <Button variant="secondary" className="w-full sm:w-auto" onClick={fechar}>
                Fechar
              </Button>
            </div>
          }
        >
          <Rotulo>{comp.rotulo}</Rotulo>
          {/* O número que se abriu, pronto e sem abreviar: é o mesmo da tela de trás. */}
          <p className="mt-2 font-heading text-[28px] font-extrabold leading-none tracking-[-0.03em] text-t1 tabular-nums sm:text-[34px]">
            {formatCurrency(comp.total)}
          </p>
          {comp.explica && (
            <p className="mt-2.5 max-w-[62ch] text-[13px] leading-relaxed text-t3">{comp.explica}</p>
          )}

          <div className="mt-6">
            {n === 0 ? (
              <EstadoVazio icone={Layers} titulo={comp.vazio ?? 'Nada compõe este valor agora'} />
            ) : (
              <>
                <SecaoTitulo
                  titulo={n === 1 ? 'De onde vem' : `De onde vêm os ${n} valores`}
                  icone={Layers}
                />
                <div
                  role="list"
                  className="list-surface stagger-children mt-3 overflow-hidden rounded-xl border border-line"
                >
                  <div
                    aria-hidden
                    className="flex items-center gap-4 border-b border-line bg-s3/20 px-5 py-2.5"
                  >
                    <Rotulo as="span" className={COL.origem}>
                      Origem
                    </Rotulo>
                    <Rotulo as="span" className={COL.situacao}>
                      Situação
                    </Rotulo>
                    <Rotulo as="span" className={COL.valor}>
                      Valor
                    </Rotulo>
                    {temDestino && <span className={COL.acao} />}
                  </div>
                  {comp.itens.map((i) => (
                    <div key={i.id} role="listitem" className="border-b border-line last:border-0">
                      <LinhaComposicao
                        item={i}
                        perfil={perfil}
                        temDestino={temDestino}
                        aoAbrir={
                          i.para
                            ? () => {
                                fechar()
                                navigate(i.para!)
                              }
                            : undefined
                        }
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {comp.nota && (
            <div className="mt-4">
              <Dica tom="info">{comp.nota}</Dica>
            </div>
          )}
        </SidePanel>
      )}
    </ComposicaoContext.Provider>
  )
}

/*
 * Uma linha da composição. Só a situação ganha moldura (é o que exige
 * decisão); parcela e frase de tempo são contexto e leem como texto na segunda
 * linha, separados por "·". O valor tem coluna própria, tabular, à direita, e
 * não muda de cor: quem diz o estado é o chip.
 */
function LinhaComposicao({
  item,
  perfil,
  temDestino,
  aoAbrir,
}: {
  item: ItemComposicao
  perfil: 'admin' | 'corretor'
  temDestino: boolean
  aoAbrir?: () => void
}) {
  const s = item.situacao
  const cancelada = s === 'cancelada'
  // O chip da casa: tom de TOM_DA_SITUACAO (prevista é informação, nunca ouro
  // nem verde), ícone por estado e a palavra de src/lib/situacao.ts.
  const chip = s ? <ChipSituacao situacao={s} perfil={perfil} /> : null

  const ordinal =
    typeof item.idx === 'number' && typeof item.count === 'number' && item.count > 1
      ? `parcela ${item.idx}/${item.count}`
      : null
  const contexto = [ordinal, item.meta].filter((c): c is string => !!c)

  const conteudo = (
    <>
      <span className={cn('block', COL.origem)}>
        <span
          className={cn(
            'block truncate text-sm font-medium text-t1',
            cancelada && 'text-t3 line-through',
          )}
        >
          {item.titulo}
        </span>
        {(contexto.length > 0 || chip) && (
          <span className="mt-1 flex min-w-0 items-center gap-2 text-xs text-t4">
            {chip && <span className="shrink-0 sm:hidden">{chip}</span>}
            {contexto.length > 0 && (
              <span className="truncate">
                {contexto.map((c, k) => (
                  <Fragment key={k}>
                    {k > 0 && (
                      <span aria-hidden className="px-1.5 text-t5">
                        ·
                      </span>
                    )}
                    {c}
                  </Fragment>
                ))}
              </span>
            )}
          </span>
        )}
      </span>
      <span className={cn(COL.situacao, 'items-center')}>{chip}</span>
      <span
        className={cn(
          COL.valor,
          'text-sm font-semibold text-t1 tabular-nums',
          cancelada && 'font-medium text-t4 line-through',
        )}
      >
        {formatCurrency(item.valor)}
      </span>
      {temDestino && (
        <span aria-hidden className={COL.acao}>
          {aoAbrir && (
            // Visível no hover e no foco; sempre visível em tela de toque, que
            // não tem hover para revelar que a linha leva à venda.
            <ChevronRight
              className="h-4 w-4 text-t4 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
              strokeWidth={1.6}
            />
          )}
        </span>
      )}
    </>
  )

  const base = 'lista-linha group flex w-full items-center gap-4 px-5 py-3.5 text-left'

  if (!aoAbrir) return <div className={base}>{conteudo}</div>

  return (
    <button
      type="button"
      onClick={aoAbrir}
      className={cn(base, 'cursor-pointer transition-colors duration-150 hover:bg-s3/50')}
    >
      {conteudo}
    </button>
  )
}

/**
 * Abre a composição de um valor.
 *
 * Chamável de qualquer tela. Se o provider não estiver montado devolve um
 * `abrir` inerte em vez de explodir — um valor que não abre é uma pena, um app
 * que cai numa tela de dinheiro é outra coisa.
 */
export function useComposicao(): Ctx {
  return useContext(ComposicaoContext) ?? { abrir: () => {} }
}
