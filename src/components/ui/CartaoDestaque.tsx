import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMovimentoReduzido } from '@/lib/useMovimentoReduzido'
import { useRolagem } from '@/lib/useRolagem'
import { Valor } from './Valor'
import { FaixaDeMetricas, type Metrica } from './FaixaDeMetricas'
import { cn } from '@/lib/utils'

/*
 * O BLOCO-HERÓI (Folha Clara, 02/11/2026): o número que responde a tela.
 *
 * Fundo --hero-bg (o único degradê da casa), cantos de 24px, texto branco e o
 * anel Champanhe à direita, que se fecha ao abrir. Dentro: o rótulo em branco
 * 82%, o número em Plus Jakarta 800 e as linhas de apoio. Só UM por tela.
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
        // Compacto (03/11): 24px de recuo, o número e o anel na mesma faixa, o rodapé logo abaixo.
        'bloco-heroi sobre-heroi relative isolate overflow-hidden rounded-sobreposicao p-recuo lg:px-8 lg:py-6',
        className,
      )}
      style={{ animation: 'sobe var(--dur-painel) var(--curva-entra) backwards' }}
    >
      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="font-medium text-barra-texto text-texto-titulo">{sobretitulo}</p>
          {children}
        </div>
        {anel && <Anel {...anel} />}
      </div>
      {rodape && <div className="relative mt-5 border-t border-white/10 pt-4">{rodape}</div>}
    </section>
  )
}

function Anel({ fracao, centro, legenda }: AnelDoDestaque) {
  const reduzido = useMovimentoReduzido()
  const r = 64
  const volta = 2 * Math.PI * r
  const f = Math.max(0, Math.min(1, fracao))
  return (
    <div className="flex flex-row-reverse items-center justify-end gap-4 max-lg:flex-row">
      <svg viewBox="0 0 160 160" className="size-20 shrink-0 text-white lg:size-24" role="img" aria-label={`${centro}`}>
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
        <text x="80" y="91" textAnchor="middle" fill="currentColor" fontSize="30" fontWeight="800" letterSpacing="-0.75" fontFamily="Plus Jakarta Sans, Geist, system-ui, sans-serif">
          {centro}
        </text>
      </svg>
      <div className="max-w-[12rem] text-barra-texto text-texto-meta lg:text-right [&_b]:font-bold [&_b]:text-white">{legenda}</div>
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
      <dt className="text-barra-texto text-sobretitulo">{rotulo}</dt>
      <dd>
        {texto !== undefined ? (
          <span className="font-heading text-white text-numero-kpi">{texto}</span>
        ) : (
          <Valor valor={v} posto="kpi" tinta="text-white !text-numero-kpi-m" />
        )}
      </dd>
      <dd className="text-barra-texto text-nota">{nota}</dd>
    </>
  )
  const classe = 'flex cursor-pointer flex-col gap-1 rounded-controle text-left transition-opacity hover:opacity-85'
  if (para) return <Link to={para} className={classe}>{corpo}</Link>
  if (aoClicar) return <button type="button" onClick={aoClicar} className={classe}>{corpo}</button>
  return <div className={classe}>{corpo}</div>
}

/*
 * A FAIXA EM DESTAQUE. Folha Clara (02/11/2026): o bloco-herói marinho fica
 * para o Início e o login (a proporção da casa é ~15% de marinho); nas listas
 * (A receber, A pagar, Vendas) as mesmas métricas voltam a ser a faixa de
 * números clara, com o líder maior. Cada número continua abrindo o que abria.
 * `anel` fica aceito na API e não é desenhado aqui.
 */
export function FaixaEmDestaque({
  metricas,
  rotuloAcessivel,
}: {
  metricas: Metrica[]
  anel?: AnelDoDestaque
  rotuloAcessivel: string
}) {
  return <FaixaDeMetricas metricas={metricas} rotuloAcessivel={rotuloAcessivel} />
}
