import { Suspense, useCallback, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Handshake, Plus, Receipt, UserRound } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { TrocarSenha } from '@/auth/TrocarSenha'
import { useAdmin } from './AdminData'
import { AcoesAdminProvider, useAcoesAdmin } from './AcoesAdmin'
import { SeletorMes } from './SeletorMes'
import { ComposicaoProvider } from '@/components/composicao/Composicao'
import { NavRail, type UsuarioDaCasca } from '@/components/layout/NavRail'
import { BottomNav } from '@/components/layout/BottomNav'
import { POLEGAR_ADMIN, itensDe, navAdmin, separarPolegar } from '@/components/layout/navegacao'
import {
  AreaDaTela,
  BarraDeTransicao,
  CascaContext,
  QuadroCarregando,
  QuadroErro,
  useQuadrosDaCasca,
  useValorDaCasca,
} from '@/components/layout/PageLayout'
import { PaletaDeBusca, useAtalhoBusca, type GrupoBusca } from '@/components/shared/PaletaDeBusca'
import type { Aviso } from '@/components/shared/PopoverAvisos'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { formatCurrency } from '@/lib/format'
import type { AttentionItem, MoneyItem } from '@/lib/sales'

/**
 * A casca do administrador (docs/souza-os.md, seção 6).
 *
 * Trilho à esquerda no computador, barra do polegar no celular, as duas
 * alimentadas pela mesma lista (navegacao.ts). A casca não desenha cabeçalho
 * de tela: cada tela traz o próprio PageLayout, com o ícone da área, o resumo
 * vivo e o CTA. O navegador de mês virou peça (SeletorMes) que só as telas que
 * dependem do mês põem no cabeçalho.
 *
 * O que continua sendo da casca: os painéis de registrar venda e lançar
 * despesa (AcoesAdmin), a busca ⌘K, o sino e o menu da conta. E, enquanto
 * houver tela antiga, a barra de transição com o mês e a ação principal.
 */
export function AdminShell() {
  return (
    <ComposicaoProvider>
      <AcoesAdminProvider>
        <CascaDoAdmin />
      </AcoesAdminProvider>
    </ComposicaoProvider>
  )
}

const TOM_DO_ALERTA = { critical: 'risco', warning: 'atencao', info: 'info' } as const
const centavos = (v: number) => Math.round(v * 100) / 100

/*
 * O sino lê a mesma lista `atencao` do Início, e agrupa.
 *
 * `attentionOf` põe as quatro primeiras parcelas vencidas uma a uma e o resto
 * num "mais N". No sino isso vira UM aviso com a contagem inteira, lida da
 * mesma regra que alimenta o contador de Receber (`overdue`), para o número do
 * sino e o do menu nunca discordarem. Comissão liberada vem uma por corretor, e
 * o popover as soma sob o mesmo título. Imposto e despesa vencida passam como
 * estão, com o valor por extenso.
 */
function avisosDoAdmin(atencao: AttentionItem[], receber: MoneyItem[]): Aviso[] {
  const avisos: Aviso[] = []

  if (atencao.some((a) => a.id.startsWith('receber-'))) {
    const vencidas = receber.filter((i) => i.overdue)
    if (vencidas.length > 0) {
      const total = centavos(vencidas.reduce((s, i) => s + i.amount, 0))
      avisos.push({
        id: 'receber-vencidas',
        tom: 'risco',
        titulo: vencidas.length === 1 ? 'Parcela vencida a receber' : 'Parcelas vencidas a receber',
        detalhe: `${formatCurrency(total)} no total`,
        quantidade: vencidas.length,
        para: '/receber',
      })
    }
  }

  for (const a of atencao) {
    if (a.id.startsWith('receber-')) continue
    if (a.id.startsWith('comissao-')) {
      const nome = a.title.replace(/: comissão liberada$/, '')
      avisos.push({
        id: a.id,
        tom: 'atencao',
        titulo: 'Corretores com comissão liberada',
        detalhe: `${nome} · ${formatCurrency(a.amount)}`,
        para: a.to,
      })
      continue
    }
    avisos.push({
      id: a.id,
      tom: TOM_DO_ALERTA[a.tone],
      titulo: a.title,
      detalhe: `${a.detail} · ${formatCurrency(a.amount)}`,
      para: a.to,
    })
  }

  return avisos
}

