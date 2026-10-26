import { useEffect, useState, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts'
import { Valor } from '@/components/ui/Valor'

/*
 * O SISTEMA DE GRÁFICOS (Souza 2.0, 23/10/2026).
 *
 * Uma biblioteca só (recharts, já no projeto), um jeito só de desenhar:
 * grade horizontal fina, eixos sem linha, valores em reais compactos no eixo
 * ("R$ 20 mil") e cheios no balão, legenda escrita fora do gráfico pela tela.
 * As cores vêm dos tokens (--g-entra, --g-sai, --g-resultado), lidas do tema
 * na hora — trocar o tema troca o gráfico.
 *
 * Todo gráfico responde uma pergunta e abre o que soma: `aoClicar` recebe o
 * índice do ponto, e a tela abre os lançamentos dele.
 */

export interface CoresDoGrafico {
  entra: string
  sai: string
  resultado: string
  grade: string
  eixo: string
  superficie: string
  sucesso: string
  risco: string
  marca: string
  suave: string
}

function lerCores(): CoresDoGrafico {
  const css = getComputedStyle(document.documentElement)
  const v = (nome: string) => css.getPropertyValue(nome).trim()
  return {
    entra: v('--g-entra'),
    sai: v('--g-sai'),
    resultado: v('--g-resultado'),
    grade: v('--g-grade'),
    eixo: v('--g-eixo'),
    superficie: v('--surface'),
    sucesso: v('--success'),
    risco: v('--error'),
    marca: v('--brand'),
    suave: v('--serie-suave'),
  }
}

/** As cores do tema, relidas quando a classe do <html> muda (claro ↔ escuro). */
export function useCoresDoGrafico(): CoresDoGrafico {
  const [cores, setCores] = useState(lerCores)
  useEffect(() => {
    const obs = new MutationObserver(() => setCores(lerCores()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return cores
}

/** "R$ 12,3 mil", "R$ 1,2 mi": o eixo não precisa de centavo. */
export function moedaCurta(v: number): string {
  const a = Math.abs(v)
  const sinal = v < 0 ? '−' : ''
  if (a >= 1_000_000) return `${sinal}R$ ${(a / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (a >= 1_000) return `${sinal}R$ ${(a / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return `${sinal}R$ ${a.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

const EIXO = { fontSize: 12, fontFamily: 'Inter, system-ui, sans-serif' }

/* ------------------------------------------------------------------ balão */

interface ItemDoBalao {
  nome: string
  valor: number
  cor: string
  forte?: boolean
}

function Balao({ titulo, itens }: { titulo: ReactNode; itens: ItemDoBalao[] }) {
  return (
    <div className="min-w-[13rem] rounded-controle border border-fio-caixa bg-surface px-3 py-2.5 shadow-dropdown">
      <p className="mb-1.5 font-medium text-t1 text-texto-meta">{titulo}</p>
      <ul className="flex flex-col gap-1">
        {itens.map((i) => (
          <li key={i.nome} className="flex items-center gap-2 text-texto-meta">
            <span aria-hidden className="size-2 shrink-0 rounded-ponto" style={{ background: i.cor }} />
            <span className="flex-1 text-t3">{i.nome}</span>
            <Valor valor={i.valor} posto="fato" forte={i.forte} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/* -------------------------------------------------------------- legenda */

/** A legenda fica fora do SVG: texto de verdade, legível e traduzível. */
export function Legenda({ itens }: { itens: { nome: string; cor: string; linha?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {itens.map((i) => (
        <li key={i.nome} className="flex items-center gap-1.5 text-t4 text-nota">
          {i.linha ? (
            <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: i.cor }} />
          ) : (
            <span aria-hidden className="size-2 rounded-ponto" style={{ background: i.cor }} />
          )}
          {i.nome}
        </li>
      ))}
    </ul>
  )
}

/** A legenda da composição: cor, nome, % e valor, uma linha por fatia. */
export function LegendaDeComposicao({ itens }: { itens: { nome: string; valor: number; pct: number; cor: string }[] }) {
  return (
    <ul className="flex w-full flex-col gap-2.5">
      {itens.map((f) => (
        <li key={f.nome} className="flex items-center gap-2.5 text-texto-meta">
          <span aria-hidden className="size-2 shrink-0 rounded-ponto" style={{ background: f.cor }} />
          <span className="flex-1 text-t3">{f.nome}</span>
          <span className="num w-10 text-right text-t4">{f.pct}%</span>
          <Valor valor={f.valor} posto="fato" forte />
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------- evolução: barras + linha */

export interface PontoDaEvolucao {
  rotulo: string
  /** O título do balão ("outubro de 2026"). */
  titulo: string
  entra: number
  sai: number
  resultado: number
}

export function GraficoEvolucao({
  pontos,
  nomes,
  rotuloAcessivel,
  aoClicar,
  altura = 280,
}: {
  pontos: PontoDaEvolucao[]
  nomes: { entra: string; sai: string; resultado: string }
  rotuloAcessivel: string
  aoClicar?: (i: number) => void
  altura?: number
}) {
  const c = useCoresDoGrafico()
  return (
    <div role="img" aria-label={rotuloAcessivel} style={{ height: altura }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={pontos}
          margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
          barGap={3}
          barCategoryGap="28%"
          onClick={(e) => {
            if (aoClicar && e && typeof e.activeTooltipIndex === 'number') aoClicar(e.activeTooltipIndex)
          }}
          style={{ cursor: aoClicar ? 'pointer' : undefined }}
        >
          <CartesianGrid vertical={false} stroke={c.grade} />
          <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ ...EIXO, fill: c.eixo }} dy={6} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={72}
            tick={{ ...EIXO, fill: c.eixo }}
            tickFormatter={moedaCurta}
          />
          <ReferenceLine y={0} stroke={c.grade} />
          <Tooltip
            cursor={{ fill: c.grade, opacity: 0.6 }}
            content={(p: TooltipProps<number, string>) => {
              const d = p.payload?.[0]?.payload as PontoDaEvolucao | undefined
              if (!p.active || !d) return null
              return (
                <Balao
                  titulo={d.titulo}
                  itens={[
                    { nome: nomes.entra, valor: d.entra, cor: c.entra },
                    { nome: nomes.sai, valor: d.sai, cor: c.sai },
                    { nome: nomes.resultado, valor: d.resultado, cor: c.resultado, forte: true },
                  ]}
                />
              )
            }}
          />
          <Bar dataKey="entra" name={nomes.entra} fill={c.entra} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="sai" name={nomes.sai} fill={c.sai} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Line
            type="monotone"
            dataKey="resultado"
            name={nomes.resultado}
            stroke={c.resultado}
            strokeWidth={2}
            dot={{ r: 2.5, fill: c.superficie, stroke: c.resultado, strokeWidth: 1.5 }}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ------------------------------------------------------ rosca: composição */

export interface Fatia {
  nome: string
  valor: number
  cor: string
}

export function GraficoRosca({
  fatias,
  centro,
  rotuloAcessivel,
  tamanho = 168,
}: {
  fatias: Fatia[]
  centro: { rotulo: string; valor: string }
  rotuloAcessivel: string
  tamanho?: number
}) {
  const c = useCoresDoGrafico()
  const total = fatias.reduce((s, f) => s + f.valor, 0)
  return (
    <div role="img" aria-label={rotuloAcessivel} className="relative shrink-0" style={{ width: tamanho, height: tamanho }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={total > 0 ? fatias : [{ nome: 'vazio', valor: 1, cor: c.grade }]}
            dataKey="valor"
            nameKey="nome"
            innerRadius="72%"
            outerRadius="100%"
            paddingAngle={total > 0 ? 1.5 : 0}
            stroke="none"
            isAnimationActive={false}
          >
            {(total > 0 ? fatias : [{ nome: 'vazio', valor: 1, cor: c.grade }]).map((f) => (
              <Cell key={f.nome} fill={f.cor} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-t4 text-nota">{centro.rotulo}</span>
        <span className="num font-semibold text-t1 text-valor-destaque">{centro.valor}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------- área: o caixa */

export interface PontoDeArea {
  rotulo: string
  titulo: string
  valor: number
}

export function GraficoArea({
  pontos,
  nome,
  rotuloAcessivel,
  aoClicar,
  altura = 200,
}: {
  pontos: PontoDeArea[]
  nome: string
  rotuloAcessivel: string
  aoClicar?: (i: number) => void
  altura?: number
}) {
  const c = useCoresDoGrafico()
  const negativo = pontos.some((p) => p.valor < 0)
  const cor = negativo ? c.risco : c.entra
  return (
    <div role="img" aria-label={rotuloAcessivel} style={{ height: altura }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={pontos}
          margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
          onClick={(e) => {
            if (aoClicar && e && typeof e.activeTooltipIndex === 'number') aoClicar(e.activeTooltipIndex)
          }}
          style={{ cursor: aoClicar ? 'pointer' : undefined }}
        >
          <CartesianGrid vertical={false} stroke={c.grade} />
          <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ ...EIXO, fill: c.eixo }} dy={6} />
          <YAxis tickLine={false} axisLine={false} width={72} tick={{ ...EIXO, fill: c.eixo }} tickFormatter={moedaCurta} />
          {negativo && <ReferenceLine y={0} stroke={c.risco} strokeDasharray="4 4" />}
          <Tooltip
            cursor={{ stroke: c.eixo, strokeDasharray: '3 3' }}
            content={(p: TooltipProps<number, string>) => {
              const d = p.payload?.[0]?.payload as PontoDeArea | undefined
              if (!p.active || !d) return null
              return <Balao titulo={d.titulo} itens={[{ nome, valor: d.valor, cor, forte: true }]} />
            }}
          />
          <Area
            type="monotone"
            dataKey="valor"
            name={nome}
            stroke={cor}
            strokeWidth={2}
            fill={cor}
            fillOpacity={0.07}
            dot={{ r: 2.5, fill: c.superficie, stroke: cor, strokeWidth: 1.5 }}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
