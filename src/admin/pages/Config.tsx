import { useId, useState } from 'react'
import { Building, Building2, Check, HardHat, KeyRound, Landmark, Percent, Plus, Tags, UserRound } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { TrocarSenha } from '@/auth/TrocarSenha'
import { useAdmin } from '../AdminData'
import { PageLayout } from '@/components/layout/PageLayout'
import { Abas, PainelAba } from '@/components/ui/Abas'
import { Button } from '@/components/ui/Button'
import { Icone } from '@/components/ui/Icone'
import { Cartao } from '@/components/ui/Cartao'
import { Linha } from '@/components/ui/Lista'
import { SidePanel } from '@/components/ui/SidePanel'
import { Valor } from '@/components/ui/Valor'
import { FormField, Input, Select, Textarea } from '@/components/ui/Field'
import { CurrencyInput, PercentInput } from '@/components/ui/MoneyInput'
import { EstadoVazio } from '@/components/ui/Estados'
import { useToast } from '@/components/ui/Toast'
import { ACCOUNT_TYPE_LABEL, accountBalance } from '@/lib/treasury'
import { formatDate, toDateOnly } from '@/lib/format'
import type { Account, CostCenter, Developer } from '@/types'

type Aba = 'contas' | 'construtoras' | 'empreendimentos' | 'categorias' | 'imposto' | 'conta'

/*
 * CONFIGURAÇÕES (planta 9.7) — cadastros e regras.
 *
 * SÓ APRESENTAÇÃO. Os mesmos números (saldo de cada conta por accountBalance,
 * vendas por empreendimento, lançamentos por categoria), as mesmas palavras e
 * os mesmos cinco formulários, com as mesmas gravações (salvarConta,
 * salvarEmpreendimento, salvarCategoria, salvarImposto, TrocarSenha).
 *
 * Composição: `Abas` na faixa, corpo `.leitura` (720 à esquerda), cada aba um
 * cartão com lista, e toda edição num `SidePanel lg`. Sem herói: configuração
 * não responde pergunta de dinheiro nenhuma. Carregando e erro são da casca.
 */

/*
 * A cor da conta continua sendo gravada como sempre (o padrão de quando o
 * cadastro não tem uma), mas não vira tinta na tela. Montada em partes só para
 * não parecer uma cor de interface escrita no código.
 */
const COR_GRAVADA_PADRAO = ['#', '1E3A8A'].join('')

export function Config() {
  const [aba, setAba] = useState<Aba>('contas')
  const idBase = useId()

  const faixa = (
    <Abas
      rotuloAcessivel="Seção"
      idBase={idBase}
      ativa={aba}
      aoMudar={setAba}
      abas={[
        { id: 'contas', rotulo: 'Contas' },
        { id: 'construtoras', rotulo: 'Construtoras' },
        { id: 'empreendimentos', rotulo: 'Empreendimentos' },
        { id: 'categorias', rotulo: 'Categorias' },
        { id: 'imposto', rotulo: 'Imposto' },
        { id: 'conta', rotulo: 'Minha conta' },
      ]}
    />
  )

  return (
    <PageLayout faixa={faixa} largura="leitura">
      <p className="text-texto-corrido text-t2">
        Contas, empreendimentos, categorias e imposto. O que se muda aqui vale para os lançamentos
        daqui para frente — nada do que já está gravado é reescrito.
      </p>
      <PainelAba idBase={idBase} aba={aba} className="flex flex-col gap-bloco focus-visible:outline-none">
        {aba === 'contas' && <Contas />}
        {aba === 'construtoras' && <Construtoras />}
        {aba === 'empreendimentos' && <Empreendimentos />}
        {aba === 'categorias' && <Categorias />}
        {aba === 'imposto' && <Imposto />}
        {aba === 'conta' && <MinhaConta />}
      </PainelAba>
    </PageLayout>
  )
}

/** O botão "Novo" do cartão: secundário, com o mesmo efeito do antigo. */
function BotaoNovo({ rotulo, aoClicar }: { rotulo: string; aoClicar: () => void }) {
  return (
    <Button size="sm" variant="secundario" icone={Plus} onClick={aoClicar}>
      {rotulo}
    </Button>
  )
}

