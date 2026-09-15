import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Kit } from './Kit'
import { ToastProvider } from '@/components/ui/Toast'
import { ligarAnimar } from '@/lib/animar'
import '../index.css'

// 8.2: .animar só com a aba visível e sem movimento reduzido (igual ao app).
ligarAnimar()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter>
      <ToastProvider>
        <Kit />
      </ToastProvider>
    </MemoryRouter>
  </StrictMode>,
)
