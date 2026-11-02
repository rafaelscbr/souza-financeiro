import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { RegistrarVenda } from './RegistrarVenda'
import { LancarDespesa } from './LancarDespesa'
import { FolhaDeEscolha, type EscolhaDeLancamento } from '@/components/ui/FolhaDeEscolha'

/*
 * AS DUAS AÇÕES QUE CRIAM DINHEIRO NOVO: registrar venda e lançar despesa.
 *
 * Moravam na casca como botões flutuantes no celular e um botão solto no
 * cabeçalho do computador. O guia tira o FAB (seção 6: "sem FAB duplicando o
 * Novo do cabeçalho") e põe a ação no CTA de cada tela. Só que o formulário
 * não pode ser montado por tela: sair de Vendas para Início no meio do
 * cadastro destruiria o que foi digitado. Então a casca é dona do estado e dos
 * dois painéis, e as telas só pedem para abrir.
 */

interface AcoesAdminValue {
  registrarVenda: () => void
  lancarDespesa: () => void
  /** Souza 3.0: a folha de escolha (despesa, venda, recebimento, pagamento). Tecla N. */
  novoLancamento: () => void
}

const NAO_TEXTO = new Set(['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file', 'image'])
function digitando(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true
  return el instanceof HTMLInputElement && !NAO_TEXTO.has(el.type)
}

const AcoesAdminContext = createContext<AcoesAdminValue | null>(null)

export function AcoesAdminProvider({ children }: { children: ReactNode }) {
  const [vendaAberta, setVendaAberta] = useState(false)
  const [despesaAberta, setDespesaAberta] = useState(false)
  const [escolhendo, setEscolhendo] = useState(false)
  const navigate = useNavigate()
  const fecharEscolha = useCallback(() => setEscolhendo(false), [])

  // Funções estáveis: a tela que põe `registrarVenda` num CTA não rerenderiza
  // porque um painel abriu ou fechou.
  const value = useMemo<AcoesAdminValue>(
    () => ({
      registrarVenda: () => setVendaAberta(true),
      lancarDespesa: () => setDespesaAberta(true),
      novoLancamento: () => setEscolhendo(true),
    }),
    [],
  )

  const escolhas = useMemo<EscolhaDeLancamento[]>(
    () => [
      { id: 'despesa', titulo: 'Despesa', descricao: 'aluguel, marketing, contador', tecla: 'd', aoEscolher: () => setDespesaAberta(true) },
      { id: 'recebimento', titulo: 'Recebimento', descricao: 'parcela que a construtora pagou', tecla: 'r', aoEscolher: () => navigate('/receber') },
      { id: 'venda', titulo: 'Venda', descricao: 'contrato novo, com as parcelas', tecla: 'v', aoEscolher: () => setVendaAberta(true) },
      { id: 'pagamento', titulo: 'Pagamento', descricao: 'repasse, imposto ou conta a pagar', tecla: 'p', aoEscolher: () => navigate('/pagar') },
    ],
    [navigate],
  )

  // N de qualquer tela, fora de campo de texto e sem painel aberto.
  const algumPainel = vendaAberta || despesaAberta || escolhendo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey || e.repeat || e.isComposing) return
      if (algumPainel || digitando(document.activeElement)) return
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      e.preventDefault()
      setEscolhendo(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [algumPainel])

  return (
    <AcoesAdminContext.Provider value={value}>
      {children}
      <RegistrarVenda aberto={vendaAberta} onFechar={() => setVendaAberta(false)} />
      <LancarDespesa aberto={despesaAberta} onFechar={() => setDespesaAberta(false)} />
      <FolhaDeEscolha titulo="O que você quer lançar?" aberto={escolhendo} aoFechar={fecharEscolha} escolhas={escolhas} />
    </AcoesAdminContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAcoesAdmin(): AcoesAdminValue {
  const ctx = useContext(AcoesAdminContext)
  if (!ctx) throw new Error('useAcoesAdmin deve ser usado dentro de <AcoesAdminProvider>')
  return ctx
}
