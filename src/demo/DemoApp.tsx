import { Suspense, useMemo, useState, type ContextType, type ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthContext } from '@/auth/AuthContext'
import { LoginPage, NovaSenhaPage, SemAcessoPage } from '@/auth/LoginPage'
import { TrocarSenha } from '@/auth/TrocarSenha'
import { AdminContext } from '@/admin/AdminData'
import { Ctx as CorretorContext } from '@/corretor/CorretorData'
import { AdminShell } from '@/admin/AdminShell'
import { Inicio as AdminInicio } from '@/admin/pages/Inicio'
import { Vendas as AdminVendas } from '@/admin/pages/Vendas'
import { Venda as AdminVenda } from '@/admin/pages/Venda'
import { Receber as AdminReceber } from '@/admin/pages/Receber'
import { Pagar as AdminPagar } from '@/admin/pages/Pagar'
import { Despesas as AdminDespesas } from '@/admin/pages/Despesas'
import { Corretores as AdminCorretores } from '@/admin/pages/Corretores'
import { Relatorios as AdminRelatorios } from '@/admin/pages/Relatorios'
import { Simulacao as AdminSimulacao } from '@/admin/pages/Simulacao'
import { Config as AdminConfig } from '@/admin/pages/Config'
import { CorretorShell } from '@/corretor/CorretorShell'
import { CorretorInicio } from '@/corretor/pages/Inicio'
import { MinhaVenda, MinhasVendas } from '@/corretor/pages/MinhasVendas'
import { Recebimentos } from '@/corretor/pages/Recebimentos'
import { FullPageLoader } from '@/components/ui/Spinner'
import { toDateOnly } from '@/lib/format'
import { attentionOf, buildSaleViews, payablesOf, receivablesOf } from '@/lib/sales'
import { ERRO_VITRINE } from './semBanco'
import * as fx from './fixtures'
import { painelCorretor, parcelasCorretor, vendasCorretor } from './corretor'

type AuthValue = NonNullable<ContextType<typeof AuthContext>>
type AdminValue = NonNullable<ContextType<typeof AdminContext>>
type CorretorValue = NonNullable<ContextType<typeof CorretorContext>>

export type Perfil = 'admin' | 'corretor'
export type TelaAvulsa = 'login' | 'nova-senha' | 'sem-acesso' | 'trocar-senha' | null

/** Toda escrita da vitrine termina aqui: mesmo caminho de erro da tela, nada gravado. */
async function semBanco(): Promise<never> {
  throw new Error(ERRO_VITRINE)
}

function useAuthFalso(perfil: Perfil, estado: AuthValue['estado']): AuthValue {
  return useMemo<AuthValue>(
    () => ({
      estado,
      session: null,
      profile:
        perfil === 'admin'
          ? { id: 'us-admin', role: 'admin', contact_id: null, name: 'Rafael Exemplo', is_active: true }
          : { id: 'us-ana', role: 'corretor', contact_id: fx.CORRETORA_ID, name: 'Corretor Exemplo', is_active: true },
      email: perfil === 'admin' ? 'admin@exemplo.local' : 'corretor@exemplo.local',
      entrar: async () => ({ erro: ERRO_VITRINE }),
      sair: async () => {},
      pedirRecuperacao: async () => ({ erro: ERRO_VITRINE }),
      definirSenha: async () => ({ erro: ERRO_VITRINE }),
      recarregarPerfil: async () => {},
    }),
    [perfil, estado],
  )
}

