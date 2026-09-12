import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/*
 * Seção — o bloco.
 *
 * A primeira versão deste componente não tinha fundo: `--c-base` e
 * `--c-surface` compartilhavam um hex, e a página era uma folha contínua
 * separada por fios de 1px. Era coerente com a marca (uma linha fina segurando
 * ar) e o Rafael pediu o contrário: mais volume, blocos com corpo.
 *
 * Então a seção virou um retângulo de papel sobre um chão um degrau mais
 * escuro, com fio de 1px e elevação curta. O que NÃO voltou, e não volta:
 * borda colorida, barra de acento na lateral, gradiente, sombra longa, e
 * sombra em conteúdo solto. A lista de dinheiro dentro do bloco continua
 * separada por fio, e o dinheiro continua pousando numa única borda direita.
 *
 * `variante="simples"` é para uso DENTRO de uma folha ou modal, onde um bloco
 * sobre um bloco só acrescenta moldura.
 */
export function Secao({
  titulo,
  acao,
  /** Subtotal em DUAS parcelas, nunca uma. Ver `SubtotalDuplo`. */
  subtotal,
  children,
  className,
  variante = 'bloco',
}: {
  titulo?: string
  acao?: ReactNode
  subtotal?: ReactNode
  children: ReactNode
  className?: string
  variante?: 'bloco' | 'simples'
}) {
  const bloco = variante === 'bloco'
  const temCabecalho = Boolean(titulo || acao || subtotal)
  return (
    <section
      className={cn(
        'first:mt-0',
        bloco
          ? 'mt-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-card'
          : 'mt-7',
        className,
      )}
    >
      {temCabecalho && (
        <header
          className={cn(
            'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line',
            bloco ? 'px-4 py-3 sm:px-5' : 'mb-2 pb-2',
          )}
        >
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
            {titulo && (
              <h2 className="text-lg font-semibold tracking-[-0.005em] text-content">{titulo}</h2>
            )}
            {subtotal}
          </div>
          {acao && <div className="shrink-0">{acao}</div>}
        </header>
      )}
      <div className={cn(bloco && 'px-4 py-2 sm:px-5 sm:py-3')}>{children}</div>
    </section>
  )
}

/**
 * O subtotal de grupo, SEMPRE em duas parcelas.
 *
 * "Quanto entra em outubro" era conta de cabeça. Mas um total único seria
 * pior que a ausência dele: somaria o que a imobiliária já tem com o que ela
 * espera, que é precisamente o erro que fazia o Início contar previsão como
 * dívida. Então o subtotal nunca é um número — são dois, lado a lado, com a
 * palavra que os separa.
 */
export function SubtotalDuplo({
  agora,
  previsto,
  rotuloAgora = 'agora',
}: {
  agora: ReactNode
  previsto: ReactNode
  rotuloAgora?: string
}) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm text-content-muted">
      <span>{rotuloAgora}</span>
      <span className="font-semibold text-content">{agora}</span>
      <span aria-hidden className="text-content-faint">
        ·
      </span>
      <span>previsto</span>
      <span>{previsto}</span>
    </p>
  )
}