function CascaDoAdmin() {
  const { sair, profile, email } = useAuth()
  const { carregando, erro, recarregar, receber, pagar, atencao, vendas, contacts } = useAdmin()
  const { registrarVenda, lancarDespesa } = useAcoesAdmin()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [buscando, setBuscando] = useState(false)
  const [trocandoSenha, setTrocandoSenha] = useState(false)
  const [quadros, registrarQuadro] = useQuadrosDaCasca()

  const abrirBusca = useCallback(() => setBuscando(true), [])
  useAtalhoBusca(abrirBusca)

  /*
   * As duas contas de sempre, sem mudança: vencido em Receber, e em Pagar o
   * que venceu mais a comissão que a imobiliária já recebeu e ainda não
   * repassou. Mudou só a cor: risco e atenção.
   */
  const vencidos = receber.filter((i) => i.overdue).length
  const esperando = pagar.filter((i) => i.overdue || (i.kind === 'comissao' && i.released)).length

  const secoes = useMemo(() => navAdmin({ vencidos, esperando }), [vencidos, esperando])
  const { destinos, mais } = useMemo(() => separarPolegar(secoes, POLEGAR_ADMIN), [secoes])
  const avisos = useMemo(() => avisosDoAdmin(atencao, receber), [atencao, receber])
  const casca = useValorDaCasca(avisos, registrarQuadro)

  const usuario: UsuarioDaCasca = {
    nome: profile?.name?.trim() || 'Administrador',
    papel: 'Administrador',
    email,
  }

  const grupos = useMemo<GrupoBusca[]>(
    () => [
      {
        rotulo: 'Ações',
        itens: [
          {
            id: 'acao-venda',
            titulo: 'Registrar venda',
            descricao: 'Parcelas, imposto e comissão do corretor de uma vez',
            icone: Plus,
            aoEscolher: registrarVenda,
          },
          {
            id: 'acao-despesa',
            titulo: 'Lançar despesa',
            descricao: 'Conta a pagar ou já paga',
            icone: Receipt,
            aoEscolher: lancarDespesa,
          },
        ],
      },
      {
        rotulo: 'Telas',
        itens: itensDe(secoes).map((i) => ({
          id: `tela-${i.para}`,
          titulo: i.rotulo,
          descricao: i.contador ? i.leituraContador : undefined,
          icone: i.icone,
          aoEscolher: () => navigate(i.para),
        })),
      },
      {
        rotulo: 'Vendas',
        itens: vendas.map((v) => ({
          id: `venda-${v.id}`,
          titulo: v.title,
          descricao:
            [
              v.unit && !v.title.includes(v.unit) ? v.unit : null,
              v.client_name,
              v.development,
              v.brokerName,
              v.status === 'cancelada' ? 'cancelada' : null,
            ]
              .filter(Boolean)
              .join(' · ') || undefined,
          icone: Handshake,
          aoEscolher: () => navigate(`/vendas/${v.id}`),
        })),
      },
      {
        rotulo: 'Corretores',
        itens: contacts
          .filter((c) => c.type === 'broker')
          .map((c) => ({
            id: `corretor-${c.id}`,
            titulo: c.name,
            descricao: c.is_active ? 'Corretor' : 'Corretor inativo',
            icone: UserRound,
            aoEscolher: () => navigate('/corretores'),
          })),
      },
    ],
    [secoes, vendas, contacts, navigate, registrarVenda, lancarDespesa],
  )

  const sairDoSistema = () => {
    void sair()
  }

  return (
    <CascaContext.Provider value={casca}>
      <div className="flex min-h-screen bg-page">
        <NavRail
          secoes={secoes}
          avisos={avisos}
          usuario={usuario}
          aoBuscar={abrirBusca}
          aoTrocarSenha={() => setTrocandoSenha(true)}
          aoSair={sairDoSistema}
        />

        {/* Abaixo de lg, o respiro de baixo é a altura da barra do polegar mais a área segura. */}
        <div className="flex min-w-0 flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
          {carregando ? (
            <QuadroCarregando rotulo="Carregando a imobiliária…" />
          ) : erro ? (
            <QuadroErro motivo={erro} aoTentarDeNovo={() => void recarregar()} />
          ) : (
            <AreaDaTela
              quadros={quadros}
              barra={
                <BarraDeTransicao
                  acoes={<SeletorMes className="flex-1 sm:flex-none" />}
                  cta={{ rotulo: 'Registrar venda', rotuloCurto: 'Venda', aoClicar: registrarVenda }}
                />
              }
            >
              <ErrorBoundary resetKey={pathname}>
                {/* A tela carrega por partes; o trilho fica de pé enquanto isso. */}
                <Suspense fallback={<QuadroCarregando rotulo="Abrindo a tela…" />}>
                  <Outlet />
                </Suspense>
              </ErrorBoundary>
            </AreaDaTela>
          )}
        </div>

        <BottomNav
          destinos={destinos}
          mais={mais}
          usuario={usuario}
          aoBuscar={abrirBusca}
          aoTrocarSenha={() => setTrocandoSenha(true)}
          aoSair={sairDoSistema}
        />
      </div>

      <PaletaDeBusca aberto={buscando} aoFechar={() => setBuscando(false)} grupos={grupos} />
      <TrocarSenha aberto={trocandoSenha} onFechar={() => setTrocandoSenha(false)} />
    </CascaContext.Provider>
  )
}
