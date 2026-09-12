import { useEffect, useMemo, useState } from 'react'
import { useAdmin } from './AdminData'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { Lista, Linha } from '@/components/ui/Lista'
import { Selo } from '@/components/ui/Selo'
import { ChipSituacao, FraseDeTempo } from '@/components/ui/Situacao'
import { Valor } from '@/components/ui/Valor'
import { formatCurrency, toDateOnly } from '@/lib/format'
import { situacaoDeTela } from '@/lib/situacao'
import type { Transaction } from '@/types'

/*
 * BAIXA DE UM LANÇAMENTO QUE NÃO É PARCELA DE VENDA: imposto, despesa, entrada
 * avulsa. Parcela de venda tem fluxo próprio (`ReceberParcela`), porque ali a
 * baixa dispara a cascata — imposto recalculado, comissão liberada.
 *
 * Aqui não há conta a conferir: o valor já está definido e a folha só pergunta
 * QUANDO e ONDE. Por isso ela é curta de propósito, e a conversão foi
 * igualmente curta:
 *
 * 1. O que está sendo baixado deixou de viver só na linha de descrição do
 *    cabeçalho, onde o valor aparecia dentro de uma frase, sem degrau. Agora é
 *    uma linha de extrato — selo, frase com verbo, valor no degrau de
 *    comparação — igual à de todas as outras telas.
 *
 * 2. A data ganhou verbo. `situacaoDeTela` decide a situação; ela nunca é
 *    escrita à mão em lugar nenhum do app, e é ela que garante que dois
 *    lugares diferentes não contem a mesma coisa de dois jeitos.
 *
 * O RPC continua sendo `baixarLancamento(id, data, conta)`.
 */
export function BaixarLancamento({ tx, onFechar }: { tx: Transaction | null; onFechar: () => void }) {
  const { accounts, baixarLancamento, hoje } = useAdmin()
  const { showToast } = useToast()
  const [data, setData] = useState(toDateOnly(new Date()))
  const [contaId, setContaId] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const contas = useMemo(() => accounts.filter((a) => a.is_active), [accounts])
  const entrada = tx?.kind === 'income'

  useEffect(() => {
    if (!tx) return
    setData(toDateOnly(new Date()))
    setContaId(contas[0]?.id ?? '')
    setErro(null)
  }, [tx, contas])

  if (!tx) return null

  /*
   * A data que o lançamento promete: vencimento quando existe, competência
   * quando não. É a mesma escolha que `payablesOf` faz em src/lib/sales.ts —
   * duas telas lendo a mesma data pelo mesmo critério.
   */
  const vencimento = tx.due_date ?? tx.competence_date
  const situacao = situacaoDeTela(tx.status === 'settled' ? 'recebida' : 'prevista', vencimento, hoje)
  const titulo = tx.description || tx.category
  const conta = contas.find((a) => a.id === contaId)

  async function confirmar() {
    setErro(null)
    setSalvando(true)
    try {
      await baixarLancamento(tx!.id, data, contaId || null)
      showToast({
        message: entrada ? 'Recebimento confirmado' : 'Pagamento confirmado',
        detail: formatCurrency(tx!.amount),
      })
      onFechar()
    } catch (e) {
      setErro(
        e instanceof Error
          ? `A baixa não foi gravada: ${e.message}`
          : `A baixa não foi gravada e o lançamento continua em ${entrada ? 'A receber' : 'A pagar'}. Confira a conexão e confirme de novo.`,
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      open={!!tx}
      onClose={onFechar}
      title={entrada ? 'Confirmar recebimento' : 'Confirmar pagamento'}
      description={tx.description && tx.description !== tx.category ? tx.category : undefined}
      footer={
        /* UMA ação primária: a que grava. */
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={confirmar} disabled={salvando}>
            {salvando ? (
              <Spinner className="h-5 w-5" />
            ) : entrada ? (
              'Confirmar recebimento'
            ) : (
              'Confirmar pagamento'
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Lista>
          <Linha
            selo={<Selo situacao={situacao} glifo="traco" />}
            titulo={titulo}
            meta={
              <FraseDeTempo
                situacao={situacao}
                prevista={vencimento}
                recebida={tx.settled_date}
              />
            }
            situacao={<ChipSituacao situacao={situacao} />}
            valor={<Valor valor={tx.amount} posto="linha" />}
          />
        </Lista>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            {/*
             * O foco entra na data: o valor já está fechado e a conta já vem
             * com a primeira ativa. A baixa quase sempre é lançada depois do
             * fato — a data é o único campo que costuma mudar.
             */}
            <FormField label="Data" htmlFor="b-data">
              <Input
                id="b-data"
                data-foco-inicial
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </FormField>
            <p className="mt-1.5 text-sm text-content-faint">
              {entrada
                ? 'o dia em que o dinheiro entrou, não o do vencimento'
                : 'o dia em que o dinheiro saiu, não o do vencimento'}
            </p>
          </div>
          <div>
            <FormField label="Conta" htmlFor="b-conta">
              <Select
                id="b-conta"
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
                : entrada
                  ? 'onde o dinheiro entrou'
                  : 'de onde o dinheiro saiu'}
            </p>
          </div>
        </div>

        <p className="text-sm text-content-muted">
          Ao confirmar, {formatCurrency(tx.amount)} {entrada ? 'entram' : 'saem'}
          {conta
            ? `${entrada ? ' em' : ' de'} ${conta.name}`
            : ' — a conta fica para definir depois, e até lá o saldo não muda'}{' '}
          e o lançamento sai de {entrada ? 'A receber' : 'A pagar'}.
        </p>

        {erro && (
          <p className="border-t border-line pt-4 text-base text-critical" role="alert">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}
