import { useId, type ReactNode } from 'react'
import { ChevronRight, TriangleAlert, type LucideIcon } from 'lucide-react'
import { SecaoTitulo } from '@/components/ui/SecaoTitulo'
import { Lista } from '@/components/ui/Lista'
import { SuperficieContext } from '@/components/ui/Painel'
import { Rotulo } from '@/components/ui/Rotulo'
import { cn } from '@/lib/utils'

/*
 * AS PEÇAS DAS FOLHAS QUE GRAVAM DINHEIRO.
 *
 * Registrar venda, receber parcela, pagar comissão, lançar despesa e dar baixa
 * são cinco painéis laterais com a mesma anatomia: blocos com nome, a coisa
 * sendo confirmada como linha de extrato, a conta num quadro tonalizado e o
 * rodapé fixo com o erro e a ação. O guia manda que um estilo que aparece em
 * duas telas vire componente (seção 8), e aqui ele aparecia em cinco.
 *
 * Nada aqui calcula nem grava: é só a forma. A conta continua em
 * src/lib/sales.ts e a gravação continua no AdminData.
 */

/**
 * Um bloco com nome dentro da folha: ícone + rótulo + descrição (SecaoTitulo)
 * e os campos embaixo. É o que divide um formulário longo sem desenhar caixa
 * dentro do painel, que já é a caixa.
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
  return (
    <section className={cn('space-y-3', className)}>
      <SecaoTitulo titulo={titulo} icone={icone} descricao={descricao} />
      <div className="space-y-4">{children}</div>
    </section>
  )
}

/**
 * O que está sendo confirmado, como linha de extrato.
 *
 * Sub-bloco interno é só fundo tonalizado, sem borda nem sombra (seção 5): a
 * `list-surface` da lista solta seria um cartão dentro do painel. O contexto
 * `painel` faz a Lista desistir da própria superfície e manter só as linhas.
 */
export function ListaNaFolha({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[14px] bg-s2">
      <SuperficieContext.Provider value="painel">
        <Lista>{children}</Lista>
      </SuperficieContext.Provider>
    </div>
  )
}

/** A conta antes de gravar, no mesmo sub-bloco tonalizado. */
export function QuadroDaConta({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-[14px] bg-s2 px-4 py-3.5', className)}>{children}</div>
}

/**
 * Rótulo visível para um controle que NÃO é um `<input>`.
 *
 * `FormField` emite `<label for=…>`, e um label apontando para um radiogroup
 * não aponta para nada. O nome acessível vem do `ariaLabel` do próprio
 * Segmented; este texto é a versão que se vê, no mesmo desenho do Label.
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
    <div>
      <p className="mb-1.5 text-xs font-medium text-t2">{rotulo}</p>
      {children}
      {hint && <p className="mt-1.5 text-xs text-t4">{hint}</p>}
    </div>
  )
}

/**
 * A DOBRA DA EXCEÇÃO.
 *
 * Recolhe o CONTROLE e mantém a INFORMAÇÃO: o resumo diz, em texto corrido, o
 * que está valendo agora ("nota fiscal com Simples de 6% · construtora retém
 * 3% de ISS"). Quem cadastra o caso típico lê a frase e segue; quem tem a
 * exceção abre e mexe. O resumo quebra linha em vez de cortar, porque cortado
 * no celular ele voltaria a esconder o estado.
 *
 * O ícone é o assunto da dobra e o chevron é o único sinal de "abre".
 */
export function DobraDaFolha({
  titulo,
  resumo,
  icone: Icone,
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
    <div className="rounded-[14px] bg-s2">
      <button
        type="button"
        onClick={aoAlternar}
        aria-expanded={aberta}
        aria-controls={id}
        className={cn(
          'flex min-h-toque w-full items-center gap-3 px-4 py-3 text-left',
          'transition-colors duration-150 hover:bg-s3/50 focus-visible:ring-2 focus-visible:ring-brand/40',
          aberta ? 'rounded-t-[14px]' : 'rounded-[14px]',
        )}
      >
        {Icone && <Icone size={16} strokeWidth={1.6} className="shrink-0 text-t3" aria-hidden />}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium text-t1">{titulo}</span>
          <span className="text-xs text-t3">{resumo}</span>
        </span>
        <ChevronRight
          size={16}
          strokeWidth={1.6}
          className={cn('shrink-0 text-t4 transition-transform duration-150', aberta && 'rotate-90')}
          aria-hidden
        />
      </button>
      {aberta && (
        <div id={id} className="space-y-4 border-t border-line p-4">
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * Aviso de risco escrito: ícone + título + a frase que diz como resolver.
 *
 * O título fica em `text-t1` e só o ícone leva o vermelho: texto pequeno no
 * tom de erro sobre o próprio fundo de erro não passa de 4,5:1 no tema claro,
 * e o status já está no ícone e na palavra (princípio 3).
 *
 * `papel="status"` é para o aviso que aparece enquanto se digita: anunciar
 * como alerta a cada mudança interromperia quem está digitando.
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
    <div
      role={papel}
      className="flex items-start gap-2.5 rounded-[14px] border border-error-line bg-error-bg px-3.5 py-2.5"
    >
      <TriangleAlert size={15} strokeWidth={1.6} className="mt-[3px] shrink-0 text-error" aria-hidden />
      <div className="min-w-0 text-[13px] leading-relaxed">
        <p className="font-semibold text-t1">{titulo}</p>
        <p className="text-t2">{children}</p>
      </div>
    </div>
  )
}

/**
 * O que acontece ao confirmar, uma consequência por linha, cada uma com o
 * ícone do assunto (a conta, a guia, a comissão). É a conta dita em palavras
 * antes de existir, para ninguém descobrir o efeito depois de gravar.
 */
export function AoConfirmar({ itens }: { itens: { icone: LucideIcon; texto: ReactNode }[] }) {
  if (itens.length === 0) return null
  return (
    <div>
      <Rotulo>Ao confirmar</Rotulo>
      <ul className="mt-2 space-y-2">
        {itens.map((item, i) => {
          const Icone = item.icone
          return (
            <li key={i} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-t2">
              <Icone size={15} strokeWidth={1.6} className="mt-[3px] shrink-0 text-t3" aria-hidden />
              <span className="min-w-0">{item.texto}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * O rodapé fixo: o erro mora AQUI, e não no pé do corpo.
 *
 * Num formulário comprido o fim do corpo pode estar fora da tela quando a
 * pessoa toca em salvar. O rodapé nunca sai, e é para ele que os olhos de
 * quem acabou de tocar no botão estão olhando. Os dados digitados ficam onde
 * estavam: o erro só é escrito, nada é limpo.
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
    <div className="space-y-3">
      {erro && <AvisoDaFolha titulo={tituloDoErro}>{erro}</AvisoDaFolha>}
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}
