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
/*
 * Chave nova em 23/10/2026. A antiga ('sgf.theme') era gravada a cada abertura,
 * então TODO aparelho tinha 'dark' salvo sem ninguém ter escolhido. Esta só é
 * gravada quando a pessoa escolhe no menu — assim o padrão novo chega a todos.
 */
export const CHAVE_TEMA = 'sgf.tema'

/**
 * Escolha salva; se não houver, CLARO (a Mesa, decisão do Rafael em
 * 23/10/2026: "mais suave, minimalista, com cara de sistema financeiro").
 * O escuro continua inteiro, a um toque no menu. Não segue o sistema
 * operacional: o sistema tem uma cara só, a menos que a pessoa escolha outra.
 */
function initialTheme(): Theme {
  try {
    return localStorage.getItem(CHAVE_TEMA) === 'dark' ? 'dark' : 'light'
  } catch {
    /* sem localStorage */
  }
  return 'light'
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

  }, [theme])

  /** Só a escolha da pessoa grava; abrir o app não grava nada. */
  const escolher = useCallback((t: Theme) => {
    try {
      localStorage.setItem(CHAVE_TEMA, t)
    } catch {
      /* ignora */
    }
    setThemeState(t)
  }, [])
  const setTheme = escolher
  const toggle = useCallback(() => escolher(theme === 'dark' ? 'light' : 'dark'), [escolher, theme])
  const value = useMemo(() => ({ theme, toggle, setTheme }), [theme, toggle, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme deve ser usado dentro de <ThemeProvider>')
  return ctx
}