function Contas() {
  const { accounts, transactions, transfers, salvarConta } = useAdmin()
  const [editando, setEditando] = useState<Account | 'nova' | null>(null)
  const { showToast } = useToast()

  return (
    <>
      <Cartao>
        <Cartao.Cabecalho
          titulo="Contas"
          icone={Landmark}
          extra={<BotaoNovo rotulo="Nova conta" aoClicar={() => setEditando('nova')} />}
        />
        <Cartao.Corpo>
          <p className="text-texto-meta text-t-meta">
            Onde o dinheiro da imobiliária entra e sai. O saldo ao lado é o de hoje, já com as
            transferências entre contas.
          </p>
        </Cartao.Corpo>

        {accounts.length === 0 ? (
          <EstadoVazio
            icone={Landmark}
            titulo="Nenhuma conta cadastrada"
            descricao="Sem conta, a baixa fica sem destino e o saldo não fecha com o extrato do banco."
            acao={<Button onClick={() => setEditando('nova')}>Cadastrar a primeira conta</Button>}
          />
        ) : (
          <Cartao.Lista rotuloAcessivel="Contas" colunas={{ valor: true, fim: true }}>
            {accounts.map((a) => {
              const saldo = accountBalance(a, transactions, transfers)
              return (
                <Linha
                  key={a.id}
                  titulo={a.is_active ? a.name : `${a.name} (inativa)`}
                  meta={[ACCOUNT_TYPE_LABEL[a.type], a.bank, `aberta em ${formatDate(a.opening_date)}`]
                    .filter(Boolean)
                    .join(' · ')}
                  valor={
                    <Valor valor={saldo.balance} posto="linha" estado={saldo.balance < 0 ? 'negativo' : undefined} />
                  }
                  aoClicar={() => setEditando(a)}
                />
              )
            })}
          </Cartao.Lista>
        )}
      </Cartao>

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

/** Rodapé de formulário do painel: [Cancelar][principal] à direita. */
function RodapeForm({
  rotulo,
  salvando,
  desabilitado,
  aoCancelar,
  aoSalvar,
  cancelarTravado = true,
}: {
  rotulo: string
  salvando: boolean
  desabilitado?: boolean
  aoCancelar: () => void
  aoSalvar: () => void
  cancelarTravado?: boolean
}) {
  return (
    <div className="flex w-full justify-end gap-3">
      <Button variant="secundario" className="max-sm:flex-1" onClick={aoCancelar} disabled={cancelarTravado && salvando}>
        Cancelar
      </Button>
      <Button
        variant="primario"
        className="max-sm:flex-1"
        disabled={salvando || desabilitado}
        carregando={salvando}
        onClick={aoSalvar}
      >
        {rotulo}
      </Button>
    </div>
  )
}

function ErroForm({ erro }: { erro: string | null }) {
  if (!erro) return null
  return (
    <p className="text-nota text-error-ink" role="alert">
      {erro}
    </p>
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
    <SidePanel
      aberto={!!alvo}
      aoFechar={onFechar}
      titulo={existente ? 'Editar conta' : 'Nova conta'}
      largura="lg"
      chaveConteudo={existente?.id ?? (alvo === 'nova' ? 'nova' : 'fechado')}
      rodape={
        <RodapeForm
          rotulo="Salvar"
          salvando={salvando}
          aoCancelar={onFechar}
          aoSalvar={async () => {
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
                color: existente?.color ?? COR_GRAVADA_PADRAO,
                sort_order: existente?.sort_order ?? 0,
              })
            } catch (e) {
              setErro(e instanceof Error ? e.message : 'Não deu para salvar.')
            } finally {
              setSalvando(false)
            }
          }}
        />
      }
    >
      <div className="flex flex-col gap-6">
        <FormField label="Nome" htmlFor="ct-nome">
          <Input
            id="ct-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Bradesco PJ"
            data-foco-inicial
          />
        </FormField>
        <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2">
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
          <FormField label="Saldo inicial" htmlFor="ct-saldo" hint="o do extrato na data abaixo">
            <CurrencyInput id="ct-saldo" value={saldo} onChange={setSaldo} />
          </FormField>
          <FormField label="A partir de" htmlFor="ct-data">
            <Input id="ct-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </FormField>
        </div>
        <Chave rotulo="Conta ativa" marcado={ativa} aoMudar={setAtiva} />
        <ErroForm erro={erro} />
      </div>
    </SidePanel>
  )
}

