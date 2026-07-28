import { Suspense, lazy, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { AppDataProvider } from '@/context/AppDataContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { FullPageLoader } from '@/components/ui/Spinner'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'

// Páginas carregadas sob demanda (reduz o bundle inicial no mobile)
const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const LancamentosPage = lazy(() =>
  import('@/pages/LancamentosPage').then((m) => ({ default: m.LancamentosPage })),
)
const FluxoCaixaPage = lazy(() =>
  import('@/pages/FluxoCaixaPage').then((m) => ({ default: m.FluxoCaixaPage })),
)
const RelatoriosPage = lazy(() =>
  import('@/pages/RelatoriosPage').then((m) => ({ default: m.RelatoriosPage })),
)
const ContatosPage = lazy(() =>
  import('@/pages/ContatosPage').then((m) => ({ default: m.ContatosPage })),
)
const MetasPage = lazy(() => import('@/pages/MetasPage').then((m) => ({ default: m.MetasPage })))
const PessoalPage = lazy(() => import('@/pages/PessoalPage').then((m) => ({ default: m.PessoalPage })))
const VendasPage = lazy(() =>
  import('@/pages/VendasPage').then((m) => ({ default: m.VendasPage })),
)
const SimuladorPage = lazy(() =>
  import('@/pages/SimuladorPage').then((m) => ({ default: m.SimuladorPage })),
)
const ObjetivosPage = lazy(() =>
  import('@/pages/ObjetivosPage').then((m) => ({ default: m.ObjetivosPage })),
)
const ContasPage = lazy(() => import('@/pages/ContasPage').then((m) => ({ default: m.ContasPage })))
const AjudaPage = lazy(() => import('@/pages/AjudaPage').then((m) => ({ default: m.AjudaPage })))

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
            <Route path="/fluxo" element={<FluxoCaixaPage />} />
            <Route path="/relatorios" element={<RelatoriosPage />} />
            <Route path="/contatos" element={<ContatosPage />} />
            <Route path="/metas" element={<MetasPage />} />
            <Route path="/simulador" element={<SimuladorPage />} />
            <Route path="/objetivos" element={<ObjetivosPage />} />
            <Route path="/pessoal" element={<PessoalPage />} />
            <Route path="/ajuda" element={<AjudaPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </AppDataProvider>
  )
}
