import { useMemo } from 'react'
import { Award, Target } from 'lucide-react'
import { useCorretor } from '../CorretorData'
import { PageLayout } from '@/components/layout/PageLayout'
import { Cartao } from '@/components/ui/Cartao'
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

  const contam = useMemo(
    () => vendas.filter((v) => !v.is_personal && v.status !== 'cancelada'),
    [vendas],
  )
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
  const nivel = nivelDoCorretor({ perfil: plano.perfil, vgv: vgvAcumulado, cfg })
  const meta = plano.perfil.counts_for_goals ? metaDoMes(plano.metas, plano.perfil.contact_id, mes) : null
  const atingido = meta ? vgvDoMes / meta : null
  const nomeDoMes = formatMonthYear(new Date(`${mes}-01T12:00:00`))

  return (
    <PageLayout subtitulo="Seu plano de carreira e sua meta.">
      <Cartao>
        <Cartao.Cabecalho titulo={`Meta de ${nomeDoMes}`} icone={Target} />
        <Cartao.Corpo>
          {meta == null ? (
            <p className="text-texto-corrido text-t3">
              {plano.perfil.counts_for_goals ? 'Nenhuma meta cadastrada para este mês.' : 'Suas vendas não entram na meta.'}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Valor valor={vgvDoMes} posto="kpi" />
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
                    Faltam <Valor valor={meta - vgvDoMes} posto="fato" /> de VGV · {doMes.length}{' '}
                    {doMes.length === 1 ? 'venda' : 'vendas'} no mês
                  </>
                )}
              </p>
            </>
          )}
        </Cartao.Corpo>
      </Cartao>

      <Cartao>
        <Cartao.Cabecalho titulo="Seu plano de carreira" icone={Award} />
        <Cartao.Lista colunas={{ valor: '11rem' }} rotuloAcessivel="Seu plano de carreira">
          <Linha
            titulo={`Nível ${NOME_DO_NIVEL[nivel.nivel]}`}
            meta={
              nivel.origem === 'pct_proprio'
                ? 'percentual combinado com a imobiliária'
                : nivel.origem === 'decisao'
                  ? 'nível definido pela imobiliária'
                  : 'pelo VGV que você já vendeu'
            }
            valor={<span className="num text-valor-linha text-t1">{nivel.pct}% da base</span>}
          />
          <Linha
            titulo="VGV que você já vendeu"
            meta="soma do valor dos imóveis das suas vendas"
            valor={<Valor valor={vgvAcumulado} posto="linha" />}
          />
          {nivel.proximo ? (
            <Linha
              titulo={`Para chegar a ${NOME_DO_NIVEL[nivel.proximo.nivel]}`}
              meta={`${nivel.proximo.nivel === 'senior' ? cfg.level3_pct : cfg.level2_pct}% da base a partir daí`}
              valor={<Valor valor={nivel.proximo.falta} posto="linha" />}
              metaValor="de VGV faltando"
            />
          ) : (
            <Linha titulo="Você está no nível mais alto" meta="Sênior é o topo do plano" />
          )}
          {plano.gestor && <Linha titulo="Seu gestor" meta={plano.gestor} />}
        </Cartao.Lista>
        <Cartao.Rodape>
          <p className="max-w-[72ch]">
            Corretor {cfg.level1_pct}% até {fmtMi(cfg.level2_from_vgv)} de VGV · Pleno {cfg.level2_pct}% a partir de{' '}
            {fmtMi(cfg.level2_from_vgv)} · Sênior {cfg.level3_pct}% a partir de {fmtMi(cfg.level3_from_vgv)}. Para manter
            Pleno ou Sênior: {fmtMi(cfg.maintenance_vgv_12m)} de VGV nos últimos 12 meses. O percentual vale sobre a base:
            a comissão menos os impostos.
          </p>
        </Cartao.Rodape>
      </Cartao>

      {plano.metas.length > 0 && (
        <Cartao>
          <Cartao.Cabecalho titulo="Suas metas" meta="de VGV por mês" />
          <Cartao.Lista colunas={{ valor: true }} rotuloAcessivel="Suas metas">
            {plano.metas.map((m) => (
              <Linha
                key={m.id}
                titulo={m.end_month ? `${formatDate(m.start_month)} a ${formatDate(m.end_month)}` : `A partir de ${formatDate(m.start_month)}`}
                valor={<Valor valor={m.monthly_vgv} posto="linha" />}
                metaValor="por mês"
              />
            ))}
          </Cartao.Lista>
        </Cartao>
      )}
    </PageLayout>
  )
}

/** "R$ 5 milhões" para os limiares do plano. */
function fmtMi(v: number): string {
  return v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${v >= 2_000_000 ? 'milhões' : 'milhão'}`
    : `R$ ${(v / 1000).toLocaleString('pt-BR')} mil`
}
