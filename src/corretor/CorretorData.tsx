import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import type { BrokerStatus } from '@/types'

/**
 * Os dados do corretor.
 *
 * Nenhuma tabela é lida aqui. Tudo passa por quatro funções do banco que
 * filtram pelo contato do próprio usuário e devolvem só as colunas
 * permitidas. Isso resolve o que política de linha não resolve: esconder
 * COLUNA. O corretor vê a parcela da venda dele e a base do cálculo da sua
 * comissão; não vê o líquido da imobiliária, nem despesa, nem nada de outro
 * corretor.
 */

export interface CorretorVenda {
  id: string
  title: string
  unit: string | null
  client_name: string | null
  development: string | null
  sale_date: string
  property_value: number | null
  broker_pct: number | null
  status: string
  commission_total: number
  commission_received: number
  commission_released: number
  commission_expected: number
  installments: number
  next_date: string | null
}

export interface CorretorParcela {
  id: string
  sale_id: string
  sale_title: string
  development: string | null
  idx: number
  count: number
  expected_date: string
  received_date: string | null
  /** A parcela que a imobiliária recebe — base do cálculo. */
  installment_amount: number
  iss_amount: number
  simples_amount: number
  broker_pct: number | null
  broker_amount: number
  broker_adjustment: number
  status: BrokerStatus
  paid_date: string | null
  notes: string | null
}

export interface CorretorPainel {
  year: number
  sales_count: number
  vgv: number
  sales_without_vgv: number
  commission_total: number
  commission_received: number
  commission_released: number
  commission_expected: number
  overdue_amount: number
  overdue_count: number
  next: {
    sale_title: string
    idx: number
    count: number
    amount: number
    date: string
    status: BrokerStatus
  } | null
  by_month: { month: string; amount: number; received: number }[]
}

interface CorretorValue {
  painel: CorretorPainel | null
  vendas: CorretorVenda[]
  parcelas: CorretorParcela[]
  ano: number
  anosDisponiveis: number[]
  setAno: (a: number) => void
  carregando: boolean
  erro: string | null
  recarregar: () => Promise<void>
}

const Ctx = createContext<CorretorValue | null>(null)
const n = (v: unknown): number => Number(v ?? 0)

export function CorretorDataProvider({ children }: { children: ReactNode }) {
  const [painel, setPainel] = useState<CorretorPainel | null>(null)
  const [vendas, setVendas] = useState<CorretorVenda[]>([])
  const [parcelas, setParcelas] = useState<CorretorParcela[]>([])
  const [ano, setAno] = useState(new Date().getFullYear())
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    setErro(null)
    const [homeRes, vendasRes, parcelasRes] = await Promise.all([
      supabase.rpc('broker_home', { p_year: ano }),
      supabase.rpc('broker_sales'),
      supabase.rpc('broker_installments'),
    ])

    if (homeRes.error || vendasRes.error || parcelasRes.error) {
      const msg = homeRes.error?.message ?? vendasRes.error?.message ?? parcelasRes.error?.message ?? ''
      setErro(
        /could not find the function|does not exist/i.test(msg)
          ? 'O sistema ainda está sendo preparado. Fale com a imobiliária.'
          : 'Não foi possível carregar seus dados. Verifique sua conexão.',
      )
      return
    }

    const h = homeRes.data as CorretorPainel | null
    setPainel(
      h
        ? {
            ...h,
            vgv: n(h.vgv),
            commission_total: n(h.commission_total),
            commission_received: n(h.commission_received),
            commission_released: n(h.commission_released),
            commission_expected: n(h.commission_expected),
            overdue_amount: n(h.overdue_amount),
            next: h.next ? { ...h.next, amount: n(h.next.amount) } : null,
            by_month: (h.by_month ?? []).map((m) => ({
              month: m.month,
              amount: n(m.amount),
              received: n(m.received),
            })),
          }
        : null,
    )
    setVendas(
      ((vendasRes.data as CorretorVenda[]) ?? []).map((v) => ({
        ...v,
        property_value: v.property_value == null ? null : n(v.property_value),
        broker_pct: v.broker_pct == null ? null : n(v.broker_pct),
        commission_total: n(v.commission_total),
        commission_received: n(v.commission_received),
        commission_released: n(v.commission_released),
        commission_expected: n(v.commission_expected),
      })),
    )
    setParcelas(
      ((parcelasRes.data as CorretorParcela[]) ?? []).map((p) => ({
        ...p,
        installment_amount: n(p.installment_amount),
        iss_amount: n(p.iss_amount),
        simples_amount: n(p.simples_amount),
        broker_pct: p.broker_pct == null ? null : n(p.broker_pct),
        broker_amount: n(p.broker_amount),
        broker_adjustment: n(p.broker_adjustment),
      })),
    )
  }, [ano])

  useEffect(() => {
    setCarregando(true)
    recarregar().finally(() => setCarregando(false))
  }, [recarregar])

  const anosDisponiveis = useMemo(() => {
    const anos = new Set<number>([new Date().getFullYear()])
    for (const v of vendas) anos.add(Number(v.sale_date.slice(0, 4)))
    for (const p of parcelas) anos.add(Number(p.expected_date.slice(0, 4)))
    return [...anos].sort((a, b) => b - a)
  }, [vendas, parcelas])

  const value = useMemo<CorretorValue>(
    () => ({ painel, vendas, parcelas, ano, anosDisponiveis, setAno, carregando, erro, recarregar }),
    [painel, vendas, parcelas, ano, anosDisponiveis, carregando, erro, recarregar],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCorretor() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCorretor deve ser usado dentro de <CorretorDataProvider>')
  return ctx
}

/** O rótulo que o corretor entende, com a explicação de cada situação. */
export const SITUACAO: Record<BrokerStatus, { rotulo: string; explica: string; cor: string }> = {
  prevista: {
    rotulo: 'Prevista',
    explica: 'A imobiliária ainda não recebeu essa parcela.',
    cor: 'text-content-muted',
  },
  liberada: {
    rotulo: 'A receber',
    explica: 'A imobiliária já recebeu. Sua comissão está liberada para pagamento.',
    cor: 'text-pending',
  },
  recebida: { rotulo: 'Recebida', explica: 'Já foi paga a você.', cor: 'text-income' },
  cancelada: { rotulo: 'Cancelada', explica: 'A venda foi cancelada.', cor: 'text-content-faint' },
}
