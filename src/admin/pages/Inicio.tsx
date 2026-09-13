import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Handshake } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { Heroi } from '@/components/ui/Assinatura'
import { Secao } from '@/components/ui/Secao'
import { Lista, Linha } from '@/components/ui/Lista'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { Selo, Marcador } from '@/components/ui/Selo'
import { ChipSituacao } from '@/components/ui/Situacao'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { accountBalance } from '@/lib/treasury'
import { situacaoDeTela } from '@/lib/situacao'
import { formatCurrency } from '@/lib/format'
import type { MoneyItem } from '@/lib/sales'

/*
 * O INÍCIO DO ADMINISTRADOR.
 *
 * Esta tela foi reescrita porque ela estava ERRADA, não porque estava feia.
 * Quatro defeitos verificados contra o banco, e cada um deles é a mesma falha
 * de origem: o Início recalculava à mão os números que as telas de destino já
 * calculavam, e chegava a respostas diferentes.
 *
 * 1. "A pagar no mês" somava toda despesa pendente do mês — e a migração 009
 *    cria, no cadastro da venda, uma linha pendente para cada parcela futura:
 *    ISS retido, Simples, comissão do corretor e distribuição do sócio. O
 *    número apresentado como dívida do mês era, na carteira real, quase todo
 *    previsão. A tela de Pagar fazia o oposto e escrevia "não é dívida hoje".
 *
 * 2. "A receber no mês" descartava qualquer pendência fora do mês — inclusive
 *    o vencido, que é justamente o que precisa ser cobrado. A tela Receber
 *    inclui o vencido de qualquer mês. Mesmo conceito, dois totais, sem
 *    explicação em lugar nenhum.
 *
 * 3. "Resultado do mês" tratava retirada de sócio como despesa; o "Resultado"
 *    de Relatórios manda retirada para distribuição de lucro e a deixa fora do
 *    lucro líquido. Dois números com o mesmo rótulo, divergindo exatamente
 *    pelo valor das retiradas — a mesma classe de erro que já custou dois
 *    commits recentes.
 *
 * 4. "Próximos 30 dias" repetia os indicadores com outra régua e incluía o
 *    passado inteiro.
 *
 * A correção é estrutural, não cosmética: **o Início não calcula nada.** Ele
 * lê `receber`, `pagar` e `atencao` do contexto — as mesmas listas que as telas
 * de destino usam — e o único número que ele deriva é o saldo em conta, que
 * vinha escondido como segunda de seis seções de Relatórios.
 *
 * E a ordem inverteu: trabalho antes de contabilidade. O que precisa de ação
 * vem primeiro, com a ação na própria linha.
 */
