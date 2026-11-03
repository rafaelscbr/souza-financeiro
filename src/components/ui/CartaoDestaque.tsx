import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMovimentoReduzido } from '@/lib/useMovimentoReduzido'
import { useRolagem } from '@/lib/useRolagem'
import { Valor } from './Valor'
import { cn } from '@/lib/utils'

/*
 * CARTÃO DE DESTAQUE (Souza 4.0, 02/11/2026) — o cartão marinho do Academy
 * ("Onde eu entrei?") e o herói do CRM ("Meta de VGV").
 *
 * Marinho, cantos de 24px, uma luz azul suave no alto (como o herói do CRM)
 * e o anel dourado à direita, que se fecha ao abrir. Dentro: o sobretítulo
 * areia, o número da tela em branco 800 e as linhas de apoio. Só UM por tela.
 */
export interface AnelDoDestaque {
  /** 0 a 1. */
  fracao: number
  /** O que fica no meio do anel ("62%"). */
  centro: string
  /** A legenda embaixo do anel. */
  legenda: ReactNode
}

export function CartaoDestaque({
  sobretitulo,
  children,
  anel,
  rodape,
  className,
  rotuloAcessivel,
}: {
  sobretitulo: ReactNode
  children: ReactNode
  anel?: AnelDoDestaque
  rodape?: ReactNode
  className?: string
  rotuloAcessivel: string
}) {
  return (
    <section
      aria-label={rotuloAcessivel}
      className={cn(
        'relative isolate overflow-hidden rounded-sobreposicao bg-moldura px-recuo py-8 text-white lg:px-10 lg:py-10',
        className,
      )}
      style={{ animation: 'sobe var(--dur-painel) var(--curva-entra) backwards' }}
    >
      {/* A luz do herói do CRM: um halo azul no alto à direita, atrás de tudo. */}
      <span
        aria-hidden
        className="pointer-events-none absolute size-[520px] rounded-full opacity-60"
        style={{ top: -128, right: -96, background: 'var(--grad-destaque)' }}
      />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="uppercase text-areia text-sobretitulo">{sobretitulo}</p>
          {children}
        </div>
        {anel && <Anel {...anel} />}
      </div>
      {rodape && <div className="relative mt-8 border-t border-white/10 pt-6">{rodape}</div>}
    </section>
  )
}

function Anel({ fracao, centro, legenda }: AnelDoDestaque) {
  const reduzido = useMovimentoReduzido()
  const r = 64
  const volta = 2 * Math.PI * r
  const f = Math.max(0, Math.min(1, fracao))
  return (
    <div className="flex flex-col items-center gap-3 max-lg:flex-row max-lg:gap-5">
      <svg viewBox="0 0 160 160" className="size-36 shrink-0 text-white max-lg:size-24" role="img" aria-label={`${centro}`}>
        <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="10" />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="var(--areia)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={volta}
          strokeDashoffset={volta * (1 - f)}
          transform="rotate(-90 80 80)"
          style={reduzido ? undefined : { animation: 'anelFecha 1100ms var(--curva-entra) 200ms backwards', ['--volta' as string]: `${volta}` }}
        />
        <text x="80" y="92" textAnchor="middle" fill="currentColor" fontSize="34" fontStyle="italic" fontFamily="Instrument Serif, Georgia, serif">
          {centro}
        </text>
      </svg>
      <div className="max-w-[11rem] text-center text-white/75 text-texto max-lg:text-left [&_b]:font-bold [&_b]:text-white">{legenda}</div>
    </div>
  )
}

/** O número grande do destaque: branco 800, rola até o valor novo. */
export function ValorDoDestaque({ valor }: { valor: number }) {
  const v = useRolagem(valor)
  return (
    <Valor
      valor={v}
      posto="lider"
      tinta="text-white !text-destaque lg:!text-destaque-lg"
      estado={valor < 0 ? 'negativo' : undefined}
    />
  )
}

/** Um número de apoio no rodapé do destaque (dentro de um <dl>), que leva à tela dele. */
export function NumeroDoDestaque({
  rotulo,
  valor,
  texto,
  nota,
  para,
}: {
  rotulo: string
  valor: number
  /** Quando não é dinheiro ("2 vendas"). */
  texto?: string
  nota: ReactNode
  para: string
}) {
  const v = useRolagem(valor)
  return (
    <Link to={para} className="flex flex-col gap-1.5 rounded-controle transition-opacity hover:opacity-85">
      <dt className="uppercase text-white/55 text-sobretitulo">{rotulo}</dt>
      <dd>
        {texto !== undefined ? (
          <span className="text-white text-numero-kpi">{texto}</span>
        ) : (
          <Valor valor={v} posto="kpi" tinta="text-white" />
        )}
      </dd>
      <dd className="text-white/65 text-texto-meta">{nota}</dd>
    </Link>
  )
}
