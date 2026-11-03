import { useMemo } from 'react'
import { Award } from 'lucide-react'
import { useCorretor } from '../CorretorData'
import { PageLayout } from '@/components/layout/PageLayout'
import { Cartao } from '@/components/ui/Cartao'
import { FaixaDeMetricas } from '@/components/ui/FaixaDeMetricas'
import { Linha } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { Barra } from '@/components/ui/Barra'
import { EstadoVazio } from '@/components/ui/Estados'
import { configVigente, metaDoMes, NOME_DO_NIVEL, nivelDoCorretor } from '@/lib/comissao'
import { formatDate, formatMonthYear, toDateOnly } from '@/lib/format'

/*
 * METAS E NÍVEL — a área do corretor (Fase 7, 23/10/2026).
 *
 * O plano de carreira visto por quem está nele: em que nível está, quanto
 * ganha, quanto falta para subir e como vai a meta do mês. As regras são as
 * de lib/comissao.ts, as mesmas da tela de Metas do administrador; os dados
 * vêm de broker_my_plan (042), que só devolve o que é DELE.
 *
 * Venda conta pela data do contrato e pelo valor inteiro do imóvel (VGV),
 * como decidido em 23/10/2026. Venda de pessoa física e cancelada não contam.
 */
export function MeuPlano() {
  const { plano, vendas } = useCorretor()
  const hoje = toDateOnly(new Date())
  const mes = hoje.slice(0, 7)

  const contam = useMemo(() => vendas.filter((v) => !v.is_personal && v.status !== 'cancelada'), [vendas])
  const vgvAcumulado = useMemo(() => contam.reduce((s, v) => s + (v.property_value ?? 0), 0), [contam])
  const doMes = useMemo(() => contam.filter((v) => v.sale_date.slice(0, 7) === mes), [contam, mes])
  const vgvDoMes = doMes.reduce((s, v) => s + (v.property_value ?? 0), 0)

  if (!plano || !plano.perfil) {
    return (
      <PageLayout subtitulo="Seu plano de carreira e sua meta.">
        <Cartao rotuloAcessivel="Metas e nível">
          <Cartao.Corpo>
            <EstadoVazio
              icone={Award}
              titulo="Seu plano ainda não foi cadastrado"
              descricao="Quando a imobiliária cadastrar seu nível e sua meta, eles aparecem aqui."
            />
          </Cartao.Corpo>
        </Cartao>
      </PageLayout>
    )
  }

  const cfg = configVigente(plano.configuracoes, hoje)
  const nivel = nivelDoCorretor({
    perfil: plano.perfil,
    vgv: vgvAcumulado,
    cfg,
  })
  const meta = plano.perfil.counts_for_goals ? metaDoMes(plano.metas, plano.perfil.contact_id, mes) : null
  const atingido = meta ? vgvDoMes / meta : null
  const nomeDoMes = formatMonthYear(new Date(`${mes}-01T12:00:00`))

  /*
   * SOUZA 3.0 (02/11/2026): a frase diz o nível e quanto falta para o próximo
   * degrau; esse "quanto falta" é o número líder, e a barra do plano (no
   * marinho) mostra o caminho até lá. A meta do mês forma par com o plano.
   */
  const pctDoProximo = nivel.proximo ? (nivel.proximo.nivel === 'senior' ? cfg.level3_pct : cfg.level2_pct) : null
  const limiarDoProximo = nivel.proximo
    ? nivel.proximo.nivel === 'senior'
      ? cfg.level3_from_vgv
      : cfg.level2_from_vgv
    : null
  const origem =
    nivel.origem === 'pct_proprio'
      ? 'combinado com a imobiliária'
      : nivel.origem === 'decisao'
        ? 'definido pela imobiliária'
        : 'pelo VGV que você já vendeu'

  const frase = (
    <>
      <b>
        {NOME_DO_NIVEL[nivel.nivel]} · {nivel.pct}% da base
      </b>
      {nivel.proximo ? (
        <>
          {' · faltam '}
          <Valor valor={nivel.proximo.falta} posto="fato" tinta="text-t1" /> de VGV para{' '}
          {NOME_DO_NIVEL[nivel.proximo.nivel]}
        </>
      ) : (
        ' · o topo do plano'
      )}
    </>
  )

  const degraus = [
    {
      id: 'corretor' as const,
      pct: cfg.level1_pct,
      regra: `até ${fmtMi(cfg.level2_from_vgv)} de VGV`,
    },
    {
      id: 'pleno' as const,
      pct: cfg.level2_pct,
      regra: `a partir de ${fmtMi(cfg.level2_from_vgv)}`,
    },
    {
      id: 'senior' as const,
      pct: cfg.level3_pct,
      regra: `a partir de ${fmtMi(cfg.level3_from_vgv)}`,
    },
  ]
  const ordem = degraus.findIndex((d) => d.id === nivel.nivel)

  return (
    <PageLayout subtitulo={frase}>
      <FaixaDeMetricas
        rotuloAcessivel="Seu plano de carreira"
        metricas={[
          nivel.proximo
            ? {
                rotulo: `Falta para ${NOME_DO_NIVEL[nivel.proximo.nivel]}`,
                valor: nivel.proximo.falta,
                lider: true,
                nota: `de VGV · ${pctDoProximo}% da base a partir daí`,
              }
            : {
                rotulo: 'Seu nível',
                valor: 0,
                texto: NOME_DO_NIVEL[nivel.nivel],
                lider: true,
                nota: 'Sênior é o topo do plano',
              },
          {
            rotulo: 'Seu percentual',
            valor: 0,
            texto: `${nivel.pct}%`,
            nota: `da base · ${origem}`,
          },
          {
            rotulo: 'VGV que você já vendeu',
            valor: vgvAcumulado,
            nota: 'soma do valor dos imóveis das suas vendas',
          },
        ]}
      />

      <div className="grid items-start gap-bloco lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Cartao rotuloAcessivel="Seu plano de carreira">
          <Cartao.Cabecalho
            titulo="Plano de carreira"
            meta={
              nivel.proximo
                ? `de ${NOME_DO_NIVEL[nivel.nivel]} para ${NOME_DO_NIVEL[nivel.proximo.nivel]}`
                : `você está em ${NOME_DO_NIVEL[nivel.nivel]}`
            }
          />
          {nivel.proximo && limiarDoProximo != null && (
            <Cartao.Corpo className="gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <Valor valor={vgvAcumulado} posto="destaque" />
                <span className="text-texto-meta text-t-meta">
                  de <Valor valor={limiarDoProximo} posto="fato" /> para {NOME_DO_NIVEL[nivel.proximo.nivel]}
                </span>
              </div>
              <Barra
                rotuloAcessivel={`${Math.round(Math.min(1, vgvAcumulado / limiarDoProximo) * 100)}% do caminho até ${NOME_DO_NIVEL[nivel.proximo.nivel]}`}
                valor={limiarDoProximo > 0 ? vgvAcumulado / limiarDoProximo : 0}
                tom="marca"
              />
            </Cartao.Corpo>
          )}
          <Cartao.Lista colunas={{ goteira: true, valor: '8rem' }} rotuloAcessivel="Os níveis do plano">
            {degraus.map((d, i) => (
              <Linha
                key={d.id}
                goteira={
                  <span
                    aria-hidden
                    className="size-2.5 rounded-ponto"
                    style={{
                      background: i <= ordem ? 'var(--g-entra)' : 'var(--g-sai)',
                    }}
                  />
                }
                titulo={i === ordem ? `${NOME_DO_NIVEL[d.id]} · seu nível` : NOME_DO_NIVEL[d.id]}
                meta={d.regra}
                valor={
                  <span
                    className={
                      i === ordem ? 'num text-valor-linha font-semibold text-t1' : 'num text-valor-linha text-t3'
                    }
                  >
                    {d.pct}%
                  </span>
                }
                metaValor="da base"
              />
            ))}
            {plano.gestor && <Linha titulo="Seu gestor" meta={plano.gestor} />}
          </Cartao.Lista>
          <Cartao.Rodape>
            <p className="max-w-[72ch]">
              Para manter Pleno ou Sênior: {fmtMi(cfg.maintenance_vgv_12m)} de VGV nos últimos 12 meses. O percentual
              vale sobre a base: a comissão menos os impostos.
            </p>
          </Cartao.Rodape>
        </Cartao>

        <div className="flex min-w-0 flex-col gap-bloco">
          <Cartao rotuloAcessivel={`Meta de ${nomeDoMes}`}>
            <Cartao.Cabecalho
              titulo={`Meta de ${nomeDoMes}`}
              meta={meta == null ? undefined : `${doMes.length} ${doMes.length === 1 ? 'venda' : 'vendas'} no mês`}
            />
            <Cartao.Corpo className="gap-3">
              {meta == null ? (
                <p className="text-texto-corrido text-t3">
                  {plano.perfil.counts_for_goals
                    ? 'Nenhuma meta cadastrada para este mês.'
                    : 'Suas vendas não entram na meta.'}
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <Valor valor={vgvDoMes} posto="destaque" />
                    <span className="text-texto-meta text-t-meta">
                      de <Valor valor={meta} posto="fato" /> · {Math.round((atingido ?? 0) * 100)}%
                    </span>
                  </div>
                  <Barra
                    rotuloAcessivel={`${Math.round((atingido ?? 0) * 100)}% da sua meta do mês`}
                    valor={atingido ?? 0}
                    tom={vgvDoMes >= meta ? 'sucesso' : 'marca'}
                  />
                  <p className="text-texto-meta text-t-meta">
                    {vgvDoMes >= meta ? (
                      'Meta batida. Parabéns!'
                    ) : (
                      <>
                        Faltam <Valor valor={meta - vgvDoMes} posto="fato" /> de VGV
                      </>
                    )}
                  </p>
                </>
              )}
            </Cartao.Corpo>
          </Cartao>

          {plano.metas.length > 0 && (
            <Cartao rotuloAcessivel="Suas metas">
              <Cartao.Cabecalho titulo="Suas metas" meta="de VGV por mês" />
              <Cartao.Lista colunas={{ valor: true }} rotuloAcessivel="Suas metas">
                {plano.metas.map((m) => (
                  <Linha
                    key={m.id}
                    titulo={
                      m.end_month
                        ? `${formatDate(m.start_month)} a ${formatDate(m.end_month)}`
                        : `A partir de ${formatDate(m.start_month)}`
                    }
                    valor={<Valor valor={m.monthly_vgv} posto="linha" />}
                    metaValor="por mês"
                  />
                ))}
              </Cartao.Lista>
            </Cartao>
          )}
        </div>
      </div>
    </PageLayout>
  )
}

/** "R$ 5 milhões" para os limiares do plano. */
function fmtMi(v: number): string {
  return v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${v >= 2_000_000 ? 'milhões' : 'milhão'}`
    : `R$ ${(v / 1000).toLocaleString('pt-BR')} mil`
}