export function Inicio() {
  const { transactions, transfers, accounts, atencao, receber, pagar, vendas, hoje, mes } = useAdmin()
  const { abrir } = useComposicao()

  const chaveMes = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`

  /** O número herói: o que existe de fato, hoje, na conta. */
  const saldo = useMemo(
    () =>
      accounts
        .filter((a) => a.is_active && a.type !== 'credit_card')
        .reduce((s, a) => s + accountBalance(a, transactions, transfers, hoje).balance, 0),
    [accounts, transactions, transfers, hoje],
  )

  /*
   * A janela de Receber, copiada dela e não reinventada: o mês selecionado
   * MAIS o vencido de qualquer mês.
   */
  const aReceber = useMemo(
    () => receber.filter((i) => i.date.slice(0, 7) === chaveMes || i.overdue),
    [receber, chaveMes],
  )
  const vencido = useMemo(() => aReceber.filter((i) => i.overdue), [aReceber])

  /*
   * A definição de src/lib/sales.ts (grupo), a mesma de Pagar e do CFO: devido
   * agora é comissão e imposto de parcela já recebida e despesa vencida ou que
   * vence hoje. Previsão fica de fora e aparece em número próprio; despesa
   * futura e retirada do sócio não entram em nenhum dos dois.
   */
  const devido = useMemo(() => pagar.filter((i) => i.grupo === 'devido'), [pagar])
  const previsto = useMemo(() => pagar.filter((i) => i.grupo === 'previsto'), [pagar])

  const soma = (l: MoneyItem[]) => Math.round(l.reduce((s, i) => s + i.amount, 0) * 100) / 100

  const vendasAtivas = vendas.filter((v) => v.status !== 'cancelada')

  /** Transforma uma lista de lançamentos na composição que a folha exibe. */
  const comp = (l: MoneyItem[]) =>
    l.map((i) => ({
      id: i.tx.id,
      titulo: i.label,
      meta: i.sale?.development ?? i.tx.category,
      valor: i.amount,
      situacao: i.installment
        ? situacaoDeTela(i.installment.status, i.installment.expected_date, hoje)
        : i.overdue
          ? ('vencida' as const)
          : ('prevista' as const),
      idx: i.installment?.idx,
      count: i.installment?.count,
      para: i.sale ? `/vendas/${i.sale.id}` : undefined,
    }))

  if (vendasAtivas.length === 0 && transactions.length === 0) {
    return (
      <EmptyState
        icon={<Handshake className="h-8 w-8" />}
        title="Tudo pronto para a primeira venda"
        description="Registre uma venda e o sistema cuida do resto: parcelas a receber, imposto na hora certa e a comissão do corretor liberada quando o dinheiro entrar."
      />
    )
  }

  return (
    <div className="animate-fade-in">
      {/*
       * UM número em degrau herói, e um só ponto de ouro na tela. É essa regra
       * que impede o Início de voltar a exibir três valores concorrentes: se só
       * um número pode ser herói, a tela é obrigada a declarar qual pergunta
       * ela responde.
       */}
      <Heroi
        rotulo="Disponível em conta"
        contexto="O que existe hoje, somando as contas ativas. Não entra nada previsto."
      >
        <Valor valor={saldo} posto="heroi" />
      </Heroi>

      {/* Trabalho primeiro. */}
      <Secao
        titulo="Precisa de atenção"
        subtotal={
          atencao.length > 0 ? (
            <span className="text-sm text-content-muted">
              {atencao.length === 1 ? '1 item' : `${atencao.length} itens`}
            </span>
          ) : undefined
        }
      >
        {atencao.length === 0 ? (
          <p className="flex items-center gap-2.5 py-3 text-base text-content-muted">
            <span className="text-income">
              <Marcador situacao="recebida" />
            </span>
            Nada vencido, nenhuma comissão liberada esperando e nenhum imposto em aberto.
          </p>
        ) : (
          <Lista>
            {atencao.map((a) => (
              <Linha
                key={a.id}
                selo={
                  <Selo
                    situacao={a.tone === 'critical' ? 'vencida' : a.tone === 'warning' ? 'liberada' : 'prevista'}
                    glifo="traco"
                  />
                }
                titulo={a.title}
                meta={a.detail}
                valor={<Valor valor={a.amount} posto="linha" />}
                para={a.to}
              />
            ))}
          </Lista>
        )}
      </Secao>

      <Secao titulo="O mês">
        <Lista>
          <Linha
            titulo="A receber"
            meta={`${aReceber.length} ${aReceber.length === 1 ? 'parcela' : 'parcelas'} neste mês, mais o vencido`}
            situacao={vencido.length > 0 ? <ChipSituacao situacao="vencida" /> : undefined}
            valor={
              <ValorComOrigem
                valor={soma(aReceber)}
                rotuloAcessivel="Ver de onde vem o total a receber"
                aoAbrir={() =>
                  abrir({
                    rotulo: 'A receber',
                    titulo: 'A receber neste mês, mais o vencido',
                    explica:
                      'Parcelas de comissão que a imobiliária ainda vai receber. Inclui o vencido de meses anteriores, porque é o que precisa de cobrança.',
                    total: soma(aReceber),
                    itens: comp(aReceber),
                    vazio: 'Nada a receber neste mês.',
                  })
                }
              />
            }
          />
          <Linha
            titulo="Devido agora"
            meta="comissão já liberada, imposto de parcela recebida e despesa"
            valor={
              <ValorComOrigem
                valor={soma(devido)}
                rotuloAcessivel="Ver de onde vem o total devido"
                aoAbrir={() =>
                  abrir({
                    rotulo: 'Devido agora',
                    titulo: 'O que é obrigação hoje',
                    explica:
                      'Só o que a imobiliária de fato deve: comissão de parcela já recebida, imposto de parcela já recebida e despesa lançada.',
                    total: soma(devido),
                    itens: comp(devido),
                    nota: 'Comissão de parcela que a construtora ainda não pagou não entra aqui. Ela aparece abaixo, como previsão.',
                    vazio: 'Nada devido agora.',
                  })
                }
              />
            }
          />
          {/*
           * A previsão aparece, porque esconder informação não é honestidade —
           * mas em linha própria, com a palavra "depende", e sem cor tônica.
           * Nunca somada ao devido.
           */}
          <Linha
            titulo="Previsto, depende do recebimento"
            meta="comissão e imposto de parcela que a construtora ainda não pagou"
            situacao={<ChipSituacao situacao="prevista" />}
            valor={
              <ValorComOrigem
                valor={soma(previsto)}
                tinta="text-content-muted"
                rotuloAcessivel="Ver de onde vem o total previsto"
                aoAbrir={() =>
                  abrir({
                    rotulo: 'Previsto',
                    titulo: 'Previsão, não dívida',
                    explica:
                      'Estes valores só passam a ser devidos quando a construtora pagar a parcela. Até lá não são obrigação e não entram em nenhum total de dívida.',
                    total: soma(previsto),
                    itens: comp(previsto),
                    vazio: 'Nenhuma previsão em aberto.',
                  })
                }
              />
            }
          />
        </Lista>
        <div className="mt-3 flex gap-2">
          <Link to="/receber" className="flex-1 sm:flex-none">
            <Button variant="secondary" className="w-full">
              Ver A receber
            </Button>
          </Link>
          <Link to="/pagar" className="flex-1 sm:flex-none">
            <Button variant="secondary" className="w-full">
              Ver A pagar
            </Button>
          </Link>
        </div>
      </Secao>

      <Secao titulo="Carteira">
        <Lista>
          <Linha
            titulo="Vendas em carteira"
            meta={`${vendasAtivas.length} ${vendasAtivas.length === 1 ? 'venda ativa' : 'vendas ativas'}`}
            valor={<Valor valor={soma(receber)} posto="linha" tinta="text-content-muted" />}
            para="/vendas"
          />
        </Lista>
        <p className="mt-2 text-sm text-content-faint">
          {formatCurrency(soma(receber))} é toda a comissão contratada que ainda não entrou, somando
          todos os meses.
        </p>
      </Secao>

      {vendasAtivas.some((v) => v.hasOverdue) && (
        <p className="mt-8 border-t border-rule pt-3 text-sm text-content-muted">
          Parcela vencida quase sempre é a construtora atrasando, não o cliente. Reagende na ficha da
          venda para a previsão voltar a fazer sentido — o corretor vê a data nova na hora.
        </p>
      )}
    </div>
  )
}
