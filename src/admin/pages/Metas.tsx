import { useMemo, useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { FaixaDeMetricas } from '@/components/ui/FaixaDeMetricas'
import { Cartao } from '@/components/ui/Cartao'
import { Linha } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { Button } from '@/components/ui/Button'
import { Barra } from '@/components/ui/Barra'
import { useToast } from '@/components/ui/Toast'
import { FormMeta, FormPercentuais, FormPerfil } from '../FormulariosDeMetas'
import {
  configVigente,
  gestaoDoMes,
  NOME_DO_NIVEL,
  nivelDoCorretor,
  situacaoDaMeta,
  vgvAcumulado,
  vgvDaVenda,
  vlvDaVenda,
} from '@/lib/comissao'
import { formatCurrency, formatDate, formatMonthYear, formatPercent } from '@/lib/format'
import { monthKey } from '@/lib/finance'
import type { Sale, SalesGoal } from '@/types'

/*
 * METAS (Fase 1, 23/10/2026): o VGV vendido no mês contra a meta da
 * imobiliária e a de cada corretor, o nível de cada um no plano de carreira,
 * o bônus do gestor e os cadastros (metas, percentuais, perfis). As regras
 * moram em lib/comissao.ts; esta tela só mostra e grava.
 *
 * VGV conta na data do contrato (decisão C5), cheio (C7); VLV é a parte da
 * Souza. As vendas do Rafael não contam.
 *
 * Souza 3.0 (02/11/2026, só apresentação): o "Desempenho e meta de VGV" que
 * morava no Início está aqui. A frase do título diz quanto da meta já foi; a
 * faixa tem o VGV do mês como líder, com a barra de progresso no marinho; e
 * os blocos vêm em duas colunas — à esquerda o mês (corretores, gestão) e
 * os percentuais; à direita os cadastros (metas, plano de carreira).
 */
export function Metas() {
  const { sales, contacts, metas, perfis, configuracoes, mes, aplicarBonusGestor } = useAdmin()
  const { abrir } = useComposicao()
  const { showToast } = useToast()
  const [metaEditada, setMetaEditada] = useState<SalesGoal | null>(null)
  const [metaNova, setMetaNova] = useState(false)
  const [percentuais, setPercentuais] = useState(false)
  const [perfilAberto, setPerfilAberto] = useState<string | null>(null)
  const [aplicando, setAplicando] = useState(false)

  const chave = monthKey(mes)
  const nomeDoMes = formatMonthYear(mes).toLowerCase()
  const cfg = configVigente(configuracoes, `${chave}-01`)
  const nome = (id: string | null) => contacts.find((c) => c.id === id)?.name ?? 'Corretor'

  const geral = useMemo(() => situacaoDaMeta({ sales, perfis, metas, mes: chave, contactId: null }), [sales, perfis, metas, chave])
  const gestao = useMemo(() => gestaoDoMes(sales, chave), [sales, chave])

  // Corretores que aparecem: com meta, com perfil que conta, ou com venda no mês.
  const corretores = useMemo(() => {
    const ids = new Set<string>()
    for (const m of metas) if (m.contact_id) ids.add(m.contact_id)
    for (const p of perfis) if (p.counts_for_goals) ids.add(p.contact_id)
    for (const s of geral.vendas) if (s.broker_id) ids.add(s.broker_id)
    return [...ids]
      .filter((id) => perfis.find((p) => p.contact_id === id)?.counts_for_goals ?? true)
      .map((id) => {
        const perfil = perfis.find((p) => p.contact_id === id)
        const vgv = vgvAcumulado(sales, id, `${chave}-31`)
        return {
          id,
          nome: nome(id),
          perfil,
          nivel: nivelDoCorretor({ perfil, vgv, cfg }),
          mes: situacaoDaMeta({ sales, perfis, metas, mes: chave, contactId: id }),
        }
      })
      .sort((a, b) => b.mes.vgv - a.mes.vgv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metas, perfis, geral.vendas, sales, chave, cfg, contacts])

  const naoContam = perfis.filter((p) => !p.counts_for_goals)

  /* ------------------------------------------------------------ abrir */

  const abrirVendas = (titulo: string, vendas: Sale[], total: number, explica: string, valor: (s: Sale) => number = vgvDaVenda) =>
    abrir({
      rotulo: 'VGV',
      titulo,
      explica,
      total,
      itens: vendas.map((s) => ({
        id: s.id,
        titulo: s.title,
        meta: `${s.client_name ?? ''}${s.client_name ? ' · ' : ''}vendida em ${formatDate(s.sale_date)}${s.broker_id ? ` · ${nome(s.broker_id)}` : ''}`,
        valor: valor(s),
        para: `/vendas/${s.id}`,
      })),
      vazio: 'Nenhuma venda neste mês.',
    })

  const abrirVgv = () =>
    abrirVendas(
      `VGV de ${nomeDoMes}`,
      geral.vendas,
      geral.vgv,
      'As vendas dos corretores no mês, pela data do contrato, com o valor inteiro do imóvel. As do Rafael não contam.',
    )

  /* ------------------------------------------------------------ bônus */

  const temGestor = perfis.some((p) => p.is_manager)
  const bonusAplicado = gestao.vendas.length > 0 && gestao.pcts.every((p) => p === cfg.manager_bonus_pct)
  async function aplicar(pct: number) {
    setAplicando(true)
    try {
      const pagas = await aplicarBonusGestor(`${chave}-01`, pct)
      showToast({
        message: pct === cfg.manager_bonus_pct ? `Gestão de ${formatPercent(pct / 100, 0)} aplicada` : `Gestão voltou a ${formatPercent(pct / 100, 0)}`,
        detail: pagas > 0 ? `${pagas} parcela(s) já paga(s) ficaram como estavam` : `vendas do time em ${nomeDoMes}`,
      })
    } catch (e) {
      showToast({ message: 'Não foi aplicado', detail: e instanceof Error ? e.message : 'tente de novo' })
    } finally {
      setAplicando(false)
    }
  }

  const metasOrdenadas = [...metas].sort(
    (a, b) => (a.contact_id === null ? -1 : b.contact_id === null ? 1 : nome(a.contact_id).localeCompare(nome(b.contact_id))) || a.start_month.localeCompare(b.start_month),
  )
  const mesCurto = (d: string) => formatMonthYear(new Date(`${d.slice(0, 7)}-15T12:00:00`)).toLowerCase()

  /* ------------------------------------------------------------ frase */

  const nVendas = geral.vendas.length
  const frase =
    geral.meta == null ? (
      <>
        <b>
          <Valor valor={geral.vgv} posto="fato" tinta="text-t1" /> vendidos
        </b>{' '}
        · sem meta geral para {nomeDoMes}
      </>
    ) : geral.bateu ? (
      <>
        <b>Meta de {nomeDoMes} batida</b> · {formatPercent(geral.atingido ?? 0, 0)} de{' '}
        <Valor valor={geral.meta} posto="fato" tinta="text-t2" />
      </>
    ) : (
      <>
        <b>{formatPercent(geral.atingido ?? 0, 0)} da meta de {nomeDoMes}</b> · faltam{' '}
        <Valor valor={geral.falta} posto="fato" tinta="text-t2" /> ·{' '}
        {nVendas === 0 ? 'nenhuma venda no mês' : nVendas === 1 ? '1 venda no mês' : `${nVendas} vendas no mês`}
      </>
    )

  /* A meta do mês é o número da tela: VGV vendido, com a barra de progresso no marinho. */
  const notaDaLider =
    geral.meta == null ? (
      'sem meta geral cadastrada'
    ) : (
      <span className="flex flex-col gap-2 pt-1">
        <Barra
          rotuloAcessivel={`${Math.round((geral.atingido ?? 0) * 100)}% da meta de ${formatCurrency(geral.meta)}`}
          valor={geral.atingido ?? 0}
          tom="marca"
        />
        <span>
          {formatPercent(geral.atingido ?? 0, 0)} da meta de <Valor valor={geral.meta} posto="fato" />
        </span>
      </span>
    )

  return (
    <PageLayout subtitulo={frase}>
      <FaixaDeMetricas
        rotuloAcessivel={`Meta de VGV de ${nomeDoMes}`}
        metricas={[
          {
            rotulo: `VGV vendido · ${nomeDoMes}`,
            valor: geral.vgv,
            lider: true,
            nota: notaDaLider,
            aoClicar: abrirVgv,
          },
          ...(geral.meta != null
            ? [
                {
                  rotulo: geral.bateu ? 'Meta batida' : 'Falta para a meta',
                  valor: geral.bateu ? geral.meta : geral.falta,
                  nota: geral.bateu ? 'a meta geral do mês' : 'para bater a meta geral',
                  aoClicar: () => abrirVendas(`VGV de ${nomeDoMes}`, geral.vendas, geral.vgv, 'As vendas que contam para a meta geral.'),
                },
              ]
            : []),
          {
            rotulo: 'VLV · parte da Souza',
            valor: geral.vlv,
            nota: 'o VGV vezes a fatia da Souza',
            aoClicar: () =>
              abrirVendas(
                `VLV de ${nomeDoMes}`,
                geral.vendas,
                geral.vlv,
                'Valor Líquido Vendido: o VGV vezes a fatia da Souza. Sem parceria, é o próprio VGV.',
                vlvDaVenda,
              ),
          },
          {
            rotulo: 'Vendas no mês',
            valor: nVendas,
            texto: String(nVendas),
            nota: 'pela data do contrato',
            aoClicar: abrirVgv,
          },
        ]}
      />

      <div className="grid items-start gap-bloco lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="flex min-w-0 flex-col gap-bloco">
          <Cartao rotuloAcessivel="Corretores no mês">
            <Cartao.Cabecalho
              titulo="Corretores"
              meta={`quanto cada um vendeu em ${nomeDoMes}`}
            />
            <Cartao.Lista colunas={{ goteira: true, valor: true, fim: true }} rotuloAcessivel="Corretores no mês">
              {corretores.map((c) => (
                <Linha
                  key={c.id}
                  goteira={<Inicial nome={c.nome} />}
                  titulo={`${c.nome}${c.perfil?.is_manager ? ' · gestor' : ''}`}
                  meta={
                    <span className="flex flex-col gap-2">
                      <span>
                        {[
                          `${NOME_DO_NIVEL[c.nivel.nivel]} ${formatPercent(c.nivel.pct / 100, 0)}${c.nivel.origem === 'decisao' ? ' por decisão' : c.nivel.origem === 'pct_proprio' ? ' (% próprio)' : ''}`,
                          c.mes.meta != null ? `meta ${formatCurrency(c.mes.meta)}` : 'sem meta',
                          c.mes.meta != null ? (c.mes.bateu ? 'bateu' : `faltam ${formatCurrency(c.mes.falta)}`) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      {c.mes.atingido != null && (
                        <Barra
                          className="max-w-80"
                          rotuloAcessivel={`${c.nome}: ${Math.round(c.mes.atingido * 100)}% da meta`}
                          valor={c.mes.atingido}
                          tom="neutro"
                        />
                      )}
                    </span>
                  }
                  valor={<Valor valor={c.mes.vgv} posto="linha" />}
                  metaValor="vendido"
                  aoClicar={() =>
                    abrirVendas(
                      `${c.nome} · ${nomeDoMes}`,
                      c.mes.vendas,
                      c.mes.vgv,
                      `VGV vendido no mês. Acumulado: ${formatCurrency(c.nivel.vgv)}${c.nivel.proximo ? `; faltam ${formatCurrency(c.nivel.proximo.falta)} para ${NOME_DO_NIVEL[c.nivel.proximo.nivel]}` : ''}.`,
                    )
                  }
                />
              ))}
            </Cartao.Lista>
            {naoContam.length > 0 && (
              <Cartao.Rodape>
                <span>Não contam para a meta: {naoContam.map((p) => nome(p.contact_id)).join(', ')}.</span>
              </Cartao.Rodape>
            )}
          </Cartao>

          {temGestor && (
            <Cartao rotuloAcessivel="Gestão do gestor">
              <Cartao.Cabecalho
                titulo="Gestão do gestor"
                meta={`${formatPercent(cfg.manager_base_pct / 100, 0)} sobre as vendas do time; ${formatPercent(cfg.manager_bonus_pct / 100, 0)} no mês em que a imobiliária bate a meta geral`}
              />
              <Cartao.Corpo className="gap-3">
                {gestao.vendas.length === 0 ? (
                  <p className="text-texto-corrido text-t2">Nenhuma venda do time com gestão em {nomeDoMes}. Nas vendas do próprio gestor não há gestão.</p>
                ) : (
                  <p className="text-texto-corrido text-t2">
                    <b className="font-medium text-t1">
                      {gestao.vendas.length} {gestao.vendas.length === 1 ? 'venda do time' : 'vendas do time'}
                    </b>{' '}
                    com gestão de {gestao.pcts.map((p) => formatPercent(p / 100, 0)).join(' e ')}.{' '}
                    {geral.bateu ? 'A meta geral foi batida.' : 'A meta geral ainda não foi batida.'}
                  </p>
                )}
                {gestao.vendas.length > 0 && geral.bateu && !bonusAplicado && (
                  <Button variant="secundario" className="self-start" onClick={() => aplicar(cfg.manager_bonus_pct)} carregando={aplicando}>
                    Aplicar {formatPercent(cfg.manager_bonus_pct / 100, 0)} nas vendas do time
                  </Button>
                )}
                {bonusAplicado && (
                  <Button variant="secundario" className="self-start" onClick={() => aplicar(cfg.manager_base_pct)} carregando={aplicando}>
                    Voltar a gestão para {formatPercent(cfg.manager_base_pct / 100, 0)}
                  </Button>
                )}
              </Cartao.Corpo>
            </Cartao>
          )}

          <Cartao rotuloAcessivel="Percentuais">
            <Cartao.Cabecalho
              titulo="Percentuais"
              meta={`valendo em ${nomeDoMes}`}
              extra={
                <Button variant="secundario" size="sm" onClick={() => setPercentuais(true)}>
                  Alterar
                </Button>
              }
            />
            <Cartao.Lista colunas={{ valor: '8rem', fim: true }} rotuloAcessivel="Percentuais">
              <Linha titulo="Comissão" meta="lançamento · imóvel de terceiros" valor={<Pct>{formatPercent(cfg.launch_commission_pct / 100, 1)} · {formatPercent(cfg.resale_commission_pct / 100, 1)}</Pct>} aoClicar={() => setPercentuais(true)} />
              <Linha titulo="Impostos" meta="ISS (só retido) · DAS" valor={<Pct>{formatPercent(cfg.iss_pct / 100, 1)} · {formatPercent(cfg.das_pct / 100, 1)}</Pct>} aoClicar={() => setPercentuais(true)} />
              <Linha titulo="Gestão" meta="base · com a meta geral batida" valor={<Pct>{formatPercent(cfg.manager_base_pct / 100, 0)} · {formatPercent(cfg.manager_bonus_pct / 100, 0)}</Pct>} aoClicar={() => setPercentuais(true)} />
              <Linha
                titulo="Níveis"
                meta={`Corretor até ${formatCurrency(cfg.level2_from_vgv)} · Pleno até ${formatCurrency(cfg.level3_from_vgv)} · Sênior depois`}
                valor={<Pct>{cfg.level1_pct}/{cfg.level2_pct}/{cfg.level3_pct}%</Pct>}
                aoClicar={() => setPercentuais(true)}
              />
            </Cartao.Lista>
          </Cartao>
        </div>

        <div className="flex min-w-0 flex-col gap-bloco">
          <Cartao rotuloAcessivel="Metas cadastradas">
            <Cartao.Cabecalho
              titulo="Metas"
              meta={`${metas.length} ${metas.length === 1 ? 'cadastrada' : 'cadastradas'}, VGV por mês`}
              extra={
                <Button variant="secundario" size="sm" icone={Plus} onClick={() => setMetaNova(true)}>
                  Nova meta
                </Button>
              }
            />
            <Cartao.Lista colunas={{ valor: true, fim: true }} rotuloAcessivel="Metas cadastradas">
              {metasOrdenadas.map((m) => (
                <Linha
                  key={m.id}
                  titulo={m.contact_id ? nome(m.contact_id) : 'Imobiliária · meta geral'}
                  meta={`${mesCurto(m.start_month)} ${m.end_month ? `a ${mesCurto(m.end_month)}` : 'em diante'}${m.notes ? ` · ${m.notes}` : ''}`}
                  valor={<Valor valor={m.monthly_vgv} posto="linha" />}
                  aoClicar={() => setMetaEditada(m)}
                />
              ))}
            </Cartao.Lista>
          </Cartao>

          <Cartao rotuloAcessivel="Plano de carreira">
            <Cartao.Cabecalho titulo="Plano de carreira" meta="o nível, o % e o gestor de cada corretor" />
            <Cartao.Lista colunas={{ goteira: true, valor: '8rem', fim: true }} rotuloAcessivel="Plano de carreira">
              {corretores.map((c) => (
                <Linha
                  key={`perfil-${c.id}`}
                  goteira={<Inicial nome={c.nome} />}
                  titulo={c.nome}
                  meta={`${c.perfil?.manager_id ? `time de ${nome(c.perfil.manager_id)}` : 'sem gestor'}${c.perfil?.is_manager ? ' · gestor de equipe' : ''}`}
                  valor={<Pct>{NOME_DO_NIVEL[c.nivel.nivel]} {formatPercent(c.nivel.pct / 100, 0)}</Pct>}
                  aoClicar={() => setPerfilAberto(c.id)}
                />
              ))}
            </Cartao.Lista>
          </Cartao>
        </div>
      </div>

      <FormMeta aberto={metaNova || metaEditada !== null} meta={metaEditada} aoFechar={() => { setMetaNova(false); setMetaEditada(null) }} />
      <FormPercentuais aberto={percentuais} aoFechar={() => setPercentuais(false)} />
      <FormPerfil aberto={perfilAberto !== null} contactId={perfilAberto} aoFechar={() => setPerfilAberto(null)} />
    </PageLayout>
  )
}

/** Percentual na coluna de valor: tinta, sem cor. */
function Pct({ children }: { children: ReactNode }) {
  return <span className="num whitespace-nowrap text-texto-titulo text-t1">{children}</span>
}

/** A inicial do corretor num círculo cinza, na goteira: quem é, sem ícone. */
function Inicial({ nome }: { nome: string }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-s2 font-medium text-nota text-t2"
    >
      {nome.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}
