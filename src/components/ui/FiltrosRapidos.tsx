import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FiltroRapido<T extends string = string> {
  id: T
  rotulo: string
  /** Quantos itens o filtro mostra. Omitido, a pílula não tem contador. */
  contador?: number
  icone?: LucideIcon
  /** O porquê do filtro, no `title` (ex.: "já recebido da construtora e não repassado"). */
  dica?: string
}

export interface FiltrosRapidosProps<T extends string> {
  filtros: FiltroRapido<T>[]
  ativo: T
  aoMudar: (id: T) => void
  /** Nome do grupo para o leitor de tela ("Filtrar comissões"). */
  rotuloAcessivel: string
  className?: string
}

/*
 * Filtros rápidos (Souza OS, seção 8): pílulas `rounded-full` com contador; a
 * ativa preenchida em --brand-fill; contador zero esmaecido.
 *
 * O contador é o que faz a pílula valer o clique: "Atrasadas 0" já responde a
 * pergunta sem abrir nada. Por isso o zero não some, só esmaece.
 *
 * Botões com `aria-pressed` num `role="group"`: cada pílula é uma parada de
 * Tab, o que numa faixa curta de filtros é mais previsível do que setas. A
 * faixa rola na horizontal no celular, sem empurrar a página.
 *
 * A pílula desenhada tem 36px, que é o que cabe numa faixa de cabeçalho; o
 * `after:` estica a área de toque 4px para cima e para baixo, até 44px, sem
 * mudar o desenho. O `py-1` da faixa existe para essa área não ser recortada.
 */
export function FiltrosRapidos<T extends string>({
  filtros,
  ativo,
  aoMudar,
  rotuloAcessivel,
  className,
}: FiltrosRapidosProps<T>) {
  return (
    <div
      role="group"
      aria-label={rotuloAcessivel}
      className={cn('flex items-center gap-2 overflow-x-auto py-1', className)}
    >
      {filtros.map((f) => {
        const selecionado = f.id === ativo
        const Icone = f.icone
        const zero = f.contador === 0
        return (
          <button
            key={f.id}
            type="button"
            aria-pressed={selecionado}
            aria-label={f.contador != null ? `${f.rotulo}, ${f.contador}` : undefined}
            title={f.dica}
            onClick={() => aoMudar(f.id)}
            className={cn(
              'relative inline-flex min-h-[36px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px]',
              'after:absolute after:inset-x-0 after:-inset-y-1',
              'transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand/40',
              selecionado
                ? 'border-transparent bg-brand-fill font-semibold text-brand-fill-text'
                : 'border-line bg-surface/60 font-medium text-t2 hover:border-line-strong hover:bg-s2 hover:text-t1',
            )}
          >
            {Icone && <Icone aria-hidden strokeWidth={1.6} className="h-[13px] w-[13px] shrink-0" />}
            <span>{f.rotulo}</span>
            {f.contador != null && (
              <span
                aria-hidden
                className={cn(
                  'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none tabular-nums',
                  selecionado
                    ? zero
                      ? 'text-brand-fill-text/70'
                      : 'bg-brand-fill-text/10 text-brand-fill-text'
                    : zero
                      ? 'text-t4'
                      : 'bg-s3/60 text-t3',
                )}
              >
                {f.contador.toLocaleString('pt-BR')}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
