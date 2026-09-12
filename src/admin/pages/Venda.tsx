import { Fragment, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, CalendarClock, Pencil, Undo2 } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { ReceberParcela } from '../ReceberParcela'
import { PagarComissao, type ComissaoAPagar } from '../PagarComissao'
import { useComposicao } from '@/components/composicao/Composicao'
import { Heroi } from '@/components/ui/Assinatura'
import { Secao } from '@/components/ui/Secao'
import { Lista, Linha, LinhaDeHoje } from '@/components/ui/Lista'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { Cascata, LinhaCascata, TotalCascata } from '@/components/ui/Cascata'
import { Selo } from '@/components/ui/Selo'
import { ChipSituacao, FraseDeTempo } from '@/components/ui/Situacao'
import { Trilha } from '@/components/ui/Trilha'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { FormField, Input, Textarea } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { brokerStatusOf } from '@/lib/sales'
import { situacaoDeTela, fraseDeTempo, diasEntre } from '@/lib/situacao'
import { formatCurrency, formatDate, formatDateShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SaleInstallment } from '@/types'

/*
 * A FICHA DA VENDA — a tela mais importante do administrador.
 *
 * Ela é, antes de tudo, um DOCUMENTO: alguém confere aqui, contra o extrato e
 * contra o contrato, se a conta da comissão fecha. Era esse o problema do
 * desenho anterior — ele tinha os números certos e a hierarquia errada:
 *
 * 1. O líquido da venda, que é a resposta da tela, aparecia como mais uma
 *    linha da conta, e a fatia que ele representa da comissão ficava num texto
 *    de 11px alinhado à direita. Agora é o único número em degrau herói.
 *
 * 2. Logo abaixo da conta vinha uma grade de quatro indicadores (Recebido, A
 *    receber, Comissão paga, Comissão a pagar) — e os dois primeiros repetiam,
 *    em caixinha, exatamente os dois números que a barra de progresso já
 *    escrevia uma linha acima. A grade de quatro indicadores é vetada por
 *    escrito (docs/sistema-visual.md §10); virou lista.
 *
 * 3. "Comissão a pagar" era um número só, somando a comissão LIBERADA (parcela
 *    que a imobiliária já recebeu, e que ela de fato deve hoje) com a comissão
 *    de parcela que a construtora ainda não pagou. É a mesma confusão que fazia
 *    o Início contar previsão como dívida. São duas linhas agora, com palavras
 *    diferentes.
 *
 * 4. Na lista de parcelas, um triângulo vermelho de 16px sem texto nenhum era
 *    o único sinal de que a construtora tinha atrasado. Agora o atraso está
 *    escrito por `fraseDeTempo` e o triângulo é `aria-hidden`: reforço, nunca
 *    o canal.
 *
 * Nenhuma conta mudou. A cascata da comissão mora na migração 009, gravada
 * parcela a parcela, e é lida daqui por `cascadeOf`; esta tela só a apresenta.
 */
