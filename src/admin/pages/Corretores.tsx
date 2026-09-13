import { useMemo, useState } from 'react'
import { KeyRound, Plus, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { useComposicao, type ItemComposicao } from '@/components/composicao/Composicao'
import { Heroi } from '@/components/ui/Assinatura'
import { Secao } from '@/components/ui/Secao'
import { Lista, Linha } from '@/components/ui/Lista'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { Trilha, LegendaTrilha } from '@/components/ui/Trilha'
import { ChipSituacao } from '@/components/ui/Situacao'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { FormField, Input, Select } from '@/components/ui/Field'
import { PercentInput } from '@/components/ui/MoneyInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { brokerProduction, brokerStatusOf } from '@/lib/sales'
import { situacaoDeTela, fraseDeTempo } from '@/lib/situacao'
import { formatCurrency } from '@/lib/format'
import type { Contact } from '@/types'

/*
 * CORRETORES — quem vende, quanto a imobiliária deve a cada um, e quem tem
 * acesso ao próprio painel.
 *
 * A tela antiga respondia à pergunta errada. Cada corretor era um CARTÃO com
 * quatro mini-indicadores lado a lado — "Comissão total", "Já paga",
 * "Liberada", "Prevista" — todos no mesmo `text-sm font-bold`, com rótulos em
 * `text-[10px]`. Quatro números do mesmo tamanho não têm hierarquia: o maior
 * deles ("Comissão total") era justamente o que a imobiliária NÃO precisa
 * pagar agora, porque soma o que já foi pago com o que ainda depende de a
 * construtora pagar. E nenhum deles abria em nada.
 *
 * A tela passa a responder à pergunta que o dono faz aqui: **quanto eu devo de
 * comissão hoje.** O herói é só o LIBERADO — parcela que a imobiliária já
 * recebeu e ainda não repassou. A previsão continua na tela, porque esconder
 * informação não é honestidade, mas em linha própria, sem cor tônica e com a
 * palavra "depende". Nunca somada ao devido.
 *
 * E o valor de cada corretor ABRE: de quais vendas e de quais parcelas ele vem,
 * com um toque para a ficha da venda. Esse caminho é o pedido central do
 * cliente — "de onde vem esse número" era uma conta feita à mão, venda por
 * venda, fora do sistema.
 *
 * O drill-down percorre EXATAMENTE o mesmo conjunto que `brokerProduction`:
 * vendas não canceladas do corretor, parcelas vivas com comissão maior que
 * zero, situação pela mesma `brokerStatusOf` do banco. Não há segunda conta —
 * é por isso que a soma dos itens da folha fecha com o número da linha, e a
 * soma das linhas fecha com o herói.
 *
 * O acesso do corretor é ligado aqui, mas o convite em si sai do painel do
 * Supabase: criar usuário pede chave de administração, que não pode viver no
 * navegador. O caminho está escrito na tela para não depender de memória.
 */
export function Corretores() {
  const { vendas, contacts, transactions, usuarios, contatosComAcesso, hoje, salvarContato, salvarAcesso } = useAdmin()
  const { showToast } = useToast()
  const { abrir } = useComposicao()
  const [editando, setEditando] = useState<Contact | 'novo' | null>(null)
  const [vinculando, setVinculando] = useState(false)

  const producao = useMemo(
    () => brokerProduction({ vendas, contacts, comAcesso: contatosComAcesso, year: null }),
    [vendas, contacts, contatosComAcesso],
  )
  const semVinculo = usuarios.filter((u) => u.role === 'corretor' && !u.contact_id)

  /*
   * As parcelas de comissão de cada corretor, prontas para a folha.
   *
   * Separadas em duas pilhas porque elas nunca podem ser somadas: LIBERADA é
   * dinheiro que a imobiliária já tem na mão e deve; PREVISTA depende de a
   * construtora pagar primeiro, e chamar isso de dívida inventaria uma
   * obrigação que não existe hoje.
   */
  const porCorretor = useMemo(() => {
    const statusPorTx = new Map(transactions.map((t) => [t.id, t.status] as const))
    const mapa = new Map<string, { liberadas: ItemComposicao[]; previstas: ItemComposicao[] }>()

    for (const v of vendas) {
      if (v.status === 'cancelada' || !v.broker_id) continue
      const grupo = mapa.get(v.broker_id) ?? { liberadas: [], previstas: [] }
      for (const i of v.installments) {
        if (i.status === 'cancelada' || i.broker_amount <= 0) continue
        const bs = brokerStatusOf(i, statusPorTx)
        if (bs !== 'liberada' && bs !== 'prevista') continue
        // `situacaoDeTela` é quem decide o que é atraso: uma comissão liberada
        // cuja data já passou vira 'vencida'; uma prevista nunca vira, porque
        // a construtora atrasar não é a imobiliária dever.
        // A mesma data da Venda: o atraso do corretor conta de quando a imobiliária
        // recebeu a parcela, não de quando a construtora devia pagar.
        const s = situacaoDeTela(bs, i.received_date ?? i.expected_date, hoje)
        const item: ItemComposicao = {
          id: i.id,
          titulo: v.title,
          meta: [v.development, fraseDeTempo(s, { prevista: i.expected_date, liberada: i.received_date }, hoje)]
            .filter(Boolean)
            .join(' · '),
          valor: i.broker_amount,
          situacao: s,
          idx: i.idx,
          count: i.count,
          para: `/vendas/${v.id}`,
        }
        if (bs === 'liberada') grupo.liberadas.push(item)
        else grupo.previstas.push(item)
      }
      mapa.set(v.broker_id, grupo)
    }
    return mapa
  }, [vendas, transactions, hoje])

  const SEM_PARCELA: { liberadas: ItemComposicao[]; previstas: ItemComposicao[] } = {
    liberadas: [],
    previstas: [],
  }
  const doCorretor = (id: string) => porCorretor.get(id) ?? SEM_PARCELA
  const soma = (l: ItemComposicao[]) => Math.round(l.reduce((s, i) => s + i.valor, 0) * 100) / 100

  /** Na folha geral o nome do corretor entra no metadado: sem ele, 12 parcelas
   * de vendas diferentes não dizem para quem é cada uma. */
  const comNome = (nome: string, itens: ItemComposicao[]) =>
    itens.map((i) => ({ ...i, meta: [nome, i.meta].filter(Boolean).join(' · ') }))

  const liberadasTodas = producao.flatMap((p) => comNome(p.contact.name, doCorretor(p.contact.id).liberadas))
  const previstasTodas = producao.flatMap((p) => comNome(p.contact.name, doCorretor(p.contact.id).previstas))
  const aPagar = soma(liberadasTodas)
  const previsto = soma(previstasTodas)

  return (
    <div className="animate-fade-in">
      {/* O nome da tela já está na navegação; o rótulo assinatura do herói é o
       * que declara a pergunta. O h1 fica para quem lê com leitor de tela. */}
      <h1 className="sr-only">Corretores</h1>

      <Heroi
        rotulo="Comissão a pagar"
        contexto="Só a parcela que a imobiliária já recebeu da construtora e ainda não repassou. É o que é dívida hoje — previsão não entra nesta conta."
        acao={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setVinculando(true)}>
              <KeyRound className="h-4 w-4" />
              Acessos
            </Button>
            <Button onClick={() => setEditando('novo')}>
              <Plus className="h-4 w-4" />
              Novo corretor
            </Button>
          </div>
        }
      >
        {liberadasTodas.length > 0 ? (
          <ValorComOrigem
            valor={aPagar}
            posto="heroi"
            rotuloAcessivel="Ver de quais vendas e parcelas vem a comissão a pagar"
            aoAbrir={() =>
              abrir({
                rotulo: 'Comissão a pagar',
                titulo: 'De quais vendas vem',
                explica:
                  'Cada parcela que a imobiliária já recebeu e ainda não repassou ao corretor. Toque em uma para abrir a venda.',
                total: aPagar,
                itens: liberadasTodas,
                nota:
                  previsto > 0
                    ? `Fora disto, ${formatCurrency(previsto)} de comissão dependem de a construtora pagar. Não é dívida hoje.`
                    : undefined,
              })
            }
          />
        ) : (
          <Valor valor={0} posto="heroi" tinta="text-content-muted" />
        )}
      </Heroi>

      {/*
       * A previsão aparece, mas em linha própria, sem cor tônica e com a
       * palavra "depende" no metadado. É o que impede que ela volte a ser
       * somada ao que a imobiliária deve de verdade.
       */}
      <Secao titulo="Ainda não liberado">
        <Lista>
          <Linha
            titulo="Previsto, depende do recebimento"
            meta="comissão de parcela que a construtora ainda não pagou à imobiliária"
            situacao={<ChipSituacao situacao="prevista" />}
            valor={
              previstasTodas.length > 0 ? (
                <ValorComOrigem
                  valor={previsto}
                  tinta="text-content-muted"
                  rotuloAcessivel="Ver quais parcelas ainda dependem do recebimento"
                  aoAbrir={() =>
                    abrir({
                      rotulo: 'Previsto',
                      titulo: 'Previsão, não dívida',
                      explica:
                        'Estas comissões só passam a ser devidas quando a construtora pagar a parcela. Até lá não são obrigação e não entram em nenhum total de dívida.',
                      total: previsto,
                      itens: previstasTodas,
                    })
                  }
                />
              ) : (
                <Valor valor={0} tinta="text-content-muted" />
              )
            }
          />
        </Lista>
      </Secao>

      {semVinculo.length > 0 && (
        <Secao titulo="Logins sem corretor vinculado">
          <p className="py-2 text-base text-content-muted">
            {semVinculo.length === 1
              ? '1 pessoa entra e vê "acesso ainda não liberado".'
              : `${semVinculo.length} pessoas entram e veem "acesso ainda não liberado".`}{' '}
            Ligue cada login a um corretor em Acessos.
          </p>
          <Button variant="secondary" onClick={() => setVinculando(true)}>
            <KeyRound className="h-4 w-4" />
            Abrir Acessos
          </Button>
        </Secao>
      )}

      <Secao titulo="Por corretor">
        {producao.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="Nenhum corretor cadastrado"
            description="Cadastre quem vende para poder registrar a comissão e, se quiser, dar acesso ao painel dele."
            action={
              <Button onClick={() => setEditando('novo')}>
                <UserPlus className="h-4 w-4" />
                Cadastrar corretor
              </Button>
            }
          />
        ) : (
          <Lista>
            {producao.map((p) => {
              const g = doCorretor(p.contact.id)
              const liberado = soma(g.liberadas)
              const dele = soma(g.previstas)
              const ehVoce = (p.contact as Contact & { is_owner?: boolean }).is_owner === true
              return (
                <Linha
                  key={p.contact.id}
                  titulo={
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{p.contact.name}</span>
                      {p.hasAccess && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-action-soft px-1.5 py-0.5 text-xs font-medium text-action-soft-ink">
                          <ShieldCheck className="h-3 w-3" aria-hidden />
                          com acesso
                        </span>
                      )}
                      {ehVoce && (
                        <span className="shrink-0 rounded-md bg-surface-3 px-1.5 py-0.5 text-xs font-medium text-content-muted">
                          você
                        </span>
                      )}
                    </span>
                  }
                  meta={
                    <span className="flex flex-wrap items-baseline gap-x-1.5">
                      previsto
                      <Valor valor={dele} posto="fato" tinta="text-content-muted" />
                      <span aria-hidden className="text-content-faint">
                        ·
                      </span>
                      depende do recebimento
                    </span>
                  }
                  valor={
                    <ValorComOrigem
                      valor={liberado}
                      tinta={liberado > 0 ? undefined : 'text-content-muted'}
                      rotuloAcessivel={`Ver de quais vendas vem a comissão de ${p.contact.name}`}
                      aoAbrir={() =>
                        abrir({
                          rotulo: p.contact.name,
                          titulo: `Comissão a pagar para ${p.contact.name}`,
                          explica:
                            'Cada parcela que a imobiliária já recebeu e ainda não repassou a ele. Toque em uma para abrir a venda.',
                          total: liberado,
                          itens: g.liberadas,
                          nota:
                            dele > 0
                              ? `Além disso, ${formatCurrency(dele)} dependem de a construtora pagar. Não é dívida hoje.`
                              : undefined,
                          vazio:
                            'Nada liberado para ele agora. O que ele tem a receber ainda depende de a construtora pagar.',
                        })
                      }
                    />
                  }
                  acao={
                    <Button variant="secondary" onClick={() => setEditando(p.contact)}>
                      Editar
                    </Button>
                  }
                />
              )
            })}
          </Lista>
        )}
      </Secao>

      {producao.length > 0 && (
        <Secao titulo="Produção">
          {/*
           * A trilha renderiza na largura final, sem crescer, e o número vem
           * escrito ao lado: a barra é reforço, nunca a única fonte. Os três
           * segmentos são os três estados da comissão dele — e o segmento ouro
           * é o mesmo valor da linha acima, vindo do mesmo conjunto.
           */}
          <Lista>
            {producao.map((p) => {
              const g = doCorretor(p.contact.id)
              const liberado = soma(g.liberadas)
              const dele = soma(g.previstas)
              const padrao = (p.contact as Contact & { default_broker_pct?: number | null }).default_broker_pct
              const semVgv = p.sales > 0 && p.salesWithoutVgv === p.sales
              return (
                <li key={p.contact.id} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <p className="min-w-0 truncate text-base font-medium text-content">{p.contact.name}</p>
                    <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm text-content-faint">
                      <span>
                        {p.sales} {p.sales === 1 ? 'venda' : 'vendas'}
                      </span>
                      <span aria-hidden>·</span>
                      {/* Quando o sistema não sabe, ele diz em texto, não em zero. */}
                      {semVgv ? (
                        <span>VGV não informado</span>
                      ) : (
                        <>
                          <span>VGV</span>
                          <Valor valor={p.vgv} posto="fato" tinta="text-content-faint" />
                          {p.salesWithoutVgv > 0 && (
                            <span>
                              ({p.salesWithoutVgv}{' '}
                              {p.salesWithoutVgv === 1 ? 'venda sem valor' : 'vendas sem valor'} informado)
                            </span>
                          )}
                        </>
                      )}
                      {padrao != null && (
                        <>
                          <span aria-hidden>·</span>
                          <span>padrão {padrao}%</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="mt-2">
                    <Trilha
                      recebido={p.paid}
                      liberado={liberado}
                      previsto={dele}
                      rotuloAcessivel={`${p.contact.name}: ${formatCurrency(p.paid)} já pagos a ele, ${formatCurrency(liberado)} liberados a pagar e ${formatCurrency(dele)} dependendo da construtora.`}
                    />
                  </div>
                </li>
              )
            })}
          </Lista>
          <div className="mt-3">
            <LegendaTrilha />
          </div>
        </Secao>
      )}

      <p className="mt-8 border-t border-rule pt-3 text-sm text-content-muted">
        A produção considera todas as vendas não canceladas, de qualquer ano. O corretor vê os
        números dele por ano, no painel próprio.
      </p>

      <EditarCorretor
        alvo={editando}
        onFechar={() => setEditando(null)}
        onSalvar={async (dados) => {
          await salvarContato(dados)
          showToast({ message: dados.id ? 'Corretor atualizado' : 'Corretor cadastrado' })
          setEditando(null)
        }}
      />

      <GerenciarAcessos
        aberto={vinculando}
        onFechar={() => setVinculando(false)}
        onSalvar={async (p) => {
          await salvarAcesso(p)
          showToast({ message: 'Acesso atualizado' })
        }}
      />
    </div>
  )
}

