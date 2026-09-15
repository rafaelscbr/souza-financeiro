import { useId, type ReactNode } from 'react'
import { ChevronRight, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Icone } from '@/components/ui/Icone'
import { Lista, type ColunasLista } from '@/components/ui/Lista'
import { Rotulo } from '@/components/ui/Rotulo'
import { cn } from '@/lib/utils'

/*
 * AS PEÇAS DAS FOLHAS QUE GRAVAM DINHEIRO (7.9 campo, 7.10 painel lateral).
 *
 * Registrar venda, receber parcela, pagar comissão, lançar despesa e dar baixa
 * são painéis laterais com a mesma anatomia: seções com nome (sem Cartao, o
 * painel já é a caixa), a coisa sendo confirmada como linha de extrato
 * (`Lista contexto="sobreposicao"`), a conta num sub-bloco `s2` e o rodapé fixo
 * com o erro e a ação.
 *
 * Nada aqui calcula nem grava: é só a forma. A conta continua em
 * src/lib/sales.ts e a gravação continua no AdminData.
 */

/**
 * Uma seção com nome dentro da folha: ícone 16 + `titulo-secao` + descrição
 * `texto-meta` a 4px, e os campos 16px abaixo. Divide um formulário longo sem
 * desenhar caixa dentro do painel, que já é a caixa. As seções ficam a 32px
 * umas das outras pelo gap do corpo do SidePanel.
 */
export function BlocoDaFolha({
  titulo,
  icone,
  descricao,
  children,
  className,
}: {
  titulo: ReactNode
  icone: LucideIcon
  descricao?: ReactNode
  children: ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className={cn('flex flex-col gap-4', className)}>
      <div className="flex min-w-0 items-start gap-2">
        <span className="flex h-6 shrink-0 items-center text-t3">
          <Icone icone={icone} tamanho={16} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id={id} className="font-heading text-t1 text-titulo-secao">
            {titulo}
          </h3>
          {descricao && <div className="text-t-meta text-texto-meta">{descricao}</div>}
        </div>
      </div>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  )
}

/**
 * O que está sendo confirmado, como linha de extrato. No painel a lista é
 * `sobreposicao`: o corpo já tem o recuo, a linha não ganha o seu. As colunas
 * são declaradas uma vez (selo | título | situação | valor).
 */
export function ListaNaFolha({
  children,
  colunas = { goteira: true, situacao: true, valor: true },
  rotuloAcessivel,
}: {
  children: ReactNode
  colunas?: ColunasLista
  rotuloAcessivel?: string
}) {
  return (
    <Lista contexto="sobreposicao" colunas={colunas} rotuloAcessivel={rotuloAcessivel} semEscada>
      {children}
    </Lista>
  )
}

