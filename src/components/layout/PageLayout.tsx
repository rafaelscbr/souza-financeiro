import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Plus, type LucideIcon } from 'lucide-react'
import { IconeTom } from '@/components/ui/IconeTom'
import { EstadoErro } from '@/components/ui/Estados'
import { FullPageLoader } from '@/components/ui/Spinner'
import type { Tom } from '@/components/ui/tom'
import { PopoverAvisos, type Aviso } from '@/components/shared/PopoverAvisos'
import { cn } from '@/lib/utils'

/*
 * O QUADRO DE TODA TELA (docs/souza-os.md, seção 6), com os ajustes do Rafael
 * de 12/09: sem aurora e sem degradê. Fundo liso com grão, cabeçalho fixo com o
 * ícone da área, título, resumo vivo, ações e a ação principal, e o conteúdo na
 * largura inteira do max-w-7xl. Nada de coluna estreita no meio de um monitor
 * vazio: a primeira versão foi reprovada também por isso.
 */

/* ------------------------------------------------------------------------- */
/* Conversa entre o quadro e a casca                                          */
/* ------------------------------------------------------------------------- */

/*
 * A casca precisa saber se a tela aberta já usa este quadro. As telas antigas
 * não têm cabeçalho próprio e dependem da casca para o navegador de mês, o
 * seletor de ano e o respiro lateral; as novas trazem tudo isso no PageLayout.
 * Enquanto as duas convivem, o quadro se anuncia e a casca tira a barra de
 * transição e o respiro dela, sem cabeçalho duplicado.
 *
 * O anúncio é um contador, não um booleano: numa troca de rota a tela nova
 * pode montar antes de a antiga desmontar. E roda em useLayoutEffect, antes da
 * pintura, para a barra antiga não piscar por um quadro na tela nova.
 *
 * A casca também entrega os avisos: abaixo de lg o trilho some, e o sino passa
 * a morar no cabeçalho da tela.
 */
export interface CascaValue {
  avisos: Aviso[]
  registrarQuadro: () => () => void
}

export const CascaContext = createContext<CascaValue | null>(null)

/** Estado da casca: quantos quadros estão montados e a função que eles chamam. */
// eslint-disable-next-line react-refresh/only-export-components
export function useQuadrosDaCasca(): [number, () => () => void] {
  const [quadros, setQuadros] = useState(0)
  const registrarQuadro = useCallback(() => {
    setQuadros((n) => n + 1)
    return () => setQuadros((n) => n - 1)
  }, [])
  return [quadros, registrarQuadro]
}

/** Monta o valor do contexto sem recriar a função de registro a cada aviso novo. */
// eslint-disable-next-line react-refresh/only-export-components
export function useValorDaCasca(avisos: Aviso[], registrarQuadro: () => () => void): CascaValue {
  return useMemo(() => ({ avisos, registrarQuadro }), [avisos, registrarQuadro])
}

/**
 * Para o que ocupa o lugar de uma tela sem ser PageLayout (o esqueleto de
 * carregando, o erro da casca): anuncia-se como quadro para a barra de
 * transição não aparecer por cima dele.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAnunciarQuadro() {
  const registrar = useContext(CascaContext)?.registrarQuadro
  useLayoutEffect(() => registrar?.(), [registrar])
}

/* ------------------------------------------------------------------------- */
/* A ação principal                                                           */
/* ------------------------------------------------------------------------- */

export interface CtaDaPagina {
  rotulo: string
  /** O rótulo no celular. Sem ele, "Novo" (seção 6). */
  rotuloCurto?: string
  aoClicar: () => void
}

/*
 * Areia CHAPADO, sem halo (ajuste de 12/09): `grad-brand` agora pinta liso, e
 * nem `shadow-brand` nem `grad-brand-glow` entram. Sora 13px bold, 40px de
 * altura, ícone Plus. No celular o rótulo encurta, mas o nome acessível
 * continua o completo: "Novo" sozinho não diz o que vai ser criado.
 */
export function BotaoCta({ rotulo, rotuloCurto = 'Novo', aoClicar }: CtaDaPagina) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-label={rotulo}
      className={cn(
        'grad-brand inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 font-heading text-[13px] font-bold sm:px-4',
        'transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98]',
        'focus-visible:ring-2 focus-visible:ring-brand/40',
      )}
    >
      <Plus size={16} strokeWidth={1.6} aria-hidden />
      <span className="sm:hidden">{rotuloCurto}</span>
      <span className="hidden sm:inline">{rotulo}</span>
    </button>
  )
}

/* ------------------------------------------------------------------------- */
/* O quadro                                                                   */
/* ------------------------------------------------------------------------- */

export interface PageLayoutProps {
  /** O ícone da área, o mesmo do menu (memória de lugar). */
  icone: LucideIcon
  tom?: Tom
  titulo: string
  /** O que a tela faz, ou um resumo vivo com números. */
  subtitulo?: ReactNode
  /** Controles da tela (navegador de mês, filtro). No celular descem para a linha de baixo. */
  acoes?: ReactNode
  cta?: CtaDaPagina
  /** Abas, filtros rápidos ou indicadores que ficam fixos junto do cabeçalho. */
  faixa?: ReactNode
  children: ReactNode
}

