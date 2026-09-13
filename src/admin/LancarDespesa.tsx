import { useEffect, useMemo, useState } from 'react'
import { ListPlus, Receipt } from 'lucide-react'
import { useAdmin } from './AdminData'
import { SidePanel } from '@/components/ui/SidePanel'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { Segmented } from '@/components/ui/Segmented'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, toDateOnly } from '@/lib/format'
import { BlocoDaFolha, DobraDaFolha, EscolhaDaFolha, RodapeDaFolha } from './FolhaDeLancamento'

/** O erro de validação sabe de qual campo é; o de gravação não é de campo nenhum. */
type Erro = { campo?: 'valor' | 'categoria'; texto: string }

/*
 * LANÇAR UMA DESPESA (ou uma entrada que não é venda) EM POUCOS TOQUES.
 *
 * O desenho de fluxo continua o mesmo, e ele estava certo: três campos
 * obrigatórios — valor, categoria e se já saiu. Fornecedor, conta,
 * empreendimento e descrição ficam recolhidos: existem, mas não pedem atenção.
 * O formulário antigo abria com quatorze campos à mostra, incluindo seletor de
 * empresa e calculadora de comissão, para lançar um Meta Ads de R$ 50.
 *
 * Abre no painel lateral (princípio 10): a tela de Despesas continua visível
 * atrás, e o botão que grava fica no rodapé fixo. O painel só fecha depois que
 * o banco confirma. Em falha, tudo o que foi digitado continua na tela.
 *
 * O recolhido agora é uma dobra que DIZ o que está preenchido ("Meta Ads ·
 * Nubank"), em vez de um botão "Mais opções" que escondia se havia algo lá
 * dentro. Recolher o controle, nunca a informação.
 *
 * O erro de campo vazio aparece no próprio campo, e o foco vai até ele; o erro
 * de gravação, que não é de campo nenhum, aparece no rodapé.
 *
 * A validação e o `criarLancamento` são os mesmos; as frases de erro dizem
 * como resolver.
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
  const [erro, setErro] = useState<Erro | null>(null)

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
  const empreendimentos = useMemo(() => costCenters.filter((c) => c.is_active), [costCenters])

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

  function fechar() {
    if (!salvando) onFechar()
  }

  // O campo com problema pode estar fora da tela no celular: o foco o traz.
  function apontar(campo: 'valor' | 'categoria', texto: string) {
    setErro({ campo, texto })
    document.getElementById(campo === 'valor' ? 'd-valor' : 'd-cat')?.focus()
  }

  async function salvar() {
    setErro(null)
    if (!valor || valor <= 0)
      return apontar('valor', 'Informe o valor em reais. Sem valor não há lançamento para somar no mês.')
    if (!categoria)
      return apontar(
        'categoria',
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
      setErro({
        texto:
          e instanceof Error
            ? `O lançamento não foi gravado: ${e.message}`
            : 'O lançamento não foi gravado. Confira a conexão e salve de novo — nada entrou no mês.',
      })
    } finally {
      setSalvando(false)
    }
  }

  const rotulos =
    tipo === 'expense' ? { settled: 'Já paguei', pending: 'A pagar' } : { settled: 'Já recebi', pending: 'A receber' }

  /*
   * O estado da dobra em texto. A conta só entra quando já saiu/entrou: é a
   * mesma regra do payload, que ignora a conta de um lançamento pendente.
   */
  const preenchidos = [
    descricao || null,
    fornecedores.find((c) => c.id === fornecedor)?.name ?? null,
    situacao === 'settled' ? contas.find((a) => a.id === contaId)?.name ?? null : null,
    empreendimentos.find((c) => c.id === empreendimento)?.name ?? null,
  ].filter(Boolean)
  const itensDaDobra = [
    'descrição',
    'fornecedor',
    situacao === 'settled' ? 'conta' : null,
    costCenters.length > 0 ? 'empreendimento' : null,
  ].filter(Boolean)
  const resumoDaDobra =
    preenchidos.length > 0 ? preenchidos.join(' · ') : `${itensDaDobra.join(', ')}: nada preenchido, tudo opcional`

  return (
    <SidePanel
      aberto={aberto}
      aoFechar={fechar}
      titulo={tipo === 'expense' ? 'Lançar despesa' : 'Lançar entrada'}
      subtitulo={
        tipo === 'expense'
          ? 'Dinheiro que saiu ou vai sair da imobiliária'
          : 'Dinheiro que entrou e não é parcela de venda'
      }
      rodape={
        /* UMA ação primária por folha. */
        <RodapeDaFolha erro={erro && !erro.campo ? erro.texto : null} tituloDoErro="Lançamento não salvo">
          <Button variant="ghost" size="lg" onClick={fechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button size="lg" className="flex-1" onClick={salvar} carregando={salvando}>
            Salvar lançamento
          </Button>
        </RodapeDaFolha>
      }
    >
      <div className="space-y-6">
        <BlocoDaFolha titulo="O lançamento" icone={Receipt}>
          {/*
           * Sem cor tônica no controle: verde significa dinheiro que se moveu,
           * e um botão de formulário não moveu nada. Quem diz se entrou ou saiu
           * é a palavra; o selecionado usa o preenchimento de controle da
           * marca, como todo controle escolhido.
           */}
          <EscolhaDaFolha rotulo="Tipo">
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
          </EscolhaDaFolha>

          {/* O foco entra no valor: quem abre esta folha tem um valor na cabeça. */}
          <FormField
            label="Valor"
            htmlFor="d-valor"
            required
            error={erro?.campo === 'valor' ? erro.texto : undefined}
            hint="Em reais, o valor cheio do documento — sem descontar nada."
          >
            <CurrencyInput id="d-valor" value={valor} onChange={setValor} data-foco-inicial />
          </FormField>

          <FormField
            label="Categoria"
            htmlFor="d-cat"
            required
            error={erro?.campo === 'categoria' ? erro.texto : undefined}
            hint={
              disponiveis.length === 0
                ? 'Nenhuma categoria cadastrada para este tipo. Cadastre em Ajustes › Categorias.'
                : 'É a categoria que decide a linha do DRE em Relatórios.'
            }
          >
            <Select id="d-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Escolher…</option>
              {disponiveis.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <EscolhaDaFolha rotulo="Situação">
              <Segmented
                ariaLabel="Situação"
                value={situacao}
                onChange={setSituacao}
                options={[
                  { value: 'settled', label: rotulos.settled },
                  { value: 'pending', label: rotulos.pending },
                ]}
              />
            </EscolhaDaFolha>
            <FormField
              label={situacao === 'settled' ? 'Data' : 'Vencimento'}
              htmlFor="d-data"
              hint={
                situacao === 'settled'
                  ? tipo === 'expense'
                    ? 'o dia em que o dinheiro saiu'
                    : 'o dia em que o dinheiro entrou'
                  : 'o dia em que vence — até lá é previsão, não dívida vencida'
              }
            >
              <Input id="d-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </FormField>
          </div>
        </BlocoDaFolha>

        {/* O resto existe, mas não pede atenção — e a dobra diz o que já está preenchido. */}
        <DobraDaFolha
          titulo="Detalhes opcionais"
          resumo={resumoDaDobra}
          icone={ListPlus}
          aberta={maisOpcoes}
          aoAlternar={() => setMaisOpcoes((v) => !v)}
        >
          <FormField label="Descrição" htmlFor="d-desc" hint="sem descrição, o lançamento leva o nome da categoria">
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
            <FormField
              label="Conta"
              htmlFor="d-conta"
              hint={`${tipo === 'expense' ? 'de onde o dinheiro saiu' : 'onde o dinheiro entrou'} — sem conta o saldo do Início não muda.`}
            >
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
            <FormField
              label="Empreendimento"
              htmlFor="d-cc"
              hint="Preenchido, este gasto entra no resultado do produto — é assim que se sabe qual empreendimento dá lucro."
            >
              <Select id="d-cc" value={empreendimento} onChange={(e) => setEmpreendimento(e.target.value)}>
                <option value="">Nenhum</option>
                {empreendimentos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
        </DobraDaFolha>
      </div>
    </SidePanel>
  )
}
