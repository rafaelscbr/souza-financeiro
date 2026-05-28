import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { ToastProvider } from '@/components/ui/toast'
import { AppLayout } from '@/components/layout/AppLayout'

// Pages
import { LoginPage } from '@/pages/auth/LoginPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { SalesPage } from '@/pages/sales/SalesPage'
import { NewSalePage } from '@/pages/sales/NewSalePage'
import { SaleDetailPage } from '@/pages/sales/SaleDetailPage'
import { DevelopmentsPage } from '@/pages/developments/DevelopmentsPage'
import { BrokersPage } from '@/pages/brokers/BrokersPage'
import { ReceivablesPage } from '@/pages/financials/ReceivablesPage'
import { PayablesPage } from '@/pages/financials/PayablesPage'
import { CommissionsPage } from '@/pages/commissions/CommissionsPage'
import { SimulatorPage } from '@/pages/simulator/SimulatorPage'
import { BudgetsPage } from '@/pages/budgets/BudgetsPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
})

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-base">SF</span>
          </div>
          <div className="h-1 w-32 bg-muted rounded-full overflow-hidden">
            <div className="h-1 bg-primary rounded-full animate-[pulse_1.5s_ease-in-out_infinite] w-2/3" />
          </div>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { setUser, setSession, setLoading } = useAuthStore()

  useEffect(() => {
    // Initialize theme from localStorage or system preference
    const saved = localStorage.getItem('theme')
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
    }

    // Auth listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected */}
            <Route element={<AuthGuard><AppLayout /></AuthGuard>}>
              <Route index element={<DashboardPage />} />
              <Route path="vendas" element={<SalesPage />} />
              <Route path="vendas/nova" element={<NewSalePage />} />
              <Route path="vendas/:id" element={<SaleDetailPage />} />
              <Route path="empreendimentos" element={<DevelopmentsPage />} />
              <Route path="corretores" element={<BrokersPage />} />
              <Route path="receber" element={<ReceivablesPage />} />
              <Route path="pagar" element={<PayablesPage />} />
              <Route path="comissoes" element={<CommissionsPage />} />
              <Route path="simulador" element={<SimulatorPage />} />
              <Route path="orcamentos" element={<BudgetsPage />} />
              <Route path="relatorios" element={<ReportsPage />} />
              <Route path="configuracoes" element={<SettingsPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
