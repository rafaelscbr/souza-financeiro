import { useLayoutEffect, useRef, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { Button } from '@/components/ui/Button'
import { baixarPlanilha, imprimirRelatorio, type Celula } from '@/lib/exportar'
import { FiltrosRapidos } from '@/components/ui/FiltrosRapidos'
import type { TipoPeriodo } from '@/lib/dre'
import { formatPercent } from '@/lib/format'
import { moedaCurta } from '@/components/graficos/Graficos'
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
  const th = 'h-10 whitespace-nowrap border-b border-fio-caixa px-3 font-medium text-t-meta text-nota first:pl-recuo last:pr-recuo'
  return (
    <div data-rolagem="" className="min-w-0 overflow-x-auto">
      <table className="w-full border-collapse md:min-w-[34rem]">
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
                            'num font-medium text-texto-meta',
                            v.melhor === null ? 'text-t-meta' : v.melhor ? 'text-success-ink' : 'text-error-ink',
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

/* ------------------------------------------------------------------------ */
/* DOZE MESES (Souza 3.0, 02/11/2026)                                       */
/* ------------------------------------------------------------------------ */

/*
 * O caixa de cada um dos últimos 12 meses, pela data do dinheiro: o que
 * entrou (marinho, o dado principal), o que saiu (cinza) e, por cima, a
 * linha do que sobrou (tinta). Embaixo, quando a largura deixa, o razão com
 * os números de cada mês na coluna do seu ponto — como no Caixa previsto do
 * Início. Passar o mouse mostra o balão; tocar num mês abre os lançamentos.
 * Os números chegam prontos (lib/painel.ts, `evolucaoMensal`).
 */
export interface MesDoFluxo {
  chave: string
  rotulo: string
  titulo: string
  entra: number
  sai: number
  resultado: number
}

const ESQ_12 = 72
const DIR_12 = 4
const TOPO_12 = 12
const BASE_12 = 28

function escalaDoze(valores: number[]): { min: number; max: number; marcas: number[] } {
  const lo = Math.min(0, ...valores)
  let hi = Math.max(0, ...valores)
  if (hi === lo) hi = lo + 1000
  const bruto = (hi - lo) / 4
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(bruto, 1))))
  const passo = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= bruto) ?? 10 * mag
  const min = Math.floor(lo / passo) * passo
  const max = Math.ceil(hi / passo) * passo
  const marcas: number[] = []
  for (let v = min; v <= max + passo / 2; v += passo) marcas.push(Math.round(v))
  return { min, max, marcas }
}

