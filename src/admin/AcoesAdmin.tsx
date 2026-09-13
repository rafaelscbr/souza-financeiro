import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { RegistrarVenda } from './RegistrarVenda'
import { LancarDespesa } from './LancarDespesa'

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
}

const AcoesAdminContext = createContext<AcoesAdminValue | null>(null)

export function AcoesAdminProvider({ children }: { children: ReactNode }) {
  const [vendaAberta, setVendaAberta] = useState(false)
  const [despesaAberta, setDespesaAberta] = useState(false)

  // Funções estáveis: a tela que põe `registrarVenda` num CTA não rerenderiza
  // porque um painel abriu ou fechou.
  const value = useMemo<AcoesAdminValue>(
    () => ({
      registrarVenda: () => setVendaAberta(true),
      lancarDespesa: () => setDespesaAberta(true),
    }),
    [],
  )

  return (
    <AcoesAdminContext.Provider value={value}>
      {children}
      <RegistrarVenda aberto={vendaAberta} onFechar={() => setVendaAberta(false)} />
      <LancarDespesa aberto={despesaAberta} onFechar={() => setDespesaAberta(false)} />
    </AcoesAdminContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAcoesAdmin(): AcoesAdminValue {
  const ctx = useContext(AcoesAdminContext)
  if (!ctx) throw new Error('useAcoesAdmin deve ser usado dentro de <AcoesAdminProvider>')
  return ctx
}
