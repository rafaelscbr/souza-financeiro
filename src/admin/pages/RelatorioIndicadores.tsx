import { useMemo } from 'react'
import { Activity, Banknote, CircleHelp, Clock, Handshake, Scale } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { PageLayout } from '@/components/layout/PageLayout'
import { Cartao } from '@/components/ui/Cartao'
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
 */

const GRUPOS: { grupo: Indicador['grupo']; icone: LucideIcon; meta: string }[] = [
  { grupo: 'Vendas', icone: Handshake, meta: 'o que a imobiliária vendeu' },
  { grupo: 'Resultado', icone: Scale, meta: 'quanto da comissão vira lucro' },
  { grupo: 'Recebimento', icone: Clock, meta: 'quando e de quem o dinheiro vem' },
  { grupo: 'Caixa', icone: Banknote, meta: 'quanto tempo o dinheiro aguenta' },
  { grupo: 'Dados insuficientes', icone: CircleHelp, meta: 'o que o sistema ainda não consegue medir' },
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
  const janela = `12 meses até ${formatMonthYear(mes)}`

  return (
    <PageLayout
      subtitulo={`A saúde do negócio em números, com a conta de cada um. ${janela}.`}
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
      {GRUPOS.map(({ grupo, icone, meta }) => {
        const doGrupo = indicadores.filter((i) => i.grupo === grupo)
        return (
          <Cartao key={grupo}>
            <Cartao.Cabecalho titulo={grupo} icone={icone} meta={meta} />
            <Cartao.Lista colunas={{ valor: '12rem' }} rotuloAcessivel={`Indicadores de ${grupo}`}>
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
      <p className="flex items-center gap-2 text-texto-meta text-t-meta">
        <Activity className="size-4" aria-hidden /> Resultado e receita contam só a comissão já devida, como no DRE.
      </p>
    </PageLayout>
  )
}
