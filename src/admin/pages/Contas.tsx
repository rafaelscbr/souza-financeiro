import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Landmark, ReceiptText } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { FaixaDeMetricas, type Metrica } from '@/components/ui/FaixaDeMetricas'
import { Cartao } from '@/components/ui/Cartao'
import { Linha } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { EstadoVazio } from '@/components/ui/Estados'
import { formatDate, formatMonthYear } from '@/lib/format'
import { monthKey } from '@/lib/finance'
import { ACCOUNT_TYPE_LABEL, accountBalance, accountStatement } from '@/lib/treasury'

/*
 * CONTAS E EXTRATO (Fase 4, 23/10/2026).
 *
 * O teste do caixa é um só: o saldo do sistema bate com o do banco? Para isso
 * cada conta precisa do extrato do mês — saldo na véspera, cada movimento com
 * o saldo corrido e o saldo no último dia —, na mesma ordem em que o banco
 * mostra. Os números vêm de `accountStatement` e `accountBalance`
 * (lib/treasury.ts), os mesmos que o Início e o Fluxo de caixa usam.
 *
 * Cadastrar e editar conta continua em Configurações; aqui é só leitura.
 *
 * SOUZA 3.0 (02/11/2026): o saldo total é o número líder da faixa e cada
 * conta é uma célula ao lado dele (tocar troca o extrato). O extrato é a
 * lista da tela; o fechamento do mês (início, entrou, saiu, saldo final)
 * forma par com ele. Com mais de três contas, elas voltam a ser uma lista,
 * na coluna do fechamento.
 */
