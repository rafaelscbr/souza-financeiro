import { useState } from 'react'
import { Settings, LogOut, Moon, Sun, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { useNavigate } from 'react-router-dom'
import { useToastActions } from '@/components/ui/toast'

export function SettingsPage() {
  const navigate = useNavigate()
  const toast = useToastActions()
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'))

  function toggleDark() {
    const next = !darkMode
    setDarkMode(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div>
      <PageHeader title="Configurações" description="Preferências do sistema" />

      <div className="px-4 md:px-6 pb-8 space-y-4">
        {/* Appearance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Aparência</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {darkMode ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-amber-500" />}
                <div>
                  <p className="text-sm font-medium text-foreground">Modo {darkMode ? 'Escuro' : 'Claro'}</p>
                  <p className="text-xs text-muted-foreground">Trocar tema da interface</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={toggleDark}>
                Alternar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* System info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" /> Sobre o sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sistema</span>
              <span className="text-foreground font-medium">Souza Financeiro</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Versão</span>
              <span className="text-foreground font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Banco de dados</span>
              <span className="text-foreground font-medium">Supabase</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Foco</span>
              <span className="text-foreground font-medium">Vendas de lançamentos</span>
            </div>
          </CardContent>
        </Card>

        {/* Future integrations */}
        <Card className="border-dashed">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-foreground mb-1">Integração iCRM</p>
            <p className="text-xs text-muted-foreground">
              Em breve — sincronização automática de vendas entre o iCRM e o Souza Financeiro.
              Quando um lead fechar no iCRM, a venda será criada automaticamente aqui.
            </p>
          </CardContent>
        </Card>

        {/* Logout */}
        <Card className="border-destructive/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Sair da conta</p>
                <p className="text-xs text-muted-foreground">Encerra sua sessão</p>
              </div>
              <Button variant="destructive" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