export function Venda() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { abrir } = useComposicao()
  const {
    vendas, transactions, hoje, desfazerRecebimento, reagendarParcela, cancelarVenda, editarVenda,
  } = useAdmin()

  const [recebendo, setRecebendo] = useState<SaleInstallment | null>(null)
  const [pagando, setPagando] = useState<ComissaoAPagar[] | null>(null)
  const [reagendando, setReagendando] = useState<SaleInstallment | null>(null)
  const [novaData, setNovaData] = useState('')
  const [notaReagendar, setNotaReagendar] = useState('')
  const [cancelando, setCancelando] = useState(false)
  const [notaCancelar, setNotaCancelar] = useState('')
  const [editando, setEditando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const venda = vendas.find((v) => v.id === id)
  const statusPorTx = useMemo(() => new Map(transactions.map((t) => [t.id, t.status])), [transactions])
  const valorPorTx = useMemo(() => new Map(transactions.map((t) => [t.id, t.amount])), [transactions])

  if (!venda) {
    return (
      <EmptyState
        title="Venda não encontrada"
        description="Ela pode ter sido removida."
        action={
          <Link to="/vendas">
            <Button variant="secondary">Voltar para Vendas</Button>
          </Link>
        }
      />
    )
  }

  const c = venda.cascade
  const ativa = venda.status !== 'cancelada'

  /*
   * Parcela cancelada fica no histórico, riscada, mas está fora de toda soma —
   * é o mesmo recorte que `cascadeOf` faz em src/lib/sales.ts.
   */
  const vivas = venda.installments.filter((p) => p.status !== 'cancelada')
  const recebidas = vivas.filter((p) => p.status === 'recebida')

  /*
   * A base do cálculo: comissão menos os dois impostos. Não é conta nova — é o
   * mesmo `v_base` da migração 009, que é sobre ele que o percentual do
   * corretor incide. Escrever essa linha é o que torna "base × 65%" conferível.
   */
  const base = arredonda(c.commission - c.iss - c.simples)
  /** O que foi CONTRATADO com o corretor, antes de qualquer desconto. */
  const corretorContratado = arredonda(vivas.reduce((s, p) => s + p.broker_amount, 0))
  /** Comissão do corretor que é dívida hoje: a parcela já entrou e ele não recebeu. */
  const corretorPrevisto = arredonda(venda.brokerToPay - venda.brokerReleased)

  /** Cada parcela com a situação de tela já derivada — nunca à mão. */
  const parcelas = venda.installments.map((p) => ({
    p,
    s: situacaoDeTela(p.status, p.expected_date, hoje),
  }))
  /*
   * Onde entra a linha do HOJE: antes da primeira parcela cuja data ainda não
   * chegou. Acima dela é fato, abaixo é promessa — e uma parcela que a
   * construtora atrasou fica acima, porque a data já passou.
   */
  const primeiraFutura = parcelas.findIndex(({ p }) => p.expected_date >= hoje)
  const marcaHoje = primeiraFutura > 0

  /** Uma parcela virando item da folha de composição. */
  const itemParcela = ({ p, s }: { p: SaleInstallment; s: ReturnType<typeof situacaoDeTela> }) => ({
    id: p.id,
    titulo: p.count > 1 ? `Parcela ${p.idx} de ${p.count}` : 'Parcela única',
    meta: fraseDeTempo(s, { prevista: p.expected_date, recebida: p.received_date }, hoje),
    valor: p.amount,
    situacao: s,
    idx: p.idx,
    count: p.count,
  })

  /*
   * A frase que acompanha o herói existe para dizer o que o número NÃO é. O
   * líquido é da venda inteira, então parte dele ainda é promessa da
   * construtora — e dizer isso junto do número é o que impede lê-lo como caixa.
   */
  const contextoDoHeroi = !ativa
    ? 'Venda cancelada. O que já tinha sido recebido e pago continua registrado, e o imposto de parcela já recebida continua devido.'
    : venda.toReceive > 0
      ? `${Math.round(c.netShare * 100)}% da comissão contratada, depois do imposto e da comissão do corretor. Não é caixa: ${formatCurrency(venda.toReceive)} desta venda ainda dependem da construtora pagar.`
      : `${Math.round(c.netShare * 100)}% da comissão contratada, depois do imposto e da comissão do corretor. A comissão desta venda já entrou por inteiro.`

  async function acao(fn: () => Promise<void>, msg: string) {
    setErro(null)
    setOcupado(true)
    try {
      await fn()
      showToast({ message: msg })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para completar.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <Link
        to="/vendas"
        className="inline-flex min-h-toque items-center gap-1.5 text-base text-content-muted transition-colors hover:text-content"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Vendas
      </Link>

      <h1 className="mt-1 text-lg font-semibold tracking-[-0.005em] text-content">{venda.title}</h1>
      <p className="mt-1 text-base text-content-muted">
        {[
          venda.client_name,
          venda.development,
          `vendida em ${formatDate(venda.sale_date)}`,
          /*
           * Quando o sistema não sabe, ele diz em texto, não em zero: uma das
           * vendas da carteira real foi cadastrada sem o valor do imóvel, e
           * "R$ 0,00" ali seria uma afirmação falsa sobre o imóvel.
           */
          venda.property_value != null
            ? `imóvel ${formatCurrency(venda.property_value)}`
            : 'valor do imóvel não informado',
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <p className="mt-0.5 text-sm text-content-faint">
        {[
          venda.brokerName ? `${venda.brokerName} ${venda.broker_pct ?? 0}%` : 'sem corretor',
          venda.issues_invoice ? `Simples ${venda.simples_pct}%` : 'sem nota fiscal',
          venda.retains_iss ? `ISS retido ${venda.iss_pct}%` : null,
          venda.partner_name
            ? `parceria ${venda.partner_name} (${venda.partner_share_pct}% da Souza)`
            : null,
          venda.status === 'cancelada' ? 'venda cancelada' : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {venda.notes && <p className="mt-2 text-base text-content-muted">{venda.notes}</p>}

      {/*
       * O número que a tela responde. Ele não recebe cor tônica de propósito:
       * parte deste líquido ainda depende da construtora pagar, e verde neste
       * sistema significa uma coisa só — dinheiro que se moveu.
       */}
      <Heroi
        rotulo="Fica para a imobiliária"
        contexto={contextoDoHeroi}
        acao={
          ativa ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditando(true)}>
                <Pencil className="h-4 w-4" aria-hidden />
                Editar
              </Button>
              <Button variant="danger" onClick={() => setCancelando(true)}>
                Cancelar venda
              </Button>
            </div>
          ) : undefined
        }
      >
        <Valor valor={c.net} posto="heroi" />
      </Heroi>

      {/*
       * A CASCATA — o documento central desta tela.
       *
       * A ordem é a da migração 009 e não muda: comissão, os dois impostos pelo
       * nome inteiro, a base, o que vai para o corretor e o que sobra. Cada
       * dedução traz a conta escrita ao lado ("3% sobre a comissão"), porque um
       * percentual sem a base não se confere.
       */}
      <Secao titulo="A conta da comissão">
        <Cascata>
          <LinhaCascata
            rotulo="Comissão da imobiliária"
            detalhe={vivas.length > 1 ? `soma das ${vivas.length} parcelas` : 'parcela única'}
            valor={c.commission}
          />
          {c.iss > 0 && (
            <LinhaCascata
              rotulo="ISS retido na fonte"
              detalhe={`${venda.iss_pct}% sobre a comissão, retido pela construtora`}
              valor={c.iss}
              subtracao
            />
          )}
          {c.simples > 0 && (
            <LinhaCascata
              rotulo="Imposto (Simples Nacional)"
              detalhe={`${venda.simples_pct}% sobre a comissão menos o ISS`}
              valor={c.simples}
              subtracao
            />
          )}
          {(c.iss > 0 || c.simples > 0) && (
            <LinhaCascata
              rotulo="Base do cálculo da comissão"
              detalhe="é sobre ela que incide o percentual do corretor"
              valor={base}
            />
          )}

          {/*
           * O DESCONTO COMBINADO, e por que ele não é uma dedução da
           * imobiliária.
           *
           * `pay_broker_installments` (migração 009) paga ao corretor
           * `broker_amount − ajuste`, e `cascadeOf` reflete isso em
           * `broker = soma(broker_amount) − brokerAdjustment`. Ou seja: o
           * desconto sai da comissão DELE, e o que ele deixa de receber fica
           * com a imobiliária. Mostrá-lo como mais um "(−)" na coluna da
           * imobiliária subtrairia duas vezes o mesmo valor e o total deixaria
           * de fechar. Então, quando há desconto, o bloco do corretor vira uma
           * conta própria de três linhas, e só a última — o que de fato sai
           * daqui — entra como dedução.
           */}
          {corretorContratado > 0 &&
            (c.brokerAdjustment > 0 ? (
              <>
                <LinhaCascata
                  rotulo={`Comissão de ${venda.brokerName ?? 'corretor'}`}
                  detalhe={`base × ${venda.broker_pct ?? 0}%`}
                  valor={corretorContratado}
                />
                <LinhaCascata
                  rotulo="desconto combinado"
                  detalhe="abatido da comissão do corretor"
                  valor={c.brokerAdjustment}
                  subtracao
                />
                <LinhaCascata rotulo="Pago ao corretor" valor={c.broker} subtracao />
              </>
            ) : (
              <LinhaCascata
                rotulo={`Comissão de ${venda.brokerName ?? 'corretor'}`}
                detalhe={`base × ${venda.broker_pct ?? 0}%`}
                valor={c.broker}
                subtracao
              />
            ))}

          {c.owner > 0 && (
            <LinhaCascata
              rotulo="Distribuição ao sócio"
              detalhe={`${venda.owner_profit_pct ?? 0}% do que sobra depois da comissão do corretor`}
              valor={c.owner}
              subtracao
            />
          )}

          <TotalCascata
            rotulo="Fica para a imobiliária"
            valor={c.net}
            nota={`${Math.round(c.netShare * 100)}% da comissão contratada.`}
          />
        </Cascata>
      </Secao>

      {ativa && (
        <Secao titulo="O que já entrou">
          {/*
           * A trilha renderiza na largura final, sem crescer: uma barra que
           * enche enquanto a pessoa olha sugere que a comissão está sendo paga
           * agora. O número vem escrito ao lado, sempre — a barra é reforço.
           */}
          <div className="mb-3">
            <Trilha
              recebido={venda.received}
              liberado={0}
              previsto={venda.toReceive}
              rotuloAcessivel={`De ${formatCurrency(c.commission)} de comissão, ${formatCurrency(venda.received)} já entraram e ${formatCurrency(venda.toReceive)} dependem da construtora.`}
            />
          </div>

          <Lista>
            <Linha
              selo={<Selo situacao="recebida" />}
              titulo="Comissão já recebida"
              meta={`${recebidas.length} de ${vivas.length} ${vivas.length === 1 ? 'parcela' : 'parcelas'}`}
              valor={
                recebidas.length > 0 ? (
                  <ValorComOrigem
                    valor={venda.received}
                    tinta="text-income"
                    rotuloAcessivel="Ver quais parcelas já entraram"
                    aoAbrir={() =>
                      abrir({
                        rotulo: 'Já recebida',
                        titulo: 'O que já entrou desta venda',
                        total: venda.received,
                        itens: parcelas.filter(({ s }) => s === 'recebida').map(itemParcela),
                      })
                    }
                  />
                ) : (
                  <Valor valor={0} tinta="text-content-muted" />
                )
              }
            />
            <Linha
              selo={<Selo situacao="prevista" />}
              titulo="Ainda a receber"
              meta="depende da construtora pagar"
              situacao={<ChipSituacao situacao="prevista" />}
              valor={
                venda.toReceive > 0 ? (
                  <ValorComOrigem
                    valor={venda.toReceive}
                    tinta="text-content-muted"
                    rotuloAcessivel="Ver quais parcelas ainda faltam"
                    aoAbrir={() =>
                      abrir({
                        rotulo: 'A receber',
                        titulo: 'O que ainda falta entrar',
                        explica:
                          'Estas parcelas não são dívida de ninguém hoje: elas dependem da construtora pagar. Se a data mudar, reagende na parcela.',
                        total: venda.toReceive,
                        itens: parcelas.filter(({ s }) => s === 'prevista').map(itemParcela),
                      })
                    }
                  />
                ) : (
                  <Valor valor={0} tinta="text-content-muted" />
                )
              }
            />

            {venda.brokerName && corretorContratado > 0 && (
              <>
                <Linha
                  selo={<Selo situacao="recebida" />}
                  titulo={`Comissão paga a ${venda.brokerName}`}
                  meta="já saiu da conta"
                  valor={<Valor valor={venda.brokerPaid} tinta="text-content-muted" />}
                />
                {/*
                 * As duas linhas abaixo eram UM número só, "Comissão a pagar",
                 * somando o que a imobiliária deve hoje com o que ela só vai
                 * dever se a construtora pagar. Separá-las é a regra de negócio
                 * mais importante do sistema: atraso é só o que a imobiliária
                 * já recebeu e não repassou.
                 */}
                {venda.brokerReleased > 0 && (
                  <Linha
                    selo={<Selo situacao="liberada" />}
                    titulo="Comissão liberada, a pagar"
                    meta="a parcela já entrou; o corretor está esperando"
                    situacao={<ChipSituacao situacao="liberada" />}
                    valor={<Valor valor={venda.brokerReleased} />}
                  />
                )}
                {corretorPrevisto > 0 && (
                  <Linha
                    selo={<Selo situacao="prevista" />}
                    titulo="Comissão prevista do corretor"
                    meta="só vira dívida quando a construtora pagar"
                    situacao={<ChipSituacao situacao="prevista" />}
                    valor={<Valor valor={corretorPrevisto} tinta="text-content-muted" />}
                  />
                )}
              </>
            )}
          </Lista>
        </Secao>
      )}

      <Secao titulo="Parcelas">
        <Lista>
          {parcelas.map(({ p, s }, i) => {
            const stCorretor = brokerStatusOf(p, statusPorTx)
            /*
             * O corretor tem situação PRÓPRIA, e ela usa a data em que a
             * imobiliária recebeu: é a partir daí que ela está com o dinheiro
             * dele na mão. Por isso "vencida" só pode nascer aqui, nunca na
             * parcela — a construtora atrasar não é atraso de ninguém.
             */
            const sCorretor = situacaoDeTela(
              stCorretor,
              p.received_date ?? p.expected_date,
              hoje,
            )
            const pagoAoCorretor = p.broker_tx_id
              ? valorPorTx.get(p.broker_tx_id) ?? p.broker_amount
              : p.broker_amount
            /*
             * A construtora atrasou: data prevista no passado e a parcela não
             * entrou. Isto NÃO é "vencida" — vencida é só o que a imobiliária
             * recebeu e não repassou. É a mesma condição que `fraseDeTempo`
             * usa para escrever "era prevista para 12/08 · a construtora
             * atrasou", e por isso reusa `diasEntre` em vez de comparar datas
             * de um jeito próprio.
             */
            const construtoraAtrasou = s === 'prevista' && diasEntre(hoje, p.expected_date) < 0
            /*
             * A frase da comissão do corretor. "Liberada em 02/09 · 10 dias
             * esperando" é a frase do sistema e é onde o atraso REAL aparece.
             * Para a comissão já paga o app não tem a data do repasse à mão —
             * ela está na transação, não na parcela —, então a palavra vai
             * sozinha em vez de uma data emprestada da parcela, que seria a
             * data errada.
             */
            const fraseCorretor =
              sCorretor === 'recebida'
                ? 'paga'
                : sCorretor === 'prevista'
                  ? 'prevista'
                  : fraseDeTempo(
                      sCorretor,
                      { prevista: p.expected_date, liberada: p.received_date },
                      hoje,
                    )

            /*
             * Parcela cancelada não tem ação nenhuma — e sem esta guarda a
             * fileira de botões viraria uma tira vazia de 8px embaixo dela.
             */
            const temAcao = ativa && (p.status === 'prevista' || p.status === 'recebida')

            const acoes = temAcao && (
              <div className="mt-2 flex flex-wrap gap-2 pl-9">
                {p.status === 'prevista' && (
                  <>
                    <Button onClick={() => setRecebendo(p)} disabled={ocupado}>
                      Recebi esta parcela
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setReagendando(p)
                        setNovaData(p.expected_date)
                        setNotaReagendar('')
                      }}
                      disabled={ocupado}
                    >
                      <CalendarClock className="h-4 w-4" aria-hidden />
                      Reagendar
                    </Button>
                  </>
                )}
                {stCorretor === 'liberada' && p.broker_amount > 0 && (
                  <Button
                    onClick={() =>
                      setPagando([
                        {
                          installmentId: p.id,
                          brokerName: venda.brokerName ?? 'corretor',
                          saleTitle: venda.title,
                          parcela: `parcela ${p.idx}/${p.count}`,
                          amount: p.broker_amount,
                          dueDate: p.received_date ?? p.expected_date,
                        },
                      ])
                    }
                    disabled={ocupado}
                  >
                    Pagar comissão
                  </Button>
                )}
                {p.status === 'recebida' && (
                  <Button
                    variant="ghost"
                    onClick={() => acao(() => desfazerRecebimento(p.id), 'Recebimento desfeito')}
                    disabled={ocupado}
                  >
                    <Undo2 className="h-4 w-4" aria-hidden />
                    Desfazer recebimento
                  </Button>
                )}
              </div>
            )

            return (
              <Fragment key={p.id}>
                {marcaHoje && i === primeiraFutura && <LinhaDeHoje />}
                {/*
                 * Esta linha é composta à mão, com a geometria da `Linha` do
                 * kit (goteira de 24px, degrau de comparação à direita, fio
                 * entre linhas): cada parcela carrega até duas ações de 44px,
                 * e a `Linha` põe a ação na mesma fileira do valor — no
                 * celular isso espremeria o texto a quase nada. Aqui as ações
                 * quebram para baixo.
                 */}
                <li className="py-2.5">
                  <div className="flex min-h-[3.5rem] w-full items-center gap-3">
                    <span className="flex w-6 shrink-0 justify-center pt-0.5">
                      <Selo situacao={s} idx={p.idx} count={p.count} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-base font-medium text-content">
                        {p.count > 1 ? `Parcela ${p.idx} de ${p.count}` : 'Parcela única'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {/* O triângulo virou reforço de um texto que diz a mesma coisa. */}
                        {construtoraAtrasou && (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-critical" aria-hidden />
                        )}
                        <FraseDeTempo
                          situacao={s}
                          prevista={p.expected_date}
                          recebida={p.received_date}
                          className={cn(construtoraAtrasou && 'text-critical')}
                        />
                      </span>
                      <span className="mt-0.5 sm:hidden">
                        <ChipSituacao situacao={s} />
                      </span>
                    </span>
                    <span className="hidden shrink-0 sm:block">
                      <ChipSituacao situacao={s} />
                    </span>
                    <span className="shrink-0 text-right">
                      {/* Mesmo degrau para todas: parcelas irregulares se comparam por contagem de dígitos. */}
                      <Valor
                        valor={p.amount}
                        posto="linha"
                        tinta={s === 'cancelada' ? 'text-content-faint line-through' : undefined}
                      />
                    </span>
                  </div>

                  {/* O que esta parcela vira quando entra: imposto, corretor e líquido. */}
                  <p className="flex flex-wrap gap-x-4 gap-y-0.5 pl-9 text-sm text-content-faint">
                    {p.iss_amount > 0 && <span>ISS {formatCurrency(p.iss_amount)}</span>}
                    {p.simples_amount > 0 && <span>Simples {formatCurrency(p.simples_amount)}</span>}
                    {p.broker_amount > 0 && (
                      <span
                        className={cn(
                          sCorretor === 'liberada' && 'font-medium text-content',
                          sCorretor === 'vencida' && 'font-medium text-critical',
                        )}
                      >
                        {venda.brokerName ?? 'corretor'}{' '}
                        {formatCurrency(stCorretor === 'recebida' ? pagoAoCorretor : p.broker_amount)}
                        {' · '}
                        {fraseCorretor}
                        {p.broker_adjustment > 0
                          ? ` · desconto de ${formatCurrency(p.broker_adjustment)}`
                          : ''}
                      </span>
                    )}
                    {p.status === 'recebida' &&
                      p.received_amount != null &&
                      p.received_amount !== p.amount && (
                        <span>caiu {formatCurrency(p.received_amount)}</span>
                      )}
                    <span className="text-content-muted">
                      fica para a imobiliária {formatCurrency(p.net_amount)}
                    </span>
                  </p>

                  {p.notes && <p className="pl-9 text-sm text-content-faint">{p.notes}</p>}

                  {acoes}
                </li>
              </Fragment>
            )
          })}
        </Lista>
      </Secao>

      {erro && (
        <p
          className="mt-6 rounded-lg bg-critical-field px-3.5 py-2.5 text-base text-critical-ink"
          role="alert"
        >
          {erro}
        </p>
      )}

      <ReceberParcela venda={venda} parcela={recebendo} onFechar={() => setRecebendo(null)} />
      <PagarComissao itens={pagando} onFechar={() => setPagando(null)} />

      {/* Reagendar */}
      <Modal
        open={!!reagendando}
        onClose={() => setReagendando(null)}
        title="Reagendar parcela"
        description="A data anterior fica registrada, e o corretor vê a nova na hora."
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setReagendando(null)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={ocupado || !novaData}
              onClick={async () => {
                const p = reagendando!
                await acao(
                  () => reagendarParcela(p.id, novaData, notaReagendar || undefined),
                  'Parcela reagendada',
                )
                setReagendando(null)
              }}
            >
              {ocupado ? <Spinner className="h-5 w-5" /> : 'Reagendar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField label="Nova data prevista" htmlFor="rg-data">
            <Input id="rg-data" type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} autoFocus />
          </FormField>
          <FormField label="Motivo" htmlFor="rg-nota" hint="opcional">
            <Input
              id="rg-nota"
              value={notaReagendar}
              onChange={(e) => setNotaReagendar(e.target.value)}
              placeholder="Ex.: construtora adiou a medição"
            />
          </FormField>
          {reagendando && (
            <p className="text-sm text-content-faint">
              Estava prevista para {formatDateShort(reagendando.expected_date)}.
            </p>
          )}
        </div>
      </Modal>

      {/* Cancelar */}
      <Modal
        open={cancelando}
        onClose={() => setCancelando(false)}
        title="Cancelar esta venda?"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setCancelando(false)}>
              Não cancelar
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={ocupado}
              onClick={async () => {
                await acao(() => cancelarVenda(venda.id, notaCancelar || undefined), 'Venda cancelada')
                setCancelando(false)
                navigate('/vendas')
              }}
            >
              {ocupado ? <Spinner className="h-5 w-5" /> : 'Sim, cancelar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-base text-content">
            Vão ser canceladas{' '}
            <strong>
              {venda.installments.filter((p) => p.status === 'prevista').length} parcela(s) prevista(s)
            </strong>{' '}
            no valor de{' '}
            <strong className="cifra">{formatCurrency(venda.toReceive)}</strong>, e as comissões ainda
            não pagas dessas parcelas.
          </p>
          <p className="text-base text-content-muted">
            O que já foi recebido e pago continua registrado — e o imposto de parcela já recebida
            continua devido. Se houver devolução, lance como despesa depois.
          </p>
          <FormField label="Motivo" htmlFor="cc-nota" hint="opcional">
            <Textarea
              id="cc-nota"
              value={notaCancelar}
              onChange={(e) => setNotaCancelar(e.target.value)}
              placeholder="Ex.: distrato assinado em 10/09"
            />
          </FormField>
        </div>
      </Modal>

      <EditarVenda
        aberto={editando}
        onFechar={() => setEditando(false)}
        venda={venda}
        onSalvar={async (dados) => {
          await acao(() => editarVenda(venda.id, dados), 'Venda atualizada')
          setEditando(false)
        }}
        ocupado={ocupado}
      />
    </div>
  )
}

const arredonda = (n: number) => Math.round(n * 100) / 100

/**
 * Editar só o que não mexe em dinheiro. Valor de comissão, percentual e
 * parcelas não entram aqui de propósito: mudá-los depois de lançado exigiria
 * reescrever o razão, e a saída honesta é cancelar e registrar de novo.
 */
function EditarVenda({
  aberto,
  onFechar,
  venda,
  onSalvar,
  ocupado,
}: {
  aberto: boolean
  onFechar: () => void
  venda: { title: string; client_name: string | null; unit: string | null; notes: string | null; property_value: number | null }
  onSalvar: (dados: Record<string, unknown>) => Promise<void>
  ocupado: boolean
}) {
  const [titulo, setTitulo] = useState(venda.title)
  const [cliente, setCliente] = useState(venda.client_name ?? '')
  const [unidade, setUnidade] = useState(venda.unit ?? '')
  const [nota, setNota] = useState(venda.notes ?? '')

  return (
    <Modal
      key={aberto ? 'aberto' : 'fechado'}
      open={aberto}
      onClose={onFechar}
      title="Editar dados da venda"
      description="Valores e parcelas não mudam por aqui."
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={ocupado}
            onClick={() =>
              onSalvar({
                title: titulo,
                client_name: cliente || null,
                unit: unidade || null,
                notes: nota || null,
              })
            }
          >
            {ocupado ? <Spinner className="h-5 w-5" /> : 'Salvar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="Título" htmlFor="e-tit">
          <Input id="e-tit" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Unidade" htmlFor="e-unid">
            <Input id="e-unid" value={unidade} onChange={(e) => setUnidade(e.target.value)} />
          </FormField>
          <FormField label="Comprador" htmlFor="e-cli">
            <Input id="e-cli" value={cliente} onChange={(e) => setCliente(e.target.value)} />
          </FormField>
        </div>
        <FormField label="Observação" htmlFor="e-nota">
          <Textarea id="e-nota" value={nota} onChange={(e) => setNota(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  )
}
