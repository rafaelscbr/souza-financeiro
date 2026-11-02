import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMovimentoReduzido } from '@/lib/useMovimentoReduzido'
import { Valor } from '@/components/ui/Valor'
import { cn } from '@/lib/utils'
import { moedaCurta } from './Graficos'

/*
 * CAIXA PREVISTO (Souza 3.0, 02/11/2026) — o gráfico-assinatura do Início.
 *
 * A pergunta: "vou ter dinheiro sem venda nova?". A resposta é a linha do
 * saldo no fim de cada mês, no marinho da Souza (o único dado com cor na
 * tela). A evidência fica embaixo, como num livro-razão: o que entra e o que
 * sai em cada mês, com cada número na coluna do seu ponto.
 *
 * A linha não começa no zero de propósito: a pergunta é a VARIAÇÃO do saldo.
 * Se algum mês fica negativo, o zero entra na escala e ganha uma linha forte.
 * A linha se desenha ao abrir (700ms); passar o mouse num mês mostra o balão;
 * clicar abre a composição daquele mês.
 */

export interface MesDoCaixa {
  rotulo: string
  titulo: string
  entra: number
  sai: number
  saldoFim: number
}

const ALTO = 290
const ALTO_CEL = 200
const ESQ = 64
const DIR = 8
const TOPO = 12
const BASE = 26

function escala(valores: number[]): { min: number; max: number; marcas: number[] } {
  let lo = Math.min(...valores)
  let hi = Math.max(...valores)
  if (lo > 0 && lo / Math.max(hi, 1) < 0.35) lo = 0
  if (hi === lo) {
    hi += Math.max(1000, Math.abs(hi) * 0.1)
    lo -= Math.max(1000, Math.abs(lo) * 0.1)
  }
  const bruto = (hi - lo) / 3
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(bruto, 1))))
  const passo = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= bruto) ?? 10 * mag
  const min = Math.floor(lo / passo) * passo
  const max = Math.ceil(hi / passo) * passo
  const marcas: number[] = []
  for (let v = min; v <= max + passo / 2; v += passo) marcas.push(Math.round(v))
  return { min, max, marcas }
}

