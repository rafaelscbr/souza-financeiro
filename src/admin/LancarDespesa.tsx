import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useAdmin } from './AdminData'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { Segmented } from '@/components/ui/Segmented'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'

/*
 * LANÇAR UMA DESPESA (ou uma entrada que não é venda) EM POUCOS TOQUES.
 *
 * O desenho de fluxo continua o mesmo, e ele estava certo: três campos
 * obrigatórios — valor, categoria e se já saiu. Fornecedor, conta,
 * empreendimento e descrição ficam recolhidos: existem, mas não pedem atenção.
 * O formulário antigo abria com quatorze campos à mostra, incluindo seletor de
 * empresa e calculadora de comissão, para lançar um Meta Ads de R$ 50.
 *
 * O que mudou é a apresentação, e são três coisas:
 *
 * 1. A GRADE DE EMOJI morreu. A categoria era uma grade de botões com o ícone
 *    da categoria e rótulo em 13px — abaixo do piso de 12px do sistema, em
 *    duas colunas no celular, com o texto quebrando em duas linhas. Emoji de
 *    seção é vetado por escrito: os únicos glifos deste app são os cinco
 *    marcadores de situação e um chevron. Agora é um campo de 44px com rótulo
 *    acima, como todos os outros — e uma lista rolável lê mais rápido que uma
 *    grade de doze alvos quando o número de categorias cresce.
 *
 * 2. Saíram `brandblue` e `pending`, que não existem mais como cor. O botão
 *    selecionado usava `border-brandblue bg-brandblue-soft` e o segmento
 *    "A pagar" usava `bg-pending/15 text-pending` — cor com alpha, que é
 *    exatamente como os selos antigos ficavam presos em 2,71:1. Controle
 *    selecionado agora é o navy da ação, que é a única cor de clicável do
 *    sistema; e "A pagar" é previsão, que por regra não recebe cor tônica.
 *
 * 3. O bloco recolhido deixou de ser um cartão cinza com borda tracejada.
 *    Separação aqui é fio, e tracejado de 1px é a primeira coisa que some no
 *    celular a meio brilho sob sol.
 *
 * A validação e o `criarLancamento` são os mesmos; só as frases de erro
 * passaram a dizer como resolver.
 */
