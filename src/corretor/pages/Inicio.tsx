import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Handshake } from 'lucide-react'
import { useCorretor, type CorretorParcela } from '../CorretorData'
import { FraseDaParcela, fraseDaParcela } from '../EtapaDaParcela'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Cartao } from '@/components/ui/Cartao'
import { FaixaDeMetricas } from '@/components/ui/FaixaDeMetricas'
import { Linha } from '@/components/ui/Lista'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { Icone } from '@/components/ui/Icone'
import { FraseDeTempo } from '@/components/ui/Situacao'
import { EstadoVazio } from '@/components/ui/Estados'
import { Dica } from '@/components/ui/Dica'
import { situacaoDeTela, type Situacao } from '@/lib/situacao'
import { formatCurrency, parseDateOnly, toDateOnly } from '@/lib/format'
import { GraficoAnoEmBarras } from '@/components/graficos/GraficoAnoEmBarras'
import { ListaDeAcoes, type ItemDeAcao } from '@/components/ui/ListaDeAcoes'
import { Regua } from '@/components/ui/Regua'

/*
 * O INÍCIO DO CORRETOR (9.8): o bolso.
 *
 * O herói é A RECEBER AGORA, o que a imobiliária já recebeu e deve a ele. O
 * ano continua na tela como três linhas que se comparam no mesmo degrau, e
 * cada número ABRE nas parcelas que o compõem, com o nome da venda.
 */
