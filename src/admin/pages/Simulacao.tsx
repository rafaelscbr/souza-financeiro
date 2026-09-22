import { useMemo, useState } from 'react'
import { Calculator, Percent, Target, Users } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Heroi } from '@/components/ui/Heroi'
import { Cartao } from '@/components/ui/Cartao'
import { Kpi } from '@/components/ui/Kpi'
import { Linha } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { FormField, Input } from '@/components/ui/Field'
import { CurrencyInput, PercentInput } from '@/components/ui/MoneyInput'
import { FiltrosRapidos } from '@/components/ui/FiltrosRapidos'
import { Dica } from '@/components/ui/Dica'
import { Button } from '@/components/ui/Button'
import { lastNMonths } from '@/lib/finance'
import { volumeDeVendas } from '@/lib/sales'
import { pontoDeEquilibrio } from '@/lib/cfo'
import { entradasPorMes } from '@/lib/sales'
import { formatCurrency, formatPercent } from '@/lib/format'
import type { LinhaDemonstrativo } from '@/lib/linhasDaVenda'

/*
 * SIMULAÇÃO DE FATURAMENTO (21/09/2026, pedido do Rafael).
 *
 * "Coloco um VGV e ele me diz quanto seria o faturamento, quanto disso seria
 * corretor, despesa atual, posso usar um número de despesa futura, quanto
 * ficaria líquido para a imobiliária... saber quantos corretores preciso."
 *
 * TRÊS REGRAS DESTA TELA:
 *
 * 1. NADA É GRAVADO. Nenhuma chamada ao banco, nenhum lançamento, nenhum
 *    estado que sobreviva ao recarregar. É papel de rascunho — e é assim que
 *    ele pediu. Por isso a tela também não tem botão de salvar: não existe
 *    onde salvar, e um botão inerte seria mentira.
 *
 * 2. OS CAMPOS COMEÇAM NA REALIDADE. VGV, ticket médio, percentual do
 *    corretor e estrutura mensal nascem preenchidos com o que o banco já sabe
 *    — a simulação parte de onde a imobiliária está, não de zero. O botão
 *    "Voltar ao real" devolve os campos a esses números.
 *
 * 3. A CONTA É A MESMA DO SISTEMA, na ordem da migração 009: comissão, menos
 *    ISS retido, menos Simples sobre o líquido de ISS, menos a comissão do
 *    corretor sobre essa base. Só depois entra a estrutura, que é da empresa e
 *    não da venda. Simular com outra ordem daria um número que nenhuma venda
 *    real produziria.
 */

type Periodo = 1 | 3 | 6 | 12

const r2 = (n: number) => Math.round(n * 100) / 100

