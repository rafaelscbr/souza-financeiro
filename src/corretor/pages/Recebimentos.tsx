import { Fragment, useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { useCorretor, type CorretorParcela } from '../CorretorData'
import { useComposicao } from '@/components/composicao/Composicao'
import { Heroi } from '@/components/ui/Assinatura'
import { Secao, SubtotalDuplo } from '@/components/ui/Secao'
import { Lista, Linha, LinhaDeHoje } from '@/components/ui/Lista'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { Selo } from '@/components/ui/Selo'
import { ChipSituacao, FraseDeTempo } from '@/components/ui/Situacao'
import { Segmented } from '@/components/ui/Segmented'
import { EmptyState } from '@/components/ui/EmptyState'
import { VOCABULARIO, fraseDeTempo, situacaoDeTela, type Situacao } from '@/lib/situacao'
import { parseDateOnly, toDateOnly } from '@/lib/format'

/*
 * O CRONOGRAMA — cada recebimento, de qual venda vem, em que situação está.
 *
 * O herói é "A receber agora", e é só o LIBERADO: o que a imobiliária já
 * recebeu e ainda não repassou. É o mesmo número do herói do Início, de
 * propósito — se as duas telas respondessem a mesma pergunta com números
 * diferentes, nenhuma das duas serviria para conferir nada.
 *
 * Previsão não entra nesse número em lugar nenhum. Ela aparece no cronograma,
 * com a palavra e a frase que dizem de quem ela depende, e nos subtotais de mês
 * — sempre na segunda parcela do subtotal, nunca somada à primeira.
 *
 * A tela anterior somava tudo num total único no topo ("16 parcelas ·
 * R$ 24.312,80"), misturando o que é dele com o que é promessa da construtora,
 * e esse total ainda mudava com o filtro. Um número que muda de significado
 * conforme o botão apertado não é um número: é uma impressão.
 */

/** Arredonda em centavos — a diferença de R$ 0,04 é o que trava uma conferência. */
const c2 = (n: number) => Math.round(n * 100) / 100

type Filtro = 'tudo' | 'aReceber' | 'recebidas'

interface Item {
  p: CorretorParcela
  s: Situacao
  /** A data que põe a parcela na linha do tempo. */
  quando: string
}

export function Recebimentos() {
  const { parcelas } = useCorretor()
  const { abrir } = useComposicao()
  const [filtro, setFiltro] = useState<Filtro>('tudo')
  const hoje = toDateOnly(new Date())

  /*
   * A parcela recebida se posiciona pela data em que FOI PAGA, não pela data em
   * que se esperava que fosse: ele confere isto contra o extrato do banco, e no
   * extrato o que existe é o dia do crédito.
   */
  const todas = useMemo<Item[]>(
    () =>
      parcelas.map((p) => {
        const s = situacaoDeTela(p.status, p.expected_date, hoje)
        return { p, s, quando: s === 'recebida' ? p.paid_date ?? p.expected_date : p.expected_date }
      }),
    [parcelas, hoje],
  )

  const liberadas = todas.filter(({ s }) => s === 'liberada' || s === 'vencida')
  const atrasadas = todas.filter(({ s }) => s === 'vencida')

  const soma = (l: Item[]) => c2(l.reduce((t, { p }) => t + p.broker_amount - p.broker_adjustment, 0))

  /** Uma parcela virando item de composição, com a venda de origem. */
  const item = ({ p, s }: Item) => ({
    id: p.id,
    titulo: p.sale_title,
    meta: [
      p.development,
      fraseDeTempo(s, { prevista: p.expected_date, liberada: p.received_date, recebida: p.paid_date }),
    ]
      .filter(Boolean)
      .join(' · '),
    valor: c2(p.broker_amount - p.broker_adjustment),
    situacao: s,
    idx: p.idx,
    count: p.count,
    para: `/minhas-vendas?venda=${p.sale_id}`,
  })

  /*
   * O filtro muda o cronograma, NUNCA o herói. "A receber agora" é a resposta da
   * tela e não pode depender de qual botão está apertado.
   *
   * "A receber" aqui significa exatamente o que significa no chip da parcela: a
   * imobiliária recebeu e deve a ele. Previsão não entra — ela está em "Tudo",
   * que é onde o cronograma inteiro aparece.
   */
  const lista = useMemo(
    () =>
      todas.filter(({ s }) => {
        if (filtro === 'aReceber') return s === 'liberada' || s === 'vencida'
        if (filtro === 'recebidas') return s === 'recebida'
        return true
      }),
    [todas, filtro],
  )

  const meses = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const it of lista) {
      const chave = it.quando.slice(0, 7)
      const ja = m.get(chave)
      if (ja) ja.push(it)
      else m.set(chave, [it])
    }
    return [...m.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([mes, itens]) => ({
        mes,
        itens: [...itens].sort((a, b) => (a.quando === b.quando ? a.p.idx - b.p.idx : a.quando < b.quando ? -1 : 1)),
      }))
  }, [lista])

  if (parcelas.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-8 w-8" />}
        title="Nenhum recebimento ainda"
        description="Quando a imobiliária registrar uma venda sua, o cronograma da comissão aparece aqui, parcela por parcela."
      />
    )
  }

  /*
   * Onde cai a linha de hoje: no primeiro mês que tem parcela de hoje em diante,
   * e só se houver passado antes dela. Sem passado não há fronteira para marcar.
   */
  const temPassado = lista.some((it) => it.quando < hoje)
  const mesDoMarco = temPassado ? meses.find((g) => g.itens.some((it) => it.quando >= hoje))?.mes : undefined

  return (
    <div className="animate-fade-in">
      <Heroi
        rotulo="A receber agora"
        contexto={
          liberadas.length > 0 ? (
            <>
              A imobiliária já recebeu estas parcelas. É dinheiro seu, esperando o repasse.{' '}
              {atrasadas.length > 0 &&
                `${atrasadas.length === 1 ? 'Uma delas já passou' : `${atrasadas.length} delas já passaram`} da data prevista — vale um lembrete.`}
            </>
          ) : (
            'Nada liberado no momento. Quando a construtora pagar uma parcela, sua comissão aparece aqui.'
          )
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
                explica:
                  'Parcelas que a imobiliária já recebeu. Sua comissão está liberada para pagamento.',
                total: soma(liberadas),
                itens: liberadas.map(item),
              })
            }
          />
        ) : (
          <Valor valor={0} posto="heroi" tinta="text-content-muted" />
        )}
      </Heroi>

      <Segmented
        ariaLabel="O que mostrar no cronograma"
        // O botão do Segmented tem 36px, que é alvo de mouse. Aqui é celular,
        // em pé, com o polegar: os três sobem para os 44px do piso de toque.
        className="[&>button]:h-toque"
        value={filtro}
        onChange={setFiltro}
        options={[
          { value: 'tudo', label: 'Tudo' },
          { value: 'aReceber', label: 'A receber' },
          { value: 'recebidas', label: 'Recebidas' },
        ]}
      />

      {meses.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Nada com esse filtro"
            description={
              filtro === 'recebidas'
                ? 'Você ainda não recebeu nenhuma comissão. Assim que a imobiliária pagar, a parcela aparece aqui com a data.'
                : 'Nenhuma parcela liberada agora. As previstas continuam em "Tudo".'
            }
          />
        </div>
      ) : (
        meses.map((g) => {
          const nome = parseDateOnly(`${g.mes}-01`).toLocaleDateString('pt-BR', {
            month: 'long',
            year: 'numeric',
          })
          // "Agora" é só o que já é dinheiro: pago a ele ou liberado. Previsão
          // vai no segundo número; cancelada não entra em nenhum dos dois.
          const existe = g.itens.filter(({ s }) => s === 'recebida' || s === 'liberada' || s === 'vencida')
          const promessa = g.itens.filter(({ s }) => s === 'prevista')
          const corte = g.mes === mesDoMarco ? g.itens.findIndex((it) => it.quando >= hoje) : -1
          return (
            <Secao
              key={g.mes}
              titulo={nome.charAt(0).toUpperCase() + nome.slice(1)}
              /*
               * Dois números, nunca um. Um total único de mês somaria o que é
               * dele com o que a construtora ainda não pagou — e é essa soma
               * que fazia uma previsão parecer dinheiro em caixa.
               */
              subtotal={
                <SubtotalDuplo
                  agora={<Valor valor={soma(existe)} posto="fato" />}
                  previsto={<Valor valor={soma(promessa)} posto="fato" tinta="text-content-muted" />}
                />
              }
            >
              <Lista>
                {g.itens.map((it, i) => (
                  <Fragment key={it.p.id}>
                    {i === corte && <LinhaDeHoje />}
                    <ParcelaNoCronograma it={it} />
                  </Fragment>
                ))}
              </Lista>
            </Secao>
          )
        })
      )}
    </div>
  )
}

