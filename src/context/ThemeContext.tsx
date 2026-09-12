import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'sgf.theme'

/**
 * Preferência salva; se não houver, ESCURO.
 *
 * Não segue o sistema operacional de propósito. O escuro é a identidade deste
 * produto — é o tema do CRM que a imobiliária já usa todo dia — e abrir claro
 * num Mac configurado em claro faria o financeiro parecer outro sistema. Quem
 * preferir claro troca no menu, e a escolha fica salva no aparelho.
 */
function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* sem localStorage */
  }
  return 'dark'
}

interface ThemeValue {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    // A barra do navegador/PWA acompanha o tema.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#070B1A' : '#EBEFF6')
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* ignora */
    }
  }, [theme])

  const setTheme = useCallback((t: Theme) => setThemeState(t), [])
  const toggle = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), [])

  return <ThemeContext.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme deve ser usado dentro de <ThemeProvider>')
  return ctx
}
