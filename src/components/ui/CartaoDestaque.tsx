import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMovimentoReduzido } from '@/lib/useMovimentoReduzido'
import { useRolagem } from '@/lib/useRolagem'
import { Valor } from './Valor'
import type { Metrica } from './FaixaDeMetricas'
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
  aoClicar,
}: {
  rotulo: string
  valor: number
  /** Quando não é dinheiro ("2 vendas"). */
  texto?: string
  nota: ReactNode
  para?: string
  aoClicar?: () => void
}) {
  const v = useRolagem(valor)
  const corpo = (
    <>
      <dt className="uppercase text-white/55 text-sobretitulo">{rotulo}</dt>
      <dd>
        {texto !== undefined ? (
          <span className="text-white text-numero-kpi">{texto}</span>
        ) : (
          <Valor valor={v} posto="kpi" tinta="text-white" />
        )}
      </dd>
      <dd className="text-white/65 text-texto-meta">{nota}</dd>
    </>
  )
  const classe = 'flex flex-col gap-1.5 rounded-controle text-left transition-opacity hover:opacity-85'
  if (para) return <Link to={para} className={classe}>{corpo}</Link>
  if (aoClicar) return <button type="button" onClick={aoClicar} className={classe}>{corpo}</button>
  return <div className={classe}>{corpo}</div>
}

/*
 * A FAIXA EM DESTAQUE (Souza 4.0): as mesmas métricas da FaixaDeMetricas,
 * vestidas de cartão marinho. A líder vira o número grande; as outras vão
 * para o rodapé; cada uma continua abrindo o que abria. As tintas de estado
 * do claro (vermelho, âmbar, verde) viram coral, areia e menta sobre o
 * marinho, para continuarem legíveis.
 */
export function FaixaEmDestaque({
  metricas,
  anel,
  rotuloAcessivel,
}: {
  metricas: Metrica[]
  anel?: AnelDoDestaque
  rotuloAcessivel: string
}) {
  const lider = metricas.find((m) => m.lider) ?? metricas[0]
  const outras = metricas.filter((m) => m !== lider)
  const grande = <ValorDoDestaque valor={lider.valor} />
  return (
    <CartaoDestaque
      rotuloAcessivel={rotuloAcessivel}
      sobretitulo={lider.rotulo}
      anel={anel}
      className="[&_.text-error-ink]:!text-coral [&_.text-success-ink]:!text-menta [&_.text-warning-ink]:!text-areia"
      rodape={
        outras.length > 0 ? (
          <dl className={outras.length >= 3 ? 'grid gap-6 sm:grid-cols-3' : 'grid gap-6 sm:grid-cols-2'}>
            {outras.map((m) => (
              <NumeroDoDestaque
                key={m.rotulo}
                rotulo={m.rotulo}
                valor={m.valor}
                texto={m.texto}
                nota={m.nota}
                para={m.para}
                aoClicar={m.aoClicar}
              />
            ))}
          </dl>
        ) : undefined
      }
    >
      {lider.para ? (
        <Link to={lider.para} className="w-max rounded-controle">
          {grande}
        </Link>
      ) : lider.aoClicar ? (
        <button type="button" onClick={lider.aoClicar} className="w-max rounded-controle text-left">
          {grande}
        </button>
      ) : (
        grande
      )}
      {lider.nota && <p className="text-white/70 text-texto">{lider.nota}</p>}
    </CartaoDestaque>
  )
}
