import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Handshake } from 'lucide-react'
import { useCorretor, type CorretorParcela } from '../CorretorData'
import { useComposicao } from '@/components/composicao/Composicao'
import { Heroi } from '@/components/ui/Assinatura'
import { Secao } from '@/components/ui/Secao'
import { Lista, Linha } from '@/components/ui/Lista'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { Selo } from '@/components/ui/Selo'
import { ChipSituacao, FraseDeTempo } from '@/components/ui/Situacao'
import { Trilha, LegendaTrilha } from '@/components/ui/Trilha'
import { EmptyState } from '@/components/ui/EmptyState'
import { situacaoDeTela, fraseDeTempo, type Situacao } from '@/lib/situacao'
import { formatCurrency, parseDateOnly, toDateOnly } from '@/lib/format'

/*
 * O INÍCIO DO CORRETOR.
 *
 * A tela anterior abria com "Sua comissão em 2026" em degrau herói — e esse
 * número é a comissão do ANO INTEIRO, somando o que ele já recebeu, o que está
 * liberado e o que ainda depende da construtora pagar. Ou seja: o maior número
 * da tela era justamente o que ele não vai receber agora.
 *
 * Isso é o oposto da regra do sistema. Previsão nunca ocupa o degrau herói.
 *
 * O herói passa a ser A RECEBER AGORA — o que a imobiliária já recebeu e deve
 * a ele. É o único número que responde a pergunta que ele abre o app para
 * fazer, e é o único que é dinheiro de verdade.
 *
 * O ano continua na tela, abaixo, como três linhas que se comparam no mesmo
 * degrau. E cada uma delas ABRE nas parcelas que a compõem, com o nome da
 * venda — porque "R$ 7.998,54 a receber" sem saber de qual venda é não serve
 * para conferir nada.
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
      <EmptyState
        icon={<Handshake className="h-8 w-8" />}
        title="Nada por aqui ainda"
        description="Suas vendas aparecem assim que a imobiliária registrar a primeira. Se você fechou uma venda e ela não está aqui, fale com a imobiliária."
      />
    )
  }

  const p = painel
  const liberadas = por((s) => s === 'liberada' || s === 'vencida')
  const recebidas = por((s) => s === 'recebida')
  const previstas = por((s) => s === 'prevista')
  const atrasadas = por((s) => s === 'vencida')

  return (
    <div className="animate-fade-in">
      <Heroi
        rotulo="A receber agora"
        contexto={
          liberadas.length > 0
            ? 'A imobiliária já recebeu estas parcelas. É dinheiro seu, esperando o repasse.'
            : 'Nada liberado no momento. Quando a construtora pagar uma parcela, sua comissão aparece aqui.'
        }
      >
        {liberadas.length > 0 ? (
          <ValorComOrigem
            valor={soma(liberadas)}
            posto="heroi"
            rotuloAcessivel="Ver de quais vendas vem o valor a receber"
            aoAbrir={() =>
              abrir({
                rotulo: 'A receber agora',
                titulo: 'De quais vendas vem',
                explica: 'Parcelas que a imobiliária já recebeu. Sua comissão está liberada para pagamento.',
                total: soma(liberadas),
                itens: liberadas.map(item),
              })
            }
          />
        ) : (
          <Valor valor={0} posto="heroi" tinta="text-content-muted" />
        )}
      </Heroi>

      {/*
       * Atraso aqui tem um significado estrito e é o mais honesto do sistema:
       * é o que a imobiliária JÁ RECEBEU e ainda não repassou. Parcela que a
       * construtora não pagou é espera, não atraso — e nunca aparece como
       * dívida da imobiliária com ele.
       */}
      {atrasadas.length > 0 && (
        <Secao titulo="Esperando há mais tempo que o previsto">
          <Lista>
            {atrasadas.map(({ p: parc, s }) => (
              <Linha
                key={parc.id}
                selo={<Selo situacao={s} idx={parc.idx} count={parc.count} />}
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
                valor={<Valor valor={parc.broker_amount - parc.broker_adjustment} posto="linha" tinta="text-critical" />}
                para={`/minhas-vendas?venda=${parc.sale_id}`}
              />
            ))}
          </Lista>
          <p className="mt-2 text-sm text-content-muted">Vale um lembrete para a imobiliária.</p>
        </Secao>
      )}

      {p.next && (
        <Secao titulo="Próximo recebimento">
          <Lista>
            <Linha
              selo={
                <Selo
                  situacao={situacaoDeTela(p.next.status, p.next.date, hoje)}
                  idx={p.next.idx}
                  count={p.next.count}
                />
              }
              titulo={p.next.sale_title}
              meta={
                <FraseDeTempo
                  situacao={situacaoDeTela(p.next.status, p.next.date, hoje)}
                  prevista={p.next.date}
                />
              }
              situacao={
                <ChipSituacao situacao={situacaoDeTela(p.next.status, p.next.date, hoje)} perfil="corretor" />
              }
              valor={<Valor valor={p.next.amount} posto="linha" />}
            />
          </Lista>
        </Secao>
      )}

      <Secao titulo={`Sua comissão em ${ano}`}>
        <div className="mb-3 space-y-2">
          <Trilha
            recebido={soma(recebidas)}
            liberado={soma(liberadas)}
            previsto={soma(previstas)}
            rotuloAcessivel={`De ${formatCurrency(soma(doAno))} em ${ano}: ${formatCurrency(soma(recebidas))} recebido, ${formatCurrency(soma(liberadas))} liberado a receber e ${formatCurrency(soma(previstas))} dependendo da construtora.`}
          />
          <LegendaTrilha />
        </div>
        <Lista>
          <Linha
            selo={<Selo situacao="recebida" />}
            titulo="Já recebida"
            meta={`${recebidas.length} ${recebidas.length === 1 ? 'parcela paga' : 'parcelas pagas'} a você`}
            valor={
              recebidas.length > 0 ? (
                <ValorComOrigem
                  valor={soma(recebidas)}
                  tinta="text-income"
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
                <Valor valor={0} tinta="text-content-muted" />
              )
            }
          />
          <Linha
            selo={<Selo situacao="liberada" />}
            titulo="A receber"
            meta="a imobiliária recebeu e vai te pagar"
            valor={
              liberadas.length > 0 ? (
                <ValorComOrigem
                  valor={soma(liberadas)}
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
                <Valor valor={0} tinta="text-content-muted" />
              )
            }
          />
          {/*
           * Previsão: sem cor tônica, com a palavra "depende" no metadado e
           * com o chip neutro. É o que impede que ela seja lida como pagamento
           * garantido.
           */}
          <Linha
            selo={<Selo situacao="prevista" />}
            titulo="Prevista"
            meta="depende da construtora pagar primeiro"
            situacao={<ChipSituacao situacao="prevista" perfil="corretor" />}
            valor={
              previstas.length > 0 ? (
                <ValorComOrigem
                  valor={soma(previstas)}
                  tinta="text-content-muted"
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
                <Valor valor={0} tinta="text-content-muted" />
              )
            }
          />
        </Lista>
      </Secao>

      {p.by_month.length > 0 && (
        <Secao titulo={`Por mês em ${ano}`}>
          <Lista>
            {p.by_month.map((m) => {
              const mesChave = m.month
              const doMes = doAno.filter(({ p: parc }) => parc.expected_date.slice(0, 7) === mesChave)
              const nome = parseDateOnly(`${m.month}-01`).toLocaleDateString('pt-BR', {
                month: 'long',
              })
              return (
                <Linha
                  key={m.month}
                  titulo={nome.charAt(0).toUpperCase() + nome.slice(1)}
                  meta={`${doMes.length} ${doMes.length === 1 ? 'parcela' : 'parcelas'}`}
                  valor={
                    doMes.length > 0 ? (
                      <ValorComOrigem
                        valor={soma(doMes)}
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
                      <Valor valor={m.amount} />
                    )
                  }
                />
              )
            })}
          </Lista>
        </Secao>
      )}

      <Secao titulo={`Sua produção em ${ano}`}>
        <Lista>
          <Linha
            titulo="Vendas fechadas"
            valor={<span className="cifra text-xl font-semibold text-content">{p.sales_count}</span>}
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
        </Lista>
      </Secao>

      <Link
        to="/recebimentos"
        className="mt-8 flex min-h-toque items-center justify-between border-t border-rule pt-4 text-base font-medium text-content transition-colors hover:text-action-soft-ink"
      >
        Ver o cronograma completo
        <ArrowRight className="h-4 w-4 text-content-faint" />
      </Link>
    </div>
  )
}
