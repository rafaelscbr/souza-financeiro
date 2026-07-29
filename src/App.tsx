import { Suspense, lazy, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { AppDataProvider } from '@/context/AppDataContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { FullPageLoader } from '@/components/ui/Spinner'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { carregarComRecuperacao } from '@/lib/chunkRecovery'

/** `lazy` que sobrevive a um deploy novo — ver lib/chunkRecovery. */
function lazyPage<T extends { default: React.ComponentType<any> }>(load: () => Promise<T>) {
  return lazy(() => carregarComRecuperacao(load))
}

// Páginas carregadas sob demanda (reduz o bundle inicial no mobile)
const DashboardPage = lazyPage(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const LancamentosPage = lazyPage(() =>
  import('@/pages/LancamentosPage').then((m) => ({ default: m.LancamentosPage })),
)
const FluxoCaixaPage = lazyPage(() =>
  import('@/pages/FluxoCaixaPage').then((m) => ({ default: m.FluxoCaixaPage })),
)
const RelatoriosPage = lazyPage(() =>
  import('@/pages/RelatoriosPage').then((m) => ({ default: m.RelatoriosPage })),
)
const ContatosPage = lazyPage(() =>
  import('@/pages/ContatosPage').then((m) => ({ default: m.ContatosPage })),
)
const MetasPage = lazyPage(() => import('@/pages/MetasPage').then((m) => ({ default: m.MetasPage })))
// Módulo pessoal: casca + telas, todas sob demanda
const PessoalLayout = lazyPage(() =>
  import('@/pages/pessoal/PessoalLayout').then((m) => ({ default: m.PessoalLayout })),
)
const VisaoGeralPage = lazyPage(() =>
  import('@/pages/pessoal/VisaoGeralPage').then((m) => ({ default: m.VisaoGeralPage })),
)
const GastosPage = lazyPage(() =>
  import('@/pages/pessoal/GastosPage').then((m) => ({ default: m.GastosPage })),
)
const CartaoPage = lazyPage(() =>
  import('@/pages/pessoal/CartaoPage').then((m) => ({ default: m.CartaoPage })),
)
const ReceberPage = lazyPage(() =>
  import('@/pages/pessoal/ReceberPage').then((m) => ({ default: m.ReceberPage })),
)
const PagarPessoalPage = lazyPage(() =>
  import('@/pages/pessoal/PagarPessoalPage').then((m) => ({ default: m.PagarPessoalPage })),
)
const PatrimonioPage = lazyPage(() =>
  import('@/pages/pessoal/PatrimonioPage').then((m) => ({ default: m.PatrimonioPage })),
)
const RendaPage = lazyPage(() =>
  import('@/pages/pessoal/RendaPage').then((m) => ({ default: m.RendaPage })),
)
const ContasPessoaisPage = lazyPage(() =>
  import('@/pages/pessoal/ContasPessoaisPage').then((m) => ({ default: m.ContasPessoaisPage })),
)
const RelatoriosPessoaisPage = lazyPage(() =>
  import('@/pages/pessoal/RelatoriosPessoaisPage').then((m) => ({
    default: m.RelatoriosPessoaisPage,
  })),
)
const VendasPage = lazyPage(() =>
  import('@/pages/VendasPage').then((m) => ({ default: m.VendasPage })),
)
const SimuladorPage = lazyPage(() =>
  import('@/pages/SimuladorPage').then((m) => ({ default: m.SimuladorPage })),
)
const ObjetivosPage = lazyPage(() =>
  import('@/pages/ObjetivosPage').then((m) => ({ default: m.ObjetivosPage })),
)
const ContasPage = lazyPage(() => import('@/pages/ContasPage').then((m) => ({ default: m.ContasPage })))
const AjudaPage = lazyPage(() => import('@/pages/AjudaPage').then((m) => ({ default: m.AjudaPage })))

/**
 * O app está rodando instalado na tela de início (PWA), e não numa aba do
 * navegador? `display-mode: standalone` cobre Android e desktop; iOS usa a
 * propriedade proprietária `navigator.standalone`.
 */
function isInstalledApp(): boolean {
  if (typeof window === 'undefined') return false
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return standalone || iosStandalone
}

/**
 * Rota inicial. Aberto pelo ícone do iPhone, o app cai direto no Pessoal — é
 * de lá que o dia a dia acontece; o painel das empresas é trabalho de mesa.
 *
 * O desvio vale só na ABERTURA: o módulo guarda que já redirecionou, então
 * tocar em "Painel" no menu depois disso mostra o painel de verdade, em vez de
 * jogar o usuário de volta para o Pessoal a cada toque.
 */
let entradaTratada = false

function RotaInicial() {
  const [irParaPessoal] = useState(() => {
    if (entradaTratada) return false
    entradaTratada = true
    return isInstalledApp()
  })
  return irParaPessoal ? <Navigate to="/pessoal" replace /> : <DashboardPage />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </ThemeProvider>
  )
}

function AuthGate() {
  const { session, loading } = useAuth()

  if (loading) return <FullPageLoader label="Carregando…" />
  if (!session) return <LoginPage />

  return (
    <AppDataProvider>
      <Suspense fallback={<FullPageLoader />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<RotaInicial />} />
            <Route path="/lancamentos" element={<LancamentosPage />} />
            <Route path="/vendas" element={<VendasPage />} />
            <Route path="/contas" element={<ContasPage />} />
            <Route path="/receber" element={<FluxoCaixaPage modo="receber" />} />
            <Route path="/pagar" element={<FluxoCaixaPage modo="pagar" />} />
            {/* rota antiga, mantida para links já salvos */}
            <Route path="/fluxo" element={<Navigate to="/receber" replace />} />
            <Route path="/relatorios" element={<RelatoriosPage />} />
            <Route path="/contatos" element={<ContatosPage />} />
            <Route path="/metas" element={<MetasPage />} />
            <Route path="/simulador" element={<SimuladorPage />} />
            <Route path="/objetivos" element={<ObjetivosPage />} />
            <Route path="/pessoal" element={<PessoalLayout />}>
              <Route index element={<VisaoGeralPage />} />
              <Route path="gastos" element={<GastosPage />} />
              <Route path="cartao" element={<CartaoPage />} />
              <Route path="receber" element={<ReceberPage />} />
              <Route path="pagar" element={<PagarPessoalPage />} />
              <Route path="patrimonio" element={<PatrimonioPage />} />
              <Route path="renda" element={<RendaPage />} />
              <Route path="contas" element={<ContasPessoaisPage />} />
              <Route path="relatorios" element={<RelatoriosPessoaisPage />} />
              <Route path="objetivos" element={<ObjetivosPage escopo="pessoal" />} />
            </Route>
            <Route path="/ajuda" element={<AjudaPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </AppDataProvider>
  )
}