export function LancarDespesa({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { categories, contacts, accounts, costCenters, company, criarLancamento } = useAdmin()
  const { showToast } = useToast()

  const [tipo, setTipo] = useState<'expense' | 'income'>('expense')
  const [valor, setValor] = useState<number | null>(null)
  const [categoria, setCategoria] = useState('')
  const [situacao, setSituacao] = useState<'settled' | 'pending'>('settled')
  const [data, setData] = useState(toDateOnly(new Date()))
  const [descricao, setDescricao] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [contaId, setContaId] = useState('')
  const [empreendimento, setEmpreendimento] = useState('')
  const [maisOpcoes, setMaisOpcoes] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Categorias de venda saem da lista: elas nascem da venda, nunca à mão.
  const disponiveis = useMemo(
    () =>
      categories
        .filter((c) => c.kind === tipo)
        .filter((c) => c.company_id === null || c.company_id === company?.id)
        .filter((c) => !['Comissões de Venda', 'Comissões de Corretores'].includes(c.name))
        .sort((a, b) => a.sort_order - b.sort_order),
    [categories, tipo, company],
  )
  const contas = useMemo(() => accounts.filter((a) => a.is_active), [accounts])
  const fornecedores = useMemo(() => contacts.filter((c) => c.is_active), [contacts])

  useEffect(() => {
    if (!aberto) return
    setTipo('expense')
    setValor(null)
    setCategoria('')
    setSituacao('settled')
    setData(toDateOnly(new Date()))
    setDescricao('')
    setFornecedor('')
    setContaId('')
    setEmpreendimento('')
    setMaisOpcoes(false)
    setErro(null)
  }, [aberto])

  async function salvar() {
    setErro(null)
    if (!valor || valor <= 0)
      return setErro('Informe o valor em reais. Sem valor não há lançamento para somar no mês.')
    if (!categoria)
      return setErro(
        'Escolha a categoria. É ela que decide em qual linha do DRE este lançamento entra — sem categoria o resultado do mês fica errado.',
      )
    setSalvando(true)
    try {
      const cat = disponiveis.find((c) => c.name === categoria)
      await criarLancamento({
        kind: tipo,
        category: categoria,
        dre_group: tipo === 'income' ? 'revenue' : cat?.dre_group ?? 'variable_expense',
        description: descricao || categoria,
        amount: valor,
        competence_date: data,
        status: situacao,
        settled_date: situacao === 'settled' ? data : null,
        due_date: situacao === 'pending' ? data : null,
        is_recurring: false,
        contact_id: fornecedor || null,
        account_id: situacao === 'settled' ? contaId || null : null,
        cost_center_id: empreendimento || null,
      })
      showToast({
        message: situacao === 'settled' ? 'Lançamento registrado' : 'Vai para A pagar',
        detail: `${formatCurrency(valor)} · ${categoria}`,
      })
      onFechar()
    } catch (e) {
      setErro(
        e instanceof Error
          ? `O lançamento não foi gravado: ${e.message}`
          : 'O lançamento não foi gravado. Confira a conexão e salve de novo — nada entrou no mês.',
      )
    } finally {
      setSalvando(false)
    }
  }

  const rotulos =
    tipo === 'expense' ? { settled: 'Já paguei', pending: 'A pagar' } : { settled: 'Já recebi', pending: 'A receber' }

  return (
    <Modal
      open={aberto}
      onClose={onFechar}
      title={tipo === 'expense' ? 'Lançar despesa' : 'Lançar entrada'}
      footer={
        /* UMA ação primária por folha. */
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={salvar} disabled={salvando}>
            {salvando ? <Spinner className="h-5 w-5" /> : 'Salvar lançamento'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/*
         * Sem cor tônica no controle: verde significa dinheiro que se moveu, e
         * um botão de formulário não moveu nada. Quem diz se entrou ou saiu é
         * a palavra, e o selecionado usa o navy da ação como todo controle.
         */}
        <Segmented
          ariaLabel="Tipo"
          value={tipo}
          onChange={(v) => {
            setTipo(v)
            setCategoria('')
          }}
          options={[
            { value: 'expense', label: 'Saiu' },
            { value: 'income', label: 'Entrou' },
          ]}
        />

        <div>
          {/* O foco entra aqui: quem abre esta folha tem um valor na cabeça. */}
          <FormField label="Valor" htmlFor="d-valor">
            <CurrencyInput id="d-valor" value={valor} onChange={setValor} data-foco-inicial />
          </FormField>
          <p className="mt-1.5 text-sm text-content-faint">
            Em reais, o valor cheio do documento — sem descontar nada.
          </p>
        </div>

        <div>
          <FormField label="Categoria" htmlFor="d-cat">
            <Select id="d-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Escolher…</option>
              {disponiveis.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
          <p className="mt-1.5 text-sm text-content-faint">
            {disponiveis.length === 0
              ? 'Nenhuma categoria cadastrada para este tipo. Cadastre em Ajustes › Categorias.'
              : 'É a categoria que decide a linha do DRE em Relatórios.'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/*
           * Rótulo como parágrafo, não como <label>: o grupo é um radiogroup e
           * não tem um campo com id para apontar. Quem usa leitor de tela ouve
           * o nome pelo `aria-label` do próprio grupo.
           */}
          <div>
            <p className="mb-1.5 block text-sm font-medium text-content-muted">Situação</p>
            <Segmented
              ariaLabel="Situação"
              value={situacao}
              onChange={setSituacao}
              options={[
                { value: 'settled', label: rotulos.settled },
                { value: 'pending', label: rotulos.pending },
              ]}
            />
          </div>
          <div>
            <FormField label={situacao === 'settled' ? 'Data' : 'Vencimento'} htmlFor="d-data">
              <Input id="d-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </FormField>
            <p className="mt-1.5 text-sm text-content-faint">
              {situacao === 'settled'
                ? tipo === 'expense'
                  ? 'o dia em que o dinheiro saiu'
                  : 'o dia em que o dinheiro entrou'
                : 'o dia em que vence — até lá é previsão, não dívida vencida'}
            </p>
          </div>
        </div>

        {/*
         * O resto existe, mas não pede atenção. Um fio separa, e não uma caixa:
         * conteúdo dentro da folha não ganha cartão nem sombra.
         */}
        <div className="border-t border-line pt-2">
          <button
            type="button"
            onClick={() => setMaisOpcoes((v) => !v)}
            aria-expanded={maisOpcoes}
            className="flex min-h-toque w-full items-center gap-1.5 rounded-lg text-base font-medium text-action-soft-ink transition-colors hover:bg-action-soft"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', maisOpcoes && 'rotate-180')} aria-hidden />
            {maisOpcoes ? 'Menos opções' : 'Fornecedor, conta, empreendimento'}
          </button>

          {maisOpcoes && (
            <div className="space-y-4 pb-1 pt-2">
              <FormField label="Descrição" htmlFor="d-desc">
                <Input
                  id="d-desc"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex.: Meta Ads setembro"
                />
              </FormField>
              <FormField label="Fornecedor" htmlFor="d-forn">
                <Select id="d-forn" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)}>
                  <option value="">Nenhum</option>
                  {fornecedores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              {situacao === 'settled' && (
                <div>
                  <FormField label="Conta" htmlFor="d-conta">
                    <Select id="d-conta" value={contaId} onChange={(e) => setContaId(e.target.value)}>
                      <option value="">Definir depois</option>
                      {contas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <p className="mt-1.5 text-sm text-content-faint">
                    {tipo === 'expense' ? 'de onde o dinheiro saiu' : 'onde o dinheiro entrou'} — sem
                    conta o saldo do Início não muda.
                  </p>
                </div>
              )}
              {costCenters.length > 0 && (
                <div>
                  <FormField label="Empreendimento" htmlFor="d-cc">
                    <Select id="d-cc" value={empreendimento} onChange={(e) => setEmpreendimento(e.target.value)}>
                      <option value="">Nenhum</option>
                      {costCenters
                        .filter((c) => c.is_active)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </Select>
                  </FormField>
                  <p className="mt-1.5 text-sm text-content-faint">
                    Preenchido, este gasto entra no resultado do produto — é assim que se sabe qual
                    empreendimento dá lucro.
                  </p>
                </div>
              )}
            </div>
          )}
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
