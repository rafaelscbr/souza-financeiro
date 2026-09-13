import { type ReactNode } from 'react'
import { Painel } from './Painel'
import { Rotulo as RotuloBase } from './Rotulo'
import { type TomAceito } from './tom'
import { cn } from '@/lib/utils'

/*
 * Aceita os dois vocabulários: o do guia ('marca', 'sucesso', 'atencao',
 * 'risco', 'info', 'neutro') e o da paleta anterior ('ouro', 'verde',
 * 'critico'), traduzido em tom.ts.
 */
export type Tom = TomAceito

/**
 * DEPRECADO — o rótulo das telas que ainda não migraram. Sem filete desde o
 * ajuste do Rafael de 12/09 (docs/souza-os.md); `tom` é aceito e ignorado.
 *
 * Componente novo usa `Rotulo` de ./Rotulo (sem filete) ou `PainelTitulo` /
 * `SecaoTitulo` (filete + ícone). Este fica para quem passa `tom`.
 */
export function Rotulo({
  children,
  className,
}: {
  children: ReactNode
  tom?: Tom
  className?: string
}) {
  return (
    <p className={cn('inline-flex items-center gap-2', className)}>
      <RotuloBase as="span">{children}</RotuloBase>
    </p>
  )
}

/** O descritor em caixa alta, sobre um valor ou no topo de uma folha. */
export function Assinatura({ children, className }: { children: ReactNode; className?: string }) {
  return <RotuloBase className={className}>{children}</RotuloBase>
}

/**
 * O HERÓI (seção 6): o número que decide a ação, no único bloco dourado da tela.
 *
 * Painel dourado (filete de ouro no topo e brilho no canto), rótulo pequeno e
 * o número grande logo abaixo. A hierarquia vem do tamanho do número.
 *
 * `contexto` é a única frase que acompanha o herói, e existe para dizer o que
 * o número NÃO é. "Devido agora" sem a frase "previsão não entra nesta conta"
 * é o mesmo número que estava errado antes.
 *
 * `apoio` é a linha logo abaixo do número: os 2–3 números de apoio e o chip.
 *
 * `tom` fica aceito por compatibilidade, mas não pinta nada: o herói é sempre
 * ouro, e o estado do número (vencido, negativo) é dito por `tinta` no Valor
 * e pelo chip no apoio, com ícone e palavra.
 */
export function Heroi({
  rotulo,
  children,
  apoio,
  contexto,
  acao,
  rodape,
}: {
  rotulo: string
  tom?: Tom
  children: ReactNode
  apoio?: ReactNode
  contexto?: ReactNode
  acao?: ReactNode
  rodape?: ReactNode
}) {
  return (
    <Painel dourado className="rounded-[18px]">
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <RotuloBase as="h2">{rotulo}</RotuloBase>
          {acao && <div className="shrink-0">{acao}</div>}
        </div>

        <div className="mt-3 min-w-0">{children}</div>

        {apoio && <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">{apoio}</div>}

        {contexto && <p className="mt-3 max-w-[62ch] text-[13px] text-t3">{contexto}</p>}
      </div>

      {rodape && <div className="border-t border-line px-5 py-4 sm:px-6">{rodape}</div>}
    </Painel>
  )
}