function EditarCorretor({
  alvo,
  onFechar,
  onSalvar,
}: {
  alvo: Contact | 'novo' | null
  onFechar: () => void
  onSalvar: (c: Partial<Contact> & { id?: string }) => Promise<void>
}) {
  const existente = alvo && alvo !== 'novo' ? alvo : null
  const [nome, setNome] = useState(existente?.name ?? '')
  const [documento, setDocumento] = useState(existente?.document ?? '')
  const [telefone, setTelefone] = useState(existente?.phone ?? '')
  const [email, setEmail] = useState(existente?.email ?? '')
  const [pct, setPct] = useState<number | null>(
    (existente as (Contact & { default_broker_pct?: number | null }) | null)?.default_broker_pct ?? null,
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  return (
    <Modal
      key={existente?.id ?? (alvo === 'novo' ? 'novo' : 'fechado')}
      open={!!alvo}
      onClose={onFechar}
      title={existente ? 'Editar corretor' : 'Novo corretor'}
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
                  type: 'broker',
                  name: nome.trim(),
                  document: documento || null,
                  phone: telefone || null,
                  email: email || null,
                  ...({ default_broker_pct: pct } as Record<string, unknown>),
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
        <FormField label="Nome" htmlFor="c-nome">
          <Input id="c-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="CPF" htmlFor="c-doc" hint="opcional">
            <Input id="c-doc" value={documento} onChange={(e) => setDocumento(e.target.value)} />
          </FormField>
          <FormField label="Telefone" htmlFor="c-tel" hint="opcional">
            <Input id="c-tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </FormField>
        </div>
        <FormField label="E-mail" htmlFor="c-mail" hint="o mesmo que ele vai usar para entrar">
          <Input id="c-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField
          label="Percentual padrão"
          htmlFor="c-pct"
          hint="preenche o formulário de venda; dá para mudar em cada venda"
        >
          <PercentInput id="c-pct" value={pct} onChange={setPct} />
        </FormField>
        {/* Erro é `critical`, não `expense`: vermelho de despesa fala de
         * dinheiro que saiu, e aqui nada saiu — só não deu para salvar. */}
        {erro && (
          <p className="text-base text-critical" role="alert">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}

function GerenciarAcessos({
  aberto,
  onFechar,
  onSalvar,
}: {
  aberto: boolean
  onFechar: () => void
  onSalvar: (p: {
    userId: string
    role: 'admin' | 'corretor'
    contactId: string | null
    name: string | null
    isActive: boolean
  }) => Promise<void>
}) {
  const { usuarios, contacts } = useAdmin()
  const [ocupado, setOcupado] = useState<string | null>(null)
  const corretores = contacts.filter((c) => c.type === 'broker')

  return (
    <Modal
      open={aberto}
      onClose={onFechar}
      title="Acessos ao sistema"
      description="Quem entra e o que cada um vê"
      className="sm:max-w-xl"
    >
      <div className="space-y-5">
        {/* Instrução em fio, não em caixa: dentro de uma folha que já flutua,
         * um segundo recuo com borda vira cartão dentro de cartão. */}
        <div className="border-b border-line pb-4">
          <p className="text-base font-semibold text-content">Como dar acesso a um corretor</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-base text-content-muted">
            <li>No painel do Supabase: Authentication → Users → Invite user, com o e-mail dele.</li>
            <li>Ele recebe o convite e cria a senha.</li>
            <li>Volte aqui e ligue o login ao corretor na lista abaixo.</li>
          </ol>
          <p className="mt-1.5 text-sm text-content-faint">
            Criar usuário exige chave de administração, que não pode ficar no navegador — por isso
            essa parte é no painel.
          </p>
        </div>

        {usuarios.length === 0 ? (
          <p className="text-base text-content-muted">Nenhum usuário além de você.</p>
        ) : (
          <Lista>
            {usuarios.map((u) => (
              <li key={u.id} className="space-y-2 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-content">
                      {u.name ?? u.email ?? u.id.slice(0, 8)}
                    </p>
                    <p className="text-sm text-content-faint">
                      {u.role === 'admin' ? 'administrador' : 'corretor'}
                      {u.is_active ? '' : ' · desativado'}
                    </p>
                  </div>
                  {/* Alvo de 44px: eram 30px de altura, num controle que liga e
                   * desliga o acesso de uma pessoa ao sistema. */}
                  <Button
                    variant={u.is_active ? 'danger' : 'secondary'}
                    className="shrink-0"
                    onClick={async () => {
                      setOcupado(u.id)
                      try {
                        await onSalvar({
                          userId: u.id,
                          role: u.role,
                          contactId: u.contact_id,
                          name: u.name,
                          isActive: !u.is_active,
                        })
                      } finally {
                        setOcupado(null)
                      }
                    }}
                    disabled={ocupado === u.id}
                  >
                    {ocupado === u.id ? <Spinner className="h-5 w-5" /> : u.is_active ? 'Desativar' : 'Ativar'}
                  </Button>
                </div>
                {u.role === 'corretor' && (
                  <Select
                    aria-label={`Corretor de ${u.name ?? u.id}`}
                    value={u.contact_id ?? ''}
                    onChange={async (e) => {
                      setOcupado(u.id)
                      try {
                        await onSalvar({
                          userId: u.id,
                          role: 'corretor',
                          contactId: e.target.value || null,
                          name: u.name,
                          isActive: u.is_active,
                        })
                      } finally {
                        setOcupado(null)
                      }
                    }}
                  >
                    <option value="">Sem corretor vinculado</option>
                    {corretores.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                )}
              </li>
            ))}
          </Lista>
        )}
      </div>
    </Modal>
  )
}
