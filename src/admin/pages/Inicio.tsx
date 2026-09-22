import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, BarChart3, Building2, CalendarRange, CircleCheck, Clock, Handshake, Hourglass, ListChecks, PieChart, ReceiptText, TrendingUp, UserRound } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Heroi } from '@/components/ui/Heroi'
import { Cartao } from '@/components/ui/Cartao'
import { Kpi } from '@/components/ui/Kpi'
import { Colunas } from '@/components/ui/Colunas'
import { Barra } from '@/components/ui/Barra'
import { Linha, LinhaGrupo } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { Selo } from '@/components/ui/Selo'
import { IconeTom } from '@/components/ui/IconeTom'
import { ChipSituacao } from '@/components/ui/Situacao'
import { EstadoVazio } from '@/components/ui/Estados'
import { formatCurrency, formatMonthTiny, formatMonthYear } from '@/lib/format'
import { lastNMonths, monthKey } from '@/lib/finance'
import { entradasPorMes } from '@/lib/sales'
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

  /*
   * A FILEIRA DE INDICADORES (21/09/2026, pedido do Rafael no desenho do CRM).
   *
   * Quatro números que ele quer ver de relance. Nenhum é novo: três já estavam
   * na tela, dentro do cartão do mês, e o quarto — o que entrou no mês — sai
   * das parcelas recebidas, somadas pela data em que o dinheiro caiu. A regra
   * do herói continua de pé: o indicador é pequeno, sem ouro, e leva para a
   * tela que manda no número.
   */
  const entrouNoMes = useMemo(() => {
    const parcelas = vendas
      .filter((v) => !v.is_personal)
      .flatMap((v) => v.installments)
      .filter((i) => i.status === 'recebida' && (i.received_date ?? '').slice(0, 7) === chaveMes)
    return {
      total: Math.round(parcelas.reduce((s, i) => s + i.amount, 0) * 100) / 100,
      n: parcelas.length,
    }
  }, [vendas, chaveMes])

  /*
   * O RITMO DO DINHEIRO (21/09/2026).
   *
   * Duas séries que o Início não tinha e que respondem as duas perguntas mais
   * frequentes de quem abre um financeiro: quanto entrou até agora, e quanto
   * vem pela frente. Nenhuma inventa número — a de trás lê a data em que cada
   * parcela foi RECEBIDA; a da frente lê as mesmas linhas de "A receber" que
   * a tela de Receber usa, agrupadas por mês de vencimento.
   */
  const doze = useMemo(() => lastNMonths(mes, 12), [mes])
  const entradas = useMemo(
    () => entradasPorMes(vendas.filter((v) => !v.is_personal), doze),
    [vendas, doze],
  )
  const entrou = useMemo(() => {
    const r2 = (n: number) => Math.round(n * 100) / 100
    return {
      total: r2(entradas.reduce((s, e) => s + e.total, 0)),
      imposto: r2(entradas.reduce((s, e) => s + e.imposto, 0)),
      corretor: r2(entradas.reduce((s, e) => s + e.corretor, 0)),
      imobiliaria: r2(entradas.reduce((s, e) => s + e.imobiliaria, 0)),
      parcelas: entradas.reduce((s, e) => s + e.parcelas, 0),
    }
  }, [entradas])

  const proximos = useMemo(() => {
    const meses = Array.from({ length: 6 }, (_, i) => new Date(mes.getFullYear(), mes.getMonth() + i, 1))
    return meses.map((m) => {
      const chave = monthKey(m)
      const itens = receber.filter((r) => r.date.slice(0, 7) === chave)
      return { mes: m, itens, total: Math.round(itens.reduce((s, r) => s + r.amount, 0) * 100) / 100 }
    })
  }, [receber, mes])
  const totalProximos = useMemo(
    () => Math.round(proximos.reduce((s, p) => s + p.total, 0) * 100) / 100,
    [proximos],
  )

  /*
   * O RAIO-X DA CARTEIRA — a pergunta de CFO (21/09/2026).
   *
   * Não é "quanto entra", é "como é a economia deste negócio": de cada real
   * de comissão contratada, quanto vira imposto, quanto vira comissão de
   * corretor e quanto fica de fato com a imobiliária. E de quem depende essa
   * carteira — concentração é risco: construtora que atrasa leva junto a
   * fatia dela.
   *
   * Tudo sai da cascata JÁ GRAVADA em cada parcela. A tela não recalcula
   * imposto nem comissão.
   */
  const raioX = useMemo(() => {
    const r2 = (n: number) => Math.round(n * 100) / 100
    const daEmpresa = vendas.filter((v) => !v.is_personal && v.status !== 'cancelada')
    const comissao = r2(daEmpresa.reduce((s, v) => s + v.cascade.commission, 0))
    const imposto = r2(daEmpresa.reduce((s, v) => s + v.cascade.iss + v.cascade.simples, 0))
    const corretor = r2(daEmpresa.reduce((s, v) => s + v.cascade.broker, 0))
    const imobiliaria = r2(daEmpresa.reduce((s, v) => s + v.cascade.net, 0))

    const porConstrutora = new Map<string, number>()
    for (const v of daEmpresa) {
      const nome = v.developer ?? v.development ?? 'Sem construtora'
      porConstrutora.set(nome, r2((porConstrutora.get(nome) ?? 0) + v.cascade.commission))
    }
    const construtoras = [...porConstrutora.entries()]
      .map(([nome, valor]) => ({ nome, valor, fatia: comissao > 0 ? valor / comissao : 0 }))
      .sort((a, b) => b.valor - a.valor)

    const pct = (v: number) => (comissao > 0 ? Math.round((v / comissao) * 100) : 0)
    return { comissao, imposto, corretor, imobiliaria, construtoras, pct, vendas: daEmpresa.length }
  }, [vendas])

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

      <div className="grid gap-bloco sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          rotulo="Vendas ativas"
          icone={Handshake}
          tom="neutro"
          valor={0}
          texto={String(vendasAtivas.length)}
          nota={`${formatCurrency(soma(receber))} de comissão ainda por entrar`}
          para="/vendas"
        />
        <Kpi
          rotulo="Entrou no mês"
          icone={Banknote}
          tom="sucesso"
          valor={entrouNoMes.total}
          estado={entrouNoMes.total > 0 ? 'recebido' : undefined}
          nota={
            entrouNoMes.n === 0
              ? 'nenhuma parcela recebida neste mês'
              : `${entrouNoMes.n} ${entrouNoMes.n === 1 ? 'parcela recebida' : 'parcelas recebidas'}`
          }
          para="/vendas"
        />
        <Kpi
          rotulo="A receber"
          icone={CalendarRange}
          tom="info"
          valor={soma(aReceber)}
          nota="neste mês, mais o que está em atraso"
          para="/receber"
        />
        <Kpi
          rotulo="Em atraso"
          icone={Hourglass}
          tom={vencido.length > 0 ? 'atencao' : 'neutro'}
          valor={soma(vencido)}
          nota={
            vencido.length === 0
              ? 'nenhuma parcela em atraso'
              : `${vencido.length} ${vencido.length === 1 ? 'parcela' : 'parcelas'} que a construtora não pagou`
          }
          para="/receber?janela=vencidas"
        />
      </div>

      {/*
       * O QUADRO (21/09/2026). Duas colunas declaradas, e não seis cartões
       * soltos numa grade automática: com `lg:col-span-7/5` o navegador
       * decidia o encaixe pela ordem, e um cartão condicional (a fila da nota,
       * a venda de pessoa física) abria buraco na fileira. Agora cada coluna é
       * uma pilha — a esquerda é o trabalho e o histórico, a direita é o mês e
       * o que vem pela frente — e nada escorrega quando um cartão some.
       */}
      <div className="grid items-start gap-bloco lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-bloco lg:col-span-7">
          {/* Trabalho primeiro. */}
          <Cartao>
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

          <Cartao>
            <Cartao.Cabecalho
              titulo="Entrou por mês"
              icone={BarChart3}
              meta={`${formatCurrency(entrou.total)} nos últimos 12 meses`}
            />
            <Cartao.Corpo>
              <Colunas
                tom="sucesso"
                itens={entradas.map((e) => ({
                  rotulo: formatMonthTiny(e.mes),
                  valor: e.total,
                  descricao: `${formatMonthYear(e.mes)}: ${formatCurrency(e.total)} em ${e.parcelas === 1 ? '1 parcela' : `${e.parcelas} parcelas`}`,
                  ativo: monthKey(e.mes) === chaveMes,
                }))}
                rotuloAcessivel={`Comissão recebida mês a mês nos últimos 12 meses. Total de ${formatCurrency(entrou.total)}.`}
              />
            </Cartao.Corpo>
            {/*
             * DE QUEM FOI O QUE ENTROU. O gráfico diz quanto; estas três linhas
             * dizem para onde foi. Elas somam exatamente a comissão recebida,
             * porque saem gravadas de cada parcela — imposto, corretor e o que
             * sobrou para a imobiliária.
             */}
            <Cartao.Lista colunas={{ valor: true }} rotuloAcessivel="De quem foi a comissão que entrou">
              <LinhaGrupo rotulo="De quem foi" />
              <Linha
                titulo="Imposto sobre essa comissão"
                meta="ISS retido na fonte e Simples das parcelas recebidas"
                valor={<Valor valor={entrou.imposto} posto="linha" />}
              />
              <Linha
                titulo="Repassado aos corretores"
                meta="a comissão deles nas parcelas que entraram"
                valor={<Valor valor={entrou.corretor} posto="linha" />}
              />
              <Linha
                titulo="Ficou com a imobiliária"
                meta="o que sobrou das parcelas recebidas, antes da estrutura"
                valor={<Valor valor={entrou.imobiliaria} posto="linha" forte />}
              />
            </Cartao.Lista>
            <Cartao.Rodape>
              <p className="max-w-[72ch]">
                Cada coluna é a comissão que a construtora pagou naquele mês, pela data em que o dinheiro caiu. As três
                linhas acima somam exatamente essa comissão — é para onde ela foi. Comissão é receita irregular: o que
                importa é o ritmo, não o mês isolado.
              </p>
            </Cartao.Rodape>
          </Cartao>

          {(filaDaNota.emitir.length > 0 || filaDaNota.esperando.length > 0) && (
            <Cartao>
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
        </div>

        <div className="flex min-w-0 flex-col gap-bloco lg:col-span-5">
          <Cartao>
            <Cartao.Cabecalho titulo="O mês" icone={CalendarRange} meta={tituloDoMes} />
            <Cartao.Lista colunas={{ situacao: true, valor: '10rem', fim: true }} rotuloAcessivel="O mês">
              <LinhaGrupo rotulo="Entra" />
              <Linha
                titulo="A receber"
                meta={
                  vencido.length > 0
                    ? `${aReceber.length} ${aReceber.length === 1 ? 'parcela' : 'parcelas'} neste mês · ${vencido.length} em atraso`
                    : `${aReceber.length} ${aReceber.length === 1 ? 'parcela' : 'parcelas'} neste mês, mais o que está em atraso`
                }
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

          <Cartao>
            <Cartao.Cabecalho
              titulo="Os próximos 6 meses"
              icone={TrendingUp}
              meta={`${formatCurrency(totalProximos)} previstos`}
            />
            <Cartao.Corpo>
              <Colunas
                tom="info"
                itens={proximos.map((p) => ({
                  rotulo: formatMonthTiny(p.mes),
                  valor: p.total,
                  descricao: `${formatMonthYear(p.mes)}: ${formatCurrency(p.total)} previstos em ${p.itens.length === 1 ? '1 parcela' : `${p.itens.length} parcelas`}`,
                  ativo: monthKey(p.mes) === chaveMes,
                }))}
                rotuloAcessivel={`Comissão prevista mês a mês nos próximos 6 meses. Total de ${formatCurrency(totalProximos)}.`}
                aoClicar={(i) => {
                  const p = proximos[i]
                  abrir({
                    rotulo: 'Previsto',
                    titulo: `Previsto para ${formatMonthYear(p.mes)}`,
                    explica:
                      'Parcelas de comissão com vencimento neste mês. A data depende da construtora pagar — é previsão, não caixa.',
                    total: p.total,
                    itens: comp(p.itens),
                    vazio: 'Nenhuma parcela prevista para este mês.',
                  })
                }}
              />
            </Cartao.Corpo>
            <Cartao.Rodape>
              <p className="max-w-[72ch]">
                O que a carteira promete, mês a mês. Toque numa coluna para ver de quais vendas ela vem.
              </p>
            </Cartao.Rodape>
          </Cartao>

          {raioX.comissao > 0 && (
            <Cartao>
              <Cartao.Cabecalho
                titulo="Raio-X da carteira"
                icone={PieChart}
                meta={`${formatCurrency(raioX.comissao)} de comissão contratada`}
              />
              <Cartao.Corpo>
                <Barra
                  segmentos={[
                    { valor: raioX.imobiliaria, tom: 'marca' },
                    { valor: raioX.corretor, tom: 'atencao' },
                    { valor: raioX.imposto, tom: 'info' },
                  ]}
                  rotuloAcessivel={`De ${formatCurrency(raioX.comissao)} de comissão contratada, ${formatCurrency(raioX.imobiliaria)} ficam com a imobiliária, ${formatCurrency(raioX.corretor)} vão para os corretores e ${formatCurrency(raioX.imposto)} para o imposto.`}
                />
              </Cartao.Corpo>
              <Cartao.Lista colunas={{ valor: true }} rotuloAcessivel="De cada real de comissão">
                <Linha
                  titulo="Fica com a imobiliária"
                  meta={`${raioX.pct(raioX.imobiliaria)}% da comissão contratada`}
                  valor={<Valor valor={raioX.imobiliaria} posto="linha" forte />}
                />
                <Linha
                  titulo="Vai para os corretores"
                  meta={`${raioX.pct(raioX.corretor)}% — custo da venda`}
                  valor={<Valor valor={raioX.corretor} posto="linha" />}
                />
                <Linha
                  titulo="Vai para o imposto"
                  meta={`${raioX.pct(raioX.imposto)}% — ISS retido e Simples`}
                  valor={<Valor valor={raioX.imposto} posto="linha" />}
                />
                <LinhaGrupo rotulo="De quem depende" contador={`${raioX.construtoras.length}`} />
                {raioX.construtoras.slice(0, 4).map((c) => (
                  <Linha
                    key={c.nome}
                    goteira={<IconeTom icone={Building2} tom="neutro" tamanho="sm" />}
                    titulo={c.nome}
                    meta={
                      <span className="flex flex-col gap-2">
                        <span>{Math.round(c.fatia * 100)}% da comissão contratada</span>
                        <Barra
                          animarEntrada={false}
                          valor={c.fatia}
                          tom="info"
                          rotuloAcessivel={`${c.nome}: ${Math.round(c.fatia * 100)}% da comissão contratada.`}
                        />
                      </span>
                    }
                    valor={<Valor valor={c.valor} posto="linha" />}
                  />
                ))}
              </Cartao.Lista>
              <Cartao.Rodape>
                <p className="max-w-[72ch]">
                  De cada R$ 100 de comissão contratada, {raioX.pct(raioX.imobiliaria)} ficam com a imobiliária. O
                  resto já tem dono antes de o dinheiro entrar. A lista de baixo é concentração: quanto da carteira
                  depende de cada construtora — se uma atrasa, é essa fatia que atrasa junto.
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
            <Cartao>
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
        </div>
      </div>
    </PageLayout>
  )
}
