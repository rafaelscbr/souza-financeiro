import { cn } from '@/lib/utils'

/*
 * Spinner SÓ dentro de botão.
 *
 * O Souza OS proíbe spinner solto (seção 8, Esqueleto): um círculo girando no
 * meio da tela não diz o que vem nem quanto falta, e a tela pula de "nada" para
 * "tudo". Dentro de um botão é outra coisa: o rótulo ao lado continua dizendo o
 * que foi pedido e o giro só confirma que o banco ainda não respondeu. Como o
 * banco é a única fonte de verdade, o botão espera por ele em vez de fingir que
 * já salvou.
 *
 * `decorativo` tira o papel de status: quando o botão já anuncia `aria-busy`
 * (é o que o Button faz com `carregando`), um segundo "Carregando" dentro dele
 * só sujaria o nome acessível do botão.
 */
export function Spinner({
  className,
  rotulo = 'Carregando',
  decorativo = false,
}: {
  className?: string
  rotulo?: string
  decorativo?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
      {...(decorativo ? { 'aria-hidden': true } : { role: 'status', 'aria-label': rotulo })}
    />
  )
}

/* Um bloco de esqueleto. O brilho é o `.shimmer` da seção 7 (index.css). */
function Bloco({ className }: { className?: string }) {
  return <span aria-hidden className={cn('shimmer block rounded-md', className)} />
}

/*
 * Carregando uma tela inteira: esqueleto com a FORMA do que vem, na ordem da
 * composição típica da seção 6 (cabeçalho com IconeTom, hero, grade de KPIs,
 * lista). Quem espera já vê onde cada coisa vai cair, e a tela não pula quando
 * os números chegam.
 *
 * O rótulo continua existindo, só que para o leitor de tela: o esqueleto já diz
 * "carregando" para quem vê. Sob `prefers-reduced-motion` o brilho para (regra
 * global do index.css) e os blocos ficam parados no lugar.
 *
 * O quadro traz o próprio respiro (max-w-7xl e o padding do PageLayout) porque
 * também é montado antes de existir casca nenhuma, no portão do App. Dentro de
 * um <main> que já tem padding, passe `className="p-0 sm:p-0 lg:p-0"`.
 */
export function FullPageLoader({
  label = 'Carregando…',
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn('mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8', className)}
    >
      <span className="sr-only">{label}</span>

      {/* Cabeçalho: IconeTom md + título 19px + subtítulo, e o CTA à direita. */}
      <div className="flex items-center gap-3">
        <Bloco className="h-9 w-9 shrink-0 rounded-[11px]" />
        <div className="min-w-0 flex-1 space-y-2">
          <Bloco className="h-[18px] w-44 max-w-full" />
          <Bloco className="h-3 w-64 max-w-full" />
        </div>
        <Bloco className="hidden h-10 w-32 shrink-0 rounded-lg sm:block" />
      </div>

      {/* Hero: rótulo, o número que decide, barra de meta e três apoios. */}
      <div className="mt-6 rounded-[16px] border border-line p-5 shadow-card surface-premium sm:p-6">
        <Bloco className="h-3 w-28" />
        <Bloco className="mt-3 h-[34px] w-60 max-w-full" />
        <Bloco className="mt-5 h-1.5 w-full rounded-full" />
        <div className="mt-5 grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Bloco className="h-3 w-16 max-w-full" />
              <Bloco className="h-5 w-24 max-w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Indicadores: a mesma grade dos KPIs, ícone + rótulo, número e nota. */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-[14px] border border-line p-4 shadow-card surface-premium">
            <div className="flex items-center gap-2">
              <Bloco className="h-7 w-7 shrink-0 rounded-[9px]" />
              <Bloco className="h-3 w-20 max-w-full" />
            </div>
            <Bloco className="mt-3 h-7 w-28 max-w-full" />
            <Bloco className="mt-2 h-3 w-16 max-w-full" />
          </div>
        ))}
      </div>

      {/*
       * Lista: cabeçalho de coluna e linhas com ícone, duas linhas de texto e
       * valor à direita. Fundo `surface` e não `list-surface`: no escuro a lista
       * é surface-2, a mesma cor do bloco de esqueleto, e sem movimento (reduced
       * motion) as linhas sumiriam.
       */}
      <div className="mt-6 overflow-hidden rounded-xl border border-line card-surface">
        <div className="border-b border-line bg-s3/20 px-5 py-2.5">
          <Bloco className="h-3 w-24" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line px-5 py-3.5 last:border-0">
            <Bloco className="h-9 w-9 shrink-0 rounded-[11px]" />
            <div className="min-w-0 flex-1 space-y-2">
              <Bloco className="h-3.5 w-48 max-w-full" />
              <Bloco className="h-3 w-32 max-w-full" />
            </div>
            <Bloco className="h-4 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
