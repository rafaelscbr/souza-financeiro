import { useMemo, useState } from 'react'
import { KeyRound, Plus, ShieldCheck, UserCheck, UserPlus, UserX, Users } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { useComposicao, type ItemComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Heroi } from '@/components/ui/Heroi'
import { Cartao } from '@/components/ui/Cartao'
import { Lista, Linha } from '@/components/ui/Lista'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { BarraTrilha, LegendaTrilha } from '@/components/ui/Barra'
import { ChipSituacao } from '@/components/ui/Situacao'
import { Chip } from '@/components/ui/Chip'
import { Badge } from '@/components/ui/Badge'
import { Dica } from '@/components/ui/Dica'
import { Button } from '@/components/ui/Button'
import { SidePanel, useParamPainel } from '@/components/ui/SidePanel'
import { FormField, Input, Select } from '@/components/ui/Field'
import { PercentInput } from '@/components/ui/MoneyInput'
import { EstadoVazio } from '@/components/ui/Estados'
import { useToast } from '@/components/ui/Toast'
import { brokerProduction, brokerStatusOf, type BrokerProduction } from '@/lib/sales'
import { situacaoDeTela, fraseDeTempo } from '@/lib/situacao'
import { formatCurrency } from '@/lib/format'
import type { Contact } from '@/types'

type Pilhas = { liberadas: ItemComposicao[]; previstas: ItemComposicao[] }

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
 *
 * COMPOSIÇÃO (9.7, só apresentação; as contas acima não mudaram):
 * 1. Herói ouro "Comissão a pagar" com o apoio "Previsto, depende do
 *    recebimento" (o número do antigo cartão "Ainda não liberado"). Os dois abrem.
 * 2. Dica dos logins sem corretor vinculado, com "Abrir Acessos".
 * 3. UMA lista de corretores: nome + acesso | vendas · VGV (contexto, nunca
 *    receita) · padrão % | a trilha fina | comissão a pagar (abre) com o
 *    previsto embaixo | Editar. A linha abre o painel do corretor
 *    (?corretor=id). A seção "Produção" foi absorvida pela linha.
 * 4. Editar e Acessos em SidePanel. Carregando e erro são da casca.
 */
