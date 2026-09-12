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

/**
 * Lançar uma despesa (ou uma entrada que não é venda) em poucos toques.
 *
 * Três campos obrigatórios: valor, categoria e se já saiu. Fornecedor, conta,
 * empreendimento e descrição ficam recolhidos — existem, mas não pedem
 * atenção. O formulário antigo abria com quatorze campos à mostra, incluindo
 * seletor de empresa e calculadora de comissão, para lançar um Meta Ads de
 * R$ 50.
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
    if (!valor || valor <= 0) return setErro('Informe o valor.')
    if (!categoria) return setErro('Escolha a categoria.')
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
      setErro(e instanceof Error ? e.message : 'Não deu para lançar.')
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
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={salvar} disabled={salvando}>
            {salvando ? <Spinner className="h-5 w-5" /> : 'Salvar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Segmented
          ariaLabel="Tipo"
          value={tipo}
          onChange={(v) => {
            setTipo(v)
            setCategoria('')
          }}
          options={[
            { value: 'expense', label: 'Saiu', activeClass: 'bg-expense/12 text-expense border border-expense/25' },
            { value: 'income', label: 'Entrou', activeClass: 'bg-income/12 text-income border border-income/25' },
          ]}
        />

        <FormField label="Valor" htmlFor="d-valor">
          <CurrencyInput id="d-valor" value={valor} onChange={setValor} autoFocus />
        </FormField>

        <div>
          <p className="mb-1.5 text-sm font-medium text-content-muted">Categoria</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {disponiveis.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoria(c.name)}
                className={cn(
                  'rounded-xl border px-2.5 py-2.5 text-left text-[13px] font-medium leading-tight transition-colors',
                  categoria === c.name
                    ? 'border-brandblue bg-brandblue-soft text-brandblue'
                    : 'border-line bg-surface-2 text-content-muted hover:text-content',
                )}
              >
                {c.icon ? `${c.icon} ` : ''}
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Situação" htmlFor="d-sit">
            <Segmented
              ariaLabel="Situação"
              value={situacao}
              onChange={setSituacao}
              options={[
                { value: 'settled', label: rotulos.settled },
                {
                  value: 'pending',
                  label: rotulos.pending,
                  activeClass: 'bg-pending/15 text-pending border border-pending/25',
                },
              ]}
            />
          </FormField>
          <FormField label={situacao === 'settled' ? 'Data' : 'Vencimento'} htmlFor="d-data">
            <Input id="d-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </FormField>
        </div>

        <button
          type="button"
          onClick={() => setMaisOpcoes((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2.5 text-sm font-medium text-content-muted transition-colors hover:text-content"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', maisOpcoes && 'rotate-180')} />
          {maisOpcoes ? 'Menos opções' : 'Fornecedor, conta, empreendimento'}
        </button>

        {maisOpcoes && (
          <div className="space-y-3 rounded-xl bg-surface-2/60 p-3.5">
            <FormField label="Descrição" htmlFor="d-desc" hint="opcional">
              <Input
                id="d-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: Meta Ads setembro"
              />
            </FormField>
            <FormField label="Fornecedor" htmlFor="d-forn" hint="opcional">
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
              <FormField label="Conta" htmlFor="d-conta" hint="de onde saiu o dinheiro">
                <Select id="d-conta" value={contaId} onChange={(e) => setContaId(e.target.value)}>
                  <option value="">Definir depois</option>
                  {contas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
            {costCenters.length > 0 && (
              <FormField label="Empreendimento" htmlFor="d-cc" hint="para saber qual produto dá lucro">
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
            )}
          </div>
        )}

        {erro && (
          <p className="text-sm text-expense" role="alert">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}