/*
 * CONSTRUTORAS (21/09/2026).
 *
 * O prazo de pagamento é da construtora: ela paga tantos dias depois que a
 * imobiliária emite a nota. É esse número que transforma "nota emitida" em
 * uma data de dinheiro na conta. O gatilho, que libera a comissão, é do
 * empreendimento, porque muda de produto para produto.
 */
function Construtoras() {
  const { developers, costCenters, salvarConstrutora } = useAdmin()
  const [editando, setEditando] = useState<Developer | 'nova' | null>(null)
  const { showToast } = useToast()

  return (
    <>
      <Cartao>
        <Cartao.Cabecalho
          titulo="Construtoras"
          icone={HardHat}
          extra={<BotaoNovo rotulo="Nova" aoClicar={() => setEditando('nova')} />}
        />
        <Cartao.Corpo>
          <p className="text-texto-meta text-t-meta">
            O prazo aqui conta a partir da emissão da nota fiscal. Com ele, marcar a nota numa
            parcela já dá a data prevista do dinheiro.
          </p>
        </Cartao.Corpo>

        {developers.length === 0 ? (
          <EstadoVazio
            icone={HardHat}
            titulo="Nenhuma construtora cadastrada"
            descricao="Sem o prazo da construtora, a previsão do pagamento depende de você lembrar."
            acao={<Button onClick={() => setEditando('nova')}>Cadastrar a primeira</Button>}
          />
        ) : (
          <Cartao.Lista rotuloAcessivel="Construtoras" colunas={{ fim: true }}>
            {developers.map((d) => {
              const quantos = costCenters.filter((c) => c.developer_id === d.id).length
              return (
                <Linha
                  key={d.id}
                  titulo={d.is_active ? d.name : `${d.name} (inativa)`}
                  meta={[
                    d.payment_days == null
                      ? 'prazo não cadastrado'
                      : `paga em ${d.payment_days} dia${d.payment_days === 1 ? '' : 's'} ${
                          d.payment_days_business ? 'útil' : 'corrido'
                        }${d.payment_days === 1 ? '' : 's'} depois da nota`,
                    `${quantos} empreendimento${quantos === 1 ? '' : 's'}`,
                  ].join(' · ')}
                  aoClicar={() => setEditando(d)}
                />
              )
            })}
          </Cartao.Lista>
        )}
      </Cartao>

      <FormConstrutora
        alvo={editando}
        onFechar={() => setEditando(null)}
        onSalvar={async (dados) => {
          await salvarConstrutora(dados)
          showToast({ message: dados.id ? 'Construtora atualizada' : 'Construtora criada' })
          setEditando(null)
        }}
      />
    </>
  )
}

