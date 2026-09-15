import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Building2, CalendarClock, CircleAlert, Clock, FileText, Handshake, HandCoins, ListOrdered, MoreHorizontal, Pencil, SearchX, Undo2,
} from 'lucide-react'
import { useAdmin } from '../AdminData'
import { ReceberParcela } from '../ReceberParcela'
import { PagarComissao, type ComissaoAPagar } from '../PagarComissao'
import { useComposicao, type ItemComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Heroi } from '@/components/ui/Heroi'
import { Cartao } from '@/components/ui/Cartao'
import { Linha, LinhaGrupo } from '@/components/ui/Lista'
import { Parcela, CabecalhoParcelas } from '@/components/ui/Parcela'
import { Demonstrativo } from '@/components/ui/Demonstrativo'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { Barra } from '@/components/ui/Barra'
import { ChipSituacao } from '@/components/ui/Situacao'
import { Rotulo } from '@/components/ui/Rotulo'
import { Icone } from '@/components/ui/Icone'
import { Button } from '@/components/ui/Button'
import { SidePanel } from '@/components/ui/SidePanel'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormField, Input, Textarea } from '@/components/ui/Field'
import { EstadoVazio } from '@/components/ui/Estados'
import { useToast } from '@/components/ui/Toast'
import { brokerStatusOf, type SaleView } from '@/lib/sales'
import { situacaoDeTela, fraseDeTempo, diasEntre, type Situacao } from '@/lib/situacao'
import { formatCurrency, formatDate, formatDateShort } from '@/lib/format'
import type { LinhaDemonstrativo, ResumoDaParcela } from '@/lib/linhasDaVenda'
import type { SaleInstallment } from '@/types'

/*
 * A FICHA DA VENDA (planta 9.2).
 *
 * SÓ APRESENTAÇÃO. Todo número desta tela é o mesmo que a ficha anterior
 * mostrava, com a mesma origem: `venda.cascade` (cascadeOf), os totais de
 * buildSaleViews e os campos gravados parcela a parcela. Nenhuma soma nova,
 * nenhuma palavra de situação nova, nenhuma ação com outro efeito.
 *
 * Composição: cabeçalho de ficha (Editar e o ⋯ com Cancelar) → herói ouro com
 * a conta da comissão ao lado → os dois lados que nunca somam entre si
 * (construtora → imobiliária; imobiliária → corretor) → parcelas com o
 * marcador de hoje → dados da venda.
 */
