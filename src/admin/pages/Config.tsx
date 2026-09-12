import { useState } from 'react'
import { Building, KeyRound, Landmark, Plus, Receipt, Tag } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { TrocarSenha } from '@/auth/TrocarSenha'
import { useAdmin } from '../AdminData'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { FormField, Input, Select } from '@/components/ui/Field'
import { CurrencyInput, PercentInput } from '@/components/ui/MoneyInput'
import { Segmented } from '@/components/ui/Segmented'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { ACCOUNT_TYPE_LABEL, accountBalance } from '@/lib/treasury'
import { formatCurrency, formatDate, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Account, CostCenter } from '@/types'

type Aba = 'contas' | 'empreendimentos' | 'categorias' | 'imposto' | 'conta'

/** Cadastros e regras. O que se configura uma vez e some do caminho. */
export function Config() {
  const [aba, setAba] = useState<Aba>('contas')

  return (
    <div className="animate-fade-in space-y-4">
      <h1 className="text-xl font-bold text-content">Configurações</h1>

      <Segmented
        ariaLabel="Seção"
        value={aba}
        onChange={setAba}
        options={[
          { value: 'contas', label: 'Contas' },
          { value: 'empreendimentos', label: 'Empreendimentos' },
          { value: 'categorias', label: 'Categorias' },
          { value: 'imposto', label: 'Imposto' },
          { value: 'conta', label: 'Minha conta' },
        ]}
      />

      {aba === 'contas' && <Contas />}
      {aba === 'empreendimentos' && <Empreendimentos />}
      {aba === 'categorias' && <Categorias />}
      {aba === 'imposto' && <Imposto />}
      {aba === 'conta' && <MinhaConta />}
    </div>
  )
}

