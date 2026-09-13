import { formatCurrency } from '@/lib/format'
import { TOM } from './tom'

/*
 * A TRILHA de progresso — três estados numa barra.
 *
 *   sucesso (verde) ........ recebida: o dinheiro se moveu
 *   atenção (âmbar) ........ liberada: é dinheiro, esperando o repasse
 *   info (azul-petróleo) ... prevista: depende da construtora, não é dívida
 *
 * Trilho `bg-s3` de 6px (seção 5). Nenhum segmento é ouro, então nenhum tem
 * halo: ouro com halo é só do tom marca, e esta barra não mede meta. Os
 * segmentos têm 2px de folga entre si para que a divisão continue legível em
 * escala de cinza, onde verde, âmbar e azul viram cinzas parecidos.
 *
 * Renderiza na largura final, sem crescer: uma barra que enche enquanto a
 * pessoa olha sugere que a comissão do ano está sendo preenchida agora. E o
 * número vem escrito ao lado sempre; a barra é reforço, nunca a única fonte.
 */
export function Trilha({
  recebido,
  liberado,
  previsto,
  rotuloAcessivel,
}: {
  recebido: number
  liberado: number
  previsto: number
  rotuloAcessivel?: string
}) {
  const total = recebido + liberado + previsto
  const p = (v: number) => (total > 0 ? (v / total) * 100 : 0)
  return (
    <div
      className="flex h-1.5 w-full gap-[2px] overflow-hidden rounded-full bg-s3"
      role="img"
      aria-label={
        rotuloAcessivel ??
        `recebido ${formatCurrency(recebido)}, liberado ${formatCurrency(liberado)}, previsto ${formatCurrency(previsto)}`
      }
    >
      {recebido > 0 && (
        <span className="h-full rounded-full" style={{ width: `${p(recebido)}%`, backgroundColor: TOM.sucesso.solido }} />
      )}
      {liberado > 0 && (
        <span className="h-full rounded-full" style={{ width: `${p(liberado)}%`, backgroundColor: TOM.atencao.solido }} />
      )}
      {previsto > 0 && (
        <span className="h-full rounded-full" style={{ width: `${p(previsto)}%`, backgroundColor: TOM.info.solido }} />
      )}
    </div>
  )
}

/**
 * A legenda da trilha. Uma linha, uma vez por tela onde a trilha aparece:
 * quem troca número por cor precisa ensinar a cor uma vez.
 */
export function LegendaTrilha() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-t3">
      <span className="flex items-center gap-1.5">
        <span className={`h-1.5 w-4 rounded-full ${TOM.sucesso.ponto}`} aria-hidden />
        recebido
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`h-1.5 w-4 rounded-full ${TOM.atencao.ponto}`} aria-hidden />
        liberado, a pagar
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`h-1.5 w-4 rounded-full ${TOM.info.ponto}`} aria-hidden />
        depende da construtora
      </span>
    </p>
  )
}
