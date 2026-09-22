import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Banknote, CalendarDays, Timer, Handshake, HandCoins, Hourglass, TriangleAlert, Wallet } from 'lucide-react'
import { useCorretor, type CorretorParcela } from '../CorretorData'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Heroi } from '@/components/ui/Heroi'
import { Cartao } from '@/components/ui/Cartao'
import { Kpi } from '@/components/ui/Kpi'
import { Linha } from '@/components/ui/Lista'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { Selo } from '@/components/ui/Selo'
import { Icone } from '@/components/ui/Icone'
import { ChipSituacao, FraseDeTempo } from '@/components/ui/Situacao'
import { BarraTrilha, LegendaTrilha } from '@/components/ui/Barra'
import { EstadoVazio } from '@/components/ui/Estados'
import { Dica } from '@/components/ui/Dica'
import { situacaoDeTela, fraseDeTempo, type Situacao } from '@/lib/situacao'
import { formatCurrency, parseDateOnly, toDateOnly } from '@/lib/format'

/*
 * O INÍCIO DO CORRETOR (9.8): o bolso.
 *
 * O herói é A RECEBER AGORA, o que a imobiliária já recebeu e deve a ele. O
 * ano continua na tela como três linhas que se comparam no mesmo degrau, e
 * cada número ABRE nas parcelas que o compõem, com o nome da venda.
 */
