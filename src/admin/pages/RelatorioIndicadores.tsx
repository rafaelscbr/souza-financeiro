import { useMemo } from 'react'
import { useAdmin } from '../AdminData'
import { PageLayout } from '@/components/layout/PageLayout'
import { Cartao } from '@/components/ui/Cartao'
import { FaixaDeMetricas, type Metrica } from '@/components/ui/FaixaDeMetricas'
import { Linha } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { ExportarRelatorio } from '../RelatorioPecas'
import { calcularIndicadores, formatarIndicador, type Indicador } from '@/lib/indicadores'
import { formatMonthYear } from '@/lib/format'
import { accountBalance } from '@/lib/treasury'

/*
 * INDICADORES (Fase 6, 23/10/2026).
 *
 * Os números de saúde do negócio num lugar só, cada um com a conta escrita
 * embaixo — quem não sabe o que é "margem líquida" lê ali mesmo. A janela é
 * de 12 meses terminando no mês da tela. O que não dá para medir ainda fica
 * no último cartão, dizendo o que falta.
 *
 * Souza 3.0 (02/11/2026): a margem líquida é o número líder (a pergunta é
 * "o negócio é saudável?"), com o VGV, o fôlego e o atraso ao lado. Os
 * grupos viram pares de cartões, sem ícone no cabeçalho.
 */

const GRUPOS: { grupo: Indicador['grupo']; meta: string }[] = [
  { grupo: 'Vendas', meta: 'o que a imobiliária vendeu' },
  { grupo: 'Resultado', meta: 'quanto da comissão vira lucro · só a comissão já devida, como no DRE' },
  { grupo: 'Recebimento', meta: 'quando e de quem o dinheiro vem' },
  { grupo: 'Caixa', meta: 'quanto tempo o dinheiro aguenta' },
  { grupo: 'Dados insuficientes', meta: 'o que o sistema ainda não consegue medir' },
]

export function RelatorioIndicadores() {
  const { vendas, transactions, transfers, installments, receber, accounts, company, mes, hoje } = useAdmin()

  const saldo = useMemo(
    () =>
      accounts
        .filter((a) => a.is_active && a.type !== 'credit_card')
        .reduce((s, a) => s + accountBalance(a, transactions, transfers, hoje).balance, 0),
    [accounts, transactions, transfers, hoje],
  )
  const indicadores = useMemo(
    () =>
      calcularIndicadores({
        vendas,
        transactions,
        installments,
        receber,
        saldo,
        teto: company?.monthly_budget ?? null,
        ate: mes,
      }),
    [vendas, transactions, installments, receber, saldo, company, mes],
  )
  const janela = `12 meses até ${formatMonthYear(mes).toLowerCase()}`
  const porId = (id: string) => indicadores.find((i) => i.id === id)

  /** Uma célula da faixa a partir de um indicador; dinheiro vira Valor, o resto vai em texto. */
  const metrica = (id: string, extra: Partial<Metrica> = {}): Metrica | null => {
    const i = porId(id)
    if (!i) return null
    const moeda = i.formato === 'moeda' && i.valor != null
    return {
      rotulo: i.nome,
      valor: i.valor ?? 0,
      texto: moeda ? undefined : formatarIndicador(i),
      estado: moeda && (i.valor ?? 0) < 0 ? 'negativo' : undefined,
      nota: i.valor == null ? `falta: ${i.falta}` : undefined,
      ...extra,
    }
  }
  const margem = porId('margem-liquida')
  const vgv = porId('vgv')
  const faixa = [
    metrica('margem-liquida', { lider: true, nota: margem?.valor != null ? 'lucro líquido ÷ receita devida' : `falta: ${margem?.falta}` }),
    metrica('vgv', { nota: `${porId('vendas')?.valor ?? 0} vendas no período` }),
    metrica('folego'),
    metrica('atraso', { nota: 'do que está a receber' }),
  ].filter((m): m is Metrica => m !== null)

  const fraseDoTitulo = (
    <>
      {margem?.valor != null ? <b>Margem líquida de {formatarIndicador(margem)}</b> : <b>Margem líquida sem dados</b>}
      {vgv?.valor != null && vgv.valor > 0 && (
        <>
          {' · '}VGV de <Valor valor={vgv.valor} posto="fato" tinta="text-t1" />
        </>
      )}
      {' · '}
      {janela}
    </>
  )

  return (
    <PageLayout
      subtitulo={fraseDoTitulo}
      acoes={
        <ExportarRelatorio
          nome={`Indicadores ${formatMonthYear(mes)}`}
          planilha={() => ({
            cabecalho: ['Grupo', 'Indicador', 'Valor', 'Como se calcula'],
            linhas: indicadores.map((i) => [
              i.grupo,
              i.nome,
              i.valor == null ? 'Dados insuficientes' : formatarIndicador(i),
              i.valor == null ? `${i.formula} Falta: ${i.falta}.` : i.formula,
            ]),
          })}
        />
      }
    >
      <FaixaDeMetricas rotuloAcessivel="Os indicadores principais" metricas={faixa} />

      <div className="grid items-start gap-bloco lg:grid-cols-2">
        {GRUPOS.map(({ grupo, meta }) => {
          const doGrupo = indicadores.filter((i) => i.grupo === grupo)
          if (doGrupo.length === 0) return null
          return (
            <Cartao key={grupo}>
              <Cartao.Cabecalho titulo={grupo} meta={meta} />
              <Cartao.Lista colunas={{ valor: '9rem' }} rotuloAcessivel={`Indicadores de ${grupo}`}>
                {doGrupo.map((i) => (
                  <Linha
                    key={i.id}
                    titulo={i.nome}
                    meta={i.valor == null ? `Falta: ${i.falta}. ${i.formula}` : i.formula}
                    valor={
                      i.valor != null && i.formato === 'moeda' ? (
                        <Valor valor={i.valor} posto="linha" estado={i.valor < 0 ? 'negativo' : undefined} />
                      ) : (
                        <span className={i.valor == null ? 'text-texto-meta text-t-meta' : 'num text-valor-linha text-t1'}>
                          {formatarIndicador(i)}
                        </span>
                      )
                    }
                  />
                ))}
              </Cartao.Lista>
            </Cartao>
          )
        })}
      </div>
    </PageLayout>
  )
}
