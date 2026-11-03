import { useMemo, useState } from 'react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { FaixaDeMetricas } from '@/components/ui/FaixaDeMetricas'
import { Cartao } from '@/components/ui/Cartao'
import { Linha } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { Select } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { ExportarRelatorio, FiltrosDePeriodo } from '../RelatorioPecas'
import { periodosDoDre, type TipoPeriodo } from '@/lib/dre'
import { marketingPorCanal, type CanalDoMarketing } from '@/lib/marketing'
import { ORIGENS, type Origem } from '@/lib/origens'
import { vendaConta } from '@/lib/comissao'
import { formatCurrency, formatDate } from '@/lib/format'

/*
 * MARKETING E RETORNO (Fase 8, 23/10/2026).
 *
 * Quanto cada canal custou e quanto trouxe. Os números vêm de
 * `marketingPorCanal` (lib/marketing.ts). Embaixo, as vendas que ainda não
 * dizem de onde vieram — dá para classificar ali mesmo, uma por uma, e o
 * relatório se completa na hora.
 *
 * Souza 3.0 (02/11/2026): o investido é o número líder, com o que as vendas
 * deixam e o retorno ao lado; canais e vendas sem origem formam um par.
 */

const vezes = (r: number) => `${r.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}×`

export function RelatorioMarketing() {
  const { vendas, transactions, mes, editarVenda } = useAdmin()
  const { abrir } = useComposicao()
  const { showToast } = useToast()
  const [tipo, setTipo] = useState<TipoPeriodo>('acumulado')

  const periodo = useMemo(() => periodosDoDre(mes, tipo).atual, [mes, tipo])
  const m = useMemo(() => marketingPorCanal({ vendas, transactions, periodo }), [vendas, transactions, periodo])
  const semOrigem = useMemo(
    () => vendas.filter((v) => vendaConta(v) && !v.origin).sort((a, b) => b.sale_date.localeCompare(a.sale_date)),
    [vendas],
  )

  const abrirCanal = (c: CanalDoMarketing) =>
    abrir({
      rotulo: c.nome,
      titulo: `${c.nome} · ${periodo.rotulo}`,
      explica: 'O investimento do canal no período (negativo) e o que fica para a imobiliária das vendas que ele trouxe.',
      total: Math.round((c.fica - c.investido) * 100) / 100,
      itens: [
        ...c.despesas.map((t) => ({
          id: t.id,
          titulo: t.description || t.category,
          meta: `investimento · ${formatDate(t.competence_date)}`,
          valor: -t.amount,
        })),
        ...c.vendas.map((v) => ({
          id: v.id,
          titulo: v.title,
          meta: `venda de ${formatDate(v.sale_date)} · fica para a imobiliária`,
          valor: v.cascade.net,
          para: `/vendas/${v.id}`,
        })),
      ],
      vazio: 'Nada neste canal no período.',
    })

  async function classificar(id: string, origem: Origem) {
    try {
      await editarVenda(id, { origin: origem })
      showToast({ message: 'Origem gravada', detail: ORIGENS.find((o) => o.id === origem)?.rotulo })
    } catch (e) {
      showToast({ message: 'A origem não foi gravada', detail: e instanceof Error ? e.message : undefined })
    }
  }

  const abrirInvestido = () =>
    abrir({
      rotulo: 'Investido',
      titulo: `Marketing · ${periodo.rotulo}`,
      explica: 'Despesas da categoria Marketing no período, pela competência.',
      total: m.total.investido,
      itens: m.despesas.map((t) => ({
        id: t.id,
        titulo: t.description || t.category,
        meta: `${t.marketing_channel ? ORIGENS.find((o) => o.id === t.marketing_channel)?.rotulo : 'sem canal'} · ${formatDate(t.competence_date)}`,
        valor: t.amount,
      })),
      vazio: 'Nenhuma despesa de marketing no período.',
    })
  const abrirVendas = () =>
    abrir({
      rotulo: 'Vendas',
      titulo: `Vendas · ${periodo.rotulo}`,
      explica: 'O que fica para a imobiliária de cada venda do período, depois de impostos, corretor e gestão.',
      total: m.total.fica,
      itens: m.vendas.map((v) => ({ id: v.id, titulo: v.title, meta: formatDate(v.sale_date), valor: v.cascade.net, para: `/vendas/${v.id}` })),
      vazio: 'Nenhuma venda no período.',
    })

  const fraseDoTitulo =
    m.total.investido === 0 ? (
      <>
        <b>Nenhum investimento em marketing</b> em {periodo.rotulo} · lance em Despesas, na categoria Marketing, com o canal
      </>
    ) : (
      <>
        <b>
          <Valor valor={m.total.investido} posto="fato" tinta="text-t1" /> investidos
        </b>{' '}
        em {periodo.rotulo}
        {m.total.retorno != null ? (
          <>
            {' · '}cada R$ 1 deixou <Valor valor={m.total.retorno} posto="fato" tinta="text-t1" /> de comissão
          </>
        ) : (
          ' · retorno ainda sem canal marcado'
        )}
      </>
    )

  return (
    <PageLayout
      subtitulo={fraseDoTitulo}
      faixa={<FiltrosDePeriodo ativo={tipo} aoMudar={setTipo} />}
      acoes={
        <ExportarRelatorio
          nome={`Marketing ${periodo.rotulo}`}
          planilha={() => ({
            cabecalho: ['Canal', 'Investido', 'Vendas', 'VGV', 'Comissão', 'Fica para a imobiliária', 'Custo por venda', 'Retorno (×)'],
            linhas: [
              ...m.canais.map((c) => [c.nome, c.investido, c.vendas.length, c.vgv, c.comissao, c.fica, c.custoPorVenda, c.retorno]),
              ['Total', m.total.investido, m.total.vendas, m.total.vgv, null, m.total.fica, null, m.total.retorno],
            ],
          })}
        />
      }
    >
      <FaixaDeMetricas
        rotuloAcessivel={`Marketing · ${periodo.rotulo}`}
        metricas={[
          {
            rotulo: `Investido em marketing · ${periodo.rotulo}`,
            valor: m.total.investido,
            lider: true,
            nota: `${m.despesas.length} ${m.despesas.length === 1 ? 'despesa' : 'despesas'} na categoria Marketing`,
            aoClicar: abrirInvestido,
          },
          {
            rotulo: 'Fica das vendas do período',
            valor: m.total.fica,
            nota: `${m.total.vendas} ${m.total.vendas === 1 ? 'venda' : 'vendas'} · depois de impostos, corretor e gestão`,
            aoClicar: m.total.fica !== 0 ? abrirVendas : undefined,
          },
          {
            rotulo: 'Retorno',
            valor: m.total.retorno ?? 0,
            texto: m.total.retorno != null ? vezes(m.total.retorno) : '—',
            nota: m.total.retorno != null ? 'o que fica ÷ o que se investiu' : 'ainda sem canal marcado',
          },
        ]}
      />

      <div className={semOrigem.length > 0 ? 'grid items-start gap-bloco xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : 'grid gap-bloco'}>
        <Cartao>
          <Cartao.Cabecalho titulo="Por canal" meta="o que cada canal custou e o que as vendas dele deixam" />
          <Cartao.Lista colunas={{ valor: '10rem', fim: true }} rotuloAcessivel="Marketing por canal">
            {m.canais.map((c) => (
              <Linha
                key={c.id}
                titulo={c.nome}
                meta={[
                  `${c.vendas.length} ${c.vendas.length === 1 ? 'venda' : 'vendas'}`,
                  `investido ${formatCurrency(c.investido)}`,
                  c.custoPorVenda != null ? `${formatCurrency(c.custoPorVenda)} por venda` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                valor={<Valor valor={c.fica} posto="linha" />}
                metaValor={c.retorno != null ? `retorno ${vezes(c.retorno)}` : 'fica para a imobiliária'}
                aoClicar={() => abrirCanal(c)}
              />
            ))}
          </Cartao.Lista>
          <Cartao.Rodape>
            <p className="max-w-[72ch]">
              Retorno = o que fica para a imobiliária das vendas do canal ÷ o que se investiu nele. É sobre a comissão
              contratada: o dinheiro entra ao longo dos meses, conforme a construtora paga.
            </p>
          </Cartao.Rodape>
        </Cartao>

        {semOrigem.length > 0 && (
          <Cartao>
            <Cartao.Cabecalho
              titulo="Vendas sem origem"
              meta={`${semOrigem.length} ${semOrigem.length === 1 ? 'venda' : 'vendas'} · escolha de onde veio cada uma`}
            />
            <Cartao.Lista colunas={{ acao: '14rem' }} rotuloAcessivel="Vendas sem origem">
              {semOrigem.map((v) => (
                <Linha
                  key={v.id}
                  titulo={v.title}
                  meta={`${formatDate(v.sale_date)}${v.brokerName ? ` · ${v.brokerName}` : ''}`}
                  acao={
                    <Select
                      aria-label={`Origem de ${v.title}`}
                      value=""
                      onChange={(e) => e.target.value && classificar(v.id, e.target.value as Origem)}
                    >
                      <option value="">De onde veio?</option>
                      {ORIGENS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.rotulo}
                        </option>
                      ))}
                    </Select>
                  }
                />
              ))}
            </Cartao.Lista>
          </Cartao>
        )}
      </div>
    </PageLayout>
  )
}