function inicioDoMes(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/** O mesmo formato de AdminDataProvider, com as mesmas funções de src/lib para os derivados. */
function AdminFalso({ children }: { children: ReactNode }) {
  const [mes, setMes] = useState<Date>(inicioDoMes())
  const hoje = toDateOnly(new Date())

  const vendas = useMemo(
    () =>
      buildSaleViews({
        sales: fx.sales, installments: fx.installments, costCenters: fx.costCenters,
        contacts: fx.contacts, transactions: fx.transactions, today: hoje,
      }),
    [hoje],
  )
  const receber = useMemo(() => receivablesOf(fx.transactions, vendas, hoje), [vendas, hoje])
  const pagar = useMemo(() => payablesOf(fx.transactions, vendas, hoje), [vendas, hoje])
  const atencao = useMemo(() => attentionOf({ vendas, receber, pagar, today: hoje }), [vendas, receber, pagar, hoje])
  const contatosComAcesso = useMemo(
    () => new Set(fx.usuarios.filter((u) => u.is_active && u.contact_id).map((u) => u.contact_id as string)),
    [],
  )

  const value = useMemo<AdminValue>(
    () => ({
      company: fx.company, sales: fx.sales, installments: fx.installments, transactions: fx.transactions,
      accounts: fx.accounts, contacts: fx.contacts, categories: fx.categories, costCenters: fx.costCenters,
      developers: fx.developers,
      transfers: fx.transfers, usuarios: fx.usuarios,
      vendas, receber, pagar, atencao, contatosComAcesso,
      mes, hoje,
      irParaMes: (d) => setMes(inicioDoMes(d)),
      mesAnterior: () => setMes((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1)),
      mesSeguinte: () => setMes((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)),
      carregando: false,
      erro: null,
      recarregar: async () => {},
      registrarVenda: semBanco, receberParcela: semBanco, desfazerRecebimento: semBanco,
      pagarComissoes: semBanco, reagendarParcela: semBanco, cancelarVenda: semBanco, editarVenda: semBanco,
      criarLancamento: semBanco, baixarLancamento: semBanco, estornarLancamento: semBanco,
      excluirLancamento: semBanco, salvarContato: semBanco, salvarConta: semBanco,
      salvarEmpreendimento: semBanco, salvarConstrutora: semBanco, salvarCategoria: semBanco, salvarImposto: semBanco,
      salvarAcesso: semBanco,
      marcarGatilho: semBanco, marcarNota: async () => { await semBanco(); return null },
    }),
    [vendas, receber, pagar, atencao, contatosComAcesso, mes, hoje],
  )
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

/** O mesmo formato de CorretorDataProvider. */
function CorretorFalso({ children }: { children: ReactNode }) {
  const [ano, setAno] = useState(new Date().getFullYear())
  const hoje = toDateOnly(new Date())
  const anosDisponiveis = useMemo(() => {
    const anos = new Set<number>([new Date().getFullYear()])
    for (const v of vendasCorretor) anos.add(Number(v.sale_date.slice(0, 4)))
    for (const p of parcelasCorretor) anos.add(Number(p.expected_date.slice(0, 4)))
    return [...anos].sort((a, b) => b - a)
  }, [])
  const value = useMemo<CorretorValue>(
    () => ({
      painel: painelCorretor(ano, hoje), vendas: vendasCorretor, parcelas: parcelasCorretor,
      ano, anosDisponiveis, setAno, carregando: false, erro: null, recarregar: async () => {},
    }),
    [ano, hoje, anosDisponiveis],
  )
  return <CorretorContext.Provider value={value}>{children}</CorretorContext.Provider>
}

function AppAdministrador() {
  return (
    <AdminFalso>
      <Routes>
        <Route element={<AdminShell />}>
          <Route path="/" element={<AdminInicio />} />
          <Route path="/vendas" element={<AdminVendas />} />
          <Route path="/vendas/:id" element={<AdminVenda />} />
          <Route path="/receber" element={<AdminReceber />} />
          <Route path="/pagar" element={<AdminPagar />} />
          <Route path="/despesas" element={<AdminDespesas />} />
          <Route path="/corretores" element={<AdminCorretores />} />
          <Route path="/relatorios" element={<AdminRelatorios />} />
          <Route path="/simulacao" element={<AdminSimulacao />} />
          <Route path="/config" element={<AdminConfig />} />
          {/* O administrador também é corretor (035): as telas dele, aqui dentro. */}
          <Route
            element={
              <CorretorFalso>
                <Outlet />
              </CorretorFalso>
            }
          >
            <Route path="/minhas-comissoes" element={<CorretorInicio />} />
            <Route path="/minhas-vendas" element={<MinhasVendas />} />
            <Route path="/minhas-vendas/:id" element={<MinhaVenda />} />
            <Route path="/recebimentos" element={<Recebimentos />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AdminFalso>
  )
}

function AppCorretor() {
  return (
    <CorretorFalso>
      <Routes>
        <Route element={<CorretorShell />}>
          <Route path="/" element={<CorretorInicio />} />
          <Route path="/minhas-vendas" element={<MinhasVendas />} />
          <Route path="/minhas-vendas/:id" element={<MinhaVenda />} />
          <Route path="/recebimentos" element={<Recebimentos />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </CorretorFalso>
  )
}

/** Troca de senha aberta por cima do app do perfil escolhido. */
function ComTrocaDeSenha({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(true)
  return (
    <>
      {children}
      <TrocarSenha aberto={aberto} onFechar={() => setAberto(false)} />
    </>
  )
}

/**
 * A porta da vitrine, no lugar do Portao de App.tsx: em vez de perguntar ao
 * banco quem entrou, a query string diz qual perfil e qual tela.
 */
export function DemoApp({ perfil, tela }: { perfil: Perfil; tela: TelaAvulsa }) {
  const estado: AuthValue['estado'] =
    tela === 'login' ? 'deslogado' : tela === 'nova-senha' ? 'recuperando_senha' : tela === 'sem-acesso' ? 'sem_perfil' : 'pronto'
  const auth = useAuthFalso(perfil, estado)

  let conteudo: ReactNode
  if (tela === 'login') conteudo = <LoginPage />
  else if (tela === 'nova-senha') conteudo = <NovaSenhaPage />
  else if (tela === 'sem-acesso') conteudo = <SemAcessoPage />
  else {
    const app = perfil === 'admin' ? <AppAdministrador /> : <AppCorretor />
    conteudo = tela === 'trocar-senha' ? <ComTrocaDeSenha>{app}</ComTrocaDeSenha> : app
  }

  return (
    <AuthContext.Provider value={auth}>
      <Suspense fallback={<FullPageLoader />}>{conteudo}</Suspense>
    </AuthContext.Provider>
  )
}
