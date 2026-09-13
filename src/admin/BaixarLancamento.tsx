import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, CircleCheck, Wallet } from 'lucide-react'
import { useAdmin } from './AdminData'
import { SidePanel } from '@/components/ui/SidePanel'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { Linha } from '@/components/ui/Lista'
import { Selo } from '@/components/ui/Selo'
import { ChipSituacao, FraseDeTempo } from '@/components/ui/Situacao'
import { Valor } from '@/components/ui/Valor'
import { formatCurrency, toDateOnly } from '@/lib/format'
import { situacaoDeTela } from '@/lib/situacao'
import type { Transaction } from '@/types'
import { AoConfirmar, BlocoDaFolha, ListaNaFolha, RodapeDaFolha } from './FolhaDeLancamento'

/*
 * BAIXA DE UM LANÇAMENTO QUE NÃO É PARCELA DE VENDA: imposto, despesa, entrada
 * avulsa. Parcela de venda tem fluxo próprio (`ReceberParcela`), porque ali a
 * baixa dispara a cascata — imposto recalculado, comissão liberada.
 *
 * Aqui não há conta a conferir: o valor já está definido e a folha só pergunta
 * QUANDO e ONDE. Por isso ela é curta de propósito.
 *
 * Abre no painel lateral (Souza OS, princípio 10): quem dá baixa numa guia
 * continua vendo a lista de A pagar de onde ela saiu, e o botão que grava fica
 * no rodapé fixo. O painel só fecha depois que o banco confirma; se a gravação
 * falhar, a data e a conta escolhidas continuam na tela, com o erro escrito
 * no rodapé.
 *
 * A situação sai de `situacaoDeTela`; ela nunca é escrita à mão em lugar
 * nenhum do app, e é ela que garante que dois lugares diferentes não contem a
 * mesma coisa de dois jeitos.
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
  const destino = entrada ? 'A receber' : 'A pagar'

  // Enquanto o banco não respondeu, fechar esconderia o resultado: o painel
  // sumiria e o aviso de sucesso ou de erro chegaria sem contexto.
  function fechar() {
    if (!salvando) onFechar()
  }

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
          : `A baixa não foi gravada e o lançamento continua em ${destino}. Confira a conexão e confirme de novo.`,
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <SidePanel
      aberto={!!tx}
      aoFechar={fechar}
      titulo={entrada ? 'Confirmar recebimento' : 'Confirmar pagamento'}
      subtitulo={tx.description && tx.description !== tx.category ? tx.category : destino}
      rodape={
        /* UMA ação primária: a que grava. */
        <RodapeDaFolha erro={erro} tituloDoErro="Baixa não gravada">
          <Button variant="ghost" size="lg" onClick={fechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button size="lg" className="flex-1" onClick={confirmar} carregando={salvando}>
            {entrada ? 'Confirmar recebimento' : 'Confirmar pagamento'}
          </Button>
        </RodapeDaFolha>
      }
    >
      <div className="space-y-6">
        {/*
         * O que está sendo baixado, como linha de extrato: selo e chip com a
         * situação, frase com verbo, valor na coluna da direita. O ícone do
         * bloco diz o sentido do dinheiro, que a linha sozinha não diz.
         */}
        <BlocoDaFolha titulo="O lançamento" icone={entrada ? ArrowDownLeft : ArrowUpRight}>
          <ListaNaFolha>
            <Linha
              selo={<Selo situacao={situacao} glifo="traco" />}
              titulo={titulo}
              meta={<FraseDeTempo situacao={situacao} prevista={vencimento} recebida={tx.settled_date} />}
              situacao={<ChipSituacao situacao={situacao} />}
              valor={<Valor valor={tx.amount} posto="linha" />}
            />
          </ListaNaFolha>
        </BlocoDaFolha>

        <BlocoDaFolha
          titulo={entrada ? 'Quando e onde entrou' : 'Quando e de onde saiu'}
          icone={Wallet}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {/*
             * O foco entra na data: o valor já está fechado e a conta já vem
             * com a primeira ativa. A baixa quase sempre é lançada depois do
             * fato — a data é o único campo que costuma mudar.
             */}
            <FormField
              label="Data"
              htmlFor="b-data"
              hint={
                entrada
                  ? 'o dia em que o dinheiro entrou, não o do vencimento'
                  : 'o dia em que o dinheiro saiu, não o do vencimento'
              }
            >
              <Input id="b-data" data-foco-inicial type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </FormField>
            <FormField
              label="Conta"
              htmlFor="b-conta"
              hint={
                contas.length === 0
                  ? 'Nenhuma conta cadastrada ainda. Cadastre em Ajustes › Contas para o saldo bater.'
                  : entrada
                    ? 'onde o dinheiro entrou'
                    : 'de onde o dinheiro saiu'
              }
            >
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
          </div>

          <AoConfirmar
            itens={[
              {
                icone: Wallet,
                texto: conta ? (
                  <>
                    {formatCurrency(tx.amount)} {entrada ? 'entram em' : 'saem de'} {conta.name}.
                  </>
                ) : (
                  <>
                    {formatCurrency(tx.amount)} {entrada ? 'entram' : 'saem'}, com a conta para definir
                    depois — até lá o saldo não muda.
                  </>
                ),
              },
              { icone: CircleCheck, texto: `O lançamento sai de ${destino}.` },
            ]}
          />
        </BlocoDaFolha>
      </div>
    </SidePanel>
  )
}
