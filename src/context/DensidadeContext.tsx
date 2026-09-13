import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Densidade = 'confortavel' | 'compacta'
const KEY = 'sgf.densidade'

/**
 * Densidade das listas: "Confortável / Compacta" (docs/souza-os.md, seção 9).
 *
 * Muda só o ar da linha, nunca esconde informação. O efeito inteiro é uma
 * regra de CSS (`html.compacta .lista-linha`), então nenhuma tela precisa ler
 * este contexto para ficar compacta: basta a linha ter a classe `lista-linha`.
 * Quem lê o contexto é só o seletor que troca a preferência.
 *
 * Preferência do aparelho, e não do banco: é conforto de leitura de quem está
 * segurando a tela, não um dado da imobiliária. Padrão confortável; só o valor
 * 'compacta' salvo liga a classe, e o anti-flash do index.html faz o mesmo
 * antes de o React carregar.
 */
function densidadeInicial(): Densidade {
  try {
    return localStorage.getItem(KEY) === 'compacta' ? 'compacta' : 'confortavel'
  } catch {
    /* sem localStorage */
  }
  return 'confortavel'
}

interface DensidadeValue {
  densidade: Densidade
  setDensidade: (d: Densidade) => void
}

const DensidadeContext = createContext<DensidadeValue | null>(null)

export function DensidadeProvider({ children }: { children: ReactNode }) {
  const [densidade, setDensidadeState] = useState<Densidade>(densidadeInicial)

  useEffect(() => {
    document.documentElement.classList.toggle('compacta', densidade === 'compacta')
    try {
      localStorage.setItem(KEY, densidade)
    } catch {
      /* ignora */
    }
  }, [densidade])

  const setDensidade = useCallback((d: Densidade) => setDensidadeState(d), [])
  const value = useMemo(() => ({ densidade, setDensidade }), [densidade, setDensidade])

  return <DensidadeContext.Provider value={value}>{children}</DensidadeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDensidade() {
  const ctx = useContext(DensidadeContext)
  if (!ctx) throw new Error('useDensidade deve ser usado dentro de <DensidadeProvider>')
  return ctx
}
