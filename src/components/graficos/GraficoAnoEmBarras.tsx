import { formatCurrency, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'

/*
 * O ANO EM BARRAS (Souza 3.0, 02/11/2026): uma coluna por mês, empilhada de
 * baixo para cima no que já caiu (marinho, o dado principal), no que está
 * liberado (tinta) e no que é previsão (cinza). Tocar num mês abre as
 * parcelas dele. As barras sobem ao abrir; o mês corrente fica em negrito.
 */
export interface MesDoAno {
  chave: string
  rotulo: string
  nome: string
  recebida: number
  liberada: number
  prevista: number
}

export function GraficoAnoEmBarras<M extends MesDoAno>({ meses, aoAbrir }: { meses: M[]; aoAbrir: (m: M) => void }) {
  const total = (m: MesDoAno) => m.recebida + m.liberada + m.prevista
  const max = Math.max(1, ...meses.map(total))
  const mesAtual = toDateOnly(new Date()).slice(0, 7)
  return (
    <div className="flex h-[250px] items-end gap-1.5 sm:gap-2" role="list" aria-label="Comissão por mês">
      {meses.map((m, i) => {
        const t = total(m)
        const partes = [
          { v: m.prevista, cor: 'var(--g-sai)' },
          { v: m.liberada, cor: 'var(--t2)' },
          { v: m.recebida, cor: 'var(--g-entra)' },
        ]
        return (
          <button
            key={m.chave}
            type="button"
            role="listitem"
            onClick={() => aoAbrir(m)}
            aria-label={`${m.nome}: ${formatCurrency(t)}`}
            title={`${m.nome}: ${formatCurrency(t)}`}
            className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
          >
            <span
              className="flex w-full max-w-[36px] origin-bottom flex-col justify-end overflow-hidden rounded-t-kbd transition-opacity group-hover:opacity-80"
              style={{
                height: t > 0 ? `${Math.max(3, (t / max) * 210)}px` : '2px',
                background: t > 0 ? undefined : 'var(--line-strong)',
                animation: `crescer var(--dur-contagem) var(--curva-entra) ${i * 35}ms backwards`,
              }}
            >
              {partes.map((x, k) => (x.v > 0 ? <span key={k} style={{ flexGrow: x.v, background: x.cor }} /> : null))}
            </span>
            <span className={cn('text-nota', m.chave === mesAtual ? 'font-semibold text-t1' : 'text-t4')}>{m.rotulo}</span>
          </button>
        )
      })}
    </div>
  )
}
