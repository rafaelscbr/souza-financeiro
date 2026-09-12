import { useEffect, useMemo, useState } from 'react'
import { useAdmin } from './AdminData'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { Cascata, LinhaCascata, TotalCascata } from '@/components/ui/Cascata'
import { Lista, Linha } from '@/components/ui/Lista'
import { Selo } from '@/components/ui/Selo'
import { ChipSituacao, FraseDeTempo } from '@/components/ui/Situacao'
import { Valor } from '@/components/ui/Valor'
import { formatCurrency, toDateOnly } from '@/lib/format'
import { situacaoDeTela } from '@/lib/situacao'

export interface ComissaoAPagar {
  installmentId: string
  brokerName: string
  saleTitle: string
  parcela: string
  amount: number
  dueDate: string
}

/**
 * O ordinal real da parcela, extraído do rótulo que a tela de A pagar monta
 * ("parcela 3/9").
 *
 * O selo da marca existe para carregar o ORDINAL — o "3" de 3/9 — e é isso que
 * transforma uma lista de seis linhas parecidas em seis linhas reconhecíveis.
 * O número já viaja até aqui, só que dentro de uma frase; lê-lo de volta é
 * apresentação. Passar `idx`/`count` no contrato seria melhor, mas isso é
 * mudança em `src/admin/pages/Pagar.tsx`, que não faz parte desta conversão.
 */
function ordinal(rotulo: string): { idx?: number; count?: number } {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(rotulo)
  if (!m) return {}
  return { idx: Number(m[1]), count: Number(m[2]) }
}

/*
 * PAGAR COMISSÃO LIBERADA.
 *
 * "Liberada" tem um significado exato neste sistema: a imobiliária JÁ recebeu
 * a parcela da construtora, então o dinheiro do corretor existe e está apenas
 * esperando um humano. É o único estado que veste o ouro da marca — e é a
 * única coisa que o corretor abre o app para ver.
 *
 * A folha aceita várias parcelas do mesmo corretor de uma vez, porque é assim
 * que acontece na prática. O desconto combinado só é oferecido quando há uma
 * parcela só: aplicar um desconto sobre um lote seria ambíguo, e foi um
 * desconto desses (a cesta de R$ 399,44 na 414-D) que já ficou registrado
 * apenas na descrição do lançamento, sem campo próprio.
 *
 * O que mudou na apresentação:
 *
 * 1. As parcelas viraram `Lista`/`Linha` com o SELO carregando o ordinal real.
 *    Antes eram uma caixa com borda — um cartão dentro da folha — onde cada
 *    parcela dizia "parcela 3/9" em 12px de texto corrido e o valor vinha em
 *    13px, abaixo do degrau de comparação. Pagar três parcelas de valores
 *    próximos exigia ler; agora exige olhar.
 *
 * 2. O total virou cascata, com a ORIGEM escrita: de quais vendas ele vem.
 *    Um total de lote sem origem é um número que só pode ser aceito, nunca
 *    conferido.
 *
 * 3. A data de liberação passa por `situacaoDeTela` e `FraseDeTempo`. Parcela
 *    liberada que passou da data é atraso de verdade — a imobiliária recebeu e
 *    não repassou — e a frase diz há quantos dias o corretor está esperando.
 *
 * O RPC continua sendo `pagarComissoes`, com o mesmo payload.
 */