export function CorretorInicio() {
  const { painel, parcelas, ano } = useCorretor()
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
    meta: [p.development, fraseDeTempo(s, { prevista: p.expected_date, liberada: p.received_date, recebida: p.paid_date })]
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
  const liberadas = por((s) => s === 'liberada' || s === 'vencida')
  const recebidas = por((s) => s === 'recebida')
  const previstas = por((s) => s === 'prevista')
  const atrasadas = por((s) => s === 'vencida')

  return (
    <PageLayout subtitulo={`Sua comissão em ${ano}`}>
      <Heroi
        variante="ouro"
        rotulo="A receber agora"
        valor={soma(liberadas)}
        rotuloAcessivel="Ver de quais vendas vem o valor a receber"
        aoAbrir={() =>
          abrir({
            rotulo: 'A receber agora',
            titulo: 'De quais vendas vem',
            explica: 'Parcelas que a imobiliária já recebeu. Sua comissão está liberada para pagamento.',
            total: soma(liberadas),
            itens: liberadas.map(item),
            vazio: 'Nada liberado no momento.',
          })
        }
        frase={
          liberadas.length > 0
            ? 'A imobiliária já recebeu estas parcelas. É dinheiro seu, esperando o repasse.'
            : 'Nada liberado no momento. Quando a construtora pagar uma parcela, sua comissão aparece aqui.'
        }
      />

      {/*
       * A FILEIRA DO CORRETOR (21/09/2026). O painel dele era uma coluna de
       * cartões; agora abre com os quatro números que ele quer de relance —
       * os mesmos que já estavam mais abaixo, sem conta nova. O herói continua
       * sendo um só: o que está liberado para ele receber.
       */}
      <div className="grid gap-bloco sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          rotulo={`Vendas em ${ano}`}
          icone={Handshake}
          tom="neutro"
          valor={0}
          texto={String(p.sales_count)}
          nota={`${formatCurrency(soma(doAno))} de comissão sua no ano`}
          para="/minhas-vendas"
        />
        <Kpi
          rotulo={`Já recebida em ${ano}`}
          icone={Banknote}
          tom="sucesso"
          valor={soma(recebidas)}
          estado={soma(recebidas) > 0 ? 'recebido' : undefined}
          nota={
            recebidas.length === 0
              ? 'nada pago a você ainda neste ano'
              : `${recebidas.length} ${recebidas.length === 1 ? 'parcela paga' : 'parcelas pagas'} a você`
          }
          para="/recebimentos"
        />
        <Kpi
          rotulo="Liberada, a receber"
          icone={HandCoins}
          tom="atencao"
          valor={soma(liberadas)}
          nota={
            liberadas.length === 0
              ? 'nada liberado no momento'
              : `${liberadas.length} ${liberadas.length === 1 ? 'parcela' : 'parcelas'} que a imobiliária já recebeu`
          }
          para="/recebimentos?foco=a-receber"
        />
        <Kpi
          rotulo="Ainda prevista"
          icone={Hourglass}
          tom="info"
          valor={soma(previstas)}
          nota={
            previstas.length === 0
              ? 'nenhuma parcela prevista'
              : `${previstas.length} ${previstas.length === 1 ? 'parcela' : 'parcelas'} · depende da construtora pagar`
          }
          para="/recebimentos"
        />
      </div>

      {/*
       * Atraso aqui tem um significado estrito: é o que a imobiliária JÁ
       * RECEBEU e ainda não repassou. Parcela que a construtora não pagou é
       * espera, não atraso.
       */}
      {atrasadas.length > 0 && (
        <Cartao>
          <Cartao.Cabecalho titulo="Esperando além do previsto" icone={TriangleAlert} />
          <Cartao.Lista
            rotuloAcessivel="Comissões atrasadas"
            colunas={{ goteira: true, situacao: true, valor: true, fim: true }}
          >
            {atrasadas.map(({ p: parc, s }) => (
              <Linha
                key={parc.id}
                goteira={<Selo situacao={s} idx={parc.idx} count={parc.count} />}
                titulo={parc.sale_title}
                meta={
                  <FraseDeTempo
                    situacao={s}
                    prevista={parc.expected_date}
                    liberada={parc.received_date}
                    recebida={parc.paid_date}
                  />
                }
                situacao={<ChipSituacao situacao={s} perfil="corretor" />}
                valor={<Valor valor={parc.broker_amount - parc.broker_adjustment} posto="linha" estado="vencido" />}
                para={`/minhas-vendas?venda=${parc.sale_id}`}
              />
            ))}
          </Cartao.Lista>
          <Cartao.Rodape>Vale um lembrete para a imobiliária.</Cartao.Rodape>
        </Cartao>
      )}

      {p.next && (
        <Cartao>
          <Cartao.Cabecalho titulo="Próximo recebimento" icone={Timer} />
          <Cartao.Lista rotuloAcessivel="Próximo recebimento" colunas={{ goteira: true, situacao: true, valor: true }}>
            <Linha
              goteira={
                <Selo
                  situacao={situacaoDeTela(p.next.status, p.next.date, hoje)}
                  idx={p.next.idx}
                  count={p.next.count}
                />
              }
              titulo={p.next.sale_title}
              meta={<FraseDeTempo situacao={situacaoDeTela(p.next.status, p.next.date, hoje)} prevista={p.next.date} />}
              situacao={<ChipSituacao situacao={situacaoDeTela(p.next.status, p.next.date, hoje)} perfil="corretor" />}
              valor={<Valor valor={p.next.amount} posto="linha" />}
            />
          </Cartao.Lista>
        </Cartao>
      )}

      <Cartao>
        <Cartao.Cabecalho titulo={`Sua comissão em ${ano}`} icone={Wallet} />
        <Cartao.Corpo>
          <BarraTrilha
            recebido={soma(recebidas)}
            liberado={soma(liberadas)}
            previsto={soma(previstas)}
            rotuloAcessivel={`De ${formatCurrency(soma(doAno))} em ${ano}: ${formatCurrency(soma(recebidas))} recebido, ${formatCurrency(soma(liberadas))} liberado a receber e ${formatCurrency(soma(previstas))} dependendo da construtora.`}
          />
          <LegendaTrilha />
          {/*
           * A ressalva que o total não dá sozinho (22/09/2026): parte desta
           * comissão vem de venda de pessoa física, que nunca passou pelo caixa
           * da imobiliária. Sem isto escrito, dois dinheiros diferentes viram um
           * número só.
           */}
          {p.personal_total > 0 && (
            <Dica>
              Deste total, <Valor valor={p.personal_total} posto="fato" forte /> vem de{' '}
              {p.personal_count === 1 ? 'uma venda' : `${p.personal_count} vendas`} de pessoa física: comissão sua que
              não passa pelo caixa da imobiliária, e por isso não espera repasse.
            </Dica>
          )}
        </Cartao.Corpo>
        <Cartao.Lista rotuloAcessivel={`Sua comissão em ${ano}`} colunas={{ goteira: true, situacao: true, valor: true }}>
          <Linha
            goteira={<Selo situacao="recebida" />}
            titulo="Já recebida"
            meta={`${recebidas.length} ${recebidas.length === 1 ? 'parcela paga' : 'parcelas pagas'} a você`}
            valor={
              recebidas.length > 0 ? (
                <ValorComOrigem
                  valor={soma(recebidas)}
                  posto="linha"
                  estado="recebido"
                  rotuloAcessivel="Ver quais parcelas você já recebeu"
                  aoAbrir={() =>
                    abrir({
                      rotulo: 'Já recebida',
                      titulo: 'O que já caiu para você',
                      total: soma(recebidas),
                      itens: recebidas.map(item),
                    })
                  }
                />
              ) : (
                <Valor valor={0} posto="linha" />
              )
            }
          />
          <Linha
            goteira={<Selo situacao="liberada" />}
            titulo="A receber"
            meta="a imobiliária recebeu e vai te pagar"
            valor={
              liberadas.length > 0 ? (
                <ValorComOrigem
                  valor={soma(liberadas)}
                  posto="linha"
                  rotuloAcessivel="Ver quais vendas compõem o valor a receber"
                  aoAbrir={() =>
                    abrir({
                      rotulo: 'A receber',
                      titulo: 'De quais vendas vem',
                      total: soma(liberadas),
                      itens: liberadas.map(item),
                    })
                  }
                />
              ) : (
                <Valor valor={0} posto="linha" />
              )
            }
          />
          {/* Previsão: sem cor tônica, com "depende" no metadado e o chip neutro. */}
          <Linha
            goteira={<Selo situacao="prevista" />}
            titulo="Prevista"
            meta="depende da construtora pagar primeiro"
            situacao={<ChipSituacao situacao="prevista" perfil="corretor" />}
            valor={
              previstas.length > 0 ? (
                <ValorComOrigem
                  valor={soma(previstas)}
                  posto="linha"
                  previsto
                  rotuloAcessivel="Ver quais parcelas estão previstas"
                  aoAbrir={() =>
                    abrir({
                      rotulo: 'Prevista',
                      titulo: 'Previsão, não promessa',
                      explica:
                        'Estas parcelas só viram comissão sua quando a construtora pagar a imobiliária. A data pode mudar.',
                      total: soma(previstas),
                      itens: previstas.map(item),
                    })
                  }
                />
              ) : (
                <Valor valor={0} posto="linha" />
              )
            }
          />
        </Cartao.Lista>
        <Cartao.Rodape>
          <Link
            to="/recebimentos"
            className="flex min-h-toque flex-1 items-center justify-between gap-3 font-medium text-t1 hover:text-t2"
          >
            Ver o cronograma completo
            <Icone icone={ArrowRight} tamanho={16} />
          </Link>
        </Cartao.Rodape>
      </Cartao>

      {p.by_month.length > 0 && (
        <Cartao>
          <Cartao.Cabecalho titulo={`Por mês em ${ano}`} icone={CalendarDays} />
          <Cartao.Lista rotuloAcessivel={`Por mês em ${ano}`} colunas={{ valor: true }}>
            {p.by_month.map((m) => {
              const doMes = doAno.filter(({ p: parc }) => parc.expected_date.slice(0, 7) === m.month)
              const nome = parseDateOnly(`${m.month}-01`).toLocaleDateString('pt-BR', { month: 'long' })
              return (
                <Linha
                  key={m.month}
                  titulo={nome.charAt(0).toUpperCase() + nome.slice(1)}
                  meta={`${doMes.length} ${doMes.length === 1 ? 'parcela' : 'parcelas'}`}
                  valor={
                    doMes.length > 0 ? (
                      <ValorComOrigem
                        valor={soma(doMes)}
                        posto="linha"
                        rotuloAcessivel={`Ver as parcelas de ${nome}`}
                        aoAbrir={() =>
                          abrir({
                            rotulo: nome,
                            titulo: `Parcelas de ${nome} de ${ano}`,
                            total: soma(doMes),
                            itens: doMes.map(item),
                          })
                        }
                      />
                    ) : (
                      <Valor valor={m.amount} posto="linha" />
                    )
                  }
                />
              )
            })}
          </Cartao.Lista>
        </Cartao>
      )}

      <Cartao>
        <Cartao.Cabecalho titulo={`Sua produção em ${ano}`} icone={Handshake} />
        <Cartao.Lista rotuloAcessivel={`Sua produção em ${ano}`} colunas={{ valor: true }}>
          <Linha
            titulo="Vendas fechadas"
            valor={<span className="num font-medium text-t1 text-valor-linha">{p.sales_count}</span>}
            para="/minhas-vendas"
          />
          <Linha
            titulo="VGV vendido"
            meta={
              p.sales_without_vgv > 0
                ? `${p.sales_without_vgv} ${p.sales_without_vgv === 1 ? 'venda sem valor informado' : 'vendas sem valor informado'}`
                : 'valor somado dos imóveis'
            }
            valor={<Valor valor={p.vgv} posto="linha" />}
            para="/minhas-vendas"
          />
        </Cartao.Lista>
      </Cartao>
    </PageLayout>
  )
}
