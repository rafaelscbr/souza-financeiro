import { Fragment } from 'react'
import type { LinhaDemonstrativo, Perfil } from '@/lib/linhasDaVenda'
import { Valor, ValorComOrigem } from './Valor'
import { ChipSituacao } from './Situacao'
import { cn } from '@/lib/utils'

/*
 * DEMONSTRATIVO (7.3.2): a conta escrita de cima para baixo, bruto, menos,
 * igual. Substitui Cascata, a prévia do Registrar venda e ContaDaParcela.
 *
 * Só desenha o que recebe: as linhas vêm de linhasDaParcela/linhasDaVenda
 * (src/lib/linhasDaVenda.ts). Nenhuma soma aqui, nenhuma linha escondida por
 * prop (o corretor recebe linhas sem "Fica para a imobiliária").
 *
 * Grade de três colunas declarada uma vez: rótulo | seta (16px) | valor (auto).
 * O sinal "−" mora colado ao valor ("− R$ 1.080,00"); a seta que abre a
 * origem fica fora do valor, numa coluna fixa, e a coluna de valor tem a
 * largura do maior número, então todas as bordas direitas alinham.
 * Linha de 32px sem gap vertical; total com 40px, 8px abaixo do fio. A linha
 * que abre algo ganha 44px com toque ou abaixo de 1024 (item 32).
 */
export interface DemonstrativoProps {
  linhas: LinhaDemonstrativo[]
  /** Abre a composição do número. Sem ele, nenhum valor vira botão. */
  aoAbrirOrigem?: (linha: LinhaDemonstrativo) => void
  /** Palavras do chip de situação (o corretor lê as dele). */
  perfil?: Perfil
  /** Venda toda recebida: o total diz "· tudo já entrou" e continua mostrando o valor. */
  tudoEntrou?: boolean
  /** Nome da conta para leitor de tela ("Conta da parcela 2 de 3"). */
  rotuloAcessivel?: string
  className?: string
}

const ALTURA_COM_ORIGEM = 'max-lg:min-h-11 [@media(pointer:coarse)]:min-h-11'

export function Demonstrativo({
  linhas,
  aoAbrirOrigem,
  perfil = 'admin',
  tudoEntrou = false,
  rotuloAcessivel,
  className,
}: DemonstrativoProps) {
  const ultimoTotal = linhas.map((l) => l.sinal).lastIndexOf('=')
  return (
    <dl
      data-demonstrativo
      aria-label={rotuloAcessivel}
      className={cn('grid min-w-0 grid-cols-[minmax(0,1fr)_16px_auto] gap-x-2', className)}
    >
      {linhas.map((linha, i) => (
        <LinhaDaConta
          key={`${linha.chave}-${i}`}
          linha={linha}
          primeira={i === 0}
          total={linha.sinal === '='}
          final={i === ultimoTotal}
          tudoEntrou={tudoEntrou}
          perfil={perfil}
          aoAbrirOrigem={aoAbrirOrigem}
        />
      ))}
    </dl>
  )
}

function LinhaDaConta({
  linha,
  primeira,
  total,
  final,
  tudoEntrou,
  perfil,
  aoAbrirOrigem,
}: {
  linha: LinhaDemonstrativo
  primeira: boolean
  total: boolean
  final: boolean
  tudoEntrou: boolean
  perfil: Perfil
  aoAbrirOrigem?: (linha: LinhaDemonstrativo) => void
}) {
  const abre = !!(aoAbrirOrigem && linha.origem)
  const destaque = primeira || total
  /* py-1: a linha de uma fileira continua com 32px; quando o detalhe quebra, 8px separam as linhas. */
  const altura = cn(total ? 'min-h-10 pt-2' : 'min-h-8 py-1', abre && ALTURA_COM_ORIGEM)
  const posto = final ? 'destaque' : destaque ? 'linha' : 'fato'
  const rotulo = final && tudoEntrou ? `${linha.rotulo} · tudo já entrou` : linha.rotulo
  /* O "−" sai do próprio Valor (colado ao número); o módulo vem da linha. */
  const valor = linha.sinal === '−' ? -Math.abs(linha.valor) : Math.abs(linha.valor)
  return (
    <Fragment>
      {total && <hr aria-hidden className="col-span-3 mt-2 border-0 border-t border-fio-caixa" />}
      <dt
        className={cn(
          'flex min-w-0 flex-wrap items-center gap-x-2',
          altura,
          destaque ? 'font-medium text-t1' : 'text-t2',
        )}
      >
        <span className={cn('min-w-0', destaque ? 'text-texto-titulo' : 'text-texto')}>{rotulo}</span>
        {linha.detalhe && <span className="text-texto-meta text-t-meta">{linha.detalhe}</span>}
        {linha.situacao && <ChipSituacao situacao={linha.situacao} perfil={perfil} />}
      </dt>
      {abre ? (
        <dd className={cn('col-span-2 grid grid-cols-subgrid items-center', altura)}>
          <ValorComOrigem
            valor={valor}
            posto={posto}
            chevron="coluna"
            className="lg:[@media(pointer:fine)]:min-h-8"
            aoAbrir={() => aoAbrirOrigem?.(linha)}
            rotuloAcessivel={`Ver de onde vem: ${linha.rotulo}`}
          />
        </dd>
      ) : (
        <dd className={cn('col-span-2 flex items-center justify-end', altura)}>
          <Valor valor={valor} posto={posto} />
        </dd>
      )}
    </Fragment>
  )
}
