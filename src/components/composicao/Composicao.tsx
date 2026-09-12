import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { Assinatura } from '@/components/ui/Assinatura'
import { Valor } from '@/components/ui/Valor'
import { Lista, Linha } from '@/components/ui/Lista'
import { Selo } from '@/components/ui/Selo'
import { ChipSituacao } from '@/components/ui/Situacao'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Situacao } from '@/lib/situacao'

/*
 * NENHUM NÚMERO SEM ORIGEM.
 *
 * Este é o mecanismo central do sistema. Todo valor na tela — uma comissão, um
 * "a receber", um total de mês, um VGV — pode ser aberto no que o compõe, até
 * a parcela da venda específica que o produziu. E de lá, um toque abre a
 * venda.
 *
 * Ele vive num provider, e não em cada tela, por uma razão prática: se cada
 * tela tivesse que montar seu próprio modal de detalhe, metade delas não
 * teria. Assim qualquer valor, em qualquer lugar, chama `abrir()` e ganha a
 * mesma folha, com o mesmo desenho e a mesma gramática de situação.
 *
 * A folha herda a disciplina da tela: um rótulo assinatura, um número em
 * degrau herói, e a lista do que o forma abaixo. Quem abre reconhece o objeto.
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
  /** O rótulo assinatura da folha. Caixa alta, curto. */
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

const ComposicaoContext = createContext<Ctx | null>(null)

export function ComposicaoProvider({ children }: { children: ReactNode }) {
  const [comp, setComp] = useState<Composicao | null>(null)
  const navigate = useNavigate()

  const abrir = useCallback((c: Composicao) => setComp(c), [])
  const valor = useMemo(() => ({ abrir }), [abrir])

  const fechar = () => setComp(null)

  return (
    <ComposicaoContext.Provider value={valor}>
      {children}
      {comp && (
        <Modal open onClose={fechar} title={comp.titulo} largura="largo">
          <Assinatura>{comp.rotulo}</Assinatura>
          <div className="mt-1.5">
            <Valor valor={comp.total} posto="heroi" />
          </div>
          {comp.explica && <p className="mt-2 text-base text-content-muted">{comp.explica}</p>}

          <div className="mt-5">
            {comp.itens.length === 0 ? (
              <EmptyState title={comp.vazio ?? 'Nada compõe este valor agora'} />
            ) : (
              <>
                <p className="mb-1 border-b border-line pb-1.5 text-xs font-medium uppercase tracking-wide text-content-muted">
                  {comp.itens.length === 1 ? 'de onde vem' : `de onde vêm os ${comp.itens.length} valores`}
                </p>
                <Lista>
                  {comp.itens.map((i) => (
                    <Linha
                      key={i.id}
                      selo={i.situacao && <Selo situacao={i.situacao} idx={i.idx} count={i.count} />}
                      titulo={i.titulo}
                      meta={i.meta}
                      situacao={i.situacao && <ChipSituacao situacao={i.situacao} />}
                      valor={<Valor valor={i.valor} posto="linha" />}
                      aoClicar={
                        i.para
                          ? () => {
                              fechar()
                              navigate(i.para!)
                            }
                          : undefined
                      }
                    />
                  ))}
                </Lista>
              </>
            )}
          </div>

          {comp.nota && (
            <p className="mt-4 border-t border-rule pt-3 text-sm text-content-muted">{comp.nota}</p>
          )}
        </Modal>
      )}
    </ComposicaoContext.Provider>
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
