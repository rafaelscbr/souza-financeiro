import { useEffect, useMemo, useState } from 'react'
import { Wallet } from 'lucide-react'
import { useAdmin } from './AdminData'
import { SidePanel } from '@/components/ui/SidePanel'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { FiltrosRapidos } from '@/components/ui/FiltrosRapidos'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/format'
import type { BudgetLine } from '@/types'
import { BlocoDaFolha, EscolhaDaFolha, RodapeDaFolha } from './FolhaDeLancamento'

type Campo = 'descricao' | 'valor' | 'categoria' | 'de' | 'ate'
type Erro = { campo?: Campo; texto: string }

/*
 * UM GASTO DO ORÇAMENTO (22/10/2026): cadastrar, mudar ou apagar.
 *
 * O Rafael quer pôr no orçamento também o que ele ainda está pensando em
 * gastar, para ver quanto precisaria vender antes de assumir. Por isso a
 * situação: Confirmado ou Possível. Gasto que muda de valor no meio do caminho
 * é cadastrado duas vezes, cada uma com a sua vigência.
 */
export function GastoDoOrcamento({
  aberto,
  linha,
  aoFechar,
}: {
  aberto: boolean
  /** A linha em edição; `null` cadastra uma nova. */
  linha: BudgetLine | null
  aoFechar: () => void
}) {
  const { categories, company, salvarOrcamento, excluirOrcamento, mes } = useAdmin()
  const { showToast } = useToast()

  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState('')
  const [valor, setValor] = useState<number | null>(null)
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [situacao, setSituacao] = useState<BudgetLine['status']>('confirmado')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [apagando, setApagando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [erro, setErro] = useState<Erro | null>(null)

  // Só a estrutura: imposto e comissão de corretor nascem da venda, não do orçamento.
  const disponiveis = useMemo(
    () =>
      categories
        .filter((c) => c.kind === 'expense')
        .filter((c) => c.company_id === null || c.company_id === company?.id)
        .filter((c) => !['cost_of_sale', 'tax'].includes(c.dre_group ?? '') && c.name !== 'Impostos e Taxas')
        .sort((a, b) => a.sort_order - b.sort_order),
    [categories, company],
  )

  useEffect(() => {
    if (!aberto) return
    const mesAtual = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`
    setDescricao(linha?.description ?? '')
    setCategoria(linha?.category ?? '')
    setValor(linha?.amount ?? null)
    setDe(linha?.start_month.slice(0, 7) ?? mesAtual)
    setAte(linha?.end_month?.slice(0, 7) ?? '')
    setSituacao(linha?.status ?? 'confirmado')
    setObs(linha?.notes ?? '')
    setErro(null)
  }, [aberto, linha, mes])

  function fechar() {
    if (!salvando && !apagando) aoFechar()
  }

  function apontar(campo: Campo, texto: string) {
    setErro({ campo, texto })
    document.getElementById(`o-${campo}`)?.focus()
  }

  async function salvar() {
    setErro(null)
    if (!descricao.trim()) return apontar('descricao', 'Dê um nome ao gasto, como "Coworking" ou "Tráfego pago".')
    if (!valor || valor <= 0) return apontar('valor', 'Informe quanto ele custa por mês, em reais.')
    if (!categoria)
      return apontar('categoria', 'Escolha a categoria. É por ela que o relatório compara o orçado com o gasto de verdade.')
    if (!de) return apontar('de', 'Diga a partir de que mês o gasto começa.')
    if (ate && ate < de) return apontar('ate', 'O último mês não pode vir antes do primeiro.')
    setSalvando(true)
    try {
      await salvarOrcamento({
        id: linha?.id,
        description: descricao.trim(),
        category: categoria,
        amount: valor,
        start_month: `${de}-01`,
        end_month: ate ? `${ate}-01` : null,
        status: situacao,
        notes: obs.trim() || null,
      })
      showToast({
        message: linha ? 'Gasto do orçamento atualizado' : 'Gasto incluído no orçamento',
        detail: `${descricao.trim()} · ${formatCurrency(valor)} por mês`,
      })
      aoFechar()
    } catch (e) {
      setErro({ texto: e instanceof Error ? `Não foi gravado: ${e.message}` : 'Não foi gravado. Confira a conexão e salve de novo.' })
    } finally {
      setSalvando(false)
    }
  }

  async function apagar() {
    if (!linha) return
    setApagando(true)
    try {
      await excluirOrcamento(linha.id)
      showToast({ message: 'Gasto tirado do orçamento', detail: linha.description })
      setConfirmandoExclusao(false)
      aoFechar()
    } catch (e) {
      setConfirmandoExclusao(false)
      setErro({ texto: e instanceof Error ? `Não foi apagado: ${e.message}` : 'Não foi apagado. Tente de novo.' })
    } finally {
      setApagando(false)
    }
  }

  return (
    <>
      <SidePanel
        aberto={aberto}
        aoFechar={fechar}
        titulo={linha ? 'Gasto do orçamento' : 'Novo gasto no orçamento'}
        subtitulo="Um custo que a imobiliária tem ou pode vir a ter"
        rodape={
          <RodapeDaFolha erro={erro && !erro.campo ? erro.texto : null} tituloDoErro="Gasto não salvo">
            {linha && (
              <Button variant="perigo" size="lg" onClick={() => setConfirmandoExclusao(true)} disabled={salvando}>
                Apagar
              </Button>
            )}
            <Button variant="secundario" size="lg" onClick={fechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button variant="primario" size="lg" onClick={salvar} carregando={salvando}>
              Salvar gasto
            </Button>
          </RodapeDaFolha>
        }
      >
        <BlocoDaFolha titulo="O gasto" icone={Wallet}>
          <FormField
            label="Nome"
            htmlFor="o-descricao"
            required
            error={erro?.campo === 'descricao' ? erro.texto : undefined}
          >
            <Input
              id="o-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Coworking"
              data-foco-inicial
            />
          </FormField>

          <FormField
            label="Valor por mês"
            htmlFor="o-valor"
            required
            error={erro?.campo === 'valor' ? erro.texto : undefined}
          >
            <CurrencyInput id="o-valor" value={valor} onChange={setValor} />
          </FormField>

          <FormField
            label="Categoria"
            htmlFor="o-categoria"
            required
            error={erro?.campo === 'categoria' ? erro.texto : undefined}
            hint="A mesma dos lançamentos: é assim que o orçado encontra o gasto de verdade."
          >
            <Select id="o-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Escolher…</option>
              {disponiveis.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2">
            <FormField label="A partir de" htmlFor="o-de" required error={erro?.campo === 'de' ? erro.texto : undefined}>
              <Input id="o-de" type="month" value={de} onChange={(e) => setDe(e.target.value)} />
            </FormField>
            <FormField
              label="Até"
              htmlFor="o-ate"
              error={erro?.campo === 'ate' ? erro.texto : undefined}
              hint="o último mês, incluso. Vazio = sem data para acabar."
            >
              <Input id="o-ate" type="month" value={ate} onChange={(e) => setAte(e.target.value)} />
            </FormField>
          </div>

          <EscolhaDaFolha
            rotulo="Situação"
            hint="Possível é o gasto que você está pensando em ter: o relatório mostra o cenário com e sem ele."
          >
            <FiltrosRapidos
              rotuloAcessivel="Situação"
              ativo={situacao}
              aoMudar={setSituacao}
              filtros={[
                { id: 'confirmado', rotulo: 'Confirmado' },
                { id: 'possivel', rotulo: 'Possível' },
              ]}
            />
          </EscolhaDaFolha>

          <FormField label="Observação" htmlFor="o-obs">
            <Input id="o-obs" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" />
          </FormField>
        </BlocoDaFolha>
      </SidePanel>

      <ConfirmDialog
        aberto={confirmandoExclusao}
        aoFechar={() => setConfirmandoExclusao(false)}
        titulo="Tirar este gasto do orçamento?"
        descricao={
          linha
            ? `${linha.description}, ${formatCurrency(linha.amount)} por mês, sai do orçamento. Nenhum lançamento é apagado: o que já foi gasto continua no DRE.`
            : undefined
        }
        rotuloConfirmar="Tirar do orçamento"
        tom="risco"
        aoConfirmar={apagar}
        ocupado={apagando}
      />
    </>
  )
}
