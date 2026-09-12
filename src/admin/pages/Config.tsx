import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { TrocarSenha } from '@/auth/TrocarSenha'
import { useAdmin } from '../AdminData'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Secao } from '@/components/ui/Secao'
import { Lista, Linha } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { FormField, Input, Select } from '@/components/ui/Field'
import { CurrencyInput, PercentInput } from '@/components/ui/MoneyInput'
import { Segmented } from '@/components/ui/Segmented'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { ACCOUNT_TYPE_LABEL, accountBalance } from '@/lib/treasury'
import { formatDate, toDateOnly } from '@/lib/format'
import type { Account, CostCenter } from '@/types'

type Aba = 'contas' | 'empreendimentos' | 'categorias' | 'imposto' | 'conta'

/*
 * CONFIGURAÇÕES — cadastros e regras. O que se configura uma vez e some do
 * caminho.
 *
 * Com 587 linhas, era a tela mais longa do app, e é inteira formulário. Duas
 * decisões de desenho saem disso:
 *
 * 1. **Não há herói.** A regra do sistema é um número em degrau herói por
 *    tela, e ela existe para obrigar a tela a declarar qual pergunta responde.
 *    Configuração não responde pergunta de dinheiro nenhuma: o saldo é do
 *    Início, o resultado é de Relatórios. Inventar um herói aqui seria pôr um
 *    terceiro número grande disputando com os dois que já têm dono — que é
 *    exatamente o defeito que a regra foi escrita para impedir. Então a tela
 *    abre com um h1 comum, sem ponto de ouro.
 *
 * 2. **Nenhum cartão.** Eram sete blocos `rounded-2xl border bg-surface
 *    shadow-card`, mais um oitavo tracejado para o vazio — e `shadow-card` já
 *    nem existe em tailwind.config.js, que guarda só `pop`, para o que de fato
 *    flutua. Viraram seções separadas por fio, e as listas de conta,
 *    empreendimento e categoria viraram `Lista`.
 *
 * Também sumiu a barra de acento colorida da conta (`a.color` pintando um
 * traço vertical de 6px): o sistema visual tem duas matizes, a da marca, e
 * nenhuma informação pode depender de uma cor arbitrária guardada no cadastro.
 * O valor continua sendo gravado como sempre — só deixou de virar tinta.
 *
 * O comportamento de salvar não mudou em nenhum dos cinco formulários.
 */
export function Config() {
  const [aba, setAba] = useState<Aba>('contas')

  return (
    <div className="animate-fade-in">
      <h1 className="text-lg font-semibold text-content">Configurações</h1>
      <p className="mt-1 max-w-[42rem] text-base text-content-muted">
        Contas, empreendimentos, categorias e imposto. O que se muda aqui vale para os lançamentos
        daqui para frente — nada do que já está gravado é reescrito.
      </p>

      {/*
       * Cinco abas não cabem lado a lado num celular sem espremer
       * "Empreendimentos" até quebrar. Então a régua tem largura mínima e quem
       * rola é a própria régua, nunca a página.
       */}
      <div className="mt-4 overflow-x-auto pb-1">
        <Segmented
          ariaLabel="Seção"
          className="min-w-[40rem]"
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
      </div>

      <div className="mt-6">
        {aba === 'contas' && <Contas />}
        {aba === 'empreendimentos' && <Empreendimentos />}
        {aba === 'categorias' && <Categorias />}
        {aba === 'imposto' && <Imposto />}
        {aba === 'conta' && <MinhaConta />}
      </div>
    </div>
  )
}

