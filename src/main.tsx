import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ligarAnimar } from './lib/animar'
import './index.css'

// 8.2: .animar só com a aba visível e sem movimento reduzido.
ligarAnimar()

/*
 * PUBLIQUEI E O RAFAEL CONTINUOU VENDO O DESIGN VELHO (21/09/2026).
 *
 * O app é PWA: o service worker guarda os arquivos e, mesmo configurado para
 * se atualizar sozinho, a PÁGINA JÁ ABERTA continua com o css e o js que ela
 * carregou. O novo só aparecia no segundo recarregamento — e quem está usando
 * não tem como adivinhar isso.
 *
 * Agora, no instante em que o service worker novo assume o controle, a página
 * se recarrega uma vez. A trava evita laço se o evento disparar de novo.
 */
if ('serviceWorker' in navigator) {
  let recarregando = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregando) return
    recarregando = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
