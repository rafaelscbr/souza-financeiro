import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, CircleCheck, Wallet } from 'lucide-react'
import { useAdmin } from './AdminData'
import { SidePanel } from '@/components/ui/SidePanel'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { Linha } from '@/components/ui/Lista'
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
 *
 * TAMBÉM ACEITA VÁRIOS (21/09/2026). Compra parcelada no cartão pessoal do
 * Rafael chega em dez linhas que ele paga numa fatura só; a lista de A pagar
 * junta as do mês numa linha, e aqui ele confirma as dez de uma vez, com a
 * mesma data e a mesma conta. Cada uma continua sendo um lançamento seu — o
 * que muda é que ele não precisa repetir a mesma folha dez vezes.
 */
export function BaixarLancamento({ tx, onFechar }: { tx: Transaction | Transaction[] | null; onFechar: () => void }) {
  const { accounts, baixarLancamento, hoje } = useAdmin()
  const { showToast } = useToast()
  const [data, setData] = useState(toDateOnly(new Date()))
  const [contaId, setContaId] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const contas = useMemo(() => accounts.filter((a) => a.is_active), [accounts])
  const lista = useMemo(() => (tx ? (Array.isArray(tx) ? tx : [tx]) : []), [tx])
  const primeiro = lista[0] ?? null
  const total = Math.round(lista.reduce((acc, t) => acc + t.amount, 0) * 100) / 100
  const entrada = primeiro?.kind === 'income'

  useEffect(() => {
    if (!tx) return
    setData(toDateOnly(new Date()))
    setContaId(contas[0]?.id ?? '')
    setErro(null)
  }, [tx, contas])

  if (!primeiro) return null

  /*
   * A data que o lançamento promete: vencimento quando existe, competência
   * quando não. É a mesma escolha que `payablesOf` faz em src/lib/sales.ts —
   * duas telas lendo a mesma data pelo mesmo critério.
   */
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
    // Um de cada vez, na ordem: se o quinto falhar, os quatro primeiros estão
    // gravados e a mensagem diz exatamente isso, em vez de sumir com tudo.
    let feitos = 0
    try {
      for (const t of lista) {
        await baixarLancamento(t.id, data, contaId || null)
        feitos += 1
      }
      showToast({
        message: entrada ? 'Recebimento confirmado' : 'Pagamento confirmado',
        detail: lista.length > 1 ? `${lista.length} lançamentos · ${formatCurrency(total)}` : formatCurrency(total),
      })
      onFechar()
    } catch (e) {
      const parcial =
        feitos > 0 ? `${feitos} de ${lista.length} já foram gravados; os que faltam continuam em ${destino}. ` : ''
      setErro(
        e instanceof Error
          ? `${parcial}A baixa não foi gravada: ${e.message}`
          : `${parcial}A baixa não foi gravada e o lançamento continua em ${destino}. Confira a conexão e confirme de novo.`,
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <SidePanel
      aberto={lista.length > 0}
      aoFechar={fechar}
      titulo={entrada ? 'Confirmar recebimento' : 'Confirmar pagamento'}
      subtitulo={
        lista.length > 1
          ? `${lista.length} lançamentos · ${formatCurrency(total)}`
          : primeiro.description && primeiro.description !== primeiro.category
            ? primeiro.category
            : destino
      }
      rodape={
        /* UMA ação primária: a que grava. */
        <RodapeDaFolha erro={erro} tituloDoErro="Baixa não gravada">
          <Button variant="secundario" size="lg" onClick={fechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="primario" size="lg" onClick={confirmar} carregando={salvando}>
            {entrada ? 'Confirmar recebimento' : 'Confirmar pagamento'}
          </Button>
        </RodapeDaFolha>
      }
    >
      <>
        {/*
         * O que está sendo baixado, como linha de extrato: selo e chip com a
         * situação, frase com verbo, valor na coluna da direita. O ícone do
         * bloco diz o sentido do dinheiro, que a linha sozinha não diz.
         */}
        <BlocoDaFolha
          titulo={lista.length > 1 ? 'Os lançamentos' : 'O lançamento'}
          icone={entrada ? ArrowDownLeft : ArrowUpRight}
        >
          {/* Sem selo: não há ordinal, e o ícone solto na goteira repetiria o chip. */}
          <ListaNaFolha
            rotuloAcessivel={lista.length > 1 ? 'Os lançamentos' : 'O lançamento'}
            colunas={{ situacao: true, valor: true }}
          >
            {lista.map((t) => {
              const v = t.due_date ?? t.competence_date
              const st = situacaoDeTela(t.status === 'settled' ? 'recebida' : 'prevista', v, hoje)
              return (
                <Linha
                  key={t.id}
                  titulo={t.description || t.category}
                  meta={<FraseDeTempo situacao={st} prevista={v} recebida={t.settled_date} />}
                  situacao={<ChipSituacao situacao={st} />}
                  valor={<Valor valor={t.amount} posto="linha" />}
                />
              )
            })}
          </ListaNaFolha>
        </BlocoDaFolha>

        <BlocoDaFolha
          titulo={entrada ? 'Quando e onde entrou' : 'Quando e de onde saiu'}
          icone={Wallet}
        >
          <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2">
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
                    <Valor valor={total} posto="fato" /> {entrada ? 'entram em' : 'saem de'} {conta.name}.
                  </>
                ) : (
                  <>
                    <Valor valor={total} posto="fato" /> {entrada ? 'entram' : 'saem'}, com a conta para definir
                    depois — até lá o saldo não muda.
                  </>
                ),
              },
              {
                icone: CircleCheck,
                texto:
                  lista.length > 1
                    ? `Os ${lista.length} lançamentos saem de ${destino}.`
                    : `O lançamento sai de ${destino}.`,
              },
            ]}
          />
        </BlocoDaFolha>
      </>
    </SidePanel>
  )
}
