import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Os tamanhos de texto próprios (tailwind.config.js → fontSize) precisam ser
// declarados, senão o tailwind-merge os lê como cor e descarta a classe de
// cor ou a de tamanho quando as duas passam juntas pelo cn().
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'numero-heroi', 'numero-heroi-m', 'numero-kpi', 'numero-kpi-m',
            'titulo-pagina', 'titulo-pagina-m', 'titulo-painel', 'titulo-secao',
            'valor-destaque', 'valor-linha', 'valor-fato',
            'texto-titulo', 'texto', 'texto-corrido', 'texto-meta', 'nota',
            'rotulo', 'chip', 'botao', 'botao-secundario',
          ],
        },
      ],
    },
  },
})

/** Combina classes Tailwind resolvendo conflitos. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