export function Contas() {
  const { accounts, transactions, transfers, mes, hoje } = useAdmin()
  const [params, setParams] = useSearchParams()
  const { abrir } = useComposicao()

  const ativas = useMemo(() => accounts.filter((a) => a.is_active), [accounts])
  const saldos = useMemo(
    () => ativas.map((a) => ({ conta: a, saldo: accountBalance(a, transactions, transfers, hoje).balance })),
    [ativas, transactions, transfers, hoje],
  )
  const total = useMemo(
    () => Math.round(saldos.filter((s) => s.conta.type !== 'credit_card').reduce((t, s) => t + s.saldo, 0) * 100) / 100,
    [saldos],
  )

  const escolhida = ativas.find((a) => a.id === params.get('conta')) ?? ativas[0]
  const chaveMes = monthKey(mes)
  const nomeDoMes = formatMonthYear(mes)

  /** O extrato inteiro da conta até o fim do mês; o mês é recortado dele. */
  const extrato = useMemo(() => {
    if (!escolhida) return null
    const fimDoMes = monthKey(new Date(mes.getFullYear(), mes.getMonth() + 1, 1)) + '-01'
    const todas = accountStatement(escolhida, transactions, transfers, accounts).filter((e) => e.date < fimDoMes)
    const antes = todas.filter((e) => e.date.slice(0, 7) < chaveMes)
    const doMes = todas.filter((e) => e.date.slice(0, 7) === chaveMes)
    const inicio = antes.length ? antes[antes.length - 1].running : escolhida.opening_balance
    const fim = doMes.length ? doMes[doMes.length - 1].running : inicio
    const soma = (dir: 'in' | 'out') =>
      Math.round(doMes.filter((e) => e.direction === dir).reduce((t, e) => t + e.amount, 0) * 100) / 100
    return { doMes, inicio, fim, entrou: soma('in'), saiu: soma('out') }
  }, [escolhida, transactions, transfers, accounts, mes, chaveMes])

  const antesDaAbertura = escolhida ? chaveMes < escolhida.opening_date.slice(0, 7) : false

  if (ativas.length === 0) {
    return (
      <PageLayout subtitulo="Onde o dinheiro da imobiliária entra e sai.">
        <Cartao rotuloAcessivel="Contas">
          <Cartao.Corpo>
            <EstadoVazio
              icone={Landmark}
              titulo="Nenhuma conta ativa"
              descricao="Cadastre as contas da imobiliária em Configurações para o saldo bater com o banco."
            />
          </Cartao.Corpo>
        </Cartao>
      </PageLayout>
    )
  }

  const naSoma = saldos.filter((s) => s.conta.type !== 'credit_card')
  const temCartao = saldos.length > naSoma.length
  const contasNaFaixa = saldos.length <= 3
  const escolher = (id: string) => setParams({ conta: id }, { replace: true })
  const abrirTotal = () =>
    abrir({
      rotulo: 'Saldo em contas',
      titulo: 'Saldo de cada conta ativa',
      explica: 'O que existe hoje em cada conta da imobiliária. Cartão de crédito fica de fora da soma.',
      total,
      itens: naSoma.map((s) => ({ id: s.conta.id, titulo: s.conta.name, meta: s.conta.bank ?? undefined, valor: s.saldo })),
      vazio: 'Nenhuma conta ativa.',
    })

  const frase = (
    <>
      <b>
        <Valor valor={total} posto="fato" tinta="text-t1" /> em contas hoje
      </b>
      {' · '}
      {naSoma.length === 1 ? '1 conta' : `${naSoma.length} contas`}
      {temCartao && ', cartão fora da soma'}
      {escolhida && ` · extrato de ${escolhida.name}`}
    </>
  )

  const metricas: Metrica[] = [
    {
      rotulo: 'Saldo em contas · hoje',
      valor: total,
      lider: true,
      estado: total < 0 ? 'negativo' : undefined,
      nota: temCartao ? 'soma das contas, sem o cartão' : 'soma das contas ativas',
      aoClicar: abrirTotal,
    },
    ...(contasNaFaixa
      ? saldos.map(({ conta, saldo }) => ({
          rotulo: conta.name,
          valor: saldo,
          estado: saldo < 0 ? ('negativo' as const) : undefined,
          nota:
            conta.id === escolhida?.id
              ? 'no extrato abaixo'
              : [ACCOUNT_TYPE_LABEL[conta.type], conta.bank].filter(Boolean).join(' · '),
          aoClicar: conta.id === escolhida?.id ? undefined : () => escolher(conta.id),
        }))
      : []),
  ]

  const ehHoje = chaveMes === hoje.slice(0, 7)
  const abriuNoMes = escolhida ? escolhida.opening_date.slice(0, 7) === chaveMes : false

  return (
    <PageLayout subtitulo={frase}>
      <FaixaDeMetricas rotuloAcessivel="Saldo das contas" metricas={metricas} />

      {escolhida && antesDaAbertura && (
        <Cartao rotuloAcessivel="Extrato">
          <Cartao.Corpo>
            <EstadoVazio
              icone={ReceiptText}
              titulo={`${escolhida.name} ainda não existia em ${nomeDoMes}`}
              descricao={`A conta começou no sistema em ${formatDate(escolhida.opening_date)}. Escolha um mês a partir daí.`}
            />
          </Cartao.Corpo>
        </Cartao>
      )}

      {/* items-start: o fechamento tem a altura dele, o extrato a do mês. */}
      <div className="grid items-start gap-bloco lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {escolhida && extrato && !antesDaAbertura && (
          <Cartao rotuloAcessivel={`Extrato de ${escolhida.name}`}>
            <Cartao.Cabecalho
              titulo={`Extrato · ${escolhida.name}`}
              meta={`${nomeDoMes.toLowerCase()} · ${extrato.doMes.length === 1 ? '1 movimento' : `${extrato.doMes.length} movimentos`}, com o saldo corrido`}
            />
            {extrato.doMes.length === 0 ? (
              <Cartao.Corpo>
                <EstadoVazio
                  icone={ReceiptText}
                  titulo="Nenhum movimento neste mês"
                  descricao="Nada entrou nem saiu desta conta."
                />
              </Cartao.Corpo>
            ) : (
              <Cartao.Lista
                colunas={{ valor: '10rem', fim: false }}
                rotuloAcessivel={`Extrato de ${escolhida.name}`}
                chaveEscada={`${escolhida.id}-${chaveMes}`}
              >
                {extrato.doMes.map((e) => (
                  <Linha
                    key={e.id}
                    titulo={e.description}
                    meta={`${formatDate(e.date)} · ${e.category}`}
                    valor={
                      <Valor
                        valor={e.direction === 'in' ? e.amount : -e.amount}
                        posto="linha"
                        estado={e.direction === 'in' ? 'recebido' : undefined}
                      />
                    }
                    metaValor={
                      <>
                        saldo <Valor valor={e.running} posto="fato" />
                      </>
                    }
                  />
                ))}
              </Cartao.Lista>
            )}
          </Cartao>
        )}

        <div className="flex min-w-0 flex-col gap-bloco">
          {escolhida && extrato && !antesDaAbertura && (
            <Cartao rotuloAcessivel="Fechamento do mês">
              <Cartao.Cabecalho titulo="Fechamento" meta="tem de bater com o extrato do banco" />
              <Cartao.Lista colunas={{ valor: '9rem' }} rotuloAcessivel={`Fechamento de ${escolhida.name} em ${nomeDoMes}`}>
                {/* Conta aberta no meio do mês começa no saldo de abertura, não na véspera. */}
                <Linha
                  titulo={abriuNoMes ? 'Saldo na abertura' : 'Início do mês'}
                  meta={abriuNoMes ? `a conta começou em ${formatDate(escolhida.opening_date)}` : `véspera de ${nomeDoMes.toLowerCase()}`}
                  valor={<Valor valor={extrato.inicio} posto="linha" />}
                />
                <Linha titulo="Entrou no mês" valor={<Valor valor={extrato.entrou} posto="linha" />} />
                <Linha titulo="Saiu no mês" valor={<Valor valor={-extrato.saiu} posto="linha" />} />
                <Linha
                  titulo={ehHoje ? 'Saldo hoje' : 'Saldo no fim do mês'}
                  meta={escolhida.name}
                  valor={<Valor valor={extrato.fim} posto="linha" forte estado={extrato.fim < 0 ? 'negativo' : undefined} />}
                />
              </Cartao.Lista>
              <Cartao.Rodape>
                <Link to="/config" className="min-h-11 py-3 hover:text-t2">
                  Cadastrar ou editar contas
                </Link>
              </Cartao.Rodape>
            </Cartao>
          )}

          {!contasNaFaixa && (
            <Cartao rotuloAcessivel="Contas">
              <Cartao.Cabecalho titulo="Contas" meta={`${saldos.length} ativas`} />
              <Cartao.Lista colunas={{ valor: true, fim: true }} rotuloAcessivel="Contas">
                {saldos.map(({ conta, saldo }) => (
                  <Linha
                    key={conta.id}
                    titulo={conta.name}
                    meta={
                      conta.id === escolhida?.id
                        ? 'no extrato'
                        : [ACCOUNT_TYPE_LABEL[conta.type], conta.bank].filter(Boolean).join(' · ')
                    }
                    valor={<Valor valor={saldo} posto="linha" estado={saldo < 0 ? 'negativo' : undefined} />}
                    aoClicar={() => escolher(conta.id)}
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
