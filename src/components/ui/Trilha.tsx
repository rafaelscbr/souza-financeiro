import { partesDoValor } from '@/lib/format'

/*
 * A TRILHA de progresso — três estados numa barra, legível em escala de cinza.
 *
 * A barra antiga tinha um segmento só e crescia com animação. Duas coisas
 * erradas: ela não distinguia o que já entrou do que está liberado do que é
 * promessa, e uma barra que enche enquanto o usuário olha sugere que a
 * comissão do ano está sendo preenchida agora.
 *
 *   preenchimento sólido verde .... recebida (o dinheiro se moveu)
 *   preenchimento sólido ouro ..... liberada (é dinheiro, esperando)
 *   contorno tracejado ............ prevista (ainda não é dinheiro)
 *
 * Renderiza na largura final, sem crescer. E o número vem escrito ao lado
 * sempre: a barra é reforço, nunca a única fonte.
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
  const { digitos } = partesDoValor(recebido)
  return (
    <div
      className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-3"
      role="img"
      aria-label={rotuloAcessivel ?? `recebido R$ ${digitos} de um total de ${total.toFixed(2)}`}
    >
      {recebido > 0 && <span className="h-full bg-income" style={{ width: `${p(recebido)}%` }} />}
      {liberado > 0 && <span className="h-full bg-seal" style={{ width: `${p(liberado)}%` }} />}
      {previsto > 0 && (
        <span
          className="h-full border-y border-r border-dashed border-rule"
          style={{ width: `${p(previsto)}%` }}
        />
      )}
    </div>
  )
}

/**
 * A legenda da gramática. Uma linha, uma vez por tela onde a trilha aparece.
 *
 * Qualquer sistema que troca cor por forma precisa ensinar a forma uma vez, ou
 * a régua fica bonita e muda.
 */
export function LegendaTrilha() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-content-faint">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-full bg-income" aria-hidden />
        recebido
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-full bg-seal" aria-hidden />
        liberado, a pagar
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-full border border-dashed border-rule" aria-hidden />
        depende da construtora
      </span>
    </p>
  )
}
