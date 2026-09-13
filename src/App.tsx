import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/auth/AuthContext'
import { LoginPage, NovaSenhaPage, SemAcessoPage } from '@/auth/LoginPage'
import { ThemeProvider } from '@/context/ThemeContext'
import { DensidadeProvider } from '@/context/DensidadeContext'
import { ToastProvider } from '@/components/ui/Toast'
import { FullPageLoader } from '@/components/ui/Spinner'
import { carregarComRecuperacao } from '@/lib/chunkRecovery'

/**
 * Duas aplicações, um login.
 *
 * O papel do perfil decide qual delas carrega, e cada uma tem o seu contexto
 * de dados: o do administrador enxerga a imobiliária inteira; o do corretor só
 * chama funções que filtram pelo contato dele. Não existe rota compartilhada
 * entre os dois, e é por isso que não existe caminho para o corretor cair numa
 * tela de administrador por acidente.
 *
 * A proteção que vale, porém, é a do banco (migração 007): aqui é conveniência
 * de interface.
 */
function pagina<T extends { default: React.ComponentType<any> }>(load: () => Promise<T>) {
  return lazy(() => carregarComRecuperacao(load))
}

const AdminShell = pagina(() => import('@/admin/AdminShell').then((m) => ({ default: m.AdminShell })))
const AdminInicio = pagina(() => import('@/admin/pages/Inicio').then((m) => ({ default: m.Inicio })))
const AdminVendas = pagina(() => import('@/admin/pages/Vendas').then((m) => ({ default: m.Vendas })))
const AdminVenda = pagina(() => import('@/admin/pages/Venda').then((m) => ({ default: m.Venda })))
const AdminReceber = pagina(() => import('@/admin/pages/Receber').then((m) => ({ default: m.Receber })))
const AdminPagar = pagina(() => import('@/admin/pages/Pagar').then((m) => ({ default: m.Pagar })))
const AdminDespesas = pagina(() => import('@/admin/pages/Despesas').then((m) => ({ default: m.Despesas })))
const AdminCorretores = pagina(() =>
  import('@/admin/pages/Corretores').then((m) => ({ default: m.Corretores })),
)
const AdminRelatorios = pagina(() =>
  import('@/admin/pages/Relatorios').then((m) => ({ default: m.Relatorios })),
)
const AdminConfig = pagina(() => import('@/admin/pages/Config').then((m) => ({ default: m.Config })))
const AdminDataProvider = pagina(() =>
  import('@/admin/AdminData').then((m) => ({ default: m.AdminDataProvider })),
)

const CorretorShell = pagina(() =>
  import('@/corretor/CorretorShell').then((m) => ({ default: m.CorretorShell })),
)
const CorretorInicio = pagina(() =>
  import('@/corretor/pages/Inicio').then((m) => ({ default: m.CorretorInicio })),
)
const MinhasVendas = pagina(() =>
  import('@/corretor/pages/MinhasVendas').then((m) => ({ default: m.MinhasVendas })),
)
const MinhaVenda = pagina(() =>
  import('@/corretor/pages/MinhasVendas').then((m) => ({ default: m.MinhaVenda })),
)
const Recebimentos = pagina(() =>
  import('@/corretor/pages/Recebimentos').then((m) => ({ default: m.Recebimentos })),
)
const CorretorDataProvider = pagina(() =>
  import('@/corretor/CorretorData').then((m) => ({ default: m.CorretorDataProvider })),
)

export default function App() {
  return (
    <ThemeProvider>
      {/* Aparência e densidade são preferências do aparelho, então valem antes
          do login: a tela de entrada já abre no tema e no ar escolhidos. */}
      <DensidadeProvider>
        <AuthProvider>
          <Portao />
        </AuthProvider>
      </DensidadeProvider>
    </ThemeProvider>
  )
}

function Portao() {
  const { estado, profile } = useAuth()

  if (estado === 'carregando') return <FullPageLoader label="Carregando…" />
  if (estado === 'recuperando_senha') return <NovaSenhaPage />
  if (estado === 'deslogado') return <LoginPage />
  if (estado === 'sem_perfil') return <SemAcessoPage />

  return (
    <ToastProvider>
      <Suspense fallback={<FullPageLoader />}>
        {profile?.role === 'admin' ? <AppAdministrador /> : <AppCorretor />}
      </Suspense>
    </ToastProvider>
  )
}

function AppAdministrador() {
  return (
    <AdminDataProvider>
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
          <Route path="/config" element={<AdminConfig />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AdminDataProvider>
  )
}

function AppCorretor() {
  return (
    <CorretorDataProvider>
      <Routes>
        <Route element={<CorretorShell />}>
          <Route path="/" element={<CorretorInicio />} />
          <Route path="/minhas-vendas" element={<MinhasVendas />} />
          <Route path="/minhas-vendas/:id" element={<MinhaVenda />} />
          <Route path="/recebimentos" element={<Recebimentos />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </CorretorDataProvider>
  )
}