export function Simulacao() {
  const { vendas, transactions, mes } = useAdmin()
  const { abrir } = useComposicao()

  /* ---------------------------------------------------- o ponto de partida */
  const real = useMemo(() => {
    const doze = lastNMonths(mes, 12)
    const daEmpresa = vendas.filter((v) => !v.is_personal)
    const volume = volumeDeVendas(daEmpresa, doze)
    const ativas = daEmpresa.filter((v) => v.status !== 'cancelada')
    const comissao = r2(ativas.reduce((s, v) => s + v.cascade.commission, 0))
    const liquido = r2(ativas.reduce((s, v) => s + v.cascade.net, 0))
    const vgvComValor = r2(ativas.reduce((s, v) => s + (v.property_value ?? 0), 0))
    const pct = vgvComValor > 0 ? r2((comissao / vgvComValor) * 100) : 5
    const equilibrio = pontoDeEquilibrio({
      transactions,
      meses: doze.slice(0, 11),
      margem: comissao > 0 ? liquido / comissao : 0,
      entradasPorMes: entradasPorMes(daEmpresa, doze),
    })
    const corretor = ativas.find((v) => v.broker_pct != null)?.broker_pct ?? 50
    return {
      vgv: volume.vgv > 0 ? volume.vgv : 1000000,
      ticket: volume.ticket > 0 ? volume.ticket : 500000,
      pctComissao: pct > 0 ? pct : 5,
      pctCorretor: Number(corretor),
      estrutura: equilibrio.custoFixo,
      margem: comissao > 0 ? liquido / comissao : 0,
    }
  }, [vendas, transactions, mes])

  /* -------------------------------------------------------- o que se mexe */
  const [vgv, setVgv] = useState<number | null>(real.vgv)
  const [pctComissao, setPctComissao] = useState<number | null>(real.pctComissao)
  const [temNota, setTemNota] = useState(true)
  const [pctSimples, setPctSimples] = useState<number | null>(6)
  const [retemIss, setRetemIss] = useState(true)
  const [pctIss, setPctIss] = useState<number | null>(3)
  const [pctCorretor, setPctCorretor] = useState<number | null>(real.pctCorretor)
  const [estrutura, setEstrutura] = useState<number | null>(real.estrutura)
  const [nova, setNova] = useState<number | null>(null)
  const [ticket, setTicket] = useState<number | null>(real.ticket)
  const [porCorretor, setPorCorretor] = useState('2')
  const [periodo, setPeriodo] = useState<Periodo>(12)

  function voltarAoReal() {
    setVgv(real.vgv)
    setPctComissao(real.pctComissao)
    setTemNota(true)
    setPctSimples(6)
    setRetemIss(true)
    setPctIss(3)
    setPctCorretor(real.pctCorretor)
    setEstrutura(real.estrutura)
    setNova(null)
    setTicket(real.ticket)
    setPorCorretor('2')
    setPeriodo(12)
  }

  /* ------------------------------------------------------------- a conta */
  const conta = useMemo(() => {
    const base = vgv ?? 0
    const comissao = r2((base * (pctComissao ?? 0)) / 100)
    const iss = retemIss ? r2((comissao * (pctIss ?? 0)) / 100) : 0
    const simples = temNota ? r2(((comissao - iss) * (pctSimples ?? 0)) / 100) : 0
    const baseCorretor = r2(comissao - iss - simples)
    const corretor = r2((baseCorretor * (pctCorretor ?? 0)) / 100)
    const brutoDaCasa = r2(baseCorretor - corretor)
    const estruturaTotal = r2((estrutura ?? 0) * periodo)
    const novaTotal = r2((nova ?? 0) * periodo)
    const liquido = r2(brutoDaCasa - estruturaTotal - novaTotal)

    const vendasNecessarias = ticket && ticket > 0 ? Math.ceil(base / ticket) : 0
    const porCorretorN = Math.max(1, Number(porCorretor) || 1)
    const corretoresNecessarios = vendasNecessarias > 0 ? Math.ceil(vendasNecessarias / porCorretorN) : 0

    /* O VGV que apenas empata: estrutura ÷ (o que sobra de cada real de VGV). */
    const sobraPorReal = base > 0 ? brutoDaCasa / base : 0
    const vgvDeEquilibrio = sobraPorReal > 0 ? r2((estruturaTotal + novaTotal) / sobraPorReal) : 0

    return {
      comissao,
      iss,
      simples,
      baseCorretor,
      corretor,
      brutoDaCasa,
      estruturaTotal,
      novaTotal,
      liquido,
      vendasNecessarias,
      corretoresNecessarios,
      vgvDeEquilibrio,
      margemSobreComissao: comissao > 0 ? brutoDaCasa / comissao : 0,
      margemSobreVgv: base > 0 ? liquido / base : 0,
    }
  }, [vgv, pctComissao, temNota, pctSimples, retemIss, pctIss, pctCorretor, estrutura, nova, periodo, ticket, porCorretor])

  const linhas: LinhaDemonstrativo[] = [
    {
      chave: 'bruto',
      rotulo: 'Comissão da imobiliária',
      detalhe: `${formatPercent((pctComissao ?? 0) / 100, 2)} sobre ${formatCurrency(vgv ?? 0)} de VGV`,
      sinal: '+',
      valor: conta.comissao,
    },
  ]
  if (conta.iss > 0)
    linhas.push({
      chave: 'iss',
      rotulo: 'ISS retido na fonte',
      detalhe: `${formatPercent((pctIss ?? 0) / 100, 2)} sobre a comissão, retido pela construtora`,
      sinal: '−',
      valor: conta.iss,
    })
  if (conta.simples > 0)
    linhas.push({
      chave: 'simples',
      rotulo: 'Imposto (Simples Nacional)',
      detalhe: `${formatPercent((pctSimples ?? 0) / 100, 2)} sobre a comissão menos o ISS`,
      sinal: '−',
      valor: conta.simples,
    })
  if (conta.iss > 0 || conta.simples > 0)
    linhas.push({
      chave: 'base',
      rotulo: 'Base do cálculo da comissão',
      detalhe: 'é sobre ela que incide o percentual do corretor',
      sinal: '=',
      valor: conta.baseCorretor,
    })
  if (conta.corretor > 0)
    linhas.push({
      chave: 'corretor',
      rotulo: 'Comissão dos corretores',
      detalhe: `${formatPercent((pctCorretor ?? 0) / 100, 2)} da base`,
      sinal: '−',
      valor: conta.corretor,
    })
  linhas.push({
    chave: 'fica',
    rotulo: 'Sobra da operação',
    detalhe: 'antes da estrutura da imobiliária',
    sinal: '=',
    valor: conta.brutoDaCasa,
  })
  if (conta.estruturaTotal > 0)
    linhas.push({
      chave: 'estrutura',
      rotulo: 'Estrutura',
      detalhe: `${formatCurrency(estrutura ?? 0)} por mês × ${periodo} ${periodo === 1 ? 'mês' : 'meses'}`,
      sinal: '−',
      valor: conta.estruturaTotal,
    })
  if (conta.novaTotal > 0)
    linhas.push({
      chave: 'nova',
      rotulo: 'Despesa nova',
      detalhe: `${formatCurrency(nova ?? 0)} por mês × ${periodo} ${periodo === 1 ? 'mês' : 'meses'}`,
      sinal: '−',
      valor: conta.novaTotal,
    })
  linhas.push({
    chave: 'fica',
    rotulo: 'Fica para a imobiliária',
    detalhe: `${formatPercent(conta.margemSobreVgv, 2)} do VGV simulado`,
    sinal: '=',
    valor: conta.liquido,
  })

  const nomeDoPeriodo = periodo === 1 ? 'no mês' : `em ${periodo} meses`

  /* O herói abre a mesma cascata que ele já mostra — é o único lugar onde há
     o que abrir, porque a simulação não tem lançamento por trás. */
  const abrirAConta = () =>
    abrir({
      rotulo: 'Simulação',
      titulo: `A conta de um VGV de ${formatCurrency(vgv ?? 0)}`,
      explica:
        'A mesma ordem que o sistema usa numa venda real: comissão, menos ISS retido, menos Simples sobre o líquido de ISS, menos a comissão do corretor sobre essa base. A estrutura entra depois, porque é da empresa e não da venda.',
      total: conta.liquido,
      linhas,
      itens: [],
      vazio: 'A conta está acima.',
    })

  return (
    <PageLayout
      icone={Calculator}
      titulo="Simulação"
      subtitulo={`Quanto sobra para a imobiliária num VGV de ${formatCurrency(vgv ?? 0)} ${nomeDoPeriodo}`}
    >
      <Dica>
        <strong className="font-semibold text-t1">Nada aqui é gravado.</strong> É papel de rascunho: os campos começam
        no que o banco já sabe — VGV dos últimos 12 meses, ticket médio real, percentual do corretor e a estrutura
        média por mês — e você mexe à vontade. Recarregar a página devolve tudo ao real.
      </Dica>

      {conta.liquido < 0 ? (
        <Heroi
          variante="ouro"
          estado="negativo"
          rotulo={`Fica para a imobiliária · ${nomeDoPeriodo}`}
          valor={conta.liquido}
          rotuloAcessivel="Abrir a conta da simulação"
          aoAbrir={abrirAConta}
          frase={`Neste desenho a operação não paga a estrutura: falta ${formatCurrency(-conta.liquido)}. O VGV que empata é ${formatCurrency(conta.vgvDeEquilibrio)}.`}
          demonstrativo={{ linhas, perfil: 'admin', rotuloAcessivel: 'A conta da simulação' }}
        />
      ) : (
        <Heroi
          variante="ouro"
          rotulo={`Fica para a imobiliária · ${nomeDoPeriodo}`}
          valor={conta.liquido}
          rotuloAcessivel="Abrir a conta da simulação"
          aoAbrir={abrirAConta}
          frase={`De cada real de VGV, ${formatPercent(conta.margemSobreVgv, 2)} sobram para a imobiliária depois do imposto, do corretor e da estrutura. O VGV que apenas empata é ${formatCurrency(conta.vgvDeEquilibrio)}.`}
          demonstrativo={{ linhas, perfil: 'admin', rotuloAcessivel: 'A conta da simulação' }}
        />
      )}

      <div className="grid gap-bloco sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          rotulo="Faturamento"
          icone={Percent}
          tom="info"
          valor={conta.comissao}
          nota={`a comissão da imobiliária no VGV simulado`}
        />
        <Kpi
          rotulo="Vendas necessárias"
          icone={Target}
          tom="marca"
          valor={0}
          texto={String(conta.vendasNecessarias)}
          nota={`com ticket de ${formatCurrency(ticket ?? 0)} por imóvel`}
        />
        <Kpi
          rotulo="Corretores"
          icone={Users}
          tom="atencao"
          valor={0}
          texto={String(conta.corretoresNecessarios)}
          nota={`a ${porCorretor} ${Number(porCorretor) === 1 ? 'venda' : 'vendas'} por corretor ${nomeDoPeriodo}`}
        />
        <Kpi
          rotulo="Margem da operação"
          icone={Calculator}
          tom="sucesso"
          valor={0}
          texto={formatPercent(conta.margemSobreComissao, 0)}
          nota="da comissão, antes da estrutura"
        />
      </div>

      <div className="grid items-start gap-bloco lg:grid-cols-12">
        <Cartao className="lg:col-span-7">
          <Cartao.Cabecalho
            titulo="O que você quer vender"
            icone={Target}
            extra={
              <Button variant="secundario" size="sm" onClick={voltarAoReal}>
                Voltar ao real
              </Button>
            }
          />
          <Cartao.Corpo>
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <FormField label="VGV do período" htmlFor="s-vgv" hint="o valor dos imóveis que você quer vender">
                <CurrencyInput id="s-vgv" value={vgv} onChange={setVgv} />
              </FormField>
              <FormField label="% de comissão" htmlFor="s-com" hint="sobre o VGV; use vírgula para decimal">
                <PercentInput id="s-com" value={pctComissao} onChange={setPctComissao} />
              </FormField>
              <FormField
                label="Ticket médio do imóvel"
                htmlFor="s-ticket"
                hint="para saber quantas vendas o VGV exige"
              >
                <CurrencyInput id="s-ticket" value={ticket} onChange={setTicket} />
              </FormField>
              <FormField
                label="Vendas por corretor"
                htmlFor="s-porcorretor"
                hint={`quantas vendas cada corretor fecha ${nomeDoPeriodo}`}
              >
                <Input
                  id="s-porcorretor"
                  type="number"
                  min="1"
                  value={porCorretor}
                  onChange={(e) => setPorCorretor(e.target.value)}
                />
              </FormField>
            </div>
          </Cartao.Corpo>
          <Cartao.Lista colunas={{ valor: true }} rotuloAcessivel="O período da simulação">
            <Linha
              titulo="Período"
              meta="a estrutura é mensal; o VGV é do período inteiro"
              valor={
                <FiltrosRapidos
                  rotuloAcessivel="Período da simulação"
                  ativo={String(periodo)}
                  aoMudar={(v) => setPeriodo(Number(v) as Periodo)}
                  filtros={[
                    { id: '1', rotulo: '1 mês' },
                    { id: '3', rotulo: '3 meses' },
                    { id: '6', rotulo: '6 meses' },
                    { id: '12', rotulo: '12 meses' },
                  ]}
                />
              }
            />
          </Cartao.Lista>
        </Cartao>

        <Cartao className="lg:col-span-5">
          <Cartao.Cabecalho titulo="Quanto o dinheiro perde no caminho" icone={Percent} />
          <Cartao.Corpo>
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
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
              {temNota && (
                <FormField label="% do Simples" htmlFor="s-simples" hint="sobre a comissão menos o ISS">
                  <PercentInput id="s-simples" value={pctSimples} onChange={setPctSimples} />
                </FormField>
              )}
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
              {retemIss && (
                <FormField label="% do ISS" htmlFor="s-isspct" hint="sobre a comissão">
                  <PercentInput id="s-isspct" value={pctIss} onChange={setPctIss} />
                </FormField>
              )}
              <FormField label="% do corretor" htmlFor="s-corretor" hint="sobre a base, nunca sobre o bruto">
                <PercentInput id="s-corretor" value={pctCorretor} onChange={setPctCorretor} />
              </FormField>
            </div>
          </Cartao.Corpo>
        </Cartao>

        <Cartao className="lg:col-span-7">
          <Cartao.Cabecalho
            titulo="A estrutura"
            icone={Calculator}
            meta={`${formatCurrency(real.estrutura)} por mês é o que a imobiliária gasta hoje, na média`}
          />
          <Cartao.Corpo>
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <FormField
                label="Estrutura por mês"
                htmlFor="s-estrutura"
                hint="aluguel, contabilidade, ferramentas — o que existe com ou sem venda"
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
          <Cartao.Lista colunas={{ valor: true }} rotuloAcessivel="A conta da estrutura">
            <Linha
              titulo={`Estrutura ${nomeDoPeriodo}`}
              meta={`${formatCurrency(estrutura ?? 0)} × ${periodo}`}
              valor={<Valor valor={conta.estruturaTotal} posto="linha" />}
            />
            {conta.novaTotal > 0 && (
              <Linha
                titulo={`Despesa nova ${nomeDoPeriodo}`}
                meta={`${formatCurrency(nova ?? 0)} × ${periodo}`}
                valor={<Valor valor={conta.novaTotal} posto="linha" />}
              />
            )}
            <Linha
              titulo="VGV que apenas empata"
              meta="abaixo disso, o período consome reserva"
              valor={<Valor valor={conta.vgvDeEquilibrio} posto="linha" forte />}
            />
          </Cartao.Lista>
          <Cartao.Rodape>
            <p className="max-w-[72ch]">
              A estrutura é da empresa, não da venda: ela entra depois da comissão do corretor e do imposto, e é por
              isso que ela não muda a margem da operação — muda o que sobra no fim.
            </p>
          </Cartao.Rodape>
        </Cartao>

        <Cartao className="lg:col-span-5">
          <Cartao.Cabecalho titulo="O que este desenho exige" icone={Users} />
          <Cartao.Lista colunas={{ valor: true }} rotuloAcessivel="O que a simulação exige">
            <Linha
              titulo="Vendas no período"
              meta={`VGV de ${formatCurrency(vgv ?? 0)} ÷ ticket de ${formatCurrency(ticket ?? 0)}`}
              valor={<span className="num font-heading text-t1 text-valor-linha">{conta.vendasNecessarias}</span>}
            />
            <Linha
              titulo="Corretores"
              meta={`a ${porCorretor} ${Number(porCorretor) === 1 ? 'venda' : 'vendas'} por corretor`}
              valor={<span className="num font-heading text-t1 text-valor-linha">{conta.corretoresNecessarios}</span>}
            />
            <Linha
              titulo="Comissão por venda"
              meta="o que a imobiliária fatura em cada uma"
              valor={
                <Valor
                  valor={conta.vendasNecessarias > 0 ? r2(conta.comissao / conta.vendasNecessarias) : 0}
                  posto="linha"
                />
              }
            />
            <Linha
              titulo="Sobra por venda"
              meta="depois do imposto e do corretor, antes da estrutura"
              valor={
                <Valor
                  valor={conta.vendasNecessarias > 0 ? r2(conta.brutoDaCasa / conta.vendasNecessarias) : 0}
                  posto="linha"
                  forte
                />
              }
            />
          </Cartao.Lista>
          <Cartao.Rodape>
            <p className="max-w-[72ch]">
              A conta de corretores é aritmética simples, não previsão: ela diz quantas pessoas, no ritmo que você
              informou, fecham o VGV do período. Se o ritmo real for outro, mude o campo e veja.
            </p>
          </Cartao.Rodape>
        </Cartao>
      </div>
    </PageLayout>
  )
}