export function Venda() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { showToast } = useToast()
  const { abrir } = useComposicao()
  const {
    vendas, transactions, hoje, desfazerRecebimento, reagendarParcela, cancelarVenda, editarVenda,
  } = useAdmin()
  const idCabecalhoParcelas = useId()

  const [recebendo, setRecebendo] = useState<SaleInstallment | null>(null)
  const [pagando, setPagando] = useState<ComissaoAPagar[] | null>(null)
  const [reagendando, setReagendando] = useState<SaleInstallment | null>(null)
  const [novaData, setNovaData] = useState('')
  const [notaReagendar, setNotaReagendar] = useState('')
  const [cancelando, setCancelando] = useState(false)
  const [notaCancelar, setNotaCancelar] = useState('')
  const [editando, setEditando] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const [parcelaAberta, setParcelaAberta] = useState<string | null>(null)
  const [chegada, setChegada] = useState<{ id: string; fase: true | 'saindo' } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const venda = vendas.find((v) => v.id === id)
  const statusPorTx = useMemo(() => new Map(transactions.map((t) => [t.id, t.status])), [transactions])
  const valorPorTx = useMemo(() => new Map(transactions.map((t) => [t.id, t.amount])), [transactions])

  /*
   * ?parcela=<id> (5.5): rola até a parcela, acende o destaque, foca o título
   * e apaga o destaque depois. Só presença na tela; nada é gravado.
   */
  const parcelaDaUrl = params.get('parcela')
  const existeParcelaDaUrl = !!venda?.installments.some((p) => p.id === parcelaDaUrl)
  useEffect(() => {
    if (!parcelaDaUrl || !existeParcelaDaUrl || !venda) return
    const indice = venda.installments.findIndex((p) => p.id === parcelaDaUrl)
    setChegada({ id: parcelaDaUrl, fase: true })
    const quadro = window.requestAnimationFrame(() => {
      const cartao = document.getElementById(idCabecalhoParcelas)?.closest('section')
      const alvo = cartao?.querySelectorAll<HTMLElement>('[data-parcela]')[indice]
      if (!alvo) return
      alvo.scrollIntoView({ block: 'center' })
      const foco = alvo.querySelector<HTMLElement>('[data-coluna="titulo"]')
      if (foco) foco.focus({ preventScroll: true })
    })
    const apaga = window.setTimeout(() => setChegada({ id: parcelaDaUrl, fase: 'saindo' }), 1200)
    const some = window.setTimeout(() => setChegada(null), 2600)
    return () => {
      window.cancelAnimationFrame(quadro)
      window.clearTimeout(apaga)
      window.clearTimeout(some)
    }
    // A venda muda de referência a cada recarga de dados; a chegada é só pela URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcelaDaUrl, existeParcelaDaUrl, idCabecalhoParcelas])

  if (!venda) {
    return (
      <PageLayout titulo="Venda" icone={Handshake}>
        <Cartao rotuloAcessivel="Venda não encontrada">
          <Cartao.Corpo>
            <EstadoVazio
              icone={SearchX}
              titulo="Venda não encontrada"
              descricao="Ela pode ter sido removida."
              acao={
                <Button variant="secundario" onClick={() => navigate('/vendas')}>
                  Voltar para Vendas
                </Button>
              }
            />
          </Cartao.Corpo>
        </Cartao>
      </PageLayout>
    )
  }

  const c = venda.cascade
  const ativa = venda.status !== 'cancelada'
  const nomeCorretor = venda.brokerName ?? 'corretor'

  /* Parcela cancelada fica no histórico, fora de toda soma (o recorte de cascadeOf). */
  const vivas = venda.installments.filter((p) => p.status !== 'cancelada')
  const recebidas = vivas.filter((p) => p.status === 'recebida')

  /* A base do cálculo: o mesmo `v_base` da migração 009 que a ficha já escrevia. */
  const base = arredonda(c.commission - c.iss - c.simples)
  /** O que foi CONTRATADO com o corretor, antes de qualquer desconto. */
  const corretorContratado = arredonda(vivas.reduce((s, p) => s + p.broker_amount, 0))
  /** Comissão do corretor que ainda depende da construtora. */
  const corretorPrevisto = arredonda(venda.brokerToPay - venda.brokerReleased)

  /** Cada parcela com a situação de tela e os números que a ficha já mostrava. */
  const parcelas = venda.installments.map((p) => montarParcela(p, venda, hoje, statusPorTx, valorPorTx))

  /* O marcador de hoje entra antes da primeira parcela cuja data ainda não chegou. */
  const primeiraFutura = parcelas.findIndex(({ p }) => p.expected_date >= hoje)
  const marcaHoje = primeiraFutura > 0

  const itemParcela = ({ p, s }: ParcelaNaTela, valor: number): ItemComposicao => ({
    id: p.id,
    titulo: tituloDaParcela(p),
    meta: fraseDeTempo(s, { prevista: p.expected_date, recebida: p.received_date }, hoje),
    valor,
    situacao: s,
    idx: p.idx,
    count: p.count,
    para: `/vendas/${venda.id}`,
    parcelaId: p.id,
  })

  /* A frase do herói diz o que o número NÃO é (o mesmo texto da ficha anterior). */
  const contextoDoHeroi = !ativa
    ? 'Venda cancelada. O que já tinha sido recebido e pago continua registrado, e o imposto de parcela já recebida continua devido.'
    : venda.toReceive > 0
      ? `${Math.round(c.netShare * 100)}% da comissão contratada, depois do imposto e da comissão do corretor. Não é caixa: ${formatCurrency(venda.toReceive)} desta venda ainda dependem da construtora pagar.`
      : `${Math.round(c.netShare * 100)}% da comissão contratada, depois do imposto e da comissão do corretor. A comissão desta venda já entrou por inteiro.`

  /*
   * A conta da comissão, na ordem da migração 009 e com as mesmas linhas da
   * cascata anterior. Com desconto combinado, o bloco do corretor continua em
   * três linhas: só "Pago ao corretor" é dedução da imobiliária (o desconto
   * sai da comissão DELE; subtraí-lo de novo faria a conta não fechar).
   */
  const conta: LinhaDemonstrativo[] = [
    {
      chave: 'bruto',
      rotulo: 'Comissão da imobiliária',
      detalhe: vivas.length > 1 ? `soma das ${vivas.length} parcelas` : 'parcela única',
      sinal: '+',
      valor: c.commission,
      origem: { tipo: 'venda', id: venda.id },
    },
  ]
  if (c.iss > 0)
    conta.push({ chave: 'iss', rotulo: 'ISS retido na fonte', detalhe: `${venda.iss_pct}% sobre a comissão, retido pela construtora`, sinal: '−', valor: c.iss })
  if (c.simples > 0)
    conta.push({ chave: 'simples', rotulo: 'Imposto (Simples Nacional)', detalhe: `${venda.simples_pct}% sobre a comissão menos o ISS`, sinal: '−', valor: c.simples })
  if (c.iss > 0 || c.simples > 0)
    conta.push({ chave: 'base', rotulo: 'Base do cálculo da comissão', detalhe: 'é sobre ela que incide o percentual do corretor', sinal: '=', valor: base })
  if (corretorContratado > 0) {
    if (c.brokerAdjustment > 0) {
      conta.push({ chave: 'corretor', rotulo: `Comissão de ${nomeCorretor}`, detalhe: `base × ${venda.broker_pct ?? 0}%`, sinal: '+', valor: corretorContratado })
      conta.push({ chave: 'desconto', rotulo: 'desconto combinado', detalhe: 'abatido da comissão do corretor', sinal: '−', valor: c.brokerAdjustment })
      conta.push({ chave: 'corretor', rotulo: 'Pago ao corretor', sinal: '−', valor: c.broker })
    } else {
      conta.push({ chave: 'corretor', rotulo: `Comissão de ${nomeCorretor}`, detalhe: `base × ${venda.broker_pct ?? 0}%`, sinal: '−', valor: c.broker })
    }
  }
  if (c.owner > 0)
    conta.push({ chave: 'socio', rotulo: 'Distribuição ao sócio', detalhe: `${venda.owner_profit_pct ?? 0}% do que sobra depois da comissão do corretor`, sinal: '−', valor: c.owner })
  conta.push({ chave: 'fica', rotulo: 'Fica para a imobiliária', detalhe: `${Math.round(c.netShare * 100)}% da comissão contratada`, sinal: '=', valor: c.net })

  /* Cada linha da conta abre as parcelas, com o campo gravado que compõe aquela linha (a mesma soma de cascadeOf). */
  for (const l of conta) l.origem = { tipo: 'venda', id: venda.id }

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

  const abrirReagendar = (p: SaleInstallment) => {
    setParcelaAberta(null)
    setReagendando(p)
    setNovaData(p.expected_date)
    setNotaReagendar('')
  }
  const abrirPagar = (p: SaleInstallment) => {
    setParcelaAberta(null)
    setPagando([
      {
        installmentId: p.id,
        brokerName: nomeCorretor,
        saleTitle: venda.title,
        parcela: `parcela ${p.idx}/${p.count}`,
        amount: p.broker_amount,
        dueDate: p.received_date ?? p.expected_date,
      },
    ])
  }
  const abrirReceber = (p: SaleInstallment) => {
    setParcelaAberta(null)
    setRecebendo(p)
  }
  const desfazer = (p: SaleInstallment) => {
    setParcelaAberta(null)
    void acao(() => desfazerRecebimento(p.id), 'Recebimento desfeito')
  }

  /* Os três números do corretor abrem as parcelas de onde vêm, com o valor que cada parcela já mostra. */
  const valorCorretor = ({ rotulo, titulo, total, filtro, previsto }: { rotulo: string; titulo: string; total: number; filtro: (x: ParcelaNaTela) => boolean; previsto?: boolean }) => {
    const itens = parcelas.filter((x) => x.p.broker_amount > 0 && filtro(x))
    const aoAbrir = () =>
      abrir({
        rotulo,
        titulo,
        total,
        vazio: 'Nenhuma parcela nesta situação.',
        itens: itens.map((x) => ({ ...itemParcela(x, x.valorCorretor), situacao: x.sCorretor, meta: `${nomeCorretor} · ${x.fraseCorretor}` })),
      })
    return previsto ? (
      <ValorComOrigem posto="linha" previsto valor={total} rotuloAcessivel={`Ver as parcelas: ${titulo.toLowerCase()}`} aoAbrir={aoAbrir} />
    ) : (
      <ValorComOrigem posto="linha" valor={total} rotuloAcessivel={`Ver as parcelas: ${titulo.toLowerCase()}`} aoAbrir={aoAbrir} />
    )
  }

  const aberta = parcelas.find(({ p }) => p.id === parcelaAberta) ?? null

  return (
    <PageLayout
      titulo={venda.title}
      icone={Handshake}
      subtitulo={[venda.client_name, venda.development, `vendida em ${formatDate(venda.sale_date)}`].filter(Boolean).join(' · ')}
      acoes={
        ativa ? (
          <Button variant="secundario" icone={Pencil} onClick={() => setEditando(true)}>
            Editar
          </Button>
        ) : undefined
      }
      menu={
        ativa ? (
          <Button
            variant="fantasma"
            size="icone"
            icone={MoreHorizontal}
            aria-label="Mais ações: editar ou cancelar venda"
            onClick={() => setMenuAberto(true)}
          />
        ) : undefined
      }
    >
      <Heroi
        variante="ouro"
        estado={c.net < 0 ? 'negativo' : undefined}
        rotulo="Fica para a imobiliária"
        valor={c.net}
        contar
        rotuloAcessivel="Abrir o que fica para a imobiliária, parcela por parcela"
        aoAbrir={() =>
          abrir({
            rotulo: 'Fica para a imobiliária',
            titulo: 'O que fica para a imobiliária',
            explica: contextoDoHeroi,
            total: c.net,
            linhas: conta,
            itens: parcelas.filter(({ p }) => p.status !== 'cancelada').map((x) => itemParcela(x, x.p.net_amount)),
          })
        }
        frase={contextoDoHeroi}
        barra={
          ativa ? (
            <Barra
              segmentos={[
                { valor: venda.received, tom: 'sucesso' },
                { valor: venda.toReceive, tom: 'info' },
              ]}
              rotuloAcessivel={`De ${formatCurrency(c.commission)} de comissão, ${formatCurrency(venda.received)} já entraram e ${formatCurrency(venda.toReceive)} dependem da construtora.`}
            />
          ) : undefined
        }
        demonstrativo={{
          linhas: conta,
          perfil: 'admin',
          rotuloAcessivel: 'A conta da comissão',
          aoAbrirOrigem: (l) =>
            abrir({
              rotulo: l.rotulo,
              titulo: `${l.rotulo}, parcela por parcela`,
              total: l.valor,
              linhas: l.chave === 'fica' ? conta : undefined,
              itens: parcelas
                .filter(({ p }) => p.status !== 'cancelada')
                .map((x) => itemParcela(x, valorDaLinhaNaParcela(l, x.p)))
                .filter((i) => i.valor !== 0),
            }),
        }}
      />

      {ativa && (
        <div className="grid gap-bloco lg:grid-cols-2">
          <Cartao>
            <Cartao.Cabecalho titulo="Da construtora para a imobiliária" icone={Building2} />
            <Cartao.Corpo>
              <Barra
                valor={c.commission > 0 ? venda.received / c.commission : 0}
                tom="sucesso"
                rotuloAcessivel={`${formatCurrency(venda.received)} de ${formatCurrency(c.commission)} já entraram`}
              />
            </Cartao.Corpo>
            <Cartao.Lista colunas={{ situacao: true, valor: true }} rotuloAcessivel="Da construtora para a imobiliária">
              <Linha
                titulo="Comissão já recebida"
                meta={`${recebidas.length} de ${vivas.length} ${vivas.length === 1 ? 'parcela' : 'parcelas'}`}
                situacao={<ChipSituacao situacao="recebida" />}
                valor={
                  recebidas.length > 0 ? (
                    <ValorComOrigem
                      posto="linha"
                      estado="recebido"
                      valor={venda.received}
                      rotuloAcessivel="Ver quais parcelas já entraram"
                      aoAbrir={() =>
                        abrir({
                          rotulo: 'Já recebida',
                          titulo: 'O que já entrou desta venda',
                          total: venda.received,
                          itens: parcelas.filter(({ s }) => s === 'recebida').map((x) => itemParcela(x, x.p.amount)),
                        })
                      }
                    />
                  ) : (
                    <ValorComOrigem
                      posto="linha"
                      valor={0}
                      rotuloAcessivel="Ver quais parcelas já entraram"
                      aoAbrir={() => abrir({ rotulo: 'Já recebida', titulo: 'O que já entrou desta venda', total: 0, itens: [], vazio: 'Nenhuma parcela entrou ainda.' })}
                    />
                  )
                }
              />
              <Linha
                titulo="Ainda a receber"
                meta="depende da construtora pagar"
                situacao={<ChipSituacao situacao="prevista" />}
                valor={
                  venda.toReceive > 0 ? (
                    <ValorComOrigem
                      posto="linha"
                      previsto
                      valor={venda.toReceive}
                      rotuloAcessivel="Ver quais parcelas ainda faltam"
                      aoAbrir={() =>
                        abrir({
                          rotulo: 'A receber',
                          titulo: 'O que ainda falta entrar',
                          explica:
                            'Estas parcelas não são dívida de ninguém hoje: elas dependem da construtora pagar. Se a data mudar, reagende na parcela.',
                          total: venda.toReceive,
                          itens: parcelas.filter(({ s }) => s === 'prevista').map((x) => itemParcela(x, x.p.amount)),
                        })
                      }
                    />
                  ) : (
                    <ValorComOrigem
                      posto="linha"
                      previsto
                      valor={0}
                      rotuloAcessivel="Ver quais parcelas ainda faltam"
                      aoAbrir={() => abrir({ rotulo: 'A receber', titulo: 'O que ainda falta entrar', total: 0, itens: [], vazio: 'A comissão desta venda já entrou por inteiro.' })}
                    />
                  )
                }
              />
            </Cartao.Lista>
          </Cartao>

          {venda.brokerName && corretorContratado > 0 && (
            <Cartao>
              <Cartao.Cabecalho titulo="Da imobiliária para o corretor" icone={HandCoins} />
              <Cartao.Corpo>
                <Barra
                  segmentos={[
                    { valor: venda.brokerPaid, tom: 'sucesso' },
                    { valor: venda.brokerReleased, tom: 'atencao' },
                    { valor: Math.max(corretorPrevisto, 0), tom: 'info' },
                  ]}
                  rotuloAcessivel={`Comissão de ${venda.brokerName}: ${formatCurrency(venda.brokerPaid)} paga, ${formatCurrency(venda.brokerReleased)} liberada e ${formatCurrency(corretorPrevisto)} prevista.`}
                />
              </Cartao.Corpo>
              <Cartao.Lista colunas={{ situacao: true, valor: true }} rotuloAcessivel="Da imobiliária para o corretor">
                <Linha
                  titulo={`Comissão paga a ${venda.brokerName}`}
                  meta="já saiu da conta"
                  valor={valorCorretor({ rotulo: 'Comissão paga', titulo: `O que já foi pago a ${venda.brokerName}`, total: venda.brokerPaid, filtro: (x) => x.stCorretor === 'recebida' })}
                />
                {/*
                 * Liberada e prevista continuam separadas: atraso é só o que a
                 * imobiliária já recebeu e não repassou.
                 */}
                {venda.brokerReleased > 0 && (
                  <Linha
                    titulo="Comissão liberada, a pagar"
                    meta="a parcela já entrou; o corretor está esperando"
                    situacao={<ChipSituacao situacao="liberada" />}
                    valor={valorCorretor({ rotulo: 'Liberada, a pagar', titulo: 'A comissão liberada, a pagar', total: venda.brokerReleased, filtro: (x) => x.stCorretor === 'liberada' })}
                  />
                )}
                {corretorPrevisto > 0 && (
                  <Linha
                    titulo="Comissão prevista do corretor"
                    meta="só vira dívida quando a construtora pagar"
                    situacao={<ChipSituacao situacao="prevista" />}
                    valor={valorCorretor({ previsto: true, rotulo: 'Prevista', titulo: 'A comissão prevista do corretor', total: corretorPrevisto, filtro: (x) => x.stCorretor === 'prevista' })}
                  />
                )}
              </Cartao.Lista>
            </Cartao>
          )}
        </div>
      )}

      {erro && (
        <p role="alert" className="rounded-caixa border border-error-line bg-surface px-recuo py-4 text-texto text-error-ink">
          {erro}
        </p>
      )}

      <Cartao>
        <Cartao.Cabecalho
          id={idCabecalhoParcelas}
          titulo="Parcelas"
          icone={ListOrdered}
          meta={`${venda.installments.length} ${venda.installments.length === 1 ? 'parcela' : 'parcelas'} · ${recebidas.length} ${recebidas.length === 1 ? 'recebida' : 'recebidas'}`}
        />
        <Cartao.Lista rotuloAcessivel="Parcelas da venda" className={LISTA_PARCELAS}>
          <CabecalhoParcelas perfil="admin" />
          {parcelas.flatMap((x, i) => {
            const { p, s } = x
            const podeReceber = ativa && p.status === 'prevista'
            const podePagar = ativa && x.stCorretor === 'liberada' && p.broker_amount > 0
            const podeDesfazer = ativa && p.status === 'recebida'
            const principal = podeReceber ? (
              <Button size="sm" variant="secundario" aria-label="Recebi esta parcela" onClick={() => abrirReceber(p)} disabled={ocupado}>
                Recebi
              </Button>
            ) : podePagar ? (
              <Button size="sm" variant="secundario" aria-label="Pagar comissão" onClick={() => abrirPagar(p)} disabled={ocupado}>
                Pagar
              </Button>
            ) : undefined
            const temMenu = podeReceber || podeDesfazer
            const itens = [
              <Parcela
                key={p.id}
                perfil="admin"
                idx={p.idx}
                count={p.count}
                titulo={tituloDaParcela(p)}
                situacao={s}
                meta={<MetaDaParcela parcela={x} nomeCorretor={nomeCorretor} hoje={hoje} />}
                resumo={x.resumo}
                acao={principal}
                menu={
                  temMenu ? (
                    <Button
                      size="icone"
                      variant="fantasma"
                      icone={MoreHorizontal}
                      aria-label={`Mais ações da ${tituloDaParcela(p).toLowerCase()}`}
                      onClick={() => setParcelaAberta(p.id)}
                    />
                  ) : undefined
                }
                aoAbrir={() => setParcelaAberta(p.id)}
                chegada={chegada?.id === p.id ? chegada.fase : undefined}
              />,
            ]
            if (marcaHoje && i === primeiraFutura)
              itens.unshift(<LinhaGrupo key="hoje" rotulo={`Hoje · ${hoje.slice(8, 10)}/${hoje.slice(5, 7)}`} hoje />)
            return itens
          })}
        </Cartao.Lista>
      </Cartao>

      <Cartao>
        <Cartao.Cabecalho titulo="Dados da venda" icone={FileText} />
        <Cartao.Corpo>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Dado rotulo="Comprador">{venda.client_name ?? 'não informado'}</Dado>
            <Dado rotulo="Empreendimento">{venda.development ?? 'não informado'}</Dado>
            <Dado rotulo="Vendida em">{formatDate(venda.sale_date)}</Dado>
            {/* Quando o sistema não sabe, diz em texto: "R$ 0,00" seria uma afirmação falsa sobre o imóvel. */}
            <Dado rotulo="Imóvel">
              {venda.property_value != null ? formatCurrency(venda.property_value) : 'valor do imóvel não informado'}
            </Dado>
            <Dado rotulo="Corretor">
              {venda.brokerName ? `${venda.brokerName} ${venda.broker_pct ?? 0}%` : 'sem corretor'}
            </Dado>
            <Dado rotulo="Impostos">
              {[
                venda.issues_invoice ? `Simples ${venda.simples_pct}%` : 'sem nota fiscal',
                venda.retains_iss ? `ISS retido ${venda.iss_pct}%` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Dado>
            {venda.partner_name && (
              <Dado rotulo="Parceria">{`parceria ${venda.partner_name} (${venda.partner_share_pct}% da Souza)`}</Dado>
            )}
            {venda.status === 'cancelada' && <Dado rotulo="Situação">venda cancelada</Dado>}
            {venda.notes && (
              <Dado rotulo="Observação" largo>
                {venda.notes}
              </Dado>
            )}
          </dl>
        </Cartao.Corpo>
      </Cartao>

      {/* O ⋯ da ficha: as mesmas ações do cabeçalho, com os mesmos efeitos. */}
      <SidePanel aberto={menuAberto} aoFechar={() => setMenuAberto(false)} titulo="Ações da venda" subtitulo={venda.title} forma="folha">
        <div className="flex flex-col gap-3">
          <Button
            variant="secundario"
            size="lg"
            icone={Pencil}
            onClick={() => {
              setMenuAberto(false)
              setEditando(true)
            }}
          >
            Editar
          </Button>
          <Button
            variant="perigo"
            size="lg"
            onClick={() => {
              setMenuAberto(false)
              setCancelando(true)
            }}
          >
            Cancelar venda
          </Button>
        </div>
      </SidePanel>

      {/* A parcela aberta: a conta inteira e todas as ações dela. */}
      <SidePanel
        aberto={!!aberta}
        aoFechar={() => setParcelaAberta(null)}
        titulo={aberta ? tituloDaParcela(aberta.p) : ''}
        subtitulo={venda.title}
        chaveConteudo={aberta?.p.id}
        rodape={
          aberta && ativa ? (
            <div className="flex flex-wrap justify-end gap-3">
              {aberta.p.status === 'recebida' && (
                <Button variant="fantasma" icone={Undo2} onClick={() => desfazer(aberta.p)} disabled={ocupado}>
                  Desfazer recebimento
                </Button>
              )}
              {aberta.p.status === 'prevista' && (
                <Button variant="secundario" icone={CalendarClock} onClick={() => abrirReagendar(aberta.p)} disabled={ocupado}>
                  Reagendar
                </Button>
              )}
              {aberta.stCorretor === 'liberada' && aberta.p.broker_amount > 0 && (
                <Button variant="secundario" onClick={() => abrirPagar(aberta.p)} disabled={ocupado}>
                  Pagar comissão
                </Button>
              )}
              {aberta.p.status === 'prevista' && (
                <Button variant="secundario" onClick={() => abrirReceber(aberta.p)} disabled={ocupado}>
                  Recebi esta parcela
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        {aberta && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <ChipSituacao situacao={aberta.s} />
              <MetaDaParcela parcela={aberta} nomeCorretor={nomeCorretor} hoje={hoje} />
            </div>
            <Demonstrativo linhas={aberta.linhas} perfil="admin" rotuloAcessivel={`Conta da ${tituloDaParcela(aberta.p).toLowerCase()}`} />
          </div>
        )}
      </SidePanel>

      <ReceberParcela venda={venda} parcela={recebendo} onFechar={() => setRecebendo(null)} />
      <PagarComissao itens={pagando} onFechar={() => setPagando(null)} />

      <SidePanel
        aberto={!!reagendando}
        aoFechar={() => setReagendando(null)}
        titulo="Reagendar parcela"
        subtitulo="A data anterior fica registrada, e o corretor vê a nova na hora."
        largura="lg"
        rodape={
          <div className="flex justify-end gap-3">
            <Button variant="secundario" onClick={() => setReagendando(null)}>
              Cancelar
            </Button>
            <Button
              variant="primario"
              disabled={ocupado || !novaData}
              carregando={ocupado}
              onClick={async () => {
                const p = reagendando!
                await acao(() => reagendarParcela(p.id, novaData, notaReagendar || undefined), 'Parcela reagendada')
                setReagendando(null)
              }}
            >
              Reagendar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Nova data prevista" htmlFor="rg-data">
            <Input id="rg-data" type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} data-foco-inicial />
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
            <p className="text-texto-meta text-t-meta">Estava prevista para {formatDateShort(reagendando.expected_date)}.</p>
          )}
        </div>
      </SidePanel>

      <ConfirmDialog
        aberto={cancelando}
        aoFechar={() => setCancelando(false)}
        titulo="Cancelar esta venda?"
        rotuloConfirmar="Sim, cancelar"
        tom="risco"
        ocupado={ocupado}
        aoConfirmar={async () => {
          await acao(() => cancelarVenda(venda.id, notaCancelar || undefined), 'Venda cancelada')
          setCancelando(false)
          navigate('/vendas')
        }}
        descricao={
          <div className="flex flex-col gap-4">
            <p>
              Vão ser canceladas{' '}
              <strong className="font-medium text-t1">
                {venda.installments.filter((p) => p.status === 'prevista').length} parcela(s) prevista(s)
              </strong>{' '}
              no valor de <Valor posto="fato" valor={venda.toReceive} forte />, e as comissões ainda não pagas dessas
              parcelas.
            </p>
            <p>
              O que já foi recebido e pago continua registrado — e o imposto de parcela já recebida continua devido. Se
              houver devolução, lance como despesa depois.
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
        }
      />

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
    </PageLayout>
  )
}

/* O cabeçalho da Parcela lê --colunas; a Lista só declara colunas de Linha. */
const LISTA_PARCELAS = '[--colunas:28px_minmax(9rem,1fr)_9rem_8rem_9rem_9rem_8rem_16px]'

const arredonda = (n: number) => Math.round(n * 100) / 100

/** O campo gravado da parcela que compõe cada linha da conta da venda (as mesmas parcelas que cascadeOf soma). */
function valorDaLinhaNaParcela(l: LinhaDemonstrativo, p: SaleInstallment): number {
  switch (l.chave) {
    case 'bruto':
      return p.amount
    case 'iss':
      return p.iss_amount
    case 'simples':
      return p.simples_amount
    case 'base':
      return arredonda(p.amount - p.iss_amount - p.simples_amount)
    case 'desconto':
      return p.broker_adjustment
    case 'corretor':
      // Com desconto, "Comissão de …" (+) é o contratado e "Pago ao corretor" (−) já vem sem o desconto.
      return l.sinal === '+' ? p.broker_amount : arredonda(p.broker_amount - p.broker_adjustment)
    case 'socio':
      return p.owner_amount
    default:
      return p.net_amount
  }
}

const tituloDaParcela = (p: SaleInstallment) => (p.count > 1 ? `Parcela ${p.idx} de ${p.count}` : 'Parcela única')

interface ParcelaNaTela {
  p: SaleInstallment
  /** Situação da parcela (situacaoDeTela). */
  s: Situacao
  /** Situação gravada da comissão do corretor (brokerStatusOf). */
  stCorretor: ReturnType<typeof brokerStatusOf>
  /** Situação de tela do corretor, contada da data em que a imobiliária recebeu. */
  sCorretor: Situacao
  /** O valor do corretor que a ficha já mostrava: o da transação quando paga, senão o contratado. */
  valorCorretor: number
  construtoraAtrasou: boolean
  fraseCorretor: string
  resumo: ResumoDaParcela
  /** A conta completa da parcela, para o painel. */
  linhas: LinhaDemonstrativo[]
}

/*
 * Os números de cada parcela, os mesmos que a ficha anterior escrevia na
 * fileira de texto (ISS, Simples, corretor, caiu, fica para a imobiliária),
 * agora em colunas e no painel da parcela.
 */
function montarParcela(
  p: SaleInstallment,
  venda: SaleView,
  hoje: string,
  statusPorTx: Map<string, string>,
  valorPorTx: Map<string, number>,
): ParcelaNaTela {
  const s = situacaoDeTela(p.status, p.expected_date, hoje)
  const stCorretor = brokerStatusOf(p, statusPorTx as Parameters<typeof brokerStatusOf>[1])
  const sCorretor = situacaoDeTela(stCorretor, p.received_date ?? p.expected_date, hoje)
  const pagoAoCorretor = p.broker_tx_id ? valorPorTx.get(p.broker_tx_id) ?? p.broker_amount : p.broker_amount
  const valorCorretor = stCorretor === 'recebida' ? pagoAoCorretor : p.broker_amount
  const construtoraAtrasou = s === 'prevista' && diasEntre(hoje, p.expected_date) < 0
  const fraseCorretor =
    sCorretor === 'recebida'
      ? 'paga'
      : sCorretor === 'prevista'
        ? 'prevista'
        : fraseDeTempo(sCorretor, { prevista: p.expected_date, liberada: p.received_date }, hoje)
  const nome = venda.brokerName ?? 'corretor'
  const detalheCorretor = [fraseCorretor, p.broker_adjustment > 0 ? `desconto de ${formatCurrency(p.broker_adjustment)}` : null]
    .filter(Boolean)
    .join(' · ')

  const linhaCorretor: LinhaDemonstrativo | null =
    p.broker_amount > 0
      ? { chave: 'corretor', rotulo: nome, detalhe: detalheCorretor, sinal: '−', valor: valorCorretor, situacao: sCorretor }
      : null
  const fica: LinhaDemonstrativo = { chave: 'fica', rotulo: 'Fica para a imobiliária', sinal: '=', valor: p.net_amount }
  const impostos: LinhaDemonstrativo[] = []
  if (p.iss_amount > 0) impostos.push({ chave: 'iss', rotulo: 'ISS', sinal: '−', valor: p.iss_amount })
  if (p.simples_amount > 0) impostos.push({ chave: 'simples', rotulo: 'Simples', sinal: '−', valor: p.simples_amount })

  const linhas: LinhaDemonstrativo[] = [
    { chave: 'bruto', rotulo: 'Parcela', sinal: '+', valor: p.amount },
    ...impostos,
    ...(linhaCorretor ? [linhaCorretor] : []),
    fica,
  ]
  return {
    p,
    s,
    stCorretor,
    sCorretor,
    valorCorretor,
    construtoraAtrasou,
    fraseCorretor,
    linhas,
    resumo: {
      valor: p.amount,
      impostos: arredonda(p.iss_amount + p.simples_amount),
      corretor: linhaCorretor ? { valor: valorCorretor, nome, detalhe: detalheCorretor, situacao: sCorretor } : null,
      fica: p.net_amount,
      // Forma C (celular): ISS e Simples em linhas próprias, como a ficha já escrevia.
      linhas: [...impostos, ...(linhaCorretor ? [{ ...linhaCorretor, detalhe: undefined }] : []), fica],
    },
  }
}

/*
 * A meta da parcela: a frase de tempo (em atenção quando a construtora
 * atrasou), o que caiu na conta, a frase do corretor e a observação. As mesmas
 * palavras da ficha anterior.
 */
function MetaDaParcela({ parcela, nomeCorretor, hoje }: { parcela: ParcelaNaTela; nomeCorretor: string; hoje: string }) {
  const { p, s, sCorretor, construtoraAtrasou, fraseCorretor } = parcela
  const caiu = p.status === 'recebida' && p.received_amount != null && p.received_amount !== p.amount
  return (
    <span className="flex min-w-0 flex-col gap-2">
      <span className={construtoraAtrasou ? 'text-warning-ink' : undefined}>
        {construtoraAtrasou && (
            <>
              <Icone icone={Clock} tamanho={12} className="inline" />{' '}
            </>
          )}
        {fraseDeTempo(s, { prevista: p.expected_date, recebida: p.received_date }, hoje)}
        {caiu && (
          <span className="whitespace-nowrap">
            {' · caiu '}
            <Valor posto="fato" valor={p.received_amount!} />
          </span>
        )}
      </span>
      {p.broker_amount > 0 && (
        <span
          className={
            sCorretor === 'vencida'
              ? 'text-error-ink'
              : sCorretor === 'liberada'
                ? 'text-warning-ink'
                : undefined
          }
        >
          {sCorretor === 'vencida' && (
            <>
              <Icone icone={CircleAlert} tamanho={12} className="inline" />{' '}
            </>
          )}
          {sCorretor === 'liberada' && (
            <>
              <Icone icone={HandCoins} tamanho={12} className="inline" />{' '}
            </>
          )}
          {`${nomeCorretor} · ${fraseCorretor}`}
          {p.broker_adjustment > 0 ? ` · desconto de ${formatCurrency(p.broker_adjustment)}` : ''}
        </span>
      )}
      {p.notes && <span>{p.notes}</span>}
    </span>
  )
}

/* Um dado da venda: rótulo em cima, texto embaixo. */
function Dado({ rotulo, largo, children }: { rotulo: string; largo?: boolean; children: ReactNode }) {
  return (
    <div className={largo ? 'flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-3' : 'flex min-w-0 flex-col gap-1'}>
      <Rotulo as="dt">{rotulo}</Rotulo>
      <dd className="min-w-0 text-texto text-t1">{children}</dd>
    </div>
  )
}

/**
 * Editar só o que não mexe em dinheiro. Valor de comissão, percentual e
 * parcelas não entram aqui de propósito: a saída honesta é cancelar e
 * registrar de novo.
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

  // Cada abertura parte do que está gravado (a ficha anterior remontava o modal).
  useEffect(() => {
    if (!aberto) return
    setTitulo(venda.title)
    setCliente(venda.client_name ?? '')
    setUnidade(venda.unit ?? '')
    setNota(venda.notes ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  return (
    <SidePanel
      aberto={aberto}
      aoFechar={onFechar}
      titulo="Editar dados da venda"
      subtitulo="Valores e parcelas não mudam por aqui."
      largura="lg"
      rodape={
        <div className="flex justify-end gap-3">
          <Button variant="secundario" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            variant="primario"
            disabled={ocupado}
            carregando={ocupado}
            onClick={() =>
              onSalvar({
                title: titulo,
                client_name: cliente || null,
                unit: unidade || null,
                notes: nota || null,
              })
            }
          >
            Salvar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="Título" htmlFor="e-tit">
          <Input id="e-tit" value={titulo} onChange={(e) => setTitulo(e.target.value)} data-foco-inicial />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
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
    </SidePanel>
  )
}
