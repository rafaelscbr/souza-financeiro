import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CalendarRange, CircleCheck, Clock, Handshake, ListChecks, ReceiptText, UserRound } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Heroi } from '@/components/ui/Heroi'
import { Cartao } from '@/components/ui/Cartao'
import { Linha, LinhaGrupo } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { Selo } from '@/components/ui/Selo'
import { IconeTom } from '@/components/ui/IconeTom'
import { ChipSituacao } from '@/components/ui/Situacao'
import { EstadoVazio } from '@/components/ui/Estados'
import { accountBalance } from '@/lib/treasury'
import { situacaoDeTela } from '@/lib/situacao'
import { etapaDaParcela, fraseDaEtapa } from '@/lib/etapas'
import type { MoneyItem, SaleView } from '@/lib/sales'
import type { SaleInstallment } from '@/types'

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
  const { transactions, transfers, accounts, atencao, receber, pagar, vendas, installments, hoje, mes } = useAdmin()
  const { abrir } = useComposicao()

  const chaveMes = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`

  /*
   * A FILA DA NOTA FISCAL (21/09/2026).
   *
   * Entre o gatilho e o dinheiro existe um passo que só depende da
   * imobiliária: emitir a nota. Sem alguém cobrando, é ele que atrasa o
   * recebimento. Aqui não se soma nada novo: são as mesmas parcelas de
   * sempre, separadas pelo degrau em que estão.
   */
  const porVenda = useMemo(() => new Map(vendas.map((v) => [v.id, v])), [vendas])
  const filaDaNota = useMemo(() => {
    const emitir: { p: SaleInstallment; venda: SaleView | undefined }[] = []
    const esperando: { p: SaleInstallment; venda: SaleView | undefined }[] = []
    for (const p of installments) {
      if (p.status !== 'prevista') continue
      // Venda de pessoa física não tem nota da imobiliária: fora da fila.
      if (porVenda.get(p.sale_id)?.is_personal) continue
      const { etapa } = etapaDaParcela(p)
      if (etapa === 'a_emitir_nota') emitir.push({ p, venda: porVenda.get(p.sale_id) })
      else if (etapa === 'nota_emitida' && p.expected_date < hoje) esperando.push({ p, venda: porVenda.get(p.sale_id) })
    }
    const porData = (a: { p: SaleInstallment }, b: { p: SaleInstallment }) =>
      (a.p.trigger_met_date ?? a.p.expected_date) < (b.p.trigger_met_date ?? b.p.expected_date) ? -1 : 1
    return { emitir: emitir.sort(porData), esperando: esperando.sort(porData) }
  }, [installments, porVenda, hoje])

  /** O número herói: o que existe de fato, hoje, na conta. */
  const contas = useMemo(
    () =>
      accounts
        .filter((a) => a.is_active && a.type !== 'credit_card')
        .map((a) => ({
          conta: a,
          saldo: accountBalance(a, transactions, transfers, hoje).balance,
        })),
    [accounts, transactions, transfers, hoje],
  )
  const saldo = useMemo(() => contas.reduce((s, c) => s + c.saldo, 0), [contas])

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
   * A definição de Pagar, copiada dela: devido agora é comissão LIBERADA (a
   * imobiliária já recebeu a parcela), imposto de parcela recebida e despesa.
   * Previsão fica de fora do total e aparece em número próprio, ao lado.
   */
  const devido = useMemo(() => pagar.filter((i) => i.released), [pagar])
  const previsto = useMemo(() => pagar.filter((i) => !i.released), [pagar])

  const soma = (l: MoneyItem[]) => Math.round(l.reduce((s, i) => s + i.amount, 0) * 100) / 100

  const nomeDoMes = mes.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
  const tituloDoMes = nomeDoMes.charAt(0).toUpperCase() + nomeDoMes.slice(1)

  /*
   * O dinheiro da imobiliária. Venda marcada como pessoa física (decisão de
   * 21/09/2026) fica de fora de tudo que é dela — ela não recebe, não paga
   * imposto e não repassa — e aparece no cartão próprio, mais abaixo.
   */
  const vendasAtivas = vendas.filter((v) => v.status !== 'cancelada' && !v.is_personal)

  /** O que entra pra você, fora da imobiliária: parcela cheia, sem desconto. */
  const pessoais = useMemo(() => {
    const linhas = vendas
      .filter((v) => v.is_personal && v.status !== 'cancelada')
      .flatMap((v) => v.installments.filter((p) => p.status === 'prevista').map((p) => ({ v, p })))
      .sort((a, b) => (a.p.expected_date < b.p.expected_date ? -1 : 1))
    return { linhas, total: Math.round(linhas.reduce((s, l) => s + l.p.amount, 0) * 100) / 100 }
  }, [vendas])

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
      <PageLayout subtitulo="Nenhuma venda registrada">
        <Cartao rotuloAcessivel="Primeira venda">
          <Cartao.Corpo>
            <EstadoVazio
              icone={Handshake}
              titulo="Tudo pronto para a primeira venda"
              descricao="Registre uma venda e o sistema cuida do resto: parcelas a receber, imposto na hora certa e a comissão do corretor liberada quando o dinheiro entrar."
            />
          </Cartao.Corpo>
        </Cartao>
      </PageLayout>
    )
  }

  const contagemAtencao = atencao.length === 1 ? '1 item' : `${atencao.length} itens`

  return (
    <PageLayout
      subtitulo={
        atencao.length === 0
          ? undefined
          : `${contagemAtencao} ${atencao.length === 1 ? 'precisa' : 'precisam'} de atenção`
      }
    >
      {/*
       * UM número em degrau herói, e um só ponto de ouro na tela. É essa regra
       * que impede o Início de voltar a exibir três valores concorrentes: se só
       * um número pode ser herói, a tela é obrigada a declarar qual pergunta
       * ela responde. Ele abre nas contas que o somam.
       */}
      <Heroi
        variante="ouro"
        rotulo="Disponível em conta"
        valor={saldo}
        rotuloAcessivel="Ver as contas que somam o disponível"
        aoAbrir={() =>
          abrir({
            rotulo: 'Disponível em conta',
            titulo: 'Saldo de cada conta ativa',
            explica: 'O que existe hoje, somando as contas ativas. Não entra nada previsto.',
            total: saldo,
            itens: contas.map((c) => ({
              id: c.conta.id,
              titulo: c.conta.name,
              meta: c.conta.bank ?? undefined,
              valor: c.saldo,
            })),
            vazio: 'Nenhuma conta ativa.',
          })
        }
        frase="O que existe hoje, somando as contas ativas. Não entra nada previsto."
      />

      <div className="grid items-start gap-bloco lg:grid-cols-12">
        {/* Trabalho primeiro. */}
        <Cartao className="lg:col-span-7">
          <Cartao.Cabecalho
            titulo="Precisa de atenção"
            icone={ListChecks}
            meta={atencao.length > 0 ? contagemAtencao : undefined}
          />
          {atencao.length === 0 ? (
            <Cartao.Corpo>
              <EstadoVazio
                icone={CircleCheck}
                titulo="Tudo em dia"
                descricao="Nada vencido, nenhuma comissão liberada esperando e nenhum imposto em aberto."
              />
            </Cartao.Corpo>
          ) : (
            <Cartao.Lista colunas={{ goteira: true, valor: true, fim: true }} rotuloAcessivel="Precisa de atenção">
              {atencao.map((a) => (
                <Linha
                  key={a.id}
                  goteira={
                    <Selo
                      situacao={a.tone === 'critical' ? 'vencida' : a.tone === 'warning' ? 'liberada' : 'prevista'}
                    />
                  }
                  titulo={a.title}
                  meta={a.detail}
                  valor={<Valor valor={a.amount} posto="linha" />}
                  para={a.to}
                />
              ))}
            </Cartao.Lista>
          )}
          {vendasAtivas.some((v) => v.hasOverdue) && (
            <Cartao.Rodape>
              <p className="max-w-[72ch]">
                Parcela vencida quase sempre é a construtora atrasando, não o cliente. Reagende na ficha da venda para a
                previsão voltar a fazer sentido — o corretor vê a data nova na hora.
              </p>
            </Cartao.Rodape>
          )}
        </Cartao>

        {(filaDaNota.emitir.length > 0 || filaDaNota.esperando.length > 0) && (
          <Cartao className="lg:col-span-7">
            <Cartao.Cabecalho
              titulo="Nota fiscal"
              icone={ReceiptText}
              meta={
                filaDaNota.emitir.length > 0
                  ? `${filaDaNota.emitir.length} ${filaDaNota.emitir.length === 1 ? 'comissão liberada' : 'comissões liberadas'} esperando nota`
                  : 'notas emitidas esperando pagamento'
              }
            />
            <Cartao.Lista colunas={{ goteira: true, valor: true, fim: true }} rotuloAcessivel="Fila da nota fiscal">
              {filaDaNota.emitir.length > 0 && <LinhaGrupo rotulo="Emitir nota" contador={`${filaDaNota.emitir.length}`} />}
              {filaDaNota.emitir.map(({ p, venda }) => (
                <Linha
                  key={p.id}
                  goteira={<IconeTom icone={ReceiptText} tom="atencao" tamanho="sm" />}
                  titulo={venda?.title ?? 'Parcela de comissão'}
                  meta={fraseDaEtapa(p, hoje)}
                  valor={<Valor valor={p.amount} posto="linha" />}
                  para={venda ? `/vendas/${venda.id}?parcela=${p.id}` : undefined}
                />
              ))}
              {filaDaNota.esperando.length > 0 && (
                <LinhaGrupo rotulo="Nota emitida, passou do prazo" contador={`${filaDaNota.esperando.length}`} />
              )}
              {filaDaNota.esperando.map(({ p, venda }) => (
                <Linha
                  key={p.id}
                  goteira={<IconeTom icone={Clock} tom="risco" tamanho="sm" />}
                  titulo={venda?.title ?? 'Parcela de comissão'}
                  meta={fraseDaEtapa(p, hoje)}
                  valor={<Valor valor={p.amount} posto="linha" />}
                  para={venda ? `/vendas/${venda.id}?parcela=${p.id}` : undefined}
                />
              ))}
            </Cartao.Lista>
            <Cartao.Rodape>
              <p className="max-w-[72ch]">
                A comissão liberada só vira dinheiro depois da nota. O prazo de cada construtora fica em
                Configurações.
              </p>
            </Cartao.Rodape>
          </Cartao>
        )}

        {/*
         * PESSOA FÍSICA (21/09/2026). Duas vendas do PortoVelas foram feitas
         * quando o Rafael ainda estava em outra imobiliária: a comissão é dele,
         * não da Souza. Elas não têm lançamento no razão da empresa, então não
         * aparecem em nenhum número acima — mas continuam sendo previsão de
         * dinheiro, e previsão escondida não ajuda ninguém.
         */}
        {pessoais.linhas.length > 0 && (
          <Cartao className="lg:col-span-5">
            <Cartao.Cabecalho titulo="Entra pra você" icone={UserRound} meta="pessoa física" />
            <Cartao.Lista colunas={{ goteira: true, valor: true, fim: true }} rotuloAcessivel="Comissão de pessoa física">
              {pessoais.linhas.map(({ v, p }) => (
                <Linha
                  key={p.id}
                  goteira={<IconeTom icone={UserRound} tom="neutro" tamanho="sm" />}
                  titulo={v.title}
                  meta={fraseDaEtapa(p, hoje)}
                  valor={<Valor valor={p.amount} posto="linha" previsto />}
                  para={`/vendas/${v.id}`}
                />
              ))}
            </Cartao.Lista>
            <Cartao.Rodape>
              <p className="max-w-[72ch]">
                <Valor valor={pessoais.total} posto="fato" previsto /> de vendas anteriores à Souza. O dinheiro é seu: não
                entra em A receber, não gera imposto da imobiliária e não aparece no resultado dela.
              </p>
            </Cartao.Rodape>
          </Cartao>
        )}

        <Cartao className="lg:col-span-5">
          <Cartao.Cabecalho titulo="O mês" icone={CalendarRange} meta={tituloDoMes} />
          <Cartao.Lista colunas={{ situacao: true, valor: '10rem', fim: true }} rotuloAcessivel="O mês">
            <LinhaGrupo rotulo="Entra" />
            <Linha
              titulo="A receber"
              meta={`${aReceber.length} ${aReceber.length === 1 ? 'parcela' : 'parcelas'} neste mês, mais o vencido`}
              situacao={vencido.length > 0 ? <ChipSituacao situacao="vencida" /> : undefined}
              valor={<Valor valor={soma(aReceber)} posto="linha" />}
              aoClicar={() =>
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
            <LinhaGrupo rotulo="Sai" />
            <Linha
              titulo="Devido agora"
              meta="comissão já liberada, imposto de parcela recebida e despesa"
              valor={<Valor valor={soma(devido)} posto="linha" />}
              aoClicar={() =>
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
            {/*
             * A previsão aparece, porque esconder informação não é honestidade —
             * mas em linha própria, com a palavra "depende", e sem cor tônica.
             * Nunca somada ao devido.
             */}
            <Linha
              titulo="Previsto, depende do recebimento"
              meta="comissão e imposto de parcela que a construtora ainda não pagou"
              situacao={<ChipSituacao situacao="prevista" />}
              valor={<Valor valor={soma(previsto)} posto="linha" previsto />}
              aoClicar={() =>
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
            <LinhaGrupo rotulo="Carteira" />
            <Linha
              titulo="Vendas em carteira"
              meta={`${vendasAtivas.length} ${vendasAtivas.length === 1 ? 'venda ativa' : 'vendas ativas'}`}
              valor={<Valor valor={soma(receber)} posto="linha" previsto />}
              aoClicar={() =>
                abrir({
                  rotulo: 'Vendas em carteira',
                  titulo: 'Comissão contratada que ainda não entrou',
                  explica: 'Toda a comissão contratada que ainda não entrou, somando todos os meses.',
                  total: soma(receber),
                  itens: comp(receber),
                  vazio: 'Nada a receber.',
                })
              }
            />
          </Cartao.Lista>
          {/* A carteira não depende do mês; a frase leva às vendas, como a linha. */}
          <Cartao.Rodape>
            <Link to="/vendas" className="min-h-11 py-3 hover:text-t2">
              <Valor valor={soma(receber)} posto="fato" /> é toda a comissão contratada que ainda não entrou, somando
              todos os meses.
            </Link>
          </Cartao.Rodape>
        </Cartao>
      </div>
    </PageLayout>
  )
}