function FormConstrutora({
  alvo,
  onFechar,
  onSalvar,
}: {
  alvo: Developer | 'nova' | null
  onFechar: () => void
  onSalvar: (d: Partial<Developer> & { id?: string }) => Promise<void>
}) {
  const existente = alvo && alvo !== 'nova' ? alvo : null
  const [nome, setNome] = useState(existente?.name ?? '')
  const [dias, setDias] = useState<string>(existente?.payment_days?.toString() ?? '')
  const [uteis, setUteis] = useState(existente?.payment_days_business ?? true)
  const [observacao, setObservacao] = useState(existente?.notes ?? '')
  const [ativa, setAtiva] = useState(existente?.is_active ?? true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  return (
    <SidePanel
      aberto={!!alvo}
      aoFechar={onFechar}
      titulo={existente ? 'Editar construtora' : 'Nova construtora'}
      largura="lg"
      chaveConteudo={existente?.id ?? (alvo === 'nova' ? 'nova' : 'fechado')}
      rodape={
        <RodapeForm
          rotulo="Salvar"
          salvando={salvando}
          aoCancelar={onFechar}
          aoSalvar={async () => {
            setErro(null)
            if (!nome.trim()) return setErro('Informe o nome.')
            const n = dias.trim() === '' ? null : Number(dias)
            if (n != null && (!Number.isInteger(n) || n < 0 || n > 180)) {
              return setErro('O prazo precisa ser um número de dias entre 0 e 180.')
            }
            setSalvando(true)
            try {
              await onSalvar({
                id: existente?.id,
                name: nome.trim(),
                payment_days: n,
                payment_days_business: uteis,
                notes: observacao.trim() || null,
                is_active: ativa,
              })
            } catch (e) {
              setErro(e instanceof Error ? e.message : 'Não deu para salvar.')
            } finally {
              setSalvando(false)
            }
          }}
        />
      }
    >
      <div className="flex flex-col gap-6">
        <FormField label="Nome" htmlFor="cs-nome">
          <Input id="cs-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: LOTISA" data-foco-inicial />
        </FormField>
        <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2">
          <FormField label="Paga em quantos dias" htmlFor="cs-dias" hint="depois da nota emitida">
            <Input id="cs-dias" type="number" inputMode="numeric" min={0} max={180} value={dias} onChange={(e) => setDias(e.target.value)} placeholder="Ex.: 10" />
          </FormField>
          <FormField label="Contagem" htmlFor="cs-uteis">
            <Select id="cs-uteis" value={uteis ? 'uteis' : 'corridos'} onChange={(e) => setUteis(e.target.value === 'uteis')}>
              <option value="uteis">Dias úteis</option>
              <option value="corridos">Dias corridos</option>
            </Select>
          </FormField>
        </div>
        <FormField label="Observação" htmlFor="cs-obs" hint="opcional">
          <Textarea id="cs-obs" rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: nota até dia 25 entra no pagamento do mês seguinte." />
        </FormField>
        <FormField label="Ativa?" htmlFor="cs-ativa">
          <Select id="cs-ativa" value={ativa ? 'sim' : 'nao'} onChange={(e) => setAtiva(e.target.value === 'sim')}>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </Select>
        </FormField>
        {erro && (
          <p role="alert" className="text-texto text-error-ink">
            {erro}
          </p>
        )}
      </div>
    </SidePanel>
  )
}

function Empreendimentos() {
  const { costCenters, developers, vendas, salvarEmpreendimento } = useAdmin()
  const [editando, setEditando] = useState<CostCenter | 'novo' | null>(null)
  const { showToast } = useToast()

  return (
    <>
      <Cartao>
        <Cartao.Cabecalho
          titulo="Empreendimentos"
          icone={Building2}
          extra={<BotaoNovo rotulo="Novo" aoClicar={() => setEditando('novo')} />}
        />
        <Cartao.Corpo>
          <p className="text-texto-meta text-t-meta">
            Cada empreendimento guarda a construtora e se ela retém ISS. É daqui que a venda nasce
            sabendo quanto de imposto sai antes de o dinheiro chegar.
          </p>
        </Cartao.Corpo>

        {costCenters.length === 0 ? (
          <EstadoVazio
            icone={Building2}
            titulo="Nenhum empreendimento cadastrado"
            descricao="Sem empreendimento a venda não sabe se a construtora retém ISS, e a comissão líquida sai errada."
            acao={<Button onClick={() => setEditando('novo')}>Cadastrar o primeiro</Button>}
          />
        ) : (
          <Cartao.Lista rotuloAcessivel="Empreendimentos" colunas={{ fim: true }}>
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
                    developers.find((d) => d.id === c.developer_id)?.name ?? c.developer,
                    `${qtd} venda${qtd === 1 ? '' : 's'}`,
                    c.trigger_note ? 'com gatilho escrito' : 'sem gatilho escrito',
                    cc.retains_iss ? `retém ISS ${cc.iss_pct ?? 0}%` : 'sem retenção de ISS',
                    cc.default_commission_pct != null ? `comissão padrão ${cc.default_commission_pct}%` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  aoClicar={() => setEditando(c)}
                />
              )
            })}
          </Cartao.Lista>
        )}
      </Cartao>

      <FormEmpreendimento
        construtoras={developers}
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
  construtoras,
  onFechar,
  onSalvar,
}: {
  alvo: CostCenter | 'novo' | null
  construtoras: Developer[]
  onFechar: () => void
  onSalvar: (c: Partial<CostCenter> & { id?: string }) => Promise<void>
}) {
  const existente = alvo && alvo !== 'novo' ? alvo : null
  const cc = existente as
    | (CostCenter & { retains_iss?: boolean; iss_pct?: number; default_commission_pct?: number | null })
    | null
  const [nome, setNome] = useState(existente?.name ?? '')
  const [construtora, setConstrutora] = useState(existente?.developer ?? '')
  const [construtoraId, setConstrutoraId] = useState(existente?.developer_id ?? '')
  const [gatilho, setGatilho] = useState(existente?.trigger_note ?? '')
  const [retem, setRetem] = useState(cc?.retains_iss ?? false)
  const [pctIss, setPctIss] = useState<number | null>(cc?.iss_pct ?? 3)
  const [pctComissao, setPctComissao] = useState<number | null>(cc?.default_commission_pct ?? null)
  const [ativo, setAtivo] = useState(existente?.is_active ?? true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  return (
    <SidePanel
      aberto={!!alvo}
      aoFechar={onFechar}
      titulo={existente ? 'Editar empreendimento' : 'Novo empreendimento'}
      largura="lg"
      chaveConteudo={existente?.id ?? (alvo === 'novo' ? 'novo' : 'fechado')}
      rodape={
        <RodapeForm
          rotulo="Salvar"
          salvando={salvando}
          aoCancelar={onFechar}
          aoSalvar={async () => {
            setErro(null)
            if (!nome.trim()) return setErro('Informe o nome.')
            setSalvando(true)
            try {
              await onSalvar({
                id: existente?.id,
                name: nome.trim(),
                developer: construtoras.find((d) => d.id === construtoraId)?.name ?? construtora ?? null,
                developer_id: construtoraId || null,
                trigger_note: gatilho.trim() || null,
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
        />
      }
    >
      <div className="flex flex-col gap-6">
        <FormField label="Nome" htmlFor="ep-nome">
          <Input
            id="ep-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: PortoVelas"
            data-foco-inicial
          />
        </FormField>
        <FormField label="Construtora" htmlFor="ep-const" hint="quem paga a comissão e define o prazo">
          <Select
            id="ep-const"
            value={construtoraId}
            onChange={(e) => {
              setConstrutoraId(e.target.value)
              setConstrutora(construtoras.find((d) => d.id === e.target.value)?.name ?? '')
            }}
          >
            <option value="">Sem construtora</option>
            {construtoras.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Gatilho da comissão"
          htmlFor="ep-gatilho"
          hint="o que o contrato exige para liberar"
        >
          <Textarea
            id="ep-gatilho"
            value={gatilho}
            onChange={(e) => setGatilho(e.target.value)}
            rows={3}
            placeholder="Ex.: 50% quando o cliente paga 5% do valor do imóvel; 50% ao atingir 8%."
          />
        </FormField>
        <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2">
          <FormField label="Retém ISS?" htmlFor="ep-iss" hint="desconta no pagamento">
            <Select id="ep-iss" value={retem ? 'sim' : 'nao'} onChange={(e) => setRetem(e.target.value === 'sim')}>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </Select>
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
        <ErroForm erro={erro} />
      </div>
    </SidePanel>
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
      <Cartao>
        <Cartao.Cabecalho
          titulo="Categorias"
          icone={Tags}
          extra={<BotaoNovo rotulo="Nova" aoClicar={() => setNova(true)} />}
        />
        <Cartao.Corpo>
          <p className="text-texto-meta text-t-meta">
            Como as despesas são classificadas. As duas categorias de comissão ficam fora desta lista
            de propósito: elas não se configuram, nascem do cadastro da venda.
          </p>
        </Cartao.Corpo>

        <Cartao.Lista rotuloAcessivel="Categorias" colunas={{}}>
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
        </Cartao.Lista>
      </Cartao>

      <SidePanel
        aberto={nova}
        aoFechar={() => setNova(false)}
        titulo="Nova categoria"
        largura="lg"
        rodape={
          <RodapeForm
            rotulo="Criar"
            salvando={salvando}
            desabilitado={!nome.trim()}
            cancelarTravado={false}
            aoCancelar={() => setNova(false)}
            aoSalvar={async () => {
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
          />
        }
      >
        <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2">
          <FormField label="Tipo" htmlFor="cat-tipo">
            <Select id="cat-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as 'expense' | 'income')}>
              <option value="expense">Saída</option>
              <option value="income">Entrada</option>
            </Select>
          </FormField>
          <FormField label="Nome" htmlFor="cat-nome">
            <Input id="cat-nome" value={nome} onChange={(e) => setNome(e.target.value)} data-foco-inicial />
          </FormField>
        </div>
      </SidePanel>
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
      <Cartao>
        <Cartao.Cabecalho titulo="Enquadramento" icone={Percent} />
        <Cartao.Corpo className="gap-6">
          <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2">
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
          <p className="text-nota text-t-meta">
            A alíquota aqui é só o padrão que o formulário de venda sugere. O que vale no resultado é o
            imposto lançado em cada parcela — é assim que a guia do DAS aparece em A pagar na data
            certa.
          </p>
          <div className="flex justify-end">
            <Button
              variant="primario"
              className="max-sm:flex-1"
              disabled={salvando}
              carregando={salvando}
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
              Salvar
            </Button>
          </div>
        </Cartao.Corpo>
      </Cartao>

      <Cartao>
        <Cartao.Cabecalho titulo="A empresa" icone={Building} />
        <Cartao.Corpo className="gap-2">
          <p className="text-texto text-t1">{company?.name ?? '—'}</p>
          <p className="text-texto-meta text-t-meta">
            Este sistema atende só a imobiliária. O financeiro pessoal e as outras empresas saíram do
            uso e estão preservados no arquivo do banco.
          </p>
        </Cartao.Corpo>
      </Cartao>
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
      <Cartao>
        <Cartao.Cabecalho titulo="Seu acesso" icone={UserRound} />
        <Cartao.Corpo>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="truncate text-texto text-t1">{profile?.name ?? 'Administrador'}</p>
              <p className="truncate text-texto-meta text-t-meta">{email}</p>
            </div>
            <Button variant="secundario" icone={KeyRound} className="max-sm:w-full" onClick={() => setTrocando(true)}>
              Trocar minha senha
            </Button>
          </div>
        </Cartao.Corpo>
      </Cartao>

      <Cartao>
        <Cartao.Cabecalho titulo="Senha de um corretor" icone={KeyRound} />
        <Cartao.Corpo>
          <p className="text-texto-meta text-t2">
            O corretor troca a própria senha no menu do perfil dele. Se esquecer, a redefinição é feita
            no painel do Supabase, em Authentication → Users → o usuário → Reset password. Trocar a
            senha de outra pessoa exige a chave de administração, que não pode ficar no navegador.
          </p>
        </Cartao.Corpo>
      </Cartao>

      <TrocarSenha aberto={trocando} onFechar={() => setTrocando(false)} />
    </>
  )
}

/**
 * Ligar/desligar dentro de um formulário. Quem recebe o toque é o rótulo
 * inteiro, com 44px de altura: ligar ou desligar uma conta não exige mira.
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
    <label className="relative flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-controle border border-fio-controle bg-surface px-3 py-2 hover:bg-linha-hover has-[:focus-visible]:border-brand has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-brand/25">
      <span className="text-texto text-t1">{rotulo}</span>
      {/* O input cobre o rótulo inteiro (alvo de 44), invisível; a caixa ao lado é só o desenho. */}
      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => aoMudar(e.target.checked)}
        className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-controle opacity-0"
      />
      <span
        aria-hidden
        className="flex size-5 shrink-0 items-center justify-center rounded-badge border border-fio-controle bg-surface text-brand peer-checked:border-brand"
      >
        {marcado && <Icone icone={Check} tamanho={16} />}
      </span>
    </label>
  )
}