export function Corretores() {
  const { vendas, contacts, transactions, usuarios, contatosComAcesso, hoje, salvarContato, salvarAcesso } = useAdmin()
  const { showToast } = useToast()
  const { abrir } = useComposicao()
  const [editando, setEditando] = useState<Contact | 'novo' | null>(null)
  const [vinculando, setVinculando] = useState(false)
  const [corretorAberto, abrirCorretor, fecharCorretor] = useParamPainel('corretor')

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
    const mapa = new Map<string, Pilhas>()

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
        const s = situacaoDeTela(bs, i.expected_date, hoje)
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

  const SEM_PARCELA: Pilhas = { liberadas: [], previstas: [] }
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

  const abrirAPagar = () =>
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

  const abrirPrevisto = () =>
    abrir({
      rotulo: 'Previsto',
      titulo: 'Previsão, não dívida',
      explica:
        'Estas comissões só passam a ser devidas quando a construtora pagar a parcela. Até lá não são obrigação e não entram em nenhum total de dívida.',
      total: previsto,
      itens: previstasTodas,
    })

  const abrirDoCorretor = (p: BrokerProduction) => {
    const g = doCorretor(p.contact.id)
    const liberado = soma(g.liberadas)
    const dele = soma(g.previstas)
    abrir({
      rotulo: p.contact.name,
      titulo: `Comissão a pagar para ${p.contact.name}`,
      explica: 'Cada parcela que a imobiliária já recebeu e ainda não repassou a ele. Toque em uma para abrir a venda.',
      total: liberado,
      itens: g.liberadas,
      nota: dele > 0 ? `Além disso, ${formatCurrency(dele)} dependem de a construtora pagar. Não é dívida hoje.` : undefined,
      vazio: 'Nada liberado para ele agora. O que ele tem a receber ainda depende de a construtora pagar.',
    })
  }

  const aberto = corretorAberto ? producao.find((p) => p.contact.id === corretorAberto) ?? null : null

  return (
    <PageLayout
      subtitulo={`${formatCurrency(aPagar)} de comissão a pagar`}
      acoes={
        <>
          <Button size="sm" variant="secundario" icone={KeyRound} onClick={() => setVinculando(true)}>
            Acessos
          </Button>
          <Button size="sm" variant="secundario" icone={Plus} onClick={() => setEditando('novo')}>
            Novo corretor
          </Button>
        </>
      }
    >
      <Heroi
        variante="ouro"
        rotulo="Comissão a pagar"
        valor={aPagar}
        rotuloAcessivel="Ver de quais vendas e parcelas vem a comissão a pagar"
        aoAbrir={abrirAPagar}
        frase="Só a parcela que a imobiliária já recebeu da construtora e ainda não repassou. É o que é dívida hoje — previsão não entra nesta conta."
        apoios={[
          {
            rotulo: 'Previsto, depende do recebimento',
            valor: previsto,
            previsto: true,
            aoAbrir: abrirPrevisto,
            rotuloAcessivel: 'Ver quais parcelas ainda dependem do recebimento',
          },
        ]}
      />

      {semVinculo.length > 0 && (
        <Dica tom="atencao">
          <span className="flex flex-col items-start gap-3">
            <span>
              <strong className="font-medium text-t1">Logins sem corretor vinculado.</strong>{' '}
              {semVinculo.length === 1
                ? '1 pessoa entra e vê "acesso ainda não liberado".'
                : `${semVinculo.length} pessoas entram e veem "acesso ainda não liberado".`}{' '}
              Ligue cada login a um corretor em Acessos.
            </span>
            <Button size="sm" variant="secundario" icone={KeyRound} onClick={() => setVinculando(true)}>
              Abrir Acessos
            </Button>
          </span>
        </Dica>
      )}

      <Cartao>
        <Cartao.Cabecalho
          titulo="Por corretor"
          icone={Users}
          meta={
            producao.length === 0
              ? undefined
              : producao.length === 1
                ? 'um corretor · de qualquer ano'
                : `${producao.length} corretores · de qualquer ano`
          }
        />
        {producao.length === 0 ? (
          <Cartao.Corpo>
            <EstadoVazio
              icone={Users}
              titulo="Nenhum corretor cadastrado"
              descricao="Cadastre quem vende para poder registrar a comissão e, se quiser, dar acesso ao painel dele."
              acao={
                <Button icone={UserPlus} onClick={() => setEditando('novo')}>
                  Cadastrar corretor
                </Button>
              }
            />
          </Cartao.Corpo>
        ) : (
          <>
            <Cartao.Lista
              colunas={{ valor: '11rem', acao: '6rem', fim: true }}
              rotuloAcessivel="Comissão por corretor"
            >
              {producao.map((p) => {
                const g = doCorretor(p.contact.id)
                const liberado = soma(g.liberadas)
                const dele = soma(g.previstas)
                return (
                  <Linha
                    key={p.contact.id}
                    titulo={<TituloDoCorretor p={p} />}
                    meta={<MetaDoCorretor p={p} liberado={liberado} previsto={dele} />}
                    valor={
                      <ValorComOrigem
                        posto="linha"
                        valor={liberado}
                        rotuloAcessivel={`Ver de quais vendas vem a comissão de ${p.contact.name}`}
                        aoAbrir={() => abrirDoCorretor(p)}
                      />
                    }
                    metaValor={
                      <span className="inline-flex items-baseline gap-1">
                        previsto <Valor posto="fato" previsto valor={dele} />
                      </span>
                    }
                    aoClicar={() => abrirCorretor(p.contact.id)}
                    acao={
                      <Button size="sm" variant="secundario" onClick={() => setEditando(p.contact)}>
                        Editar
                      </Button>
                    }
                  />
                )
              })}
            </Cartao.Lista>
            <Cartao.Rodape>
              <LegendaTrilha />
              <span>
                A produção considera todas as vendas não canceladas, de qualquer ano. O corretor vê os números dele
                por ano, no painel próprio.
              </span>
            </Cartao.Rodape>
          </>
        )}
      </Cartao>

      <PainelDoCorretor
        p={aberto}
        pilhas={aberto ? doCorretor(aberto.contact.id) : SEM_PARCELA}
        aoFechar={fecharCorretor}
        aoAbrirComissao={() => aberto && abrirDoCorretor(aberto)}
        aoAbrirPrevisto={() =>
          aberto &&
          abrir({
            rotulo: aberto.contact.name,
            titulo: `Comissão prevista de ${aberto.contact.name}`,
            explica:
              'Estas comissões só passam a ser devidas quando a construtora pagar a parcela. Até lá não são obrigação e não entram em nenhum total de dívida.',
            total: soma(doCorretor(aberto.contact.id).previstas),
            itens: doCorretor(aberto.contact.id).previstas,
            vazio: 'Nenhuma parcela prevista.',
          })
        }
        aoEditar={() => {
          if (!aberto) return
          fecharCorretor()
          setEditando(aberto.contact)
        }}
      />

      <EditarCorretor
        key={editando === null ? 'fechado' : editando === 'novo' ? 'novo' : editando.id}
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
    </PageLayout>
  )
}

