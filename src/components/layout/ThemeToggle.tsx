import { flushSync } from 'react-dom'
import { Moon, Sun } from 'lucide-react'
import { Icone } from '@/components/ui/Icone'
import { useTheme, type Theme } from '@/context/ThemeContext'
import { movimentoReduzido } from '@/lib/useMovimentoReduzido'
import { cn } from '@/lib/utils'

/*
 * TROCA DE TEMA (8.3).
 *
 * Com `document.startViewTransition` e sem movimento reduzido: crossfade da
 * raiz. Sem suporte (ou com movimento reduzido, 8.5): troca instantânea, com
 * `html.trocando-tema` por 1 quadro para nenhuma transição de cor correr no
 * meio da troca.
 *
 * A classe `light` é aplicada aqui, dentro do quadro da transição, e o
 * ThemeProvider a confirma depois (é idempotente): o efeito do provider roda
 * depois da pintura e ficaria fora do instantâneo "novo" da transição.
 */
type DocumentoComTransicao = Document & {
  startViewTransition?: (atualizar: () => void) => { ready: Promise<void> }
}

/* Crossfade da raiz em 200ms (8.1 `--dur-pagina`); o padrão do navegador é 250ms. */
const CROSSFADE = { duration: 200, easing: 'cubic-bezier(.2,0,0,1)' }

export function trocarTema(tema: Theme, aplicar: (t: Theme) => void): void {
  const raiz = document.documentElement
  const efetivar = () => {
    raiz.classList.toggle('light', tema === 'light')
    flushSync(() => aplicar(tema))
  }
  const doc = document as DocumentoComTransicao
  if (typeof doc.startViewTransition === 'function' && !movimentoReduzido()) {
    const transicao = doc.startViewTransition(efetivar)
    transicao.ready
      .then(() => {
        const opcoes = (pseudo: string) => ({ ...CROSSFADE, pseudoElement: pseudo }) as KeyframeAnimationOptions
        raiz.animate({ opacity: [1, 0] }, opcoes('::view-transition-old(root)'))
        raiz.animate({ opacity: [0, 1] }, opcoes('::view-transition-new(root)'))
      })
      .catch(() => {
        /* transição pulada: o tema já foi aplicado */
      })
    return
  }
  raiz.classList.add('trocando-tema')
  efetivar()
  requestAnimationFrame(() => raiz.classList.remove('trocando-tema'))
}

/** Hook: o tema atual e a troca com a coreografia de 8.3. */
export function useTrocaDeTema(): { tema: Theme; trocar: (t: Theme) => void } {
  const { theme, setTheme } = useTheme()
  return { tema: theme, trocar: (t) => trocarTema(t, setTheme) }
}

/**
 * DEPRECADO — apagar na limpeza final. Interruptor de ícone; a casca usa o
 * SeletorAparencia (duas opções com nome). Ninguém em src/ importa este botão.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { tema, trocar } = useTrocaDeTema()
  const escuro = tema === 'dark'
  return (
    <button
      type="button"
      onClick={() => trocar(escuro ? 'light' : 'dark')}
      className={cn(
        'flex size-10 items-center justify-center rounded-controle text-t2 transition-colors hover:bg-linha-hover hover:text-t1 active:bg-linha-press max-lg:size-11 [@media(pointer:coarse)]:size-11',
        className,
      )}
      aria-label={escuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={escuro ? 'Tema claro' : 'Tema escuro'}
    >
      <Icone icone={escuro ? Sun : Moon} tamanho={16} />
    </button>
  )
}