const doisDigitos = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function GraficoDozeMeses({
  meses,
  aoClicar,
  rotuloAcessivel,
}: {
  meses: MesDoFluxo[]
  aoClicar: (i: number) => void
  rotuloAcessivel: string
}) {
  const caixa = useRef<HTMLDivElement>(null)
  const [largura, setLargura] = useState(720)
  const [ativo, setAtivo] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = caixa.current
    if (!el) return
    const medir = () => setLargura(Math.max(260, el.clientWidth))
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const estreito = largura < 560
  const alto = estreito ? 210 : 270
  const { min, max, marcas } = escalaDoze(meses.flatMap((m) => [m.entra, m.sai, m.resultado]))
  // A margem do eixo cabe o maior rótulo ("−R$ 10 mil"), para nada vazar à esquerda.
  const esq = Math.max(ESQ_12 - 24, Math.ceil(Math.max(...marcas.map((v) => moedaCurta(v).length)) * 6.8) + 14)
  const passoX = (largura - esq - DIR_12) / Math.max(meses.length, 1)
  const x = (i: number) => esq + (i + 0.5) * passoX
  const y = (v: number) => TOPO_12 + (1 - (v - min) / (max - min || 1)) * (alto - TOPO_12 - BASE_12)
  const barra = Math.max(4, Math.min(18, passoX * 0.27))
  const zero = y(0)
  const linha = meses.map((m, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(m.resultado).toFixed(1)}`).join(' ')
  // No celular, um rótulo a cada três meses; o mês do fim sempre aparece.
  const pulo = passoX < 34 ? 3 : passoX < 52 ? 2 : 1
  const mostraRotulo = (i: number) => (meses.length - 1 - i) % pulo === 0
  // O razão embaixo só quando cada mês tem largura para "−00.000,00".
  const comRazao = passoX >= 80

  const m = ativo != null ? meses[ativo] : null
  const esquerdaDoBalao = ativo != null ? Math.min(Math.max(x(ativo), 104), largura - 104) : 0

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div ref={caixa} className="relative min-w-0" onMouseLeave={() => setAtivo(null)}>
        <svg role="img" aria-label={rotuloAcessivel} width="100%" height={alto} viewBox={`0 0 ${largura} ${alto}`} className="block">
          {marcas.map((v) => (
            <g key={v}>
              <line
                x1={esq}
                x2={largura - DIR_12}
                y1={y(v)}
                y2={y(v)}
                stroke={v === 0 ? 'var(--line-strong)' : 'var(--g-grade)'}
                strokeWidth={1}
              />
              <text x={esq - 10} y={y(v) + 4} textAnchor="end" fontSize={12} fill="var(--g-eixo)" className="num">
                {moedaCurta(v)}
              </text>
            </g>
          ))}
          {meses.map((mes, i) => (
            <g key={mes.chave}>
              {ativo === i && (
                <rect x={x(i) - passoX / 2 + 2} y={TOPO_12 - 6} width={passoX - 4} height={alto - TOPO_12 - BASE_12 + 6} rx={4} fill="var(--s2)" />
              )}
              {mes.entra > 0 && (
                <rect
                  x={x(i) - barra - 1.5}
                  y={y(mes.entra)}
                  width={barra}
                  height={Math.max(1, zero - y(mes.entra))}
                  rx={2}
                  fill="var(--g-entra)"
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: 'bottom',
                    animation: `crescer var(--dur-contagem) var(--curva-entra) ${i * 35}ms backwards`,
                  }}
                />
              )}
              {mes.sai > 0 && (
                <rect
                  x={x(i) + 1.5}
                  y={y(mes.sai)}
                  width={barra}
                  height={Math.max(1, zero - y(mes.sai))}
                  rx={2}
                  fill="var(--g-sai)"
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: 'bottom',
                    animation: `crescer var(--dur-contagem) var(--curva-entra) ${i * 35 + 20}ms backwards`,
                  }}
                />
              )}
              {mostraRotulo(i) && (
                <text
                  x={x(i)}
                  y={alto - 8}
                  textAnchor="middle"
                  fontSize={12}
                  fill={ativo === i ? 'var(--t1)' : 'var(--g-eixo)'}
                  fontWeight={ativo === i ? 600 : 400}
                >
                  {mes.rotulo}
                </text>
              )}
            </g>
          ))}
          <path d={linha} fill="none" stroke="var(--g-resultado)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
          {meses.map((mes, i) => (
            <g
              key={`ponto-${mes.chave}`}
              onMouseEnter={() => setAtivo(i)}
              onClick={() => aoClicar(i)}
              className="cursor-pointer"
            >
              <circle
                cx={x(i)}
                cy={y(mes.resultado)}
                r={ativo === i ? 4.5 : 3}
                fill="var(--surface)"
                stroke={mes.resultado < 0 ? 'var(--error)' : 'var(--g-resultado)'}
                strokeWidth={1.75}
              />
              <rect x={x(i) - passoX / 2} y={0} width={passoX} height={alto} fill="transparent" />
            </g>
          ))}
        </svg>
        {m && ativo != null && (
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 z-popover flex min-w-[12rem] -translate-x-1/2 flex-col gap-1 rounded-controle bg-t1 px-3 py-2 text-nota text-white shadow-dropdown"
            style={{ left: esquerdaDoBalao, animation: 'esmaeceEntra var(--dur-micro) var(--curva-entra)' }}
          >
            <span className="font-semibold">{m.titulo}</span>
            <span className="flex justify-between gap-4 text-white/70">
              entrou <Valor valor={m.entra} posto="fato" tinta="text-white" />
            </span>
            <span className="flex justify-between gap-4 text-white/70">
              saiu <Valor valor={-m.sai} posto="fato" tinta="text-white" />
            </span>
            <span className="flex justify-between gap-4 text-white/70">
              sobrou <Valor valor={m.resultado} posto="fato" tinta="font-semibold text-white" />
            </span>
          </div>
        )}
      </div>

      {comRazao && (
        <table className="w-full table-fixed border-collapse" aria-label="O que entrou, saiu e sobrou em cada mês">
          <colgroup>
            <col style={{ width: esq }} />
            {meses.map((mes) => (
              <col key={mes.chave} />
            ))}
            <col style={{ width: DIR_12 }} />
          </colgroup>
          <tbody>
            {(
              [
                ['Entrou', 'entra', ''],
                ['Saiu', 'sai', '−'],
                ['Sobrou', 'resultado', ''],
              ] as const
            ).map(([rotulo, k, sinal]) => (
              <tr key={k}>
                <th scope="row" className="border-t border-fio-linha py-2 text-left font-normal text-t-meta text-nota">
                  {rotulo}
                </th>
                {meses.map((mes, i) => {
                  const v = mes[k]
                  const sobra = k === 'resultado'
                  return (
                    <td
                      key={mes.chave}
                      onMouseEnter={() => setAtivo(i)}
                      onMouseLeave={() => setAtivo(null)}
                      className={cn(
                        'num border-t border-fio-linha py-2 text-center text-nota',
                        v === 0
                          ? 'text-t5'
                          : sobra && v < 0
                            ? 'text-error-ink'
                            : ativo === i || sobra
                              ? 'text-t1'
                              : 'text-t3',
                        sobra && 'font-medium',
                      )}
                    >
                      {v === 0 ? '—' : `${sinal}${v < 0 ? '−' : ''}${doisDigitos(Math.abs(v))}`}
                    </td>
                  )
                })}
                <td className="border-t border-fio-linha" />
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