export function PageLayout({ icone, tom = 'neutro', titulo, subtitulo, acoes, cta, faixa, children }: PageLayoutProps) {
  const casca = useContext(CascaContext)
  useAnunciarQuadro()

  // A aba do navegador diz em que tela se está; com três abas abertas do
  // financeiro, "Souza Imobiliária · Financeiro" três vezes não ajuda ninguém.
  // Ao sair, devolve o título de antes: a tela antiga, sem quadro, não o escreve.
  useEffect(() => {
    const anterior = document.title
    document.title = `${titulo} · Souza Imobiliária`
    return () => {
      document.title = anterior
    }
  }, [titulo])

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-page texture-grain">
      <header className="nav-bg-blur sticky top-0 z-20 border-b border-line pt-safe">
        {/*
         * Uma linha no computador: identidade à esquerda, ações e CTA à
         * direita. No celular as ações descem para uma segunda linha inteira
         * (order-last + w-full), porque navegador de mês, sino e CTA não cabem
         * ao lado de um título em 390px, e título cortado não diz onde se está.
         */}
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <IconeTom icone={icone} tom={tom} tamanho="md" />
            <div className="min-w-0">
              <h1 className="truncate font-heading text-[19px] font-bold leading-tight tracking-[-0.015em] text-t1">
                {titulo}
              </h1>
              {/* O subtítulo quebra linha em vez de cortar: é onde mora dinheiro, e valor nunca sai pela metade. */}
              {subtitulo && <p className="mt-0.5 text-[13px] leading-snug text-t3">{subtitulo}</p>}
            </div>
          </div>

          {acoes && (
            <div className="order-last flex w-full min-w-0 items-center gap-2 sm:order-none sm:w-auto">{acoes}</div>
          )}

          {(cta || casca) && (
            <div className="flex shrink-0 items-center gap-2.5">
              {casca && (
                <div className="flex lg:hidden">
                  <PopoverAvisos avisos={casca.avisos} />
                </div>
              )}
              {cta && <BotaoCta {...cta} />}
            </div>
          )}
        </div>

        {faixa && <div className="mx-auto max-w-7xl px-4 pb-3 sm:px-6 lg:px-8">{faixa}</div>}
      </header>

      <main className="entrada-pagina mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* O que a casca põe no lugar da tela                                         */
/* ------------------------------------------------------------------------- */

/*
 * A área da tela dentro da casca. Com tela antiga (nenhum quadro anunciado),
 * a casca desenha a barra de transição e dá o respiro que o <main> antigo dava.
 * Com tela nova, sai da frente: o PageLayout traz cabeçalho, respiro e <main>.
 *
 * O invólucro é SEMPRE o mesmo <div>; só a classe muda. Trocar o elemento
 * remontaria a tela, que desanunciaria o quadro, que trocaria o elemento de
 * novo: um laço sem fim.
 */
export function AreaDaTela({ quadros, barra, children }: { quadros: number; barra: ReactNode; children: ReactNode }) {
  const legado = quadros === 0
  return (
    <>
      {legado && barra}
      <div
        role={legado ? 'main' : undefined}
        className={
          legado ? 'mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8' : 'flex flex-1 flex-col'
        }
      >
        {children}
      </div>
    </>
  )
}

/**
 * Barra fina da casca para as telas que ainda não usam o PageLayout: o
 * navegador de mês (ou de ano), o sino no celular e a ação principal. Some
 * sozinha quando a tela migra. No computador, sem ações e sem CTA, nem aparece:
 * o sino já está no trilho.
 */
export function BarraDeTransicao({ acoes, cta }: { acoes?: ReactNode; cta?: CtaDaPagina }) {
  const casca = useContext(CascaContext)
  return (
    <header className={cn('nav-bg-blur sticky top-0 z-20 border-b border-line pt-safe', !acoes && !cta && 'lg:hidden')}>
      <div className="mx-auto flex max-w-7xl items-center justify-end gap-2.5 px-4 py-2.5 sm:px-6 lg:px-8">
        {acoes && <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">{acoes}</div>}
        {casca && (
          <div className="flex lg:hidden">
            <PopoverAvisos avisos={casca.avisos} />
          </div>
        )}
        {cta && <BotaoCta {...cta} />}
      </div>
    </header>
  )
}

/** Carregando no lugar da tela: o esqueleto com a forma do quadro, nunca spinner solto. */
export function QuadroCarregando({ rotulo }: { rotulo: string }) {
  useAnunciarQuadro()
  return <FullPageLoader label={rotulo} />
}

/**
 * Falhou no lugar da tela. Erro sempre vence vazio (seção 1): a casca que não
 * conseguiu ler o banco não pode mostrar a tela dizendo "nenhuma venda".
 */
export function QuadroErro({ motivo, aoTentarDeNovo }: { motivo?: ReactNode; aoTentarDeNovo: () => void }) {
  useAnunciarQuadro()
  return (
    <main className="entrada-pagina mx-auto flex w-full max-w-7xl flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="w-full max-w-xl rounded-[14px] border border-line shadow-card surface-premium">
        <EstadoErro motivo={motivo} aoTentarDeNovo={aoTentarDeNovo} />
      </div>
    </main>
  )
}
