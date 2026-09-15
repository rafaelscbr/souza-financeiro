/*
 * VITRINE DE TELAS (demo.html) — só em desenvolvimento.
 *
 * As telas REAIS (src/admin/pages, src/corretor/pages, dentro de AdminShell e
 * CorretorShell) com dados de exemplo, sem login e sem banco. vite.config só
 * põe index.html no build; demo.html, como kit.html, só existe no `vite` de dev.
 *
 * URLs (servidor em http://localhost:5173):
 *   Administrador
 *     /demo.html?perfil=admin#/
 *     /demo.html?perfil=admin#/vendas
 *     /demo.html?perfil=admin#/vendas/venda-exemplo-mar-1204   (outras: venda-exemplo-parque-803,
 *        venda-exemplo-vista-1502, venda-exemplo-mar-305, venda-exemplo-parque-1101 (cancelada),
 *        venda-exemplo-vista-402 (sem corretor, sem VGV))
 *     /demo.html?perfil=admin#/receber   #/pagar   #/despesas   #/corretores   #/relatorios   #/config
 *   Corretor ("Corretor Exemplo", ligado a Ana Corretora Exemplo)
 *     /demo.html?perfil=corretor#/
 *     /demo.html?perfil=corretor#/minhas-vendas
 *     /demo.html?perfil=corretor#/minhas-vendas/venda-exemplo-mar-1204
 *     /demo.html?perfil=corretor#/recebimentos
 *   Telas avulsas
 *     /demo.html?tela=login          /demo.html?tela=nova-senha     /demo.html?tela=sem-acesso
 *     /demo.html?tela=trocar-senha&perfil=admin#/config  (modal aberto por cima do app)
 *   Também valem #/login e #/trocar-senha no lugar de ?tela=.
 *
 * Tema: localStorage 'sgf.theme' = 'dark' | 'light' (igual ao app). Nada grava:
 * toda ação termina no erro "vitrine: sem banco" (ver semBanco.ts).
 */
import './semBanco'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ThemeProvider } from '@/context/ThemeContext'
import { DensidadeProvider } from '@/context/DensidadeContext'
import { ToastProvider } from '@/components/ui/Toast'
import { ligarAnimar } from '@/lib/animar'
import { desligarCliente } from './semBanco'
import { DemoApp, type Perfil, type TelaAvulsa } from './DemoApp'
import '../index.css'

desligarCliente(supabase)
ligarAnimar()

const busca = new URLSearchParams(window.location.search)
const perfil: Perfil = busca.get('perfil') === 'corretor' ? 'corretor' : 'admin'
const TELAS: TelaAvulsa[] = ['login', 'nova-senha', 'sem-acesso', 'trocar-senha']
const pelaHash = window.location.hash.replace(/^#\/?/, '').split(/[?/]/)[0]
const pedida = busca.get('tela') ?? pelaHash
const tela: TelaAvulsa = TELAS.includes(pedida as TelaAvulsa) ? (pedida as TelaAvulsa) : null
if (tela && pelaHash === tela) window.location.hash = '#/'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ThemeProvider>
        <DensidadeProvider>
          <ToastProvider>
            <DemoApp perfil={perfil} tela={tela} />
          </ToastProvider>
        </DensidadeProvider>
      </ThemeProvider>
    </HashRouter>
  </StrictMode>,
)
