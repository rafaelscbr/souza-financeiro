import { useMemo, useState } from 'react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Heroi } from '@/components/ui/Heroi'
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

  const fraseDoHeroi =
    geral.meta == null ? (
      <>Sem meta geral cadastrada para {nomeDoMes}.</>
    ) : (
      <>
        Meta de <Valor valor={geral.meta} posto="fato" />: {formatPercent(geral.atingido ?? 0, 0)} atingido
        {geral.bateu ? ', meta batida.' : '.'}
      </>
    )

  const metasOrdenadas = [...metas].sort(
    (a, b) => (a.contact_id === null ? -1 : b.contact_id === null ? 1 : nome(a.contact_id).localeCompare(nome(b.contact_id))) || a.start_month.localeCompare(b.start_month),
  )
  const mesCurto = (d: string) => formatMonthYear(new Date(`${d.slice(0, 7)}-15T12:00:00`)).toLowerCase()

  return (
    <PageLayout subtitulo="VGV vendido contra a meta da imobiliária e de cada corretor.">
      <Heroi
        variante="ouro"
        rotulo={`VGV vendido · ${nomeDoMes}`}
        valor={geral.vgv}
        rotuloAcessivel={`Ver as vendas de ${nomeDoMes}`}
        aoAbrir={() => abrirVendas(`VGV de ${nomeDoMes}`, geral.vendas, geral.vgv, 'As vendas dos corretores no mês, pela data do contrato, com o valor inteiro do imóvel. As do Rafael não contam.')}
        frase={fraseDoHeroi}
        barra={
          geral.atingido != null ? (
            <Barra
              rotuloAcessivel={`${Math.round(geral.atingido * 100)}% da meta de ${formatCurrency(geral.meta ?? 0)}`}
              valor={geral.atingido}
              tom={geral.bateu ? 'sucesso' : 'marca'}
            />
          ) : undefined
        }
        apoios={[
          ...(geral.meta != null
            ? [{ rotulo: geral.bateu ? 'Meta batida' : 'Falta', valor: geral.bateu ? geral.meta : geral.falta, rotuloAcessivel: 'Ver as vendas do mês', aoAbrir: () => abrirVendas(`VGV de ${nomeDoMes}`, geral.vendas, geral.vgv, 'As vendas que contam para a meta geral.') }]
            : []),
          { rotulo: 'VLV · parte da Souza', valor: geral.vlv, rotuloAcessivel: 'Ver o VLV de cada venda', aoAbrir: () => abrirVendas(`VLV de ${nomeDoMes}`, geral.vendas, geral.vlv, 'Valor Líquido Vendido: o VGV vezes a fatia da Souza. Sem parceria, é o próprio VGV.', vlvDaVenda) },
        ].filter((a) => a.valor !== 0)}
      />

      <Cartao>
        <Cartao.Cabecalho titulo="Corretores" meta={`Nível no plano de carreira e o mês de cada um. Toque para ver as vendas.`} />
        <Cartao.Lista colunas={{ valor: true, fim: true }} rotuloAcessivel="Corretores no mês">
          {corretores.map((c) => (
            <Linha
              key={c.id}
              titulo={`${c.nome}${c.perfil?.is_manager ? ' · gestor' : ''}`}
              meta={[
                `${NOME_DO_NIVEL[c.nivel.nivel]} ${formatPercent(c.nivel.pct / 100, 0)}${c.nivel.origem === 'decisao' ? ' por decisão' : c.nivel.origem === 'pct_proprio' ? ' (% próprio)' : ''}`,
                c.mes.meta != null ? `meta ${formatCurrency(c.mes.meta)}` : 'sem meta',
                c.mes.meta != null ? (c.mes.bateu ? 'bateu' : `faltam ${formatCurrency(c.mes.falta)}`) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              valor={<Valor valor={c.mes.vgv} posto="linha" />}
              metaValor="vendido"
              aoClicar={() => abrirVendas(`${c.nome} · ${nomeDoMes}`, c.mes.vendas, c.mes.vgv, `VGV vendido no mês. Acumulado: ${formatCurrency(c.nivel.vgv)}${c.nivel.proximo ? `; faltam ${formatCurrency(c.nivel.proximo.falta)} para ${NOME_DO_NIVEL[c.nivel.proximo.nivel]}` : ''}.`)}
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
        <Cartao>
          <Cartao.Cabecalho titulo="Gestão do gestor" meta={`${formatPercent(cfg.manager_base_pct / 100, 0)} sobre as vendas do time; ${formatPercent(cfg.manager_bonus_pct / 100, 0)} no mês em que a imobiliária bate a meta geral.`} />
          <Cartao.Corpo>
            <div className="flex flex-col gap-3 text-texto-corrido text-t2">
              {gestao.vendas.length === 0 ? (
                <p>Nenhuma venda do time com gestão em {nomeDoMes}. Nas vendas do próprio gestor não há gestão.</p>
              ) : (
                <p>
                  {gestao.vendas.length} {gestao.vendas.length === 1 ? 'venda do time' : 'vendas do time'} em {nomeDoMes}, com gestão de{' '}
                  {gestao.pcts.map((p) => formatPercent(p / 100, 0)).join(' e ')}.{' '}
                  {geral.bateu ? 'A meta geral foi batida.' : 'A meta geral ainda não foi batida.'}
                </p>
              )}
              {gestao.vendas.length > 0 && geral.bateu && !bonusAplicado && (
                <div>
                  <Button variant="primario" onClick={() => aplicar(cfg.manager_bonus_pct)} carregando={aplicando}>
                    Aplicar {formatPercent(cfg.manager_bonus_pct / 100, 0)} nas vendas do time de {nomeDoMes}
                  </Button>
                </div>
              )}
              {bonusAplicado && (
                <div>
                  <Button variant="secundario" onClick={() => aplicar(cfg.manager_base_pct)} carregando={aplicando}>
                    Voltar a gestão para {formatPercent(cfg.manager_base_pct / 100, 0)}
                  </Button>
                </div>
              )}
            </div>
          </Cartao.Corpo>
        </Cartao>
      )}

      <Cartao>
        <Cartao.Cabecalho
          titulo="Metas cadastradas"
          meta="Toque numa meta para mudar ou apagar."
          extra={
            <Button variant="secundario" size="sm" onClick={() => setMetaNova(true)}>
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
              metaValor="por mês"
              aoClicar={() => setMetaEditada(m)}
            />
          ))}
        </Cartao.Lista>
      </Cartao>

      <Cartao>
        <Cartao.Cabecalho
          titulo="Percentuais e plano de carreira"
          meta={`Valendo em ${nomeDoMes}. Toque num corretor para mudar o nível, o gestor ou o %.`}
          extra={
            <Button variant="secundario" size="sm" onClick={() => setPercentuais(true)}>
              Alterar percentuais
            </Button>
          }
        />
        <Cartao.Lista colunas={{ valor: '8rem', fim: true }} rotuloAcessivel="Percentuais">
          <Linha titulo="Comissão" meta="lançamento · imóvel de terceiros" valor={<span className="text-texto-titulo text-t1">{formatPercent(cfg.launch_commission_pct / 100, 1)} · {formatPercent(cfg.resale_commission_pct / 100, 1)}</span>} aoClicar={() => setPercentuais(true)} />
          <Linha titulo="Impostos" meta="ISS (só retido) · DAS" valor={<span className="text-texto-titulo text-t1">{formatPercent(cfg.iss_pct / 100, 1)} · {formatPercent(cfg.das_pct / 100, 1)}</span>} aoClicar={() => setPercentuais(true)} />
          <Linha titulo="Gestão" meta="base · com a meta geral batida" valor={<span className="text-texto-titulo text-t1">{formatPercent(cfg.manager_base_pct / 100, 0)} · {formatPercent(cfg.manager_bonus_pct / 100, 0)}</span>} aoClicar={() => setPercentuais(true)} />
          <Linha
            titulo="Níveis"
            meta={`Corretor até ${formatCurrency(cfg.level2_from_vgv)} · Pleno até ${formatCurrency(cfg.level3_from_vgv)} · Sênior depois`}
            valor={<span className="text-texto-titulo text-t1">{cfg.level1_pct}/{cfg.level2_pct}/{cfg.level3_pct}%</span>}
            aoClicar={() => setPercentuais(true)}
          />
          {corretores.map((c) => (
            <Linha
              key={`perfil-${c.id}`}
              titulo={c.nome}
              meta={`${c.perfil?.manager_id ? `time de ${nome(c.perfil.manager_id)}` : 'sem gestor'}${c.perfil?.is_manager ? ' · gestor de equipe' : ''}`}
              valor={<span className="text-texto-titulo text-t1">{NOME_DO_NIVEL[c.nivel.nivel]} {formatPercent(c.nivel.pct / 100, 0)}</span>}
              aoClicar={() => setPerfilAberto(c.id)}
            />
          ))}
        </Cartao.Lista>
      </Cartao>

      <FormMeta aberto={metaNova || metaEditada !== null} meta={metaEditada} aoFechar={() => { setMetaNova(false); setMetaEditada(null) }} />
      <FormPercentuais aberto={percentuais} aoFechar={() => setPercentuais(false)} />
      <FormPerfil aberto={perfilAberto !== null} contactId={perfilAberto} aoFechar={() => setPerfilAberto(null)} />
    </PageLayout>
  )
}
