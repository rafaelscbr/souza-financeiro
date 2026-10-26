import { Download, Printer } from 'lucide-react'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { Button } from '@/components/ui/Button'
import { baixarPlanilha, imprimirRelatorio, type Celula } from '@/lib/exportar'
import { FiltrosRapidos } from '@/components/ui/FiltrosRapidos'
import type { TipoPeriodo } from '@/lib/dre'
import { formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

/*
 * As peças comuns aos relatórios (DRE e Fluxo de caixa): o filtro de período
 * e a conta escrita de cima para baixo. Os dois relatórios se leem do mesmo
 * jeito — quem aprendeu um, lê o outro.
 */

/**
 * Os dois botões de exportar (Fase 6): planilha e PDF. A planilha é montada na
 * hora do clique, das mesmas linhas que a tela desenha — o total do arquivo é
 * o da tela.
 */
export function ExportarRelatorio({
  nome,
  planilha,
}: {
  nome: string
  planilha: () => { cabecalho: string[]; linhas: Celula[][] }
}) {
  return (
    <div data-nao-imprimir className="flex items-center gap-2">
      <Button
        variant="secundario"
        size="sm"
        icone={Download}
        onClick={() => {
          const p = planilha()
          baixarPlanilha(nome, p.cabecalho, p.linhas)
        }}
      >
        Planilha
      </Button>
      <Button variant="secundario" size="sm" icone={Printer} onClick={imprimirRelatorio}>
        PDF
      </Button>
    </div>
  )
}

export function FiltrosDePeriodo({ ativo, aoMudar }: { ativo: TipoPeriodo; aoMudar: (t: TipoPeriodo) => void }) {
  return (
    <FiltrosRapidos
      rotuloAcessivel="Período"
      ativo={ativo}
      aoMudar={aoMudar}
      filtros={[
        { id: 'mes', rotulo: 'Mês' },
        { id: 'trimestre', rotulo: 'Trimestre' },
        { id: 'ano', rotulo: 'Ano' },
        { id: 'acumulado', rotulo: 'No ano até aqui', dica: 'De janeiro até o mês escolhido.' },
      ]}
    />
  )
}

/**
 * A variação contra o período anterior, em palavras. Resultado e saldo se
 * comparam com sinal (de +6.500 para −4.000 "virou negativo", nunca "caiu
 * 39%"); custo se compara pelo tamanho (despesa de 5 mil para 7 mil "subiu").
 */
export function variacaoEmPalavras(agora: number, antes: number, custo = false): string {
  if (antes === 0) return agora === 0 ? 'igual' : 'não havia no período anterior'
  if (!custo && antes > 0 && agora < 0) return 'virou negativo'
  if (!custo && antes < 0 && agora >= 0) return 'virou positivo'
  const v = custo ? (Math.abs(agora) - Math.abs(antes)) / Math.abs(antes) : (agora - antes) / Math.abs(antes)
  if (Math.abs(v) < 0.005) return 'igual'
  return `${v > 0 ? 'subiu' : 'caiu'} ${formatPercent(Math.abs(v), 0)}`
}

/** O mínimo que uma linha precisa para entrar na conta. */
export interface LinhaDaConta {
  id: string
  rotulo: string
  /** `conta` recua; `subtotal` e `resultado` ganham fio acima e peso. */
  tipo: 'grupo' | 'conta' | 'subtotal' | 'resultado'
  valor: number
}

/**
 * O RELATÓRIO EM TABELA (Souza 2.0, 24/10/2026).
 *
 * A conta de cima para baixo, como num demonstrativo de verdade: coluna do
 * período, peso sobre a receita (`base`) e, com `comparar`, o período
 * anterior e a variação. Grupo em negrito, conta recuada, subtotal e
 * resultado com fio acima. Dedução leva o sinal de menos e fica na cor do
 * texto — vermelho só para resultado negativo, não para toda subtração.
 * Valor zero não abre: botão que abre folha vazia é promessa quebrada.
 */
export function ContaDoRelatorio<L extends LinhaDaConta>({
  linhas,
  base,
  emPalavras,
  aoAbrir,
  rotuloAcessivel,
  rotuloAtual = 'Período',
  comparar,
}: {
  linhas: L[]
  base?: number
  emPalavras: Record<string, string>
  aoAbrir: (l: L) => void
  rotuloAcessivel: string
  /** O nome da coluna do período ("out/2026"). */
  rotuloAtual?: string
  /** O período anterior, para as colunas de comparação. */
  comparar?: { rotulo: string; valores: Map<string, number> }
}) {
  const comBase = base !== undefined
  const th = 'h-10 whitespace-nowrap border-b border-fio-caixa px-3 font-medium text-t4 text-nota first:pl-recuo last:pr-recuo'
  return (
    <div data-rolagem="" className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse">
        <caption className="sr-only">{rotuloAcessivel}</caption>
        <thead>
          <tr>
            <th scope="col" className={cn(th, 'text-left')}>
              Conta
            </th>
            <th scope="col" className={cn(th, 'text-right')}>
              {rotuloAtual}
            </th>
            {comBase && (
              <th scope="col" className={cn(th, 'text-right max-sm:hidden')}>
                % receita
              </th>
            )}
            {comparar && (
              <>
                <th scope="col" className={cn(th, 'text-right max-md:hidden')}>
                  {comparar.rotulo}
                </th>
                <th scope="col" className={cn(th, 'text-right max-md:hidden')}>
                  Variação
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const total = l.tipo === 'subtotal' || l.tipo === 'resultado'
            const conta = l.tipo === 'conta'
            const resultado = l.tipo === 'resultado'
            const nome = l.rotulo.replace('(−) ', '').replace('(+) ', '')
            const antes = comparar?.valores.get(l.id) ?? 0
            const v = comparar ? variacaoRelativa(l.valor, antes) : null
            const td = cn(
              'px-3 py-2.5 align-middle first:pl-recuo last:pr-recuo',
              total ? 'border-t border-fio-caixa' : 'border-t border-fio-linha',
              resultado && 'bg-s2',
            )
            return (
              <tr key={l.id}>
                <th scope="row" className={cn(td, 'text-left font-normal')}>
                  <span className={cn('flex min-w-0 flex-col', conta && 'pl-5')}>
                    <span
                      className={cn(
                        conta ? 'text-t3 text-texto' : 'text-t1 text-texto-titulo',
                        (total || l.tipo === 'grupo') && 'font-semibold',
                      )}
                    >
                      {l.rotulo}
                    </span>
                    {!conta && emPalavras[l.id] && <span className="text-t-meta text-nota max-sm:hidden">{emPalavras[l.id]}</span>}
                  </span>
                </th>
                <td className={cn(td, 'text-right')}>
                  <span className="flex justify-end">
                    {l.valor === 0 ? (
                      <Valor valor={0} posto="linha" forte={total} />
                    ) : (
                      <ValorComOrigem
                        valor={l.valor}
                        posto={resultado ? 'destaque' : 'linha'}
                        forte={total || l.tipo === 'grupo'}
                        estado={total && l.valor < 0 ? 'negativo' : undefined}
                        rotuloAcessivel={`Ver os lançamentos de ${nome}`}
                        aoAbrir={() => aoAbrir(l)}
                      />
                    )}
                  </span>
                </td>
                {comBase && (
                  <td className={cn(td, 'num text-right text-t-meta text-texto-meta max-sm:hidden')}>
                    {base > 0 && l.valor !== 0 ? formatPercent(Math.abs(l.valor) / base, 1) : '—'}
                  </td>
                )}
                {comparar && (
                  <>
                    <td className={cn(td, 'text-right max-md:hidden')}>
                      <span className="flex justify-end">
                        <Valor valor={antes} posto="fato" />
                      </span>
                    </td>
                    <td className={cn(td, 'text-right max-md:hidden')}>
                      {v == null ? (
                        <span className="text-t5 text-texto-meta">—</span>
                      ) : (
                        <span
                          className={cn(
                            'num inline-flex h-5 items-center rounded-badge px-1.5 text-chip',
                            v.melhor === null ? 'bg-s3 text-t3' : v.melhor ? 'bg-success-bg text-success-ink' : 'bg-error-bg text-error-ink',
                          )}
                        >
                          {v.texto}
                        </span>
                      )}
                    </td>
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * A variação de uma linha com sinal: valores do DRE já vêm com sinal (custo
 * negativo), então "subir" é sempre melhor. Sem base anterior, sem variação.
 */
function variacaoRelativa(agora: number, antes: number): { texto: string; melhor: boolean | null } | null {
  if (Math.abs(antes) < 0.01) return agora === 0 ? null : { texto: 'novo', melhor: null }
  const v = (agora - antes) / Math.abs(antes)
  const pct = Math.round(v * 100)
  if (pct === 0) return { texto: '0%', melhor: null }
  return { texto: `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`, melhor: agora > antes }
}

ContaDoRelatorio.displayName = 'ContaDoRelatorio'
