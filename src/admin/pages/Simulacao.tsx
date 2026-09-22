import { useMemo, useState } from 'react'
import { Building2, Calculator, Percent, Target, Users } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Heroi } from '@/components/ui/Heroi'
import { Cartao } from '@/components/ui/Cartao'
import { Kpi } from '@/components/ui/Kpi'
import { Linha, LinhaGrupo } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { Barra } from '@/components/ui/Barra'
import { FormField, Input } from '@/components/ui/Field'
import { CurrencyInput, PercentInput } from '@/components/ui/MoneyInput'
import { FiltrosRapidos } from '@/components/ui/FiltrosRapidos'
import { Dica } from '@/components/ui/Dica'
import { Button } from '@/components/ui/Button'
import { lastNMonths } from '@/lib/finance'
import { entradasPorMes, volumeDeVendas } from '@/lib/sales'
import { pontoDeEquilibrio } from '@/lib/cfo'
import { formatCurrency, formatPercent } from '@/lib/format'
import type { LinhaDemonstrativo } from '@/lib/linhasDaVenda'

/*
 * SIMULAÇÃO DE FATURAMENTO — a conta do ano, e o mês que ela significa.
 *
 * Reescrita em 21/09/2026 depois de o Rafael usar a primeira versão: "ficou
 * confuso... R$ 1.435.721,55 de VGV cada, isso por mês ou por ano?". A
 * pergunta dele condenou o desenho antigo, que tinha seletor de período e
 * números sem unidade. As decisões desta versão:
 *
 * 1. A CONTA É SEMPRE ANUAL, e todo número aparece nos DOIS prazos: o total
 *    do ano na coluna do valor e a média mensal logo embaixo dele. Não existe
 *    mais seletor de período, e nenhum valor fica sem dizer a que prazo
 *    pertence. Era daí que vinha a confusão.
 *
 * 2. DOIS CAMINHOS, UM CAMPO. Ou ele diz o VGV que quer vender, ou diz quanto
 *    quer que sobre — e a tela faz a conta no sentido que falta. Antes os dois
 *    conviviam e a tela mostrava duas respostas concorrentes.
 *
 * 3. POUCOS CAMPOS À VISTA. Só três importam no dia a dia: o número do
 *    desenho, quantos corretores e o ticket médio. As premissas (comissão,
 *    corretor, imposto, estrutura) ficam em cartão próprio, já preenchidas com
 *    o que a imobiliária pratica — 5% de comissão é o padrão de contrato,
 *    decidido por ele em 21/09/2026.
 *
 * 4. A CONTA É A DO SISTEMA, na ordem da migração 009: comissão, menos ISS
 *    retido, menos Simples sobre o líquido de ISS, menos o corretor sobre essa
 *    base. A estrutura entra depois, porque é da empresa e não da venda.
 *
 * 5. DUAS COLUNAS DECLARADAS, como no Início: as premissas e o desenho à
 *    esquerda, os resultados à direita. Grade automática com cartão
 *    condicional abre buraco na fileira — foi o que ele viu ("o grid tá
 *    quebrado, tem card quebrando").
 *
 * NADA É GRAVADO. Nenhuma chamada ao banco, nenhum lançamento: recarregar
 * devolve tudo ao real. Por isso a tela não tem botão de salvar.
 */

type Caminho = 'vgv' | 'meta'

const r2 = (n: number) => Math.round(n * 100) / 100
const MESES = 12
const umaCasa = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