export function GraficoCaixaPrevisto({
  meses,
  aoClicar,
  rotuloAcessivel,
}: {
  meses: MesDoCaixa[]
  aoClicar?: (i: number) => void
  rotuloAcessivel: string
}) {
  const caixa = useRef<HTMLDivElement>(null)
  const linha = useRef<SVGPathElement>(null)
  const [largura, setLargura] = useState(700)
  const [ativo, setAtivo] = useState<number | null>(null)
  const reduzido = useMovimentoReduzido()

  useLayoutEffect(() => {
    const el = caixa.current
    if (!el) return
    const medir = () => setLargura(Math.max(280, el.clientWidth))
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const alto = largura < 520 ? ALTO_CEL : ALTO
  const { min, max, marcas } = escala(meses.map((m) => m.saldoFim))
  const passoX = (largura - ESQ - DIR) / Math.max(meses.length, 1)
  const x = (i: number) => ESQ + (i + 0.5) * passoX
  const y = (v: number) => TOPO + (1 - (v - min) / (max - min || 1)) * (alto - TOPO - BASE)
  const d = meses.map((m, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(m.saldoFim).toFixed(1)}`).join(' ')

  // A linha se desenha quando os dados mudam (outro mês, uma baixa).
  const chave = meses.map((m) => m.saldoFim).join('|')
  useEffect(() => {
    const p = linha.current
    if (!p || reduzido) return
    const L = p.getTotalLength()
    p.style.transition = 'none'
    p.style.strokeDasharray = `${L}`
    p.style.strokeDashoffset = `${L}`
    p.getBoundingClientRect()
    p.style.transition = 'stroke-dashoffset 700ms var(--curva-entra)'
    p.style.strokeDashoffset = '0'
  }, [chave, reduzido])

  const m = ativo != null ? meses[ativo] : null

  return (
    <div className="flex flex-col">
      <div className="px-recuo">
      <div ref={caixa} className="relative" onMouseLeave={() => setAtivo(null)}>
        <svg
          role="img"
          aria-label={rotuloAcessivel}
          width="100%"
          height={alto}
          viewBox={`0 0 ${largura} ${alto}`}
          className="block overflow-visible"
        >
          {marcas.map((v) => (
            <g key={v}>
              <line
                x1={ESQ}
                x2={largura - DIR}
                y1={y(v)}
                y2={y(v)}
                stroke={v === 0 && min < 0 ? 'var(--t5)' : 'var(--g-grade)'}
                strokeWidth={1}
              />
              <text x={ESQ - 10} y={y(v) + 4} textAnchor="end" fontSize={12} fill="var(--g-eixo)" className="num">
                {moedaCurta(v)}
              </text>
            </g>
          ))}
          {meses.map((mes, i) => (
            <text key={mes.rotulo + i} x={x(i)} y={alto - 6} textAnchor="middle" fontSize={12} fill="var(--g-eixo)">
              {mes.rotulo}
            </text>
          ))}
          <path
            ref={linha}
            d={d}
            fill="none"
            stroke="var(--g-entra)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {meses.map((mes, i) => (
            <g
              key={i}
              onMouseEnter={() => setAtivo(i)}
              onClick={() => aoClicar?.(i)}
              className={aoClicar ? 'cursor-pointer' : undefined}
            >
              <line
                x1={x(i)}
                x2={x(i)}
                y1={TOPO}
                y2={alto - BASE}
                stroke="var(--line-input)"
                strokeDasharray="3 3"
                style={{ opacity: ativo === i ? 1 : 0, transition: 'opacity var(--dur-micro)' }}
              />
              <circle
                cx={x(i)}
                cy={y(mes.saldoFim)}
                r={ativo === i ? 5 : 3.5}
                fill="var(--surface)"
                stroke={mes.saldoFim < 0 ? 'var(--error)' : 'var(--g-entra)'}
                strokeWidth={2}
                style={{ transition: 'r var(--dur-micro)' }}
              />
              <rect x={x(i) - passoX / 2} y={0} width={passoX} height={alto} fill="transparent" />
            </g>
          ))}
        </svg>
        {m && ativo != null && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-popover -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-controle bg-t1 px-3 py-2 text-nota text-white shadow-dropdown"
            style={{
              left: x(ativo),
              top: y(m.saldoFim) - 12,
              animation: 'esmaeceEntra var(--dur-micro) var(--curva-entra)',
            }}
          >
            <Valor valor={m.saldoFim} posto="fato" tinta="font-semibold text-white" />
            <span className="text-white/70"> no fim de {m.titulo.toLowerCase()}</span>
            <br />
            <span className="text-white/70">
              entra <Valor valor={m.entra} posto="fato" tinta="text-white/70" /> · sai{' '}
              <Valor valor={m.sai} posto="fato" tinta="text-white/70" />
            </span>
          </div>
        )}
      </div>
      </div>

      {/* O razão: as colunas caem embaixo dos pontos (margem + eixo à esquerda, folga à direita). */}
      <table className="mb-3 mt-1 w-full table-fixed max-sm:hidden" aria-label="O que entra e o que sai em cada mês">
        <colgroup>
          <col style={{ width: `calc(var(--recuo) + ${ESQ}px)` }} />
          {meses.map((_, i) => (
            <col key={i} />
          ))}
          <col style={{ width: `calc(var(--recuo) + ${DIR}px)` }} />
        </colgroup>
        <tbody>
          {(
            [
              ['Entra', 'entra', '+'],
              ['Sai', 'sai', '−'],
            ] as const
          ).map(([rot, k, sinal], j) => (
            <tr key={k}>
              <th scope="row" className={cn('py-2 ps-recuo text-left font-normal text-t4 text-texto-meta', j && 'border-t border-fio-linha')}>
                {rot}
              </th>
              {meses.map((mes, i) => (
                <td
                  key={i}
                  className={cn(
                    'num py-2 text-center text-texto-meta transition-colors duration-micro',
                    j && 'border-t border-fio-linha',
                    mes[k] === 0 ? 'text-t5' : ativo === i ? 'text-t1' : 'text-t3',
                  )}
                >
                  {mes[k] === 0 ? '—' : `${sinal}${mes[k].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </td>
              ))}
              <td className={cn(j && 'border-t border-fio-linha')} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