export function PagarComissao({
  itens,
  onFechar,
}: {
  itens: ComissaoAPagar[] | null
  onFechar: () => void
}) {
  const { accounts, pagarComissoes, hoje } = useAdmin()
  const { showToast } = useToast()

  const [data, setData] = useState(toDateOnly(new Date()))
  const [contaId, setContaId] = useState('')
  const [desconto, setDesconto] = useState<number | null>(null)
  const [nota, setNota] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const contas = useMemo(() => accounts.filter((a) => a.is_active && a.type !== 'credit_card'), [accounts])
  const unica = itens?.length === 1

  useEffect(() => {
    if (!itens) return
    setData(toDateOnly(new Date()))
    setContaId(contas[0]?.id ?? '')
    setDesconto(null)
    setNota('')
    setErro(null)
  }, [itens, contas])

  if (!itens || itens.length === 0) return null

  const total = Math.round(itens.reduce((s, i) => s + i.amount, 0) * 100) / 100
  const aPagar = Math.round((total - (unica ? desconto ?? 0 : 0)) * 100) / 100
  const corretor = itens[0].brokerName

  /*
   * A origem do total, em palavras: quantas parcelas, de quais vendas. É o que
   * permite conferir o lote sem abrir a ficha de cada venda.
   */
  const vendas = [...new Set(itens.map((i) => i.saleTitle))]
  const origem =
    vendas.length === 1
      ? `${itens.length} ${itens.length === 1 ? 'parcela' : 'parcelas'} de ${vendas[0]}`
      : `${itens.length} parcelas de ${vendas.length} vendas: ${vendas.join(' · ')}`

  async function confirmar() {
    setErro(null)
    if (aPagar < 0)
      return setErro(
        `O desconto de ${formatCurrency(desconto ?? 0)} é maior que a comissão de ${formatCurrency(total)}. ` +
          'Reduza o desconto para no máximo o valor da comissão — pagamento negativo não existe no caixa.',
      )
    setSalvando(true)
    try {
      await pagarComissoes({
        installmentIds: itens!.map((i) => i.installmentId),
        date: data,
        accountId: contaId || null,
        adjustment: unica ? desconto ?? 0 : 0,
        note: nota || null,
      })
      showToast({
        message: `Comissão paga a ${corretor}`,
        detail: `${formatCurrency(aPagar)} em ${itens!.length} parcela(s)`,
      })
      onFechar()
    } catch (e) {
      setErro(
        e instanceof Error
          ? `O pagamento não foi gravado: ${e.message}`
          : 'O pagamento não foi gravado e a comissão continua liberada. Confira a conexão e confirme de novo.',
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      open={!!itens}
      onClose={onFechar}
      title="Pagar comissão"
      description={corretor}
      footer={
        /* UMA ação primária, e ela diz quanto vai sair. */
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={confirmar} disabled={salvando}>
            {salvando ? <Spinner className="h-5 w-5" /> : `Pagar ${formatCurrency(aPagar)}`}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/*
         * Uma linha por parcela, o valor de todas no MESMO degrau e numa borda
         * direita só: é assim que dois valores próximos passam a ser comparados
         * por contagem de dígitos, sem leitura.
         */}
        <Lista>
          {itens.map((i) => {
            const { idx, count } = ordinal(i.parcela)
            const situacao = situacaoDeTela('liberada', i.dueDate, hoje)
            return (
              <Linha
                key={i.installmentId}
                selo={<Selo situacao={situacao} idx={idx} count={count} />}
                titulo={i.saleTitle}
                meta={
                  <FraseDeTempo situacao={situacao} prevista={i.dueDate} liberada={i.dueDate} />
                }
                situacao={<ChipSituacao situacao={situacao} />}
                valor={<Valor valor={i.amount} posto="linha" />}
              />
            )
          })}
        </Lista>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FormField label="Data do pagamento" htmlFor="p-data">
              <Input id="p-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </FormField>
            <p className="mt-1.5 text-sm text-content-faint">o dia em que o dinheiro saiu</p>
          </div>
          <div>
            {/*
             * O foco inicial mora aqui, e não na data: o valor já vem da
             * parcela e a data já vem com hoje. A única coisa que de fato muda
             * de um pagamento para o outro é de qual conta ele sai.
             */}
            <FormField label="Conta" htmlFor="p-conta">
              <Select
                id="p-conta"
                data-foco-inicial
                value={contaId}
                onChange={(e) => setContaId(e.target.value)}
                disabled={contas.length === 0}
              >
                <option value="">Definir depois</option>
                {contas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <p className="mt-1.5 text-sm text-content-faint">
              {contas.length === 0
                ? 'Nenhuma conta cadastrada ainda. Cadastre em Ajustes › Contas para o saldo bater.'
                : 'de onde o dinheiro saiu'}
            </p>
          </div>
        </div>

        {unica ? (
          <div className="space-y-4">
            <div>
              <FormField label="Desconto combinado" htmlFor="p-desc">
                <CurrencyInput id="p-desc" value={desconto} onChange={setDesconto} />
              </FormField>
              <p className="mt-1.5 text-sm text-content-faint">
                Em reais, e opcional. Sai do valor pago e fica registrado como desconto — não como
                comissão menor.
              </p>
            </div>
            {(desconto ?? 0) > 0 && (
              <div>
                <FormField label="Do que foi o desconto" htmlFor="p-nota">
                  <Input
                    id="p-nota"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    placeholder="Ex.: cesta de Natal"
                  />
                </FormField>
                <p className="mt-1.5 text-sm text-content-faint">
                  Sem esta frase o desconto vira um valor sem motivo daqui a seis meses.
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-content-muted">
            Desconto só em pagamento de uma parcela por vez: sobre um lote não dá para saber de
            qual venda ele saiu.
          </p>
        )}

        {/* O total, com a origem escrita embaixo. */}
        <div className="border-t border-rule pt-4">
          <Cascata>
            <LinhaCascata rotulo="Comissão liberada" valor={total} />
            {(desconto ?? 0) > 0 && unica && (
              <LinhaCascata
                subtracao
                rotulo="Desconto combinado"
                detalhe={nota || undefined}
                valor={desconto ?? 0}
              />
            )}
            <TotalCascata rotulo="A pagar agora" valor={aPagar} nota={origem} />
          </Cascata>
        </div>

        {erro && (
          <p className="border-t border-line pt-4 text-base text-critical" role="alert">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}
