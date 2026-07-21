/**
 * Mini-gráfico de tendência, em SVG puro (sem biblioteca) para não pesar
 * quando há vários por tela. Mostra a direção do indicador ao lado do número.
 */
export function Sparkline({
  data,
  color = 'currentColor',
  width = 68,
  height = 22,
  labels,
  onSelect,
}: {
  data: number[]
  color?: string
  width?: number
  height?: number
  /** Texto de cada ponto (mês + valor) mostrado ao tocar/passar o cursor. */
  labels?: string[]
  /** Torna cada ponto clicável — recebe o índice do mês. */
  onSelect?: (index: number) => void
}) {
  const clean = data.filter((v) => Number.isFinite(v))
  if (clean.length < 2) return null

  const min = Math.min(...clean)
  const max = Math.max(...clean)
  const range = max - min || 1
  const stepX = width / (clean.length - 1)

  const points = clean.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * (height - 2) - 1
    return [x, y] as const
  })

  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lastX, lastY] = points[points.length - 1]
  // Preenchimento suave sob a linha.
  const areaPath = `${path} L${width},${height} L0,${height} Z`
  const gid = `spark-${Math.round(min)}-${Math.round(max)}-${clean.length}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gid})`} />
      <path d={path} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={2.2} fill={color} />
      {/* Alvos de clique/toque por ponto — retângulos largos e invisíveis. */}
      {onSelect &&
        points.map(([x], i) => (
          <rect
            key={i}
            x={x - width / (points.length * 2)}
            y={0}
            width={width / points.length}
            height={height}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(i)
            }}
          >
            {labels?.[i] && <title>{labels[i]}</title>}
          </rect>
        ))}
    </svg>
  )
}
