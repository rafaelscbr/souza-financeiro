import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { Icone } from '@/components/ui/Icone'
import { Linha, Lista } from '@/components/ui/Lista'
import { SidePanel } from '@/components/ui/SidePanel'
import { ContadorNav, OpcoesDaConta, type UsuarioDaCasca } from './NavRail'
import { estaAtivo, type ItemNav } from './navegacao'
import { cn } from '@/lib/utils'

/*
 * A BARRA INFERIOR (4.4), abaixo de 1024px.
 *
 * `fixed` no rodapé, fundo da página, fio de cima por sombra de 1px. Altura
 * 64 + área segura. Colunas iguais até `max-w-xl`. Cada item: pílula 32×56
 * com ícone 20 (ativa em `nav-active-bg`) e rótulo 11/16 500, sem caixa alta.
 * O contador pousa no canto da pílula, no máximo "9+". "Mais" abre uma folha
 * (SidePanel forma="folha") com os outros destinos e a conta.
 */

export interface BottomNavProps {
  /** Até cinco destinos, na ordem da lista de navegação. */
  destinos: ItemNav[]
  /** O que não coube na barra. Pode ser vazio: o "Mais" ainda leva à conta. */
  mais: ItemNav[]
  usuario: UsuarioDaCasca
  aoBuscar: () => void
  aoTrocarSenha: () => void
  aoSair: () => void
}

function Pilula({ ativo, children }: { ativo: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        'relative flex h-8 w-14 items-center justify-center rounded-full transition-colors',
        ativo ? 'bg-nav-active-bg text-nav-active-text' : 'text-nav-muted',
      )}
    >
      {children}
    </span>
  )
}

/* O badge, em relação à pílula: canto de cima à direita, sem número solto de posição. */
function ContadorDaPilula({ item }: { item: ItemNav }) {
  if (!item.contador) return null
  return (
    <span className="absolute right-0 top-0 flex -translate-y-1/2">
      <ContadorNav item={item} compacto />
    </span>
  )
}

/* Controle isolado: cor em 150ms; pressionar é fundo `linha-press` na pílula, sem escala (8.3). */
const ITEM =
  'group flex min-h-16 w-full flex-col items-center justify-start gap-1 pt-2 font-medium transition-colors [&:active>span:first-child]:bg-linha-press'

export function BottomNav({ destinos, mais, usuario, aoBuscar, aoTrocarSenha, aoSair }: BottomNavProps) {
  const { pathname } = useLocation()
  const [aberto, setAberto] = useState(false)
  const fechar = useCallback(() => setAberto(false), [])

  useEffect(() => setAberto(false), [pathname])

  // O "Mais" acende quando a tela aberta é uma das que moram nele.
  const maisAtivo = mais.some((i) => estaAtivo(pathname, i))
  const contadorMais = mais.reduce((s, i) => s + (i.contador ?? 0), 0)
  const tomMais = mais.find((i) => (i.contador ?? 0) > 0)?.tomContador

  const depoisDeFechar = (acao: () => void) => () => {
    setAberto(false)
    acao()
  }

  return (
    <>
      <nav
        aria-label="Principal"
        data-barra-inferior=""
        className="fixed inset-x-0 bottom-0 z-nav bg-page lg:hidden"
        style={{ boxShadow: '0 -1px 0 var(--fio-caixa)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="mx-auto grid max-w-xl auto-cols-fr grid-flow-col">
          {destinos.map((item) => (
            <li key={item.para} className="min-w-0">
              <NavLink to={item.para} end={item.fim} className={`${ITEM} text-chip`}>
                {({ isActive }) => (
                  <>
                    <Pilula ativo={isActive}>
                      <Icone icone={item.icone} tamanho={20} />
                      <ContadorDaPilula item={item} />
                    </Pilula>
                    <span className={cn('max-w-full truncate', isActive ? 'text-nav-active-text' : 'text-nav-text')}>
                      {item.rotulo}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li className="min-w-0">
            <button
              type="button"
              onClick={() => setAberto(true)}
              aria-haspopup="dialog"
              aria-expanded={aberto}
              className={`${ITEM} text-chip`}
            >
              <Pilula ativo={maisAtivo || aberto}>
                <Icone icone={MoreHorizontal} tamanho={20} />
                {contadorMais > 0 && (
                  <ContadorDaPilula
                    item={{ para: '', rotulo: 'Mais', icone: MoreHorizontal, contador: contadorMais, tomContador: tomMais }}
                  />
                )}
              </Pilula>
              <span className={maisAtivo || aberto ? 'text-nav-active-text' : 'text-nav-text'}>Mais</span>
            </button>
          </li>
        </ul>
      </nav>

      <SidePanel aberto={aberto} aoFechar={fechar} titulo="Mais" forma="folha" largura="md">
        {mais.length > 0 && (
          <Lista contexto="sobreposicao" colunas={{ goteira: true, fim: true }} rotuloAcessivel="Outros destinos" semEscada>
            {mais.map((item) => (
              <Linha
                key={item.para}
                goteira={<Icone icone={item.icone} tamanho={16} className="text-t3" />}
                titulo={
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="truncate">{item.rotulo}</span>
                    <ContadorNav item={item} />
                  </span>
                }
                para={item.para}
              />
            ))}
          </Lista>
        )}
        <OpcoesDaConta
          contexto="painel"
          usuario={usuario}
          aoBuscar={depoisDeFechar(aoBuscar)}
          aoTrocarSenha={depoisDeFechar(aoTrocarSenha)}
          aoSair={depoisDeFechar(aoSair)}
        />
      </SidePanel>
    </>
  )
}