/**
 * Uma parcela na linha do tempo.
 *
 * Os quatro sinais, todos: o selo com o ORDINAL REAL na goteira (o "3" de 3/9),
 * a palavra no chip — em perfil corretor, porque "Liberada" não existe no
 * vocabulário dele —, a frase com verbo e tempo, e só então a cor. Em preto e
 * branco, no sol, a linha continua legível.
 *
 * O valor pousa na mesma borda direita de todas as outras, no mesmo degrau: é
 * assim que 16 parcelas de R$ 201,61 a R$ 2.692,89 passam a ser comparadas por
 * contagem de dígitos, sem leitura.
 *
 * E toda parcela abre a venda de origem: "R$ 1.240,00 em outubro" sem saber de
 * qual venda vem não serve para conferir nada.
 */
function ParcelaNoCronograma({ it }: { it: Item }) {
  const { p, s } = it
  return (
    <Linha
      selo={<Selo situacao={s} idx={p.idx} count={p.count} />}
      titulo={p.sale_title}
      meta={
        <>
          {p.count > 1 && `parcela ${p.idx}/${p.count} · `}
          <FraseDeTempo
            situacao={s}
            prevista={p.expected_date}
            liberada={p.received_date}
            recebida={p.paid_date}
          />
        </>
      }
      situacao={<ChipSituacao situacao={s} perfil="corretor" />}
      // A tinta vem do vocabulário: previsto fica sem cor tônica, e é a
      // ausência de cor que diz que ainda não é dinheiro.
      valor={
        <Valor valor={c2(p.broker_amount - p.broker_adjustment)} posto="linha" tinta={VOCABULARIO[s].tinta} />
      }
      para={`/minhas-vendas?venda=${p.sale_id}`}
    />
  )
}