export function CorretorInicio() {
  const { painel, parcelas, ano, vendas } = useCorretor()
  const { abrir } = useComposicao()
  const hoje = toDateOnly(new Date())

  /** As parcelas do ano exibido, já traduzidas para a situação de tela. */
  const doAno = useMemo(
    () =>
      parcelas
        .filter((p) => p.expected_date.slice(0, 4) === String(ano))
        .map((p) => ({ p, s: situacaoDeTela(p.status, p.expected_date, hoje) })),
    [parcelas, ano, hoje],
  )

  const por = (fn: (s: Situacao) => boolean) => doAno.filter(({ s }) => fn(s))

  /** Uma parcela virando item de composição, com a venda de origem. */
  const item = ({ p, s }: { p: CorretorParcela; s: Situacao }) => ({
    id: p.id,
    titulo: p.sale_title,
    meta: [p.development, fraseDaParcela(p, s, hoje)]
      .filter(Boolean)
      .join(' · '),
    valor: p.broker_amount - p.broker_adjustment,
    situacao: s,
    idx: p.idx,
    count: p.count,
    para: `/minhas-vendas?venda=${p.sale_id}`,
  })

  const soma = (l: { p: CorretorParcela }[]) =>
    Math.round(l.reduce((s, { p }) => s + p.broker_amount - p.broker_adjustment, 0) * 100) / 100

  if (!painel || (painel.sales_count === 0 && painel.commission_total === 0)) {
    return (
      <PageLayout>
        <Cartao rotuloAcessivel="Suas comissões">
          <EstadoVazio
            icone={Handshake}
            titulo="Nada por aqui ainda"
            descricao="Suas vendas aparecem assim que a imobiliária registrar a primeira. Se você fechou uma venda e ela não está aqui, fale com a imobiliária."
          />
        </Cartao>
      </PageLayout>
    )
  }

  const p = painel
  /** A próxima parcela, com os marcos do gatilho e da nota que o painel não traz. */
  const proxima = p.next
    ? parcelas.find((x) => x.sale_title === p.next!.sale_title && x.idx === p.next!.idx)
    : undefined
  const liberadas = por((s) => s === 'liberada' || s === 'vencida')
  const recebidas = por((s) => s === 'recebida')
  const previstas = por((s) => s === 'prevista')
  const atrasadas = por((s) => s === 'vencida')
  const ativas = [...vendas].filter((v) => v.status !== 'cancelada').sort((a, b) => b.sale_date.localeCompare(a.sale_date))
  const sProxima = p.next ? situacaoDeTela(p.next.status, p.next.date, hoje) : null

  /*
   * SOUZA 3.0 (02/11/2026): o mesmo desenho do Início do administrador. A
   * frase do título responde "quanto é meu agora?"; o número líder é o que
   * está liberado; o ano vira um gráfico de 12 meses (recebido em marinho,
   * liberado em tinta, previsto em cinza) e a régua do ano diz quanto já caiu.
   */
  const passos: ItemDeAcao[] = [
    ...atrasadas.map(({ p: parc }) => ({
      id: parc.id,
      titulo: parc.sale_title,
      detalhe: `liberada há mais tempo que o combinado · vale um lembrete para a imobiliária`,
      valor: parc.broker_amount - parc.broker_adjustment,
      tom: 'risco' as const,
      para: `/minhas-vendas?venda=${parc.sale_id}`,
    })),
    ...(p.next && sProxima
      ? [
          {
            id: 'proxima',
            titulo: `Próximo: ${p.next.sale_title}`,
            detalhe: proxima ? <FraseDaParcela p={proxima} s={sProxima} /> : <FraseDeTempo situacao={sProxima} prevista={p.next.date} />,
            valor: p.next.amount,
            para: '/recebimentos',
          },
        ]
      : []),
    { id: 'plano', titulo: 'Suas metas e seu nível', detalhe: 'quanto falta para o próximo degrau', para: '/meu-plano' },
  ]

  const frase = (
    <>
      <b>
        {liberadas.length > 0
          ? `${formatCurrency(soma(liberadas))} liberados para você`
          : 'Nada liberado agora'}
      </b>
      {p.next && sProxima ? ` · próximo: ${formatCurrency(p.next.amount)} de ${p.next.sale_title}` : ` · sua comissão em ${ano}`}
    </>
  )

  const meses = Array.from({ length: 12 }, (_, i) => {
    const chave = `${ano}-${String(i + 1).padStart(2, '0')}`
    const doMes = doAno.filter(({ p: parc }) => parc.expected_date.slice(0, 7) === chave)
    return {
      chave,
      rotulo: parseDateOnly(`${chave}-01`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      nome: parseDateOnly(`${chave}-01`).toLocaleDateString('pt-BR', { month: 'long' }),
      recebida: soma(doMes.filter(({ s }) => s === 'recebida')),
      liberada: soma(doMes.filter(({ s }) => s === 'liberada' || s === 'vencida')),
      prevista: soma(doMes.filter(({ s }) => s === 'prevista')),
      itens: doMes,
    }
  })

  return (
    <PageLayout subtitulo={frase}>
      <FaixaDeMetricas
        rotuloAcessivel="Suas comissões no ano"
        metricas={[
          {
            rotulo: 'Liberada, a receber',
            valor: soma(liberadas),
            lider: true,
            nota:
              liberadas.length === 0
                ? 'quando a construtora pagar, aparece aqui'
                : `${liberadas.length} ${liberadas.length === 1 ? 'parcela' : 'parcelas'} que a imobiliária já recebeu`,
            para: '/recebimentos?foco=a-receber',
          },
          {
            rotulo: `Já recebida em ${ano}`,
            valor: soma(recebidas),
            nota:
              recebidas.length === 0
                ? 'nada pago a você ainda neste ano'
                : `${recebidas.length} ${recebidas.length === 1 ? 'parcela paga' : 'parcelas pagas'} a você`,
            para: '/recebimentos',
          },
          {
            rotulo: 'Ainda prevista',
            valor: soma(previstas),
            nota: previstas.length === 0 ? 'nenhuma parcela prevista' : 'depende da construtora pagar',
            para: '/recebimentos',
          },
          {
            rotulo: `Vendas em ${ano}`,
            valor: 0,
            texto: String(p.sales_count),
            nota: p.vgv > 0 ? `${formatCurrency(p.vgv)} de VGV` : 'valor dos imóveis não informado',
            para: '/minhas-vendas',
          },
        ]}
      />

      <div className="grid items-stretch gap-bloco lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Cartao rotuloAcessivel={`Sua comissão mês a mês em ${ano}`}>
          <Cartao.Cabecalho
            titulo={`Sua comissão em ${ano}`}
            meta={`${formatCurrency(soma(doAno))} no ano, mês a mês`}
            extra={
              <span className="flex flex-wrap items-center gap-3 text-t4 text-texto-meta">
                <LegendaPonto cor="var(--g-entra)" nome="Recebida" />
                <LegendaPonto cor="var(--t2)" nome="Liberada" />
                <LegendaPonto cor="var(--g-sai)" nome="Prevista" />
              </span>
            }
          />
          <Cartao.Corpo>
            <GraficoAnoEmBarras
              meses={meses}
              aoAbrir={(m) =>
                abrir({
                  rotulo: m.nome,
                  titulo: `Parcelas de ${m.nome} de ${ano}`,
                  total: Math.round((m.recebida + m.liberada + m.prevista) * 100) / 100,
                  itens: m.itens.map(item),
                  vazio: 'Nenhuma parcela neste mês.',
                })
              }
            />
          </Cartao.Corpo>
        </Cartao>

        <Cartao rotuloAcessivel="Pede atenção">
          <Cartao.Cabecalho
            titulo="Próximos passos"
            meta={atrasadas.length > 0 ? 'há repasse esperando além do previsto' : 'o que vem por aí'}
          />
          <ListaDeAcoes rotuloAcessivel="Próximos passos" itens={passos} />
        </Cartao>
      </div>

      {/* Itens à altura do próprio conteúdo: o número de vendas muda de corretor para corretor. */}
      <div className="grid items-start gap-bloco lg:grid-cols-2">
        <Cartao rotuloAcessivel={`Quanto já caiu em ${ano}`}>
          <Cartao.Cabecalho titulo="Quanto já caiu" meta={`de ${formatCurrency(soma(doAno))} em ${ano}`} />
          <Cartao.Corpo className="gap-3">
            <Regua
              rotuloAcessivel={`De ${formatCurrency(soma(doAno))} em ${ano}: ${formatCurrency(soma(recebidas))} recebido, ${formatCurrency(soma(liberadas))} liberado a receber e ${formatCurrency(soma(previstas))} dependendo da construtora.`}
              partes={[
                { nome: 'Recebida', valor: soma(recebidas), cor: 'var(--g-entra)' },
                { nome: 'Liberada', valor: soma(liberadas), cor: 'var(--t2)' },
                { nome: 'Prevista', valor: soma(previstas), cor: 'var(--g-sai)' },
              ]}
            />
            {p.personal_total > 0 && (
              <Dica>
                Deste total, <Valor valor={p.personal_total} posto="fato" forte /> vem de{' '}
                {p.personal_count === 1 ? 'uma venda' : `${p.personal_count} vendas`} de pessoa física: comissão sua que não passa
                pelo caixa da imobiliária, e por isso não espera repasse.
              </Dica>
            )}
          </Cartao.Corpo>
          <Cartao.Lista rotuloAcessivel={`Sua comissão em ${ano}`} colunas={{ goteira: true, valor: true }}>
            <Linha
              goteira={<span aria-hidden className="size-2.5 rounded-ponto" style={{ background: 'var(--g-entra)' }} />}
              titulo="Já recebida"
              meta={`${recebidas.length} ${recebidas.length === 1 ? 'parcela paga' : 'parcelas pagas'} a você`}
              valor={
                <ValorComOrigem
                  valor={soma(recebidas)}
                  posto="linha"
                  rotuloAcessivel="Ver quais parcelas você já recebeu"
                  aoAbrir={() => abrir({ rotulo: 'Já recebida', titulo: 'O que já caiu para você', total: soma(recebidas), itens: recebidas.map(item), vazio: 'Nada pago ainda.' })}
                />
              }
            />
            <Linha
              goteira={<span aria-hidden className="size-2.5 rounded-ponto" style={{ background: 'var(--t2)' }} />}
              titulo="Liberada, a receber"
              meta="a imobiliária recebeu e vai te pagar"
              valor={
                <ValorComOrigem
                  valor={soma(liberadas)}
                  posto="linha"
                  rotuloAcessivel="Ver quais vendas compõem o valor a receber"
                  aoAbrir={() => abrir({ rotulo: 'A receber', titulo: 'De quais vendas vem', total: soma(liberadas), itens: liberadas.map(item), vazio: 'Nada liberado no momento.' })}
                />
              }
            />
            <Linha
              goteira={<span aria-hidden className="size-2.5 rounded-ponto" style={{ background: 'var(--g-sai)' }} />}
              titulo="Prevista"
              meta="depende da construtora pagar primeiro"
              valor={
                <ValorComOrigem
                  valor={soma(previstas)}
                  posto="linha"
                  previsto
                  rotuloAcessivel="Ver quais parcelas estão previstas"
                  aoAbrir={() =>
                    abrir({
                      rotulo: 'Prevista',
                      titulo: 'Previsão, não promessa',
                      explica: 'Estas parcelas só viram comissão sua quando a construtora pagar a imobiliária. A data pode mudar.',
                      total: soma(previstas),
                      itens: previstas.map(item),
                      vazio: 'Nenhuma parcela prevista.',
                    })
                  }
                />
              }
            />
          </Cartao.Lista>
        </Cartao>

        <Cartao rotuloAcessivel="Suas vendas">
          <Cartao.Cabecalho
            titulo="Suas vendas"
            meta={`${ativas.length} ${ativas.length === 1 ? 'venda ativa' : 'vendas ativas'} · as mais recentes primeiro`}
          />
          {ativas.length === 0 ? (
            <Cartao.Corpo>
              <EstadoVazio icone={Handshake} titulo="Nenhuma venda ativa" descricao="Quando a imobiliária registrar uma venda sua, ela aparece aqui." />
            </Cartao.Corpo>
          ) : (
            <Cartao.Lista rotuloAcessivel="Suas vendas mais recentes" colunas={{ valor: true, fim: true }}>
              {ativas.slice(0, 4).map((v) => (
                <Linha
                  key={v.id}
                  titulo={v.title}
                  meta={[v.development, v.is_personal ? 'pessoa física' : null, `${v.installments} ${v.installments === 1 ? 'parcela' : 'parcelas'}`]
                    .filter(Boolean)
                    .join(' · ')}
                  valor={<Valor valor={v.commission_total} posto="linha" />}
                  para={`/minhas-vendas?venda=${v.id}`}
                />
              ))}
            </Cartao.Lista>
          )}
          <Cartao.Rodape>
            <Link to="/minhas-vendas" className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline hover:underline-offset-4">
              Ver todas as vendas
              <Icone icone={ArrowRight} tamanho={16} />
            </Link>
          </Cartao.Rodape>
        </Cartao>
      </div>
    </PageLayout>
  )
}

function LegendaPonto({ cor, nome }: { cor: string; nome: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="size-2 rounded-ponto" style={{ background: cor }} />
      {nome}
    </span>
  )
}
