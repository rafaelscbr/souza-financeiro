import { cn } from '@/lib/utils'

/*
 * Carregando.
 *
 * Sem brilho deslizante e sem pulsação: brilho sobre um valor que ainda não
 * carregou sugere atividade financeira que não existe, e nesta gramática
 * "tracejado" já significa "isto ainda não é um fato" — o carregando não pode
 * dividir desenho com um estado real, ou uma previsão passa a ser lida como
 * "espere, o número certo ainda vem".
 *
 * Então carregar é um fio estático no lugar da linha. Nada se move.
 */
export function Esqueleto({ className }: { className?: string }) {
  return <span className={cn('block h-px w-full bg-line', className)} aria-hidden />
}

export function ListaCarregando({ linhas = 4 }: { linhas?: number }) {
  return (
    <ul className="divide-y divide-line" aria-busy="true" aria-live="polite">
      <li className="sr-only">Carregando…</li>
      {Array.from({ length: linhas }).map((_, i) => (
        <li key={i} className="flex min-h-[3.5rem] items-center gap-3 py-2.5">
          <span className="h-6 w-6 shrink-0 rounded-marca border border-line" aria-hidden />
          <span className="flex-1 space-y-2">
            <Esqueleto className="max-w-[14rem]" />
            <Esqueleto className="max-w-[8rem]" />
          </span>
          <Esqueleto className="w-16 shrink-0" />
        </li>
      ))}
    </ul>
  )
}