export function Simulacao() {
  const { vendas, transactions, mes } = useAdmin()
  const { abrir } = useComposicao()

  /* ---------------------------------------------------- o ponto de partida */
  const real = useMemo(() => {
    const doze = lastNMonths(mes, MESES)
    const daEmpresa = vendas.filter((v) => !v.is_personal)
    const volume = volumeDeVendas(daEmpresa, doze)
    const ativas = daEmpresa.filter((v) => v.status !== 'cancelada')
    const comissao = r2(ativas.reduce((s, v) => s + v.cascade.commission, 0))
    const liquido = r2(ativas.reduce((s, v) => s + v.cascade.net, 0))
    const comValor = ativas.filter((v) => v.property_value != null)
    const vgvComValor = r2(comValor.reduce((s, v) => s + (v.property_value ?? 0), 0))
    const comissaoComValor = r2(comValor.reduce((s, v) => s + v.cascade.commission, 0))
    const equilibrio = pontoDeEquilibrio({
      transactions,
      meses: doze.slice(0, 11),
      margem: comissao > 0 ? liquido / comissao : 0,
      entradasPorMes: entradasPorMes(daEmpresa, doze),
    })
    return {
      vgv: volume.vgv > 0 ? volume.vgv : 5000000,
      ticket: volume.ticket > 0 ? volume.ticket : 700000,
      estrutura: equilibrio.custoFixo,
      /* Só contexto: a média que a carteira realiza hoje, não a premissa. */
      pctDaCarteira: vgvComValor > 0 ? r2((comissaoComValor / vgvComValor) * 100) : 0,
    }
  }, [vendas, transactions, mes])

  /* -------------------------------------------------------- o que se mexe */
  const [caminho, setCaminho] = useState<Caminho>('vgv')
  const [vgvAlvo, setVgvAlvo] = useState<number | null>(real.vgv)
  const [metaAlvo, setMetaAlvo] = useState<number | null>(200000)
  const [corretores, setCorretores] = useState('2')
  const [ticket, setTicket] = useState<number | null>(real.ticket)
  const [pctComissao, setPctComissao] = useState<number | null>(5)
  const [pctCorretor, setPctCorretor] = useState<number | null>(50)
  const [temNota, setTemNota] = useState(true)
  const [pctSimples, setPctSimples] = useState<number | null>(6)
  const [retemIss, setRetemIss] = useState(true)
  const [pctIss, setPctIss] = useState<number | null>(3)
  const [estrutura, setEstrutura] = useState<number | null>(real.estrutura)
  const [nova, setNova] = useState<number | null>(null)

  function voltarAoReal() {
    setCaminho('vgv')
    setVgvAlvo(real.vgv)
    setMetaAlvo(200000)
    setCorretores('2')
    setTicket(real.ticket)
    setPctComissao(5)
    setPctCorretor(50)
    setTemNota(true)
    setPctSimples(6)
    setRetemIss(true)
    setPctIss(3)
    setEstrutura(real.estrutura)
    setNova(null)
  }

  /* ------------------------------------------------------------- a conta */
  const c = useMemo(() => {
    /*
     * Primeiro, quanto sobra de CADA REAL de VGV. É este coeficiente que
     * manda nas duas contas: com ele se vai do VGV ao lucro, e do lucro ao
     * VGV. É também a resposta de CFO mais importante desta tela — ele
     * costuma ser muito menor do que as pessoas imaginam.
     */
    const comissaoPorReal = (pctComissao ?? 0) / 100
    const issPorReal = retemIss ? comissaoPorReal * ((pctIss ?? 0) / 100) : 0
    const simplesPorReal = temNota ? (comissaoPorReal - issPorReal) * ((pctSimples ?? 0) / 100) : 0
    const basePorReal = comissaoPorReal - issPorReal - simplesPorReal
    const corretorPorReal = basePorReal * ((pctCorretor ?? 0) / 100)
    const sobraPorReal = basePorReal - corretorPorReal

    const estruturaAno = r2((estrutura ?? 0) * MESES)
    const novaAno = r2((nova ?? 0) * MESES)
    const custoFixoAno = r2(estruturaAno + novaAno)

    /* O VGV do ano: o que ele digitou, ou o que a meta exige. */
    const meta = metaAlvo ?? 0
    const vgvAno =
      caminho === 'vgv' ? vgvAlvo ?? 0 : sobraPorReal > 0 ? r2((custoFixoAno + meta) / sobraPorReal) : 0

    const comissaoAno = r2(vgvAno * comissaoPorReal)
    const issAno = r2(vgvAno * issPorReal)
    const simplesAno = r2(vgvAno * simplesPorReal)
    const corretorAno = r2(vgvAno * corretorPorReal)
    const sobraAno = r2(vgvAno * sobraPorReal)
    const liquidoAno = r2(sobraAno - custoFixoAno)

    const time = Math.max(1, Number(corretores) || 1)
    const vendasAno = ticket && ticket > 0 ? Math.ceil(vgvAno / ticket) : 0
    const vendasPorCorretorAno = vendasAno > 0 ? Math.ceil(vendasAno / time) : 0
    const vgvPorCorretorAno = r2(vgvAno / time)
    const comissaoPorCorretorAno = r2(corretorAno / time)

    /* O VGV que apenas empata: a mesma conta da meta, com meta zero. */
    const vgvDeEquilibrio = sobraPorReal > 0 ? r2(custoFixoAno / sobraPorReal) : 0

    return {
      sobraPorReal,
      vgvAno,
      comissaoAno,
      issAno,
      simplesAno,
      corretorAno,
      sobraAno,
      estruturaAno,
      novaAno,
      custoFixoAno,
      custoTotalAno: r2(issAno + simplesAno + corretorAno + custoFixoAno),
      impostoAno: r2(issAno + simplesAno),
      liquidoAno,
      time,
      vendasAno,
      vendasPorCorretorAno,
      vgvPorCorretorAno,
      comissaoPorCorretorAno,
      vgvDeEquilibrio,
      margemSobreComissao: comissaoAno > 0 ? sobraAno / comissaoAno : 0,
      margemSobreVgv: vgvAno > 0 ? liquidoAno / vgvAno : 0,
    }
  }, [caminho, vgvAlvo, metaAlvo, pctComissao, pctCorretor, temNota, pctSimples, retemIss, pctIss, estrutura, nova, ticket, corretores])

  /** O mês é sempre o ano dividido por doze: média, nunca promessa. */
  const porMes = (v: number) => r2(v / MESES)

  /* --------------------------------------------------------- a cascata */
  const linhas: LinhaDemonstrativo[] = [
    {
      chave: 'bruto',
      rotulo: 'Comissão no ano (faturamento)',
      detalhe: `${formatPercent((pctComissao ?? 0) / 100, 2)} sobre ${formatCurrency(c.vgvAno)} de VGV`,
      sinal: '+',
      valor: c.comissaoAno,
    },
  ]
  if (retemIss)
    linhas.push({
      chave: 'iss',
      rotulo: 'ISS retido na fonte',
      detalhe: `${formatPercent((pctIss ?? 0) / 100, 2)} da comissão, retido pela construtora`,
      sinal: '−',
      valor: c.issAno,
    })
  if (temNota)
    linhas.push({
      chave: 'simples',
      rotulo: 'Simples Nacional',
      detalhe: `${formatPercent((pctSimples ?? 0) / 100, 2)} da comissão menos o ISS`,
      sinal: '−',
      valor: c.simplesAno,
    })
  linhas.push(
    {
      chave: 'corretor',
      rotulo: 'Comissão dos corretores',
      detalhe: `${formatPercent((pctCorretor ?? 0) / 100, 2)} da base, somando o time inteiro`,
      sinal: '−',
      valor: c.corretorAno,
    },
    {
      chave: 'fica',
      rotulo: 'Sobra da operação',
      detalhe: 'antes da estrutura da imobiliária',
      sinal: '=',
      valor: c.sobraAno,
    },
    {
      chave: 'estrutura',
      rotulo: 'Estrutura no ano',
      detalhe: `${formatCurrency(estrutura ?? 0)} por mês × 12`,
      sinal: '−',
      valor: c.estruturaAno,
    },
    {
      chave: 'nova',
      rotulo: 'Despesa nova no ano',
      detalhe: `${formatCurrency(nova ?? 0)} por mês × 12`,
      sinal: '−',
      valor: c.novaAno,
    },
    {
      chave: 'fica',
      rotulo: 'Fica para a imobiliária',
      detalhe: `${formatPercent(c.margemSobreVgv, 2)} do VGV`,
      sinal: '=',
      valor: c.liquidoAno,
    },
  )

  const abrirAConta = () =>
    abrir({
      rotulo: 'Simulação',
      titulo: `A conta de um VGV de ${formatCurrency(c.vgvAno)} no ano`,
      explica:
        'A mesma ordem que o sistema usa numa venda real: comissão, menos ISS retido, menos Simples sobre o líquido de ISS, menos a comissão do corretor sobre essa base. A estrutura entra depois, porque é da empresa e não da venda.',
      total: c.liquidoAno,
      linhas,
      itens: [],
      vazio: 'A conta está acima.',
    })

  /** Uma linha nos dois prazos: o total do ano, e a média mensal embaixo. */
  const linhaAnoEMes = (p: {
    titulo: string
    meta: string
    valor: number
    forte?: boolean
    negativo?: boolean
  }) => (
    <Linha
      key={p.titulo}
      titulo={p.titulo}
      meta={p.meta}
      valor={
        p.negativo && p.valor < 0 ? (
          <Valor valor={p.valor} posto="linha" estado="negativo" />
        ) : (
          <Valor valor={p.valor} posto="linha" forte={p.forte} />
        )
      }
      metaValor={`${formatCurrency(porMes(p.valor))} por mês`}
    />
  )

  const explicaCaminho =
    caminho === 'vgv'
      ? 'Você diz o VGV que quer vender no ano e a tela diz quanto sobra.'
      : 'Você diz quanto quer que sobre no ano e a tela diz o VGV que produz isso.'

  return (
    <PageLayout
      icone={Calculator}
      titulo="Simulação"
      subtitulo={`VGV de ${formatCurrency(c.vgvAno)} no ano · ${formatCurrency(porMes(c.vgvAno))} por mês`}
    >
      <Dica>
        <strong className="font-semibold text-t1">A conta é do ANO, e cada número aparece nos dois prazos:</strong> o
        total do ano na coluna da direita e a média por mês logo embaixo dele. {explicaCaminho} Nada aqui é gravado —
        os campos começam no que o banco já sabe, e recarregar devolve tudo ao real.
      </Dica>

      <Heroi
        variante="ouro"
        estado={c.liquidoAno < 0 ? 'negativo' : undefined}
        rotulo="Fica para a imobiliária · no ano"
        valor={c.liquidoAno}
        rotuloAcessivel="Abrir a conta da simulação"
        aoAbrir={abrirAConta}
        frase={
          c.liquidoAno < 0
            ? `Neste desenho a operação não paga a estrutura: falta ${formatCurrency(-c.liquidoAno)} no ano, ${formatCurrency(porMes(-c.liquidoAno))} por mês. O VGV que empata é ${formatCurrency(c.vgvDeEquilibrio)}.`
            : `São ${formatCurrency(porMes(c.liquidoAno))} por mês, na média. De cada real de VGV, ${formatPercent(c.margemSobreVgv, 2)} chegam até aqui — depois do imposto, do corretor e da estrutura. O VGV que apenas empata é ${formatCurrency(c.vgvDeEquilibrio)}.`
        }
        demonstrativo={{ linhas, perfil: 'admin', rotuloAcessivel: 'A conta da simulação' }}
      />

      <div className="grid gap-bloco sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          rotulo="Faturamento no ano"
          icone={Percent}
          tom="info"
          valor={c.comissaoAno}
          nota={`${formatCurrency(porMes(c.comissaoAno))} por mês · a comissão da imobiliária`}
        />
        <Kpi
          rotulo="Custo total no ano"
          icone={Building2}
          tom="atencao"
          valor={c.custoTotalAno}
          nota={`${formatCurrency(porMes(c.custoTotalAno))} por mês · imposto, corretor e estrutura`}
        />
        <Kpi
          rotulo="Fica por mês"
          icone={Calculator}
          tom="marca"
          valor={porMes(c.liquidoAno)}
          nota={`${formatCurrency(c.liquidoAno)} no ano`}
        />
        <Kpi
          rotulo="Margem sobre o VGV"
          icone={Target}
          tom="sucesso"
          valor={0}
          texto={formatPercent(c.margemSobreVgv, 2)}
          nota={`${formatPercent(c.margemSobreComissao, 0)} da comissão sobram antes da estrutura`}
        />
      </div>

      {/*
       * O ENCAIXE (21/09/2026): "não pode ter espaço vazio de grid". Duas
       * colunas iguais só para os dois cartões de ENTRADA, que têm altura
       * parecida; os dois cartões de RESULTADO ocupam a largura inteira, um
       * embaixo do outro. Cartão de largura total não deixa buraco em fileira
       * nenhuma, e as tabelas de ano/mês ganham espaço para respirar.
       */}
      <div className="grid items-start gap-bloco lg:grid-cols-2">
          <Cartao>
            <Cartao.Cabecalho
              titulo="O desenho"
              icone={Target}
              extra={
                <Button variant="secundario" size="sm" onClick={voltarAoReal}>
                  Voltar ao real
                </Button>
              }
            />
            <Cartao.Corpo>
              <div className="flex flex-col gap-2">
                <p className="text-texto-meta font-medium text-t2">Por onde você quer começar</p>
                <FiltrosRapidos
                  rotuloAcessivel="Por onde começar a simulação"
                  ativo={caminho}
                  aoMudar={(v) => setCaminho(v as Caminho)}
                  filtros={[
                    { id: 'vgv', rotulo: 'Tenho um VGV', dica: 'Digite o VGV do ano e veja quanto sobra' },
                    {
                      id: 'meta',
                      rotulo: 'Tenho uma meta',
                      dica: 'Digite quanto quer que sobre e veja o VGV necessário',
                    },
                  ]}
                />
              </div>
              {caminho === 'vgv' ? (
                <FormField
                  label="VGV que você quer vender no ano"
                  htmlFor="s-vgv"
                  hint={`o valor dos imóveis. Começa no que a imobiliária vendeu nos últimos 12 meses (${formatCurrency(real.vgv)})`}
                >
                  <CurrencyInput id="s-vgv" value={vgvAlvo} onChange={setVgvAlvo} />
                </FormField>
              ) : (
                <FormField
                  label="Quanto você quer que sobre no ano"
                  htmlFor="s-meta"
                  hint="depois do imposto, do corretor e da estrutura — o lucro da imobiliária"
                >
                  <CurrencyInput id="s-meta" value={metaAlvo} onChange={setMetaAlvo} />
                </FormField>
              )}
              <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <FormField label="Quantos corretores" htmlFor="s-corretores" hint="o time que vai atrás deste VGV">
                  <Input
                    id="s-corretores"
                    type="number"
                    min="1"
                    value={corretores}
                    onChange={(e) => setCorretores(e.target.value)}
                  />
                </FormField>
                <FormField
                  label="Ticket médio do imóvel"
                  htmlFor="s-ticket"
                  hint="para traduzir VGV em número de vendas"
                >
                  <CurrencyInput id="s-ticket" value={ticket} onChange={setTicket} />
                </FormField>
                {/* A estrutura fica aqui, e não nas premissas: ela é decisão
                    dele neste desenho, não característica do mercado. */}
                <FormField
                  label="Estrutura por mês"
                  htmlFor="s-estrutura"
                  hint={`aluguel, contabilidade, ferramentas. Hoje a média é ${formatCurrency(real.estrutura)}`}
                >
                  <CurrencyInput id="s-estrutura" value={estrutura} onChange={setEstrutura} />
                </FormField>
                <FormField
                  label="Despesa nova por mês"
                  htmlFor="s-nova"
                  hint="o 'e se eu contratar': salário, sala maior, mídia"
                >
                  <CurrencyInput id="s-nova" value={nova} onChange={setNova} />
                </FormField>
              </div>
            </Cartao.Corpo>
          </Cartao>

          <Cartao>
            <Cartao.Cabecalho
              titulo="As premissas"
              icone={Percent}
              meta="já preenchidas com o que a imobiliária pratica"
            />
            <Cartao.Corpo>
              <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <FormField
                  label="% de comissão"
                  htmlFor="s-com"
                  hint={`5% é o padrão de contrato${real.pctDaCarteira > 0 ? `; a carteira de hoje realiza ${formatPercent(real.pctDaCarteira / 100, 2)}` : ''}`}
                >
                  <PercentInput id="s-com" value={pctComissao} onChange={setPctComissao} />
                </FormField>
                <FormField label="% do corretor" htmlFor="s-corretor" hint="sobre a base, nunca sobre o bruto">
                  <PercentInput id="s-corretor" value={pctCorretor} onChange={setPctCorretor} />
                </FormField>
                <FormField label="Emite nota fiscal?" htmlFor="s-nota" hint="sem nota, o Simples não incide">
                  <FiltrosRapidos
                    rotuloAcessivel="Emite nota fiscal"
                    ativo={temNota ? 'sim' : 'nao'}
                    aoMudar={(v) => setTemNota(v === 'sim')}
                    filtros={[
                      { id: 'sim', rotulo: 'Sim' },
                      { id: 'nao', rotulo: 'Não' },
                    ]}
                  />
                </FormField>
                <FormField label="% do Simples" htmlFor="s-simples" hint="sobre a comissão menos o ISS">
                  <PercentInput id="s-simples" value={pctSimples} onChange={setPctSimples} />
                </FormField>
                <FormField label="Construtora retém ISS?" htmlFor="s-iss" hint="desconta antes de pagar">
                  <FiltrosRapidos
                    rotuloAcessivel="Construtora retém ISS"
                    ativo={retemIss ? 'sim' : 'nao'}
                    aoMudar={(v) => setRetemIss(v === 'sim')}
                    filtros={[
                      { id: 'sim', rotulo: 'Sim' },
                      { id: 'nao', rotulo: 'Não' },
                    ]}
                  />
                </FormField>
                <FormField label="% do ISS" htmlFor="s-isspct" hint="sobre a comissão">
                  <PercentInput id="s-isspct" value={pctIss} onChange={setPctIss} />
                </FormField>
              </div>
            </Cartao.Corpo>
          </Cartao>
      </div>

      <Cartao>
        <Cartao.Cabecalho
          titulo="Faturamento e custos"
          icone={Calculator}
          meta="o total do ano, e a média por mês embaixo de cada número"
        />
        <Cartao.Lista colunas={{ valor: true }} rotuloAcessivel="Faturamento e custos, no ano e por mês">
          <LinhaGrupo rotulo="Entra" />
          {linhaAnoEMes({
            titulo: 'VGV vendido',
            meta: 'o valor dos imóveis — não é dinheiro da imobiliária',
            valor: c.vgvAno,
          })}
          {linhaAnoEMes({
            titulo: 'Comissão (faturamento)',
            meta: `${formatPercent((pctComissao ?? 0) / 100, 2)} do VGV`,
            valor: c.comissaoAno,
            forte: true,
          })}
          <LinhaGrupo rotulo="Sai" />
          {retemIss &&
            linhaAnoEMes({
              titulo: 'ISS retido na fonte',
              meta: `${formatPercent((pctIss ?? 0) / 100, 2)} da comissão`,
              valor: c.issAno,
            })}
          {temNota &&
            linhaAnoEMes({
              titulo: 'Simples Nacional',
              meta: `${formatPercent((pctSimples ?? 0) / 100, 2)} da comissão menos o ISS`,
              valor: c.simplesAno,
            })}
          {linhaAnoEMes({
            titulo: 'Comissão dos corretores',
            meta: `${formatPercent((pctCorretor ?? 0) / 100, 2)} da base, o time inteiro`,
            valor: c.corretorAno,
          })}
          {linhaAnoEMes({
            titulo: 'Estrutura',
            meta: 'o que existe com ou sem venda',
            valor: c.estruturaAno,
          })}
          {c.novaAno > 0 &&
            linhaAnoEMes({
              titulo: 'Despesa nova',
              meta: 'a contratação que você está simulando',
              valor: c.novaAno,
            })}
          <LinhaGrupo rotulo="Fica" />
          {linhaAnoEMes({
            titulo: 'Sobra da operação',
            meta: 'antes da estrutura',
            valor: c.sobraAno,
            forte: true,
          })}
          {linhaAnoEMes({
            titulo: 'Fica para a imobiliária',
            meta: `${formatPercent(c.margemSobreVgv, 2)} do VGV`,
            valor: c.liquidoAno,
            forte: true,
            negativo: true,
          })}
        </Cartao.Lista>
        <Cartao.Corpo>
          <div className="flex flex-col gap-2">
            <Barra
              segmentos={[
                { valor: Math.max(c.liquidoAno, 0), tom: 'marca' },
                { valor: c.custoFixoAno, tom: 'neutro' },
                { valor: c.corretorAno, tom: 'atencao' },
                { valor: c.impostoAno, tom: 'info' },
              ]}
              rotuloAcessivel={`Da comissão de ${formatCurrency(c.comissaoAno)}: ${formatCurrency(c.liquidoAno)} ficam para a imobiliária, ${formatCurrency(c.custoFixoAno)} pagam a estrutura, ${formatCurrency(c.corretorAno)} vão para os corretores e ${formatCurrency(c.impostoAno)} para o imposto.`}
            />
            <p className="text-nota text-t-meta">
              A barra divide a comissão do ano: o que fica, a estrutura, os corretores e o imposto.
            </p>
          </div>
        </Cartao.Corpo>
        <Cartao.Rodape>
          <p className="max-w-[72ch]">
            A linha de baixo é sempre o ano dividido por doze — média, não promessa. Comissão de imobiliária é
            receita irregular: um mês traz três parcelas e o seguinte, nenhuma. A estrutura, ao contrário, chega
            todo mês igual, e é essa assimetria que exige reserva.
          </p>
        </Cartao.Rodape>
          </Cartao>

          <Cartao>
        <Cartao.Cabecalho
          titulo="O que o time precisa fazer"
          icone={Users}
          meta={`${c.time} ${c.time === 1 ? 'corretor' : 'corretores'} neste desenho`}
        />
        <Cartao.Lista colunas={{ valor: true }} rotuloAcessivel="A meta do time">
          <LinhaGrupo rotulo="A imobiliária inteira" />
          <Linha
            titulo="Vendas no ano"
            meta={`VGV de ${formatCurrency(c.vgvAno)} ÷ ticket de ${formatCurrency(ticket ?? 0)}`}
            valor={<span className="num font-heading text-t1 text-valor-linha">{c.vendasAno}</span>}
            metaValor={`${umaCasa(c.vendasAno / MESES)} por mês`}
          />
          <LinhaGrupo rotulo="Cada corretor" />
          <Linha
            titulo="VGV por corretor"
            meta="o VGV do ano dividido pelo time"
            valor={<Valor valor={c.vgvPorCorretorAno} posto="linha" forte />}
            metaValor={`${formatCurrency(porMes(c.vgvPorCorretorAno))} por mês`}
          />
          <Linha
            titulo="Vendas por corretor"
            meta="arredondado para cima: meia venda não existe"
            valor={<span className="num font-heading text-t1 text-valor-linha">{c.vendasPorCorretorAno}</span>}
            metaValor={`${umaCasa(c.vendasPorCorretorAno / MESES)} por mês`}
          />
          <Linha
            titulo="Comissão de cada corretor"
            meta="o que cada um leva, se o time vender por igual"
            valor={<Valor valor={c.comissaoPorCorretorAno} posto="linha" />}
            metaValor={`${formatCurrency(porMes(c.comissaoPorCorretorAno))} por mês`}
          />
          <LinhaGrupo rotulo="O mínimo" />
          <Linha
            titulo="VGV que apenas empata"
            meta="abaixo disso, o ano consome reserva"
            valor={<Valor valor={c.vgvDeEquilibrio} posto="linha" />}
            metaValor={`${formatCurrency(porMes(c.vgvDeEquilibrio))} por mês`}
          />
        </Cartao.Lista>
        <Cartao.Rodape>
          <p className="max-w-[72ch]">
            Tudo aqui é do ANO, com a média mensal embaixo. A divisão por igual entre os corretores é o ponto de
            partida da conversa, não uma previsão: se o time tem ritmos diferentes, a meta de cada um muda — o que
            não muda é o total que precisa sair.
          </p>
        </Cartao.Rodape>
      </Cartao>
    </PageLayout>
  )
}
