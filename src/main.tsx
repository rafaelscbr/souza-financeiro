import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ligarAnimar } from './lib/animar'
import './index.css'

// 8.2: .animar só com a aba visível e sem movimento reduzido.
ligarAnimar()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
