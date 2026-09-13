import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'sgf.theme'

/**
 * Preferência salva; se não houver, ESCURO.
 *
 * Não segue o sistema operacional de propósito. O escuro é o padrão da casa
 * (docs/souza-os.md, seção 2) — é o tema do iCRM que a imobiliária já usa todo
 * dia — e abrir claro num Mac configurado em claro faria o financeiro parecer
 * outro sistema. Quem preferir claro troca no menu, e a escolha fica salva.
 *
 * O valor salvo continua 'light' | 'dark', o mesmo de antes da troca de
 * mecanismo, então não há migração: quem tinha escolhido claro continua claro.
 */
function initialTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
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
    // O mecanismo do guia: `:root` é o escuro, a classe `html.light` é o claro.
    root.classList.toggle('light', theme === 'light')

    /*
     * A barra do navegador/PWA acompanha o fundo da página. Lida do próprio
     * token --page-bg, e não de um hex repetido aqui: se o fundo mudar no CSS,
     * a barra muda junto. (O anti-flash do index.html precisa do hex porque
     * roda antes de o CSS existir.)
     */
    const fundo = getComputedStyle(root).getPropertyValue('--page-bg').trim()
    if (fundo) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', fundo)

    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* ignora */
    }
  }, [theme])

  const setTheme = useCallback((t: Theme) => setThemeState(t), [])
  const toggle = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), [])
  const value = useMemo(() => ({ theme, toggle, setTheme }), [theme, toggle, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme deve ser usado dentro de <ThemeProvider>')
  return ctx
}