function Contas() {
  const { accounts, transactions, transfers, salvarConta } = useAdmin()
  const [editando, setEditando] = useState<Account | 'nova' | null>(null)
  const { showToast } = useToast()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-content-muted">Onde o dinheiro da imobiliária entra e sai.</p>
        <Button size="sm" onClick={() => setEditando('nova')}>
          <Plus className="h-4 w-4" />
          Nova conta
        </Button>
      </div>

      {accounts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface/50 p-6 text-center text-sm text-content-muted">
          Nenhuma conta cadastrada. Sem conta, a baixa fica sem destino e o saldo não fecha com o
          extrato do banco.
        </p>
      ) : (
        <ul className="space-y-2">
          {accounts.map((a) => {
            const saldo = accountBalance(a, transactions, transfers)
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: a.color }} aria-hidden />
                  <div>
                    <p className="text-sm font-semibold text-content">
                      {a.name}
                      {!a.is_active && <span className="ml-1.5 text-xs text-content-faint">(inativa)</span>}
                    </p>
                    <p className="text-xs text-content-faint">
                      {ACCOUNT_TYPE_LABEL[a.type]}
                      {a.bank ? ` · ${a.bank}` : ''} · desde {formatDate(a.opening_date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn('tnum text-sm font-bold', saldo.balance < 0 ? 'text-expense' : 'text-content')}
                  >
                    {formatCurrency(saldo.balance)}
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => setEditando(a)}>
                    Editar
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <FormConta
        alvo={editando}
        onFechar={() => setEditando(null)}
        onSalvar={async (dados) => {
          await salvarConta(dados)
          showToast({ message: dados.id ? 'Conta atualizada' : 'Conta criada' })
          setEditando(null)
        }}
      />
    </div>
  )
}

function FormConta({
  alvo,
  onFechar,
  onSalvar,
}: {
  alvo: Account | 'nova' | null
  onFechar: () => void
  onSalvar: (c: Partial<Account> & { id?: string }) => Promise<void>
}) {
  const existente = alvo && alvo !== 'nova' ? alvo : null
  const [nome, setNome] = useState(existente?.name ?? '')
  const [tipo, setTipo] = useState<Account['type']>(existente?.type ?? 'checking')
  const [banco, setBanco] = useState(existente?.bank ?? '')
  const [saldo, setSaldo] = useState<number | null>(existente?.opening_balance ?? 0)
  const [data, setData] = useState(existente?.opening_date ?? toDateOnly(new Date()))
  const [ativa, setAtiva] = useState(existente?.is_active ?? true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  return (
    <Modal
      key={existente?.id ?? (alvo === 'nova' ? 'nova' : 'fechado')}
      open={!!alvo}
      onClose={onFechar}
      title={existente ? 'Editar conta' : 'Nova conta'}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={salvando}
            onClick={async () => {
              setErro(null)
              if (!nome.trim()) return setErro('Informe o nome da conta.')
              setSalvando(true)
              try {
                await onSalvar({
                  id: existente?.id,
                  name: nome.trim(),
                  type: tipo,
                  bank: banco || null,
                  opening_balance: saldo ?? 0,
                  opening_date: data,
                  is_active: ativa,
                  color: existente?.color ?? '#1E3A8A',
                  sort_order: existente?.sort_order ?? 0,
                })
              } catch (e) {
                setErro(e instanceof Error ? e.message : 'Não deu para salvar.')
              } finally {
                setSalvando(false)
              }
            }}
          >
            {salvando ? <Spinner className="h-5 w-5" /> : 'Salvar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="Nome" htmlFor="ct-nome">
          <Input id="ct-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Bradesco PJ" autoFocus />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Tipo" htmlFor="ct-tipo">
            <Select id="ct-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as Account['type'])}>
              {Object.entries(ACCOUNT_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Banco" htmlFor="ct-banco" hint="opcional">
            <Input id="ct-banco" value={banco} onChange={(e) => setBanco(e.target.value)} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Saldo inicial" htmlFor="ct-saldo" hint="o do extrato na data abaixo">
            <CurrencyInput id="ct-saldo" value={saldo} onChange={setSaldo} />
          </FormField>
          <FormField label="A partir de" htmlFor="ct-data">
            <Input id="ct-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </FormField>
        </div>
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3">
          <span className="text-sm text-content">Conta ativa</span>
          <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
        </label>
        {erro && (
          <p className="text-sm text-expense" role="alert">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}

function Empreendimentos() {
  const { costCenters, vendas, salvarEmpreendimento } = useAdmin()
  const [editando, setEditando] = useState<CostCenter | 'novo' | null>(null)
  const { showToast } = useToast()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-content-muted">
          Cada empreendimento guarda a construtora e se ela retém ISS.
        </p>
        <Button size="sm" onClick={() => setEditando('novo')}>
          <Plus className="h-4 w-4" />
          Novo
        </Button>
      </div>

      <ul className="space-y-2">
        {costCenters.map((c) => {
          const cc = c as CostCenter & { retains_iss?: boolean; iss_pct?: number; default_commission_pct?: number | null }
          const qtd = vendas.filter((v) => v.cost_center_id === c.id).length
          return (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card"
            >
              <div>
                <p className="text-sm font-semibold text-content">
                  {c.name}
                  {!c.is_active && <span className="ml-1.5 text-xs text-content-faint">(inativo)</span>}
                </p>
                <p className="text-xs text-content-faint">
                  {[
                    c.developer,
                    `${qtd} venda${qtd === 1 ? '' : 's'}`,
                    cc.retains_iss ? `retém ISS ${cc.iss_pct ?? 0}%` : 'sem retenção de ISS',
                    cc.default_commission_pct != null ? `comissão padrão ${cc.default_commission_pct}%` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setEditando(c)}>
                Editar
              </Button>
            </li>
          )
        })}
      </ul>

      <FormEmpreendimento
        alvo={editando}
        onFechar={() => setEditando(null)}
        onSalvar={async (dados) => {
          await salvarEmpreendimento(dados)
          showToast({ message: dados.id ? 'Empreendimento atualizado' : 'Empreendimento criado' })
          setEditando(null)
        }}
      />
    </div>
  )
}

function FormEmpreendimento({
  alvo,
  onFechar,
  onSalvar,
}: {
  alvo: CostCenter | 'novo' | null
  onFechar: () => void
  onSalvar: (c: Partial<CostCenter> & { id?: string }) => Promise<void>
}) {
  const existente = alvo && alvo !== 'novo' ? alvo : null
  const cc = existente as
    | (CostCenter & { retains_iss?: boolean; iss_pct?: number; default_commission_pct?: number | null })
    | null
  const [nome, setNome] = useState(existente?.name ?? '')
  const [construtora, setConstrutora] = useState(existente?.developer ?? '')
  const [retem, setRetem] = useState(cc?.retains_iss ?? false)
  const [pctIss, setPctIss] = useState<number | null>(cc?.iss_pct ?? 3)
  const [pctComissao, setPctComissao] = useState<number | null>(cc?.default_commission_pct ?? null)
  const [ativo, setAtivo] = useState(existente?.is_active ?? true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  return (
    <Modal
      key={existente?.id ?? (alvo === 'novo' ? 'novo' : 'fechado')}
      open={!!alvo}
      onClose={onFechar}
      title={existente ? 'Editar empreendimento' : 'Novo empreendimento'}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={salvando}
            onClick={async () => {
              setErro(null)
              if (!nome.trim()) return setErro('Informe o nome.')
              setSalvando(true)
              try {
                await onSalvar({
                  id: existente?.id,
                  name: nome.trim(),
                  developer: construtora || null,
                  is_active: ativo,
                  ...({
                    retains_iss: retem,
                    iss_pct: retem ? pctIss ?? 0 : 0,
                    default_commission_pct: pctComissao,
                  } as Record<string, unknown>),
                })
              } catch (e) {
                setErro(e instanceof Error ? e.message : 'Não deu para salvar.')
              } finally {
                setSalvando(false)
              }
            }}
          >
            {salvando ? <Spinner className="h-5 w-5" /> : 'Salvar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="Nome" htmlFor="ep-nome">
          <Input id="ep-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: PortoVelas" autoFocus />
        </FormField>
        <FormField label="Construtora" htmlFor="ep-const" hint="quem paga a comissão">
          <Input id="ep-const" value={construtora} onChange={(e) => setConstrutora(e.target.value)} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Retém ISS?" htmlFor="ep-iss" hint="desconta no pagamento">
            <Segmented
              ariaLabel="Retém ISS"
              value={retem ? 'sim' : 'nao'}
              onChange={(v) => setRetem(v === 'sim')}
              options={[
                { value: 'sim', label: 'Sim' },
                { value: 'nao', label: 'Não' },
              ]}
            />
          </FormField>
          {retem && (
            <FormField label="% do ISS" htmlFor="ep-isspct">
              <PercentInput id="ep-isspct" value={pctIss} onChange={setPctIss} />
            </FormField>
          )}
        </div>
        <FormField label="% de comissão habitual" htmlFor="ep-com" hint="opcional; preenche a venda">
          <PercentInput id="ep-com" value={pctComissao} onChange={setPctComissao} />
        </FormField>
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3">
          <span className="text-sm text-content">Ativo</span>
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
        </label>
        {erro && (
          <p className="text-sm text-expense" role="alert">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}

function Categorias() {
  const { categories, company, transactions, salvarCategoria } = useAdmin()
  const [nova, setNova] = useState(false)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<'expense' | 'income'>('expense')
  const [salvando, setSalvando] = useState(false)
  const { showToast } = useToast()

  const minhas = categories
    .filter((c) => c.company_id === null || c.company_id === company?.id)
    .filter((c) => !['Comissões de Venda', 'Comissões de Corretores'].includes(c.name))
  const usoPorCategoria = new Map<string, number>()
  for (const t of transactions) usoPorCategoria.set(t.category, (usoPorCategoria.get(t.category) ?? 0) + 1)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-content-muted">Como as despesas são classificadas.</p>
        <Button size="sm" onClick={() => setNova(true)}>
          <Plus className="h-4 w-4" />
          Nova
        </Button>
      </div>

      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        {minhas.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-content-faint" />
              <span className="text-sm text-content">{c.name}</span>
              <span className="text-[10px] uppercase tracking-wide text-content-faint">
                {c.kind === 'income' ? 'entrada' : 'saída'}
              </span>
            </div>
            <span className="text-xs text-content-faint">
              {usoPorCategoria.get(c.name) ?? 0} uso(s)
            </span>
          </li>
        ))}
      </ul>

      <Modal
        open={nova}
        onClose={() => setNova(false)}
        title="Nova categoria"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setNova(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={salvando || !nome.trim()}
              onClick={async () => {
                setSalvando(true)
                try {
                  await salvarCategoria({
                    name: nome.trim(),
                    kind: tipo,
                    dre_group: tipo === 'income' ? 'revenue' : 'variable_expense',
                    is_recurring_default: false,
                  })
                  showToast({ message: 'Categoria criada' })
                  setNome('')
                  setNova(false)
                } finally {
                  setSalvando(false)
                }
              }}
            >
              {salvando ? <Spinner className="h-5 w-5" /> : 'Criar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Segmented
            ariaLabel="Tipo"
            value={tipo}
            onChange={setTipo}
            options={[
              { value: 'expense', label: 'Saída' },
              { value: 'income', label: 'Entrada' },
            ]}
          />
          <FormField label="Nome" htmlFor="cat-nome">
            <Input id="cat-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </FormField>
        </div>
      </Modal>
    </div>
  )
}

function Imposto() {
  const { company, salvarImposto } = useAdmin()
  const [regime, setRegime] = useState(company?.tax_regime ?? 'simples')
  const [aliquota, setAliquota] = useState<number | null>(company?.tax_rate ?? 6)
  const [salvando, setSalvando] = useState(false)
  const { showToast } = useToast()

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-content">
          <Receipt className="h-4 w-4 text-content-muted" />
          Enquadramento
        </h2>
        <p className="mb-4 text-xs text-content-muted">
          A alíquota aqui é só o padrão que o formulário de venda sugere. O que vale no resultado é o
          imposto lançado em cada parcela — é assim que a guia do DAS aparece em A pagar na data
          certa.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Regime" htmlFor="im-regime">
            <Select id="im-regime" value={regime ?? 'simples'} onChange={(e) => setRegime(e.target.value as typeof regime)}>
              <option value="simples">Simples Nacional</option>
              <option value="presumido">Lucro Presumido</option>
              <option value="real">Lucro Real</option>
              <option value="none">Não contribuinte</option>
            </Select>
          </FormField>
          <FormField label="Alíquota padrão" htmlFor="im-aliq" hint="a efetiva do extrato do PGDAS-D">
            <PercentInput id="im-aliq" value={aliquota} onChange={setAliquota} />
          </FormField>
        </div>
        <Button
          className="mt-4"
          disabled={salvando}
          onClick={async () => {
            setSalvando(true)
            try {
              await salvarImposto(regime ?? 'simples', aliquota)
              showToast({ message: 'Imposto atualizado' })
            } finally {
              setSalvando(false)
            }
          }}
        >
          {salvando ? <Spinner className="h-5 w-5" /> : 'Salvar'}
        </Button>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-content">
          <Landmark className="h-4 w-4 text-content-muted" />
          Sobre a empresa
        </h2>
        <p className="text-sm text-content-muted">
          {company?.name ?? '—'}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-content-faint">
          <Building className="h-3.5 w-3.5" />
          Este sistema atende só a imobiliária. O financeiro pessoal e as outras empresas saíram do
          uso e estão preservados no arquivo do banco.
        </p>
      </div>
    </div>
  )
}

/**
 * A própria conta do administrador. A troca de senha vive aqui porque o acesso
 * do corretor foi criado sem e-mail, e um sistema em que a senha só se troca
 * por link de e-mail não serve para quem não tem caixa de e-mail.
 */
function MinhaConta() {
  const { email, profile } = useAuth()
  const [trocando, setTrocando] = useState(false)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-content">
          <KeyRound className="h-4 w-4 text-content-muted" />
          Seu acesso
        </h2>
        <p className="text-sm text-content-muted">{profile?.name ?? 'Administrador'}</p>
        <p className="text-xs text-content-faint">{email}</p>
        <Button className="mt-4" onClick={() => setTrocando(true)}>
          Trocar minha senha
        </Button>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-1 text-sm font-semibold text-content">Senha de um corretor</h2>
        <p className="text-sm text-content-muted">
          O corretor troca a própria senha no menu do perfil dele. Se esquecer, a redefinição é feita
          no painel do Supabase, em Authentication → Users → o usuário → Reset password. Trocar a
          senha de outra pessoa exige a chave de administração, que não pode ficar no navegador.
        </p>
      </div>

      <TrocarSenha aberto={trocando} onFechar={() => setTrocando(false)} />
    </div>
  )
}
