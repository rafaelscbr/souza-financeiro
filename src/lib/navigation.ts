import {
  LayoutDashboard,
  Receipt,
  ArrowDownCircle,
  ArrowUpCircle,
  PieChart,
  Target,
  Flag,
  Calculator,
  Landmark,
  Handshake,
  BookOpen,
  Users,
  Wallet,
  CreditCard,
  ShoppingBag,
  Gem,
  FileText,
  Gauge,
} from 'lucide-react'

/**
 * O app são DOIS produtos que dividem a mesma base: o financeiro das empresas
 * (PJ) e o financeiro pessoal do dono (PF). Misturar os menus foi o que deixou
 * a navegação confusa — cada espaço agora tem o seu, e a troca é explícita.
 *
 * A regra é simples: tudo que começa com `/pessoal` é PF; o resto é PJ.
 */
export type WorkspaceId = 'empresas' | 'pessoal'

export interface NavItemDef {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
  /** Texto curto de apoio, usado na sidebar larga. */
  hint?: string
}

export interface NavGroup {
  title: string | null
  items: NavItemDef[]
}

export interface Workspace {
  id: WorkspaceId
  label: string
  short: string
  icon: typeof LayoutDashboard
  home: string
  groups: NavGroup[]
  /** Itens da barra inferior do celular — no máximo cinco, senão o alvo do polegar encolhe. */
  mobile: string[]
}

const EMPRESAS: Workspace = {
  id: 'empresas',
  label: 'Empresas',
  short: 'PJ',
  icon: Landmark,
  home: '/',
  groups: [
    { title: null, items: [{ to: '/', label: 'Painel', icon: LayoutDashboard, end: true }] },
    {
      title: 'Movimento',
      items: [
        { to: '/lancamentos', label: 'Lançamentos', icon: Receipt },
        { to: '/vendas', label: 'Vendas', icon: Handshake },
        { to: '/contas', label: 'Contas e bancos', icon: Landmark },
      ],
    },
    {
      title: 'Financeiro',
      items: [
        { to: '/receber', label: 'Contas a receber', icon: ArrowDownCircle },
        { to: '/pagar', label: 'Contas a pagar', icon: ArrowUpCircle },
      ],
    },
    {
      title: 'Análise',
      items: [
        { to: '/relatorios', label: 'Relatórios', icon: PieChart },
        { to: '/simulador', label: 'Simulador', icon: Calculator },
      ],
    },
    {
      title: 'Planejamento',
      items: [
        { to: '/objetivos', label: 'Objetivos', icon: Target },
        { to: '/metas', label: 'Orçamento', icon: Flag },
      ],
    },
    {
      title: 'Cadastros',
      items: [
        { to: '/contatos', label: 'Contatos', icon: Users },
        { to: '/ajuda', label: 'Ajuda', icon: BookOpen },
      ],
    },
  ],
  mobile: ['/', '/lancamentos', '/vendas', '/receber', '/pagar'],
}

const PESSOAL: Workspace = {
  id: 'pessoal',
  label: 'Pessoal',
  short: 'PF',
  icon: Wallet,
  home: '/pessoal',
  groups: [
    {
      title: null,
      items: [{ to: '/pessoal', label: 'Visão geral', icon: Gauge, end: true }],
    },
    {
      title: 'Dia a dia',
      items: [
        { to: '/pessoal/gastos', label: 'Gastos', icon: ShoppingBag },
        { to: '/pessoal/cartao', label: 'Cartão de crédito', icon: CreditCard },
        { to: '/pessoal/receber', label: 'A receber', icon: ArrowDownCircle },
        { to: '/pessoal/pagar', label: 'A pagar', icon: ArrowUpCircle },
      ],
    },
    {
      title: 'Riqueza',
      items: [
        { to: '/pessoal/patrimonio', label: 'Patrimônio', icon: Gem },
        { to: '/pessoal/renda', label: 'Renda e retiradas', icon: ArrowDownCircle },
        { to: '/pessoal/objetivos', label: 'Objetivos', icon: Target },
      ],
    },
    {
      title: 'Cadastros',
      items: [
        { to: '/pessoal/contas', label: 'Minhas contas', icon: Landmark },
        { to: '/pessoal/relatorios', label: 'Relatórios e IR', icon: FileText },
      ],
    },
  ],
  mobile: ['/pessoal', '/pessoal/gastos', '/pessoal/cartao', '/pessoal/receber', '/pessoal/pagar'],
}

export const WORKSPACES: Workspace[] = [EMPRESAS, PESSOAL]

export function workspaceOf(pathname: string): Workspace {
  return pathname === '/pessoal' || pathname.startsWith('/pessoal/') ? PESSOAL : EMPRESAS
}

export function mobileItems(ws: Workspace): NavItemDef[] {
  const flat = ws.groups.flatMap((g) => g.items)
  return ws.mobile.map((p) => flat.find((i) => i.to === p)).filter((i): i is NavItemDef => !!i)
}