function Contas() {
  const { accounts, transactions, transfers, salvarConta } = useAdmin()
  const [editando, setEditando] = useState<Account | 'nova' | null>(null)
  const { showToast } = useToast()

  return (
    <>
      <Secao
        titulo="Contas"
        acao={
          <Button onClick={() => setEditando('nova')}>
            <Plus className="h-4 w-4" />
            Nova conta
          </Button>
        }
      >
        <p className="mb-1 max-w-[42rem] text-base text-content-muted">
          Onde o dinheiro da imobiliária entra e sai. O saldo ao lado é o de hoje, já com as
          transferências entre contas.
        </p>

        {accounts.length === 0 ? (
          <EmptyState
            title="Nenhuma conta cadastrada"
            description="Sem conta, a baixa fica sem destino e o saldo não fecha com o extrato do banco."
            action={<Button onClick={() => setEditando('nova')}>Cadastrar a primeira conta</Button>}
          />
        ) : (
          /*
           * A linha inteira abre o cadastro — 56px de alvo em vez do botão
           * "Editar" de 36px que ficava no canto direito, abaixo do piso de
           * toque de 44px do sistema.
           */
          <Lista>
            {accounts.map((a) => {
              const saldo = accountBalance(a, transactions, transfers)
              return (
                <Linha
                  key={a.id}
                  titulo={a.is_active ? a.name : `${a.name} (inativa)`}
                  meta={[
                    ACCOUNT_TYPE_LABEL[a.type],
                    a.bank,
                    `aberta em ${formatDate(a.opening_date)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  valor={
                    <Valor
                      valor={saldo.balance}
                      posto="linha"
                      tinta={saldo.balance < 0 ? 'text-expense' : undefined}
                    />
                  }
                  aoClicar={() => setEditando(a)}
                />
              )
            })}
          </Lista>
        )}
      </Secao>

      <FormConta
        alvo={editando}
        onFechar={() => setEditando(null)}
        onSalvar={async (dados) => {
          await salvarConta(dados)
          showToast({ message: dados.id ? 'Conta atualizada' : 'Conta criada' })
          setEditando(null)
        }}
      />
    </>
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
          <Input
            id="ct-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Bradesco PJ"
            autoFocus
          />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
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
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Saldo inicial" htmlFor="ct-saldo" hint="o do extrato na data abaixo">
            <CurrencyInput id="ct-saldo" value={saldo} onChange={setSaldo} />
          </FormField>
          <FormField label="A partir de" htmlFor="ct-data">
            <Input id="ct-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </FormField>
        </div>
        <Chave rotulo="Conta ativa" marcado={ativa} aoMudar={setAtiva} />
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
    <>
      <Secao
        titulo="Empreendimentos"
        acao={
          <Button onClick={() => setEditando('novo')}>
            <Plus className="h-4 w-4" />
            Novo
          </Button>
        }
      >
        <p className="mb-1 max-w-[42rem] text-base text-content-muted">
          Cada empreendimento guarda a construtora e se ela retém ISS. É daqui que a venda nasce
          sabendo quanto de imposto sai antes de o dinheiro chegar.
        </p>

        {costCenters.length === 0 ? (
          <EmptyState
            title="Nenhum empreendimento cadastrado"
            description="Sem empreendimento a venda não sabe se a construtora retém ISS, e a comissão líquida sai errada."
            action={<Button onClick={() => setEditando('novo')}>Cadastrar o primeiro</Button>}
          />
        ) : (
          <Lista>
            {costCenters.map((c) => {
              const cc = c as CostCenter & {
                retains_iss?: boolean
                iss_pct?: number
                default_commission_pct?: number | null
              }
              const qtd = vendas.filter((v) => v.cost_center_id === c.id).length
              return (
                <Linha
                  key={c.id}
                  titulo={c.is_active ? c.name : `${c.name} (inativo)`}
                  meta={[
                    c.developer,
                    `${qtd} venda${qtd === 1 ? '' : 's'}`,
                    cc.retains_iss ? `retém ISS ${cc.iss_pct ?? 0}%` : 'sem retenção de ISS',
                    cc.default_commission_pct != null
                      ? `comissão padrão ${cc.default_commission_pct}%`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  aoClicar={() => setEditando(c)}
                />
              )
            })}
          </Lista>
        )}
      </Secao>

      <FormEmpreendimento
        alvo={editando}
        onFechar={() => setEditando(null)}
        onSalvar={async (dados) => {
          await salvarEmpreendimento(dados)
          showToast({ message: dados.id ? 'Empreendimento atualizado' : 'Empreendimento criado' })
          setEditando(null)
        }}
      />
    </>
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
          <Input
            id="ep-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: PortoVelas"
            autoFocus
          />
        </FormField>
        <FormField label="Construtora" htmlFor="ep-const" hint="quem paga a comissão">
          <Input id="ep-const" value={construtora} onChange={(e) => setConstrutora(e.target.value)} />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
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
        <Chave rotulo="Ativo" marcado={ativo} aoMudar={setAtivo} />
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
    <>
      <Secao
        titulo="Categorias"
        acao={
          <Button onClick={() => setNova(true)}>
            <Plus className="h-4 w-4" />
            Nova
          </Button>
        }
      >
        <p className="mb-1 max-w-[42rem] text-base text-content-muted">
          Como as despesas são classificadas. As duas categorias de comissão ficam fora desta lista
          de propósito: elas não se configuram, nascem do cadastro da venda.
        </p>

        <Lista>
          {minhas.map((c) => {
            const usos = usoPorCategoria.get(c.name) ?? 0
            return (
              <Linha
                key={c.id}
                titulo={c.name}
                meta={[
                  c.kind === 'income' ? 'entrada' : 'saída',
                  `${usos} ${usos === 1 ? 'lançamento' : 'lançamentos'}`,
                ].join(' · ')}
              />
            )
          })}
        </Lista>
      </Secao>

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
    </>
  )
}

function Imposto() {
  const { company, salvarImposto } = useAdmin()
  const [regime, setRegime] = useState(company?.tax_regime ?? 'simples')
  const [aliquota, setAliquota] = useState<number | null>(company?.tax_rate ?? 6)
  const [salvando, setSalvando] = useState(false)
  const { showToast } = useToast()

  return (
    <>
      <Secao titulo="Enquadramento">
        <p className="mb-3 max-w-[42rem] text-base text-content-muted">
          A alíquota aqui é só o padrão que o formulário de venda sugere. O que vale no resultado é o
          imposto lançado em cada parcela — é assim que a guia do DAS aparece em A pagar na data
          certa.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Regime" htmlFor="im-regime">
            <Select
              id="im-regime"
              value={regime ?? 'simples'}
              onChange={(e) => setRegime(e.target.value as typeof regime)}
            >
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
      </Secao>

      <Secao titulo="A empresa">
        <p className="text-base text-content">{company?.name ?? '—'}</p>
        <p className="mt-2 max-w-[42rem] text-sm text-content-muted">
          Este sistema atende só a imobiliária. O financeiro pessoal e as outras empresas saíram do
          uso e estão preservados no arquivo do banco.
        </p>
      </Secao>
    </>
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
    <>
      <Secao titulo="Seu acesso">
        <p className="text-base text-content">{profile?.name ?? 'Administrador'}</p>
        <p className="mt-0.5 text-sm text-content-muted">{email}</p>
        <Button className="mt-4" onClick={() => setTrocando(true)}>
          Trocar minha senha
        </Button>
      </Secao>

      <Secao titulo="Senha de um corretor">
        <p className="max-w-[42rem] text-base text-content-muted">
          O corretor troca a própria senha no menu do perfil dele. Se esquecer, a redefinição é feita
          no painel do Supabase, em Authentication → Users → o usuário → Reset password. Trocar a
          senha de outra pessoa exige a chave de administração, que não pode ficar no navegador.
        </p>
      </Secao>

      <TrocarSenha aberto={trocando} onFechar={() => setTrocando(false)} />
    </>
  )
}

/**
 * Ligar/desligar dentro de um formulário.
 *
 * A caixa de seleção nativa é bem menor que o piso de toque do sistema, então
 * quem recebe o toque é o rótulo inteiro, com 44px de altura: ligar ou desligar
 * uma conta não pode exigir mira.
 */
function Chave({
  rotulo,
  marcado,
  aoMudar,
}: {
  rotulo: string
  marcado: boolean
  aoMudar: (v: boolean) => void
}) {
  return (
    <label className="flex min-h-toque cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3.5 py-2">
      <span className="text-base text-content">{rotulo}</span>
      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => aoMudar(e.target.checked)}
        className="h-5 w-5 accent-action"
      />
    </label>
  )
}