/** A conta antes de gravar: sub-bloco `s2`, sem borda nem sombra (5.2). */
export function QuadroDaConta({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-caixa bg-s2 px-4 py-3', className)}>{children}</div>
}

/**
 * Rótulo visível para um controle que NÃO é um `<input>` (um radiogroup).
 * O nome acessível vem do `rotuloAcessivel` do próprio controle; este texto é
 * a versão que se vê, no mesmo desenho do Label do campo (7.9): rótulo, 8px,
 * controle, 8px, dica.
 */
export function EscolhaDaFolha({
  rotulo,
  hint,
  children,
}: {
  rotulo: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="font-medium text-t2 text-texto-meta">{rotulo}</p>
      {children}
      {hint && <p className="text-t-meta text-nota">{hint}</p>}
    </div>
  )
}

/**
 * A DOBRA DA EXCEÇÃO.
 *
 * Recolhe o CONTROLE e mantém a INFORMAÇÃO: o resumo diz, em texto corrido, o
 * que está valendo agora. O resumo quebra linha em vez de cortar, porque
 * cortado no celular ele voltaria a esconder o estado. O ícone é o assunto da
 * dobra e o chevron é o único sinal de "abre".
 */
export function DobraDaFolha({
  titulo,
  resumo,
  icone,
  aberta,
  aoAlternar,
  children,
}: {
  titulo: string
  resumo: string
  icone?: LucideIcon
  aberta: boolean
  aoAlternar: () => void
  children: ReactNode
}) {
  const id = useId()
  return (
    <div className="rounded-caixa bg-s2">
      <button
        type="button"
        onClick={aoAlternar}
        aria-expanded={aberta}
        aria-controls={id}
        className={cn(
          'flex min-h-toque w-full items-center gap-3 px-4 py-3 text-left hover:bg-linha-hover',
          'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/25',
          aberta ? 'rounded-t-caixa' : 'rounded-caixa',
        )}
        style={{ transitionProperty: 'background-color', transitionDuration: 'var(--dur-micro)', transitionTimingFunction: 'var(--curva-cor)' }}
      >
        {icone && <Icone icone={icone} tamanho={16} className="shrink-0 text-t3" />}
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-t1 text-texto-titulo">{titulo}</span>
          <span className="text-t-meta text-texto-meta">{resumo}</span>
        </span>
        <span
          className={cn('flex shrink-0 text-t-meta', aberta && 'rotate-90')}
          style={{ transitionProperty: 'transform', transitionDuration: 'var(--dur-micro)', transitionTimingFunction: 'var(--curva-cor)' }}
        >
          <Icone icone={ChevronRight} tamanho={16} />
        </span>
      </button>
      {aberta && (
        <div id={id} className="flex flex-col gap-6 border-t border-fio-linha p-4">
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * Aviso de risco escrito: ícone + título + a frase que diz como resolver.
 * O título fica em t1 e só o ícone leva o tom de erro (contraste no claro).
 * `papel="status"` é para o aviso que aparece enquanto se digita.
 */
export function AvisoDaFolha({
  titulo,
  children,
  papel = 'alert',
}: {
  titulo: string
  children: ReactNode
  papel?: 'alert' | 'status'
}) {
  return (
    <div role={papel} className="flex w-full items-start gap-3 rounded-caixa border border-error-line bg-error-bg px-4 py-3">
      <span className="flex h-5 shrink-0 items-center text-error-ink">
        <Icone icone={TriangleAlert} tamanho={16} />
      </span>
      <div className="flex min-w-0 flex-col text-texto-corrido">
        <p className="font-semibold text-t1">{titulo}</p>
        <p className="text-t2">{children}</p>
      </div>
    </div>
  )
}

/**
 * O que acontece ao confirmar, uma consequência por linha, cada uma com o
 * ícone do assunto. É a conta dita em palavras antes de existir.
 */
export function AoConfirmar({ itens }: { itens: { icone: LucideIcon; texto: ReactNode }[] }) {
  const id = useId()
  if (itens.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <Rotulo>
        <span id={id}>Ao confirmar</span>
      </Rotulo>
      <div role="list" aria-labelledby={id} className="flex flex-col gap-2">
        {itens.map((item, i) => (
          <div role="listitem" key={i} className="flex items-start gap-3 text-t2 text-texto-corrido">
            <span className="flex h-5 shrink-0 items-center text-t3">
              <Icone icone={item.icone} tamanho={16} />
            </span>
            <span className="min-w-0">{item.texto}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * O rodapé fixo: o erro mora AQUI, e não no pé do corpo, porque é para o
 * rodapé que os olhos de quem acabou de tocar no botão estão olhando. Os
 * botões ficam à direita (`[secundário][primário]`); no celular dividem a
 * largura (7.10). Os dados digitados ficam onde estavam.
 */
export function RodapeDaFolha({
  erro,
  tituloDoErro,
  children,
}: {
  erro?: string | null
  tituloDoErro: string
  children: ReactNode
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      {erro && <AvisoDaFolha titulo={tituloDoErro}>{erro}</AvisoDaFolha>}
      <div className="flex items-center justify-end gap-3 max-sm:[&>*]:flex-1">{children}</div>
    </div>
  )
}
