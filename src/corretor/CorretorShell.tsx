import { Suspense, useCallback, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Handshake } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { TrocarSenha } from '@/auth/TrocarSenha'
import { useCorretor, type CorretorParcela } from './CorretorData'
import { ComposicaoProvider } from '@/components/composicao/Composicao'
import { NavRail, type UsuarioDaCasca } from '@/components/layout/NavRail'
import { BottomNav } from '@/components/layout/BottomNav'
import { POLEGAR_CORRETOR, ROTAS_CORRETOR, itensDe, navCorretor, separarPolegar } from '@/components/layout/navegacao'
import { CarregandoTela, CascaDaPagina } from '@/components/layout/PageLayout'
import { PaletaDeBusca, useAtalhoBusca, type GrupoBusca } from '@/components/shared/PaletaDeBusca'
import type { Aviso } from '@/components/shared/PopoverAvisos'
import { Select } from '@/components/ui/Field'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { formatCurrency } from '@/lib/format'
import { situacaoDeTela } from '@/lib/situacao'
import { cn } from '@/lib/utils'

/**
 * A casca do corretor: três destinos, nada para criar.
 *
 * A mesma casa do administrador (trilho, polegar, sino, busca e menu da conta),
 * com menos coisa dentro. Pensada para o celular primeiro, que é de onde ele
 * olha, entre uma visita e outra: por isso a barra do polegar tem só os três
 * destinos e o "Mais", e os alvos têm pelo menos 40px.
 *
 * Sem navegador de mês: o que ele quer saber é "quanto tenho a receber", não
 * "como foi maio". O ano continua existindo para quem tem mais de um.
 */
export function CorretorShell() {
  return (
    <ComposicaoProvider>
      <CascaDoCorretor />
    </ComposicaoProvider>
  )
}

/**
 * O seletor de ano do corretor, para a tela pôr nas ações do PageLayout. Só
 * aparece com mais de um ano: um seletor com uma opção é um rótulo que parece
 * botão.
 */
export function SeletorAno({ className }: { className?: string }) {
  const { ano, anosDisponiveis, setAno } = useCorretor()
  if (anosDisponiveis.length <= 1) return null
  return (
    <Select
      aria-label="Ano"
      value={String(ano)}
      onChange={(e) => setAno(Number(e.target.value))}
      className={cn('h-10 min-h-0 w-[6.5rem] tabular-nums', className)}
    >
      {anosDisponiveis.map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
    </Select>
  )
}

const centavos = (v: number) => Math.round(v * 100) / 100

/*
 * O sino do corretor: as parcelas dele que pedem atenção, agrupadas. A
 * situação vem de situacaoDeTela(), a mesma de toda tela, e com ela a regra
 * que importa aqui: ATRASADA é só o que a imobiliária já recebeu e não
 * repassou. Parcela que a construtora ainda não pagou é espera e não entra no
 * sino. O valor é a comissão DELE (bruto menos ajuste), o mesmo de
 * Recebimentos; nada da imobiliária aparece.
 */
function avisosDoCorretor(parcelas: CorretorParcela[]): Aviso[] {
  const atrasadas = { n: 0, total: 0 }
  const aReceber = { n: 0, total: 0 }
  for (const p of parcelas) {
    const s = situacaoDeTela(p.status, p.expected_date)
    const valor = p.broker_amount - p.broker_adjustment
    if (s === 'vencida') {
      atrasadas.n += 1
      atrasadas.total += valor
    } else if (s === 'liberada') {
      aReceber.n += 1
      aReceber.total += valor
    }
  }

  const avisos: Aviso[] = []
  if (atrasadas.n > 0) {
    avisos.push({
      id: 'comissoes-atrasadas',
      tom: 'risco',
      titulo: atrasadas.n === 1 ? 'Comissão atrasada' : 'Comissões atrasadas',
      detalhe: `${formatCurrency(centavos(atrasadas.total))} já recebidos pela imobiliária`,
      quantidade: atrasadas.n,
      para: '/recebimentos',
    })
  }
  if (aReceber.n > 0) {
    avisos.push({
      id: 'comissoes-a-receber',
      tom: 'atencao',
      titulo: aReceber.n === 1 ? 'Comissão a receber' : 'Comissões a receber',
      detalhe: `${formatCurrency(centavos(aReceber.total))} no total`,
      quantidade: aReceber.n,
      para: '/recebimentos',
    })
  }
  return avisos
}

function CascaDoCorretor() {
  const { sair, profile, email } = useAuth()
  const { carregando, erro, recarregar, vendas, parcelas } = useCorretor()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [buscando, setBuscando] = useState(false)
  const [trocandoSenha, setTrocandoSenha] = useState(false)

  const abrirBusca = useCallback(() => setBuscando(true), [])
  useAtalhoBusca(abrirBusca)

  const secoes = useMemo(() => navCorretor(), [])
  const { destinos, mais } = useMemo(() => separarPolegar(secoes, POLEGAR_CORRETOR), [secoes])
  const avisos = useMemo(() => avisosDoCorretor(parcelas), [parcelas])

  const usuario: UsuarioDaCasca = {
    nome: profile?.name?.trim() || 'Corretor',
    papel: 'Corretor',
    email,
  }

  const grupos = useMemo<GrupoBusca[]>(
    () => [
      {
        rotulo: 'Telas',
        itens: itensDe(secoes).map((i) => ({
          id: `tela-${i.para}`,
          titulo: i.rotulo,
          icone: i.icone,
          aoEscolher: () => navigate(i.para),
        })),
      },
      {
        rotulo: 'Suas vendas',
        itens: vendas.map((v) => ({
          id: `venda-${v.id}`,
          titulo: v.title,
          descricao:
            [v.unit && !v.title.includes(v.unit) ? v.unit : null, v.client_name, v.development]
              .filter(Boolean)
              .join(' · ') || undefined,
          icone: Handshake,
          aoEscolher: () => navigate(`/minhas-vendas?venda=${v.id}`),
        })),
      },
    ],
    [secoes, vendas, navigate],
  )

  const sairDoSistema = () => {
    void sair()
  }

  return (
    <>
      <div className="fundo-app flex min-h-screen">
        <NavRail
          secoes={secoes}
          usuario={usuario}
          aoBuscar={abrirBusca}
          aoTrocarSenha={() => setTrocandoSenha(true)}
          aoSair={sairDoSistema}
        />

        {/* Nenhuma rota do corretor declara mês nem CTA: o cabeçalho é ícone, título e sino. */}
        <CascaDaPagina
          rotas={ROTAS_CORRETOR}
          avisos={avisos}
          carregando={carregando}
          erro={erro}
          aoTentarDeNovo={() => void recarregar()}
        >
          <ErrorBoundary resetKey={pathname}>
            <Suspense fallback={<CarregandoTela rotulo="Abrindo a tela…" />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </CascaDaPagina>

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
    </>
  )
}
