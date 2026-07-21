import { Suspense, lazy } from 'react'
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
            <Route path="/" element={<DashboardPage />} />
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
