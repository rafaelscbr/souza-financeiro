import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Landmark, ReceiptText } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Heroi } from '@/components/ui/Heroi'
import { Cartao } from '@/components/ui/Cartao'
import { Linha, LinhaGrupo } from '@/components/ui/Lista'
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

  return (
    <PageLayout subtitulo="O saldo de cada conta e o extrato do mês, para conferir com o banco.">
      <Heroi
        variante="ouro"
        rotulo="Saldo em contas · hoje"
        valor={total}
        rotuloAcessivel="Ver o saldo de cada conta"
        aoAbrir={() =>
          abrir({
            rotulo: 'Saldo em contas',
            titulo: 'Saldo de cada conta ativa',
            explica: 'O que existe hoje em cada conta da imobiliária. Cartão de crédito fica de fora da soma.',
            total,
            itens: saldos
              .filter((s) => s.conta.type !== 'credit_card')
              .map((s) => ({ id: s.conta.id, titulo: s.conta.name, meta: s.conta.bank ?? undefined, valor: s.saldo })),
            vazio: 'Nenhuma conta ativa.',
          })
        }
        frase="A soma das contas ativas da imobiliária, com as transferências entre elas. Cartão de crédito fica de fora."
      />

      <Cartao>
        <Cartao.Cabecalho titulo="Contas" icone={Landmark} meta="toque numa conta para ver o extrato" />
        <Cartao.Lista colunas={{ valor: true, fim: true }} rotuloAcessivel="Contas">
          {saldos.map(({ conta, saldo }) => (
            <Linha
              key={conta.id}
              titulo={conta.id === escolhida?.id ? `${conta.name} · no extrato abaixo` : conta.name}
              meta={[ACCOUNT_TYPE_LABEL[conta.type], conta.bank].filter(Boolean).join(' · ')}
              valor={<Valor valor={saldo} posto="linha" estado={saldo < 0 ? 'negativo' : undefined} />}
              aoClicar={() => setParams({ conta: conta.id }, { replace: true })}
            />
          ))}
        </Cartao.Lista>
        <Cartao.Rodape>
          <Link to="/config" className="min-h-11 py-3 hover:text-t2">
            Cadastrar ou editar contas em Configurações
          </Link>
        </Cartao.Rodape>
      </Cartao>

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

      {escolhida && extrato && !antesDaAbertura && (
        <Cartao>
          <Cartao.Cabecalho titulo={`Extrato · ${escolhida.name}`} icone={ReceiptText} meta={nomeDoMes} />
          <Cartao.Lista colunas={{ valor: '10rem', fim: false }} rotuloAcessivel={`Extrato de ${escolhida.name}`}>
            {/* Conta aberta no meio do mês começa no saldo de abertura, não na véspera. */}
            <Linha
              titulo={escolhida.opening_date.slice(0, 7) === chaveMes ? 'Saldo na abertura da conta' : 'Saldo no início do mês'}
              meta={
                escolhida.opening_date.slice(0, 7) === chaveMes
                  ? `a conta começou no sistema em ${formatDate(escolhida.opening_date)}`
                  : `véspera de ${nomeDoMes}`
              }
              valor={<Valor valor={extrato.inicio} posto="linha" />}
            />
            <LinhaGrupo rotulo={`Movimentos · ${extrato.doMes.length}`} />
            {extrato.doMes.length === 0 ? (
              <Linha titulo="Nenhum movimento neste mês" meta="nada entrou nem saiu desta conta" />
            ) : (
              extrato.doMes.map((e) => (
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
              ))
            )}
            <LinhaGrupo rotulo="Fechamento" />
            <Linha titulo="Entrou no mês" valor={<Valor valor={extrato.entrou} posto="linha" />} />
            <Linha titulo="Saiu no mês" valor={<Valor valor={-extrato.saiu} posto="linha" />} />
            <Linha
              titulo={chaveMes === hoje.slice(0, 7) ? 'Saldo hoje' : 'Saldo no fim do mês'}
              meta="tem de bater com o extrato do banco"
              valor={<Valor valor={extrato.fim} posto="linha" estado={extrato.fim < 0 ? 'negativo' : undefined} />}
            />
          </Cartao.Lista>
        </Cartao>
      )}
    </PageLayout>
  )
}