const padraoDe = (c: Contact) => (c as Contact & { default_broker_pct?: number | null }).default_broker_pct
const ehDono = (c: Contact) => (c as Contact & { is_owner?: boolean }).is_owner === true

/** Nome + acesso ao painel próprio + "você". */
function TituloDoCorretor({ p }: { p: BrokerProduction }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="min-w-0 truncate">{p.contact.name}</span>
      {p.hasAccess && (
        <Chip tom="sucesso" icone={ShieldCheck}>
          com acesso
        </Chip>
      )}
      {ehDono(p.contact) && <Badge>você</Badge>}
    </span>
  )
}

/**
 * Vendas · VGV · padrão, e a trilha fina dos três estados da comissão dele.
 * VGV é contexto de produção, nunca receita: vem em meta, sem cor. Quando o
 * sistema não sabe o VGV, diz em texto, não em zero.
 */
function MetaDoCorretor({ p, liberado, previsto }: { p: BrokerProduction; liberado: number; previsto: number }) {
  const padrao = padraoDe(p.contact)
  const semVgv = p.sales > 0 && p.salesWithoutVgv === p.sales
  return (
    <span className="flex flex-col gap-2">
      <span className="flex flex-wrap items-baseline gap-x-1">
        <span>
          {p.sales} {p.sales === 1 ? 'venda' : 'vendas'}
        </span>
        <span aria-hidden>·</span>
        {semVgv ? (
          <span>VGV não informado</span>
        ) : (
          <>
            <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
              VGV <Valor valor={p.vgv} posto="fato" />
            </span>
            {p.salesWithoutVgv > 0 && (
              <span>
                ({p.salesWithoutVgv} {p.salesWithoutVgv === 1 ? 'venda sem valor' : 'vendas sem valor'} informado)
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
      </span>
      {/*
       * VENDA DE PESSOA FÍSICA (21/09/2026): é 100% dele e o dinheiro não
       * passa pela imobiliária. Fica nesta linha à parte, fora da trilha
       * acima, justamente para ninguém somar com o que a empresa deve.
       */}
      {p.personalSales > 0 && (
        <span className="flex flex-wrap items-baseline gap-x-1 text-t3">
          <span>
            {p.personalSales === 1 ? 'mais 1 venda como pessoa física' : `mais ${p.personalSales} vendas como pessoa física`}
          </span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
            <Valor valor={p.personalTotal} posto="fato" /> 100% dele
          </span>
          <span aria-hidden>·</span>
          <span>pagamento direto, fora da imobiliária</span>
        </span>
      )}
      <BarraTrilha
        className="w-full max-w-[20rem]"
        recebido={p.paid}
        liberado={liberado}
        previsto={previsto}
        rotuloAcessivel={`${p.contact.name}: ${formatCurrency(p.paid)} já pagos a ele, ${formatCurrency(liberado)} liberados a pagar e ${formatCurrency(previsto)} dependendo da construtora.`}
      />
    </span>
  )
}

/**
 * O painel do corretor (?corretor=id): dados, percentual, acesso e as parcelas
 * que formam os números da linha dele. Cada parcela abre a venda. Os totais
 * são os mesmos da linha (mesmas pilhas, mesma soma).
 */
function PainelDoCorretor({
  p,
  pilhas,
  aoFechar,
  aoAbrirComissao,
  aoAbrirPrevisto,
  aoEditar,
}: {
  p: BrokerProduction | null
  pilhas: Pilhas
  aoFechar: () => void
  aoAbrirComissao: () => void
  aoAbrirPrevisto: () => void
  aoEditar: () => void
}) {
  const liberado = soma2(pilhas.liberadas)
  const dele = soma2(pilhas.previstas)
  const padrao = p ? padraoDe(p.contact) : null
  return (
    <SidePanel
      aberto={!!p}
      aoFechar={aoFechar}
      titulo={p?.contact.name ?? 'Corretor'}
      subtitulo={p ? (p.hasAccess ? 'com acesso ao painel próprio' : 'sem acesso ao painel próprio') : undefined}
      rodape={
        <Button variant="secundario" onClick={aoEditar}>
          Editar
        </Button>
      }
    >
      {p && (
        <div className="flex flex-col gap-8">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 text-texto-corrido">
            <dt className="text-t-meta">Vendas</dt>
            <dd className="text-t1">
              <MetaDoCorretor p={p} liberado={liberado} previsto={dele} />
            </dd>
            <dt className="text-t-meta">Percentual padrão</dt>
            <dd className="text-t1">{padrao != null ? `${padrao}%` : 'não informado'}</dd>
            <dt className="text-t-meta">Telefone</dt>
            <dd className="min-w-0 truncate text-t1">{p.contact.phone || 'não informado'}</dd>
            <dt className="text-t-meta">E-mail</dt>
            <dd className="min-w-0 truncate text-t1">{p.contact.email || 'não informado'}</dd>
          </dl>

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-heading text-t1 text-titulo-secao">Comissão a pagar</h3>
              <ValorComOrigem
                posto="destaque"
                valor={liberado}
                rotuloAcessivel={`Ver de quais vendas vem a comissão de ${p.contact.name}`}
                aoAbrir={aoAbrirComissao}
              />
            </div>
            <ParcelasDoCorretor itens={pilhas.liberadas} vazio="Nada liberado para ele agora." rotulo="Parcelas liberadas" />
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-heading text-t1 text-titulo-secao">Previsto, depende do recebimento</h3>
              <ValorComOrigem
                posto="destaque"
                previsto
                valor={dele}
                rotuloAcessivel={`Ver quais parcelas de ${p.contact.name} ainda dependem do recebimento`}
                aoAbrir={aoAbrirPrevisto}
              />
            </div>
            <ParcelasDoCorretor itens={pilhas.previstas} vazio="Nenhuma parcela prevista." rotulo="Parcelas previstas" />
          </section>
        </div>
      )}
    </SidePanel>
  )
}

const soma2 = (l: ItemComposicao[]) => Math.round(l.reduce((s, i) => s + i.valor, 0) * 100) / 100

function ParcelasDoCorretor({ itens, vazio, rotulo }: { itens: ItemComposicao[]; vazio: string; rotulo: string }) {
  if (itens.length === 0) return <p className="text-texto-corrido text-t3">{vazio}</p>
  return (
    <Lista contexto="sobreposicao" colunas={{ situacao: true, valor: true, fim: true }} rotuloAcessivel={rotulo}>
      {itens.map((i) => (
        <Linha
          key={i.id}
          titulo={i.idx != null && i.count != null ? `${i.titulo} · parcela ${i.idx}/${i.count}` : i.titulo}
          meta={i.meta}
          situacao={i.situacao ? <ChipSituacao situacao={i.situacao} /> : undefined}
          valor={i.situacao === 'prevista' ? <Valor posto="linha" previsto valor={i.valor} /> : <Valor posto="linha" valor={i.valor} />}
          para={i.para ? `${i.para}?parcela=${i.id}` : undefined}
        />
      ))}
    </Lista>
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
  const [pct, setPct] = useState<number | null>(existente ? padraoDe(existente) ?? null : null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const salvar = async () => {
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
  }

  return (
    <SidePanel
      aberto={!!alvo}
      aoFechar={onFechar}
      titulo={existente ? 'Editar corretor' : 'Novo corretor'}
      largura="lg"
      rodape={
        <>
          <Button variant="secundario" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button carregando={salvando} onClick={salvar}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <FormField label="Nome" htmlFor="c-nome">
          <Input id="c-nome" data-foco-inicial value={nome} onChange={(e) => setNome(e.target.value)} />
        </FormField>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-4">
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
        <FormField label="Percentual padrão" htmlFor="c-pct" hint="preenche o formulário de venda; dá para mudar em cada venda">
          <PercentInput id="c-pct" value={pct} onChange={setPct} />
        </FormField>
        {/* Erro de salvar, não de dinheiro: tinta de erro, com a palavra. */}
        {erro && (
          <p className="text-texto-corrido text-error-ink" role="alert">
            {erro}
          </p>
        )}
      </div>
    </SidePanel>
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
    <SidePanel aberto={aberto} aoFechar={onFechar} titulo="Acessos ao sistema" subtitulo="Quem entra e o que cada um vê" largura="lg">
      <div className="flex flex-col gap-6">
        <Dica>
          <span className="flex flex-col gap-2">
            <strong className="font-medium text-t1">Como dar acesso a um corretor</strong>
            <span>1. No painel do Supabase: Authentication → Users → Invite user, com o e-mail dele.</span>
            <span>2. Ele recebe o convite e cria a senha.</span>
            <span>3. Volte aqui e ligue o login ao corretor na lista abaixo.</span>
            <span className="text-t3">
              Criar usuário exige chave de administração, que não pode ficar no navegador — por isso essa parte é no
              painel.
            </span>
          </span>
        </Dica>

        {usuarios.length === 0 ? (
          <p className="text-texto-corrido text-t3">Nenhum usuário além de você.</p>
        ) : (
          <div role="list" aria-label="Usuários" className="flex flex-col">
            {usuarios.map((u) => (
              <div role="listitem" key={u.id} className="flex flex-col gap-3 border-t border-fio-linha py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="truncate text-texto-titulo text-t1">{u.name ?? u.email ?? u.id.slice(0, 8)}</p>
                    <p className="text-texto-meta text-t-meta">
                      {u.role === 'admin' ? 'administrador' : 'corretor'}
                      {u.is_active ? '' : ' · desativado'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={u.is_active ? 'perigo' : 'secundario'}
                    icone={u.is_active ? UserX : UserCheck}
                    carregando={ocupado === u.id}
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
                  >
                    {u.is_active ? 'Desativar' : 'Ativar'}
                  </Button>
                </div>
                {u.role === 'corretor' && (
                  <Select
                    aria-label={`Corretor de ${u.name ?? u.id}`}
                    value={u.contact_id ?? ''}
                    disabled={ocupado === u.id}
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
              </div>
            ))}
          </div>
        )}
      </div>
    </SidePanel>
  )
}
