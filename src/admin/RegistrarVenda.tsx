import { useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Calculator,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ListOrdered,
  Percent,
  Plus,
  type LucideIcon,
} from 'lucide-react'
import { useAdmin } from './AdminData'
import { SidePanel } from '@/components/ui/SidePanel'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select, Textarea } from '@/components/ui/Field'
import { CurrencyInput, PercentInput } from '@/components/ui/MoneyInput'
import { FiltrosRapidos } from '@/components/ui/FiltrosRapidos'
import { useToast } from '@/components/ui/Toast'
import { Demonstrativo } from '@/components/ui/Demonstrativo'
import { Icone } from '@/components/ui/Icone'
import { Valor } from '@/components/ui/Valor'
import { Selo } from '@/components/ui/Selo'
import { FraseDeTempo } from '@/components/ui/Situacao'
import { formatCurrency, toDateOnly } from '@/lib/format'
import { previewCascade, suggestInstallments } from '@/lib/sales'
import type { LinhaDemonstrativo } from '@/lib/linhasDaVenda'
import { cn } from '@/lib/utils'
import type { NewInstallment } from '@/types'

/*
 * REGISTRAR UMA VENDA (9.6, 7.9, 7.10).
 *
 * Uma venda carrega 17 campos no payload (`NewSale`), e quatro deles —
 * parceria, nota fiscal, ISS retido, percentual do corretor — são EXCEÇÃO.
 *
 * Painel lateral `lg` (672px) com rodapé fixo. OS TRÊS PASSOS CONTINUAM: a
 * planta 9.6 junta tudo numa rolagem só, mas a validação acontece na troca de
 * passo e a entrada no passo 3 cria a primeira parcela com a comissão daquele
 * momento. Juntar mudaria o que é validado e quando, e o que é gravado; então
 * cada passo virou um bloco com nome, sem caixa dentro do painel.
 *
 * Dentro do passo, a exceção fica RECOLHIDA com o estado escrito na dobra
 * ("nota fiscal com Simples de 6% · construtora retém 3% de ISS").
 *
 * A prévia usa `previewCascade` e o Demonstrativo, na ordem da migração 009.
 * O painel só fecha e mostra o toast depois que o banco confirma; em falha,
 * o que foi digitado continua e o erro aparece no rodapé, junto do botão.
 *
 * O que NÃO mudou: a conta mora em `previewCascade` e no banco; nenhuma
 * validação foi afrouxada; o payload é o mesmo.
 */
export function RegistrarVenda({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { costCenters, contacts, registrarVenda } = useAdmin()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [passo, setPasso] = useState(1)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Qual dobra de exceção está aberta. Uma por vez: duas abertas devolvem a
  // folha à parede de campos que o recolhimento existe para desfazer.
  const [painel, setPainel] = useState<'parceria' | 'impostos' | 'observacao' | null>(null)
  // Fechar com dados preenchidos pede confirmação antes de descartar (9.6).
  const [descartar, setDescartar] = useState(false)
  const idForm = useId()

  // passo 1
  const [empreendimento, setEmpreendimento] = useState('')
  const [unidade, setUnidade] = useState('')
  const [cliente, setCliente] = useState('')
  const [dataVenda, setDataVenda] = useState(toDateOnly(new Date()))
  const [valorImovel, setValorImovel] = useState<number | null>(null)

  // passo 2
  const [pctComissao, setPctComissao] = useState<number | null>(null)
  const [parceria, setParceria] = useState(false)
  const [parceiro, setParceiro] = useState('')
  const [pctSouza, setPctSouza] = useState<number | null>(50)
  const [comissaoSouza, setComissaoSouza] = useState<number | null>(null)
  const [comissaoManual, setComissaoManual] = useState(false)
  const [temNota, setTemNota] = useState(true)
  const [pctSimples, setPctSimples] = useState<number | null>(6)
  const [retemIss, setRetemIss] = useState(false)
  const [pctIss, setPctIss] = useState<number | null>(3)
  const [corretor, setCorretor] = useState('')
  const [pctCorretor, setPctCorretor] = useState<number | null>(null)

  // passo 3
  const [parcelas, setParcelas] = useState<NewInstallment[]>([])
  const [observacao, setObservacao] = useState('')

  const empreendimentos = useMemo(() => costCenters.filter((c) => c.is_active), [costCenters])
  const corretores = useMemo(() => contacts.filter((c) => c.type === 'broker' && c.is_active), [contacts])

  // Reinicia a cada abertura: modal montado permanentemente guarda o estado
  // anterior e a segunda venda sai com os dados da primeira.
  useEffect(() => {
    if (!aberto) return
    setPasso(1)
    setErro(null)
    setPainel(null)
    setDescartar(false)
    setEmpreendimento('')
    setUnidade('')
    setCliente('')
    setDataVenda(toDateOnly(new Date()))
    setValorImovel(null)
    setPctComissao(null)
    setParceria(false)
    setParceiro('')
    setPctSouza(50)
    setComissaoSouza(null)
    setComissaoManual(false)
    setTemNota(true)
    setPctSimples(6)
    setRetemIss(false)
    setPctIss(3)
    setCorretor('')
    setPctCorretor(null)
    setParcelas([])
    setObservacao('')
  }, [aberto])

  // O empreendimento já sabe se a construtora retém ISS e qual a comissão
  // habitual — é o que faz o formulário se preencher sozinho.
  function escolherEmpreendimento(id: string) {
    setEmpreendimento(id)
    const cc = costCenters.find((c) => c.id === id) as
      | (typeof costCenters)[number] & { retains_iss?: boolean; iss_pct?: number; default_commission_pct?: number }
      | undefined
    if (!cc) return
    if (cc.retains_iss != null) setRetemIss(!!cc.retains_iss)
    if (cc.iss_pct != null) setPctIss(Number(cc.iss_pct))
    if (cc.default_commission_pct != null && pctComissao == null) setPctComissao(Number(cc.default_commission_pct))
  }

  function escolherCorretor(id: string) {
    setCorretor(id)
    const c = contacts.find((x) => x.id === id) as
      | (typeof contacts)[number] & { default_broker_pct?: number | null }
      | undefined
    if (c?.default_broker_pct != null) setPctCorretor(Number(c.default_broker_pct))
  }

  const comissaoNegocio =
    valorImovel != null && pctComissao != null ? Math.round(valorImovel * pctComissao) / 100 : null
  const comissaoCalculada =
    comissaoNegocio == null
      ? null
      : parceria && pctSouza != null
        ? Math.round(comissaoNegocio * pctSouza) / 100
        : comissaoNegocio
  const comissao = comissaoManual ? comissaoSouza ?? 0 : comissaoCalculada ?? 0

  const soma = Math.round(parcelas.reduce((s, p) => s + p.amount, 0) * 100) / 100
  const fecha = Math.abs(soma - comissao) <= 0.01
  const diferenca = Math.round((comissao - soma) * 100) / 100

  const previa = useMemo(
    () =>
      previewCascade({
        amount: comissao,
        issuesInvoice: temNota,
        simplesPct: pctSimples ?? 0,
        retainsIss: retemIss,
        issPct: pctIss ?? 0,
        brokerPct: corretor ? pctCorretor : null,
      }),
    [comissao, temNota, pctSimples, retemIss, pctIss, corretor, pctCorretor],
  )

  function gerarParcelas(n: number) {
    if (comissao <= 0) return
    const base = parcelas[0]?.expected_date ?? toDateOnly(new Date())
    setParcelas(suggestInstallments(comissao, n, base))
  }

  function irPara(n: number) {
    setErro(null)
    if (n === 2) {
      if (!empreendimento && !unidade && !cliente) {
        return setErro(
          'Esta venda ainda não tem como ser identificada na lista. Escolha o empreendimento, informe a unidade ou escreva o nome de quem comprou — qualquer um dos três resolve.',
        )
      }
    }
    if (n === 3) {
      if (comissao <= 0) {
        return setErro(
          'A comissão da imobiliária está em zero. Informe o valor do imóvel e o percentual, ou digite a comissão direto no campo "Comissão da imobiliária".',
        )
      }
      if (corretor && !pctCorretor) {
        return setErro(
          'O corretor está escolhido e o percentual dele está vazio. Informe o % do corretor, ou volte o campo Corretor para "Nenhum".',
        )
      }
      if (parcelas.length === 0) setParcelas(suggestInstallments(comissao, 1, toDateOnly(new Date())))
    }
    setPasso(n)
  }

  async function salvar() {
    setErro(null)
    if (!fecha) {
      return setErro(
        `As parcelas somam ${formatCurrency(soma)} e a comissão é ${formatCurrency(comissao)}. ${textoDaDiferenca(diferenca)}`,
      )
    }
    const titulo = [
      unidade ? `Unid. ${unidade}` : null,
      empreendimentos.find((e) => e.id === empreendimento)?.name ?? null,
      cliente ? `(${cliente})` : null,
    ]
      .filter(Boolean)
      .join(' — ')
    setSalvando(true)
    try {
      const id = await registrarVenda({
        title: titulo || 'Venda',
        cost_center_id: empreendimento || null,
        unit: unidade || null,
        client_name: cliente || null,
        sale_date: dataVenda,
        property_value: valorImovel,
        commission_pct: pctComissao,
        commission_total: comissao,
        partner_name: parceria ? parceiro || null : null,
        partner_share_pct: parceria ? pctSouza : null,
        issues_invoice: temNota,
        simples_pct: pctSimples ?? 6,
        retains_iss: retemIss,
        iss_pct: retemIss ? pctIss ?? 0 : 0,
        broker_id: corretor || null,
        broker_pct: corretor ? pctCorretor : null,
        notes: observacao || null,
        installments: parcelas,
      })
      showToast({
        message: 'Venda registrada',
        detail: `${formatCurrency(comissao)} de comissão em ${parcelas.length} parcela(s)`,
        actionLabel: 'Abrir',
        onAction: () => navigate(`/vendas/${id}`),
      })
      onFechar()
    } catch (e) {
      /*
       * `registrarVenda` é UMA chamada de `register_sale` no banco, e função de
       * Postgres é transação: ou grava a venda com todas as parcelas, ou não
       * grava nada. Por isso a mensagem pode afirmar que nada ficou pela
       * metade, e o caminho de saída é tentar de novo, não conferir o que
       * sobrou.
       */
      setErro(
        e instanceof Error
          ? `${e.message} A venda não foi gravada; o cadastro é uma gravação única, então nada ficou pela metade.`
          : 'A venda não foi gravada e nada ficou pela metade. Toque em "Registrar venda" outra vez; se repetir, confira a conexão.',
      )
    } finally {
      setSalvando(false)
    }
  }

  const titulosDoPasso = ['A venda', 'A comissão', 'As parcelas']

  const sujo = Boolean(
    empreendimento ||
      unidade ||
      cliente ||
      valorImovel != null ||
      pctComissao != null ||
      parceria ||
      comissaoManual ||
      corretor ||
      parcelas.length > 0 ||
      observacao,
  )

  // Escape, Fechar, véu e Cancelar: com dados preenchidos, pergunta antes.
  function pedirFechar() {
    if (salvando) return
    if (sujo) setDescartar(true)
    else onFechar()
  }

  const previaProps = { previa, comissao, temNota, retemIss, pctSimples, pctIss, pctCorretor }

  return (
    <>
      <SidePanel
        aberto={aberto}
        aoFechar={pedirFechar}
        titulo="Registrar venda"
        subtitulo={`Passo ${passo} de 3 · ${titulosDoPasso[passo - 1]}`}
        largura="lg"
        chaveConteudo={passo}
        rodape={
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {/*
             * O erro mora no rodapé: quem acabou de tocar no botão está com os
             * olhos aqui, e o fim do corpo pode estar fora da tela.
             */}
            {erro && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-caixa border border-error-line bg-error-bg px-4 py-3"
              >
                <span className="flex h-5 shrink-0 items-center text-error-ink">
                  <Icone icone={CircleAlert} tamanho={16} />
                </span>
                <p className="min-w-0 text-texto-corrido text-t1">{erro}</p>
              </div>
            )}
            {/*
             * Dois botões, e só dois: uma saída e uma primária que diz para onde
             * leva. A primária do passo 3 NÃO fica desabilitada quando as
             * parcelas não fecham: a trava está em `salvar()` e explica a conta.
             */}
            <div className="flex flex-wrap items-center justify-end gap-3">
              {/*
               * O resumo mora na mesma fileira dos botões, e não no `resumo` do
               * painel: assim o erro acima ocupa a largura inteira do rodapé. No
               * celular ele ganha a própria linha, acima dos dois botões. Sem
               * comissão ainda não há conta: diz o que falta em vez de um zero.
               */}
              <span className="flex min-w-0 flex-1 flex-col max-sm:w-full max-sm:basis-full max-sm:flex-row max-sm:items-center max-sm:justify-between max-sm:gap-3">
                <span className="text-texto-meta text-t-meta">Fica para a imobiliária</span>
                {comissao > 0 ? (
                  <Valor valor={previa.net} posto="destaque" />
                ) : (
                  <span className="text-nota text-t-meta">aparece quando houver comissão</span>
                )}
              </span>
              {passo > 1 ? (
                <Button
                  type="button"
                  variant="secundario"
                  size="lg"
                  className="max-sm:flex-1"
                  onClick={() => irPara(passo - 1)}
                  disabled={salvando}
                >
                  Voltar
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secundario"
                  size="lg"
                  className="max-sm:flex-1"
                  onClick={pedirFechar}
                  disabled={salvando}
                >
                  Cancelar
                </Button>
              )}
              <Button type="submit" form={idForm} size="lg" className="max-sm:flex-1" carregando={salvando}>
                {passo === 1 ? 'Continuar para a comissão' : passo === 2 ? 'Continuar para as parcelas' : 'Registrar venda'}
              </Button>
            </div>
          </div>
        }
      >
        <form
          id={idForm}
          noValidate
          className="flex flex-col gap-8"
          onSubmit={(e) => {
            e.preventDefault()
            if (salvando) return
            if (passo < 3) irPara(passo + 1)
            else void salvar()
          }}
        >
          {passo === 1 && (
            <Bloco titulo="A venda" icone={Building2}>
              <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                {/*
                 * O empreendimento vem primeiro porque ele PREENCHE o resto: traz o
                 * ISS da construtora e a comissão habitual.
                 */}
                <FormField
                  label="Empreendimento"
                  htmlFor="v-cc"
                  className="sm:col-span-2"
                  hint="a construtora escolhida já traz o ISS e o percentual de comissão habituais"
                >
                  <Select
                    id="v-cc"
                    data-foco-inicial
                    value={empreendimento}
                    onChange={(e) => escolherEmpreendimento(e.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {empreendimentos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.developer ? ` · ${c.developer}` : ''}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Unidade" htmlFor="v-unid" hint="como está no contrato. Ex.: 414-D, apto 1302A">
                  <Input id="v-unid" value={unidade} onChange={(e) => setUnidade(e.target.value)} />
                </FormField>
                <FormField label="Data da venda" htmlFor="v-data" hint="dia/mês/ano">
                  <Input id="v-data" type="date" value={dataVenda} onChange={(e) => setDataVenda(e.target.value)} />
                </FormField>
                <FormField label="Comprador" htmlFor="v-cli" hint="nome de quem assinou">
                  <Input
                    id="v-cli"
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                    placeholder="Nome de quem comprou"
                  />
                </FormField>
                <FormField
                  label="Valor do imóvel"
                  htmlFor="v-vgv"
                  hint="em reais, com centavos. Deixe vazio se ainda não souber — dá para informar a comissão direto"
                >
                  <CurrencyInput id="v-vgv" value={valorImovel} onChange={setValorImovel} />
                </FormField>
              </div>
            </Bloco>
          )}

          {passo === 2 && (
            <>
              <Bloco titulo="A comissão" icone={Percent}>
                <FormField
                  label="% da comissão"
                  htmlFor="v-pct"
                  hint="em %, sobre o valor do imóvel. Use vírgula para decimal: 5,5"
                >
                  <PercentInput id="v-pct" value={pctComissao} onChange={setPctComissao} />
                </FormField>

                {/*
                 * A comissão do negócio é resultado, não campo — então não veste
                 * caixa de campo. Quando falta dado ela diz o que falta.
                 */}
                <p className="flex min-h-8 items-center justify-between gap-3 border-t border-fio-linha pt-3">
                  <span className="text-texto text-t2">Comissão do negócio</span>
                  {comissaoNegocio == null ? (
                    <span className="text-right text-nota text-t-meta">falta o valor do imóvel ou o percentual</span>
                  ) : (
                    <Valor valor={comissaoNegocio} posto="linha" />
                  )}
                </p>

                <Excecao
                  titulo="Venda em parceria"
                  resumo={
                    parceria
                      ? `${parceiro || 'imobiliária parceira'} · ${formatarPct(pctSouza)} da comissão do negócio é da Souza`
                      : 'a comissão inteira é da Souza'
                  }
                  aberta={painel === 'parceria'}
                  aoAlternar={() => setPainel((p) => (p === 'parceria' ? null : 'parceria'))}
                >
                  <Escolha
                    rotulo="Divide a comissão com outra imobiliária?"
                    hint="a parceria reduz a comissão da imobiliária antes de qualquer imposto"
                  >
                    <FiltrosRapidos
                      rotuloAcessivel="Venda em parceria"
                      ativo={parceria ? 'sim' : 'nao'}
                      aoMudar={(v) => setParceria(v === 'sim')}
                      filtros={SIM_NAO}
                    />
                  </Escolha>
                  {parceria && (
                    <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                      <FormField label="Imobiliária parceira" htmlFor="v-parc" hint="o nome que vai no histórico da venda">
                        <Input
                          id="v-parc"
                          value={parceiro}
                          onChange={(e) => setParceiro(e.target.value)}
                          placeholder="Ex.: Rogga"
                        />
                      </FormField>
                      <FormField label="% que é da Souza" htmlFor="v-pctsouza" hint="em %, da comissão do negócio">
                        <PercentInput id="v-pctsouza" value={pctSouza} onChange={setPctSouza} />
                      </FormField>
                    </div>
                  )}
                </Excecao>

                <FormField
                  label="Comissão da imobiliária"
                  htmlFor="v-com"
                  hint={
                    comissaoManual
                      ? 'em reais, informado à mão — é este valor que as parcelas vão somar'
                      : 'em reais, calculado a partir do percentual. Pode ajustar se o contrato traz outro valor'
                  }
                >
                  <CurrencyInput
                    id="v-com"
                    value={comissaoManual ? comissaoSouza : comissaoCalculada}
                    onChange={(v) => {
                      setComissaoManual(true)
                      setComissaoSouza(v)
                    }}
                  />
                </FormField>

                <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <FormField label="Corretor" htmlFor="v-corr" hint="deixe em Nenhum se não há comissão a repassar">
                    <Select id="v-corr" value={corretor} onChange={(e) => escolherCorretor(e.target.value)}>
                      <option value="">Nenhum</option>
                      {corretores.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  {corretor && (
                    <FormField
                      label="% do corretor"
                      htmlFor="v-corrpct"
                      hint="em %, sobre a base — a comissão já descontada de ISS e Simples, nunca sobre o bruto"
                    >
                      <PercentInput id="v-corrpct" value={pctCorretor} onChange={setPctCorretor} />
                    </FormField>
                  )}
                </div>

                <Excecao
                  titulo="Impostos desta venda"
                  resumo={resumoDosImpostos(temNota, pctSimples, retemIss, pctIss)}
                  aberta={painel === 'impostos'}
                  aoAlternar={() => setPainel((p) => (p === 'impostos' ? null : 'impostos'))}
                >
                  <Escolha
                    rotulo="A imobiliária emite nota fiscal?"
                    hint={temNota ? 'com nota, o Simples incide sobre cada recebimento' : 'sem nota, o Simples não incide'}
                  >
                    <FiltrosRapidos
                      rotuloAcessivel="Emite nota fiscal"
                      ativo={temNota ? 'sim' : 'nao'}
                      aoMudar={(v) => setTemNota(v === 'sim')}
                      filtros={SIM_NAO}
                    />
                  </Escolha>
                  {temNota && (
                    <FormField label="% do Simples Nacional" htmlFor="v-simples" hint="em %, sobre a comissão menos o ISS">
                      <PercentInput id="v-simples" value={pctSimples} onChange={setPctSimples} />
                    </FormField>
                  )}
                  <Escolha
                    rotulo="A construtora retém o ISS na fonte?"
                    hint={
                      retemIss
                        ? 'a construtora desconta o ISS antes de pagar a parcela'
                        : 'a construtora paga a parcela cheia'
                    }
                  >
                    <FiltrosRapidos
                      rotuloAcessivel="Construtora retém ISS"
                      ativo={retemIss ? 'sim' : 'nao'}
                      aoMudar={(v) => setRetemIss(v === 'sim')}
                      filtros={SIM_NAO}
                    />
                  </Escolha>
                  {retemIss && (
                    <FormField label="% do ISS" htmlFor="v-isspct" hint="em %, sobre a comissão">
                      <PercentInput id="v-isspct" value={pctIss} onChange={setPctIss} />
                    </FormField>
                  )}
                </Excecao>
              </Bloco>

              <PreviaDaConta {...previaProps} />
            </>
          )}

          {passo === 3 && (
            <>
              <Bloco
                titulo="As parcelas"
                icone={ListOrdered}
                descricao={parcelas.length === 1 ? '1 parcela' : `${parcelas.length} parcelas`}
              >
                {/*
                 * Os números são AÇÕES ("divida em 3 iguais"), não um estado
                 * selecionado: nenhum deles acende quando a lista tem n parcelas.
                 */}
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Dividir a comissão">
                  <span className="text-texto text-t2 max-sm:w-full">Dividir em partes iguais:</span>
                  {[1, 2, 3, 4].map((n) => (
                    <Button
                      key={n}
                      type="button"
                      variant="secundario"
                      size="md"
                      className="num min-w-11"
                      onClick={() => gerarParcelas(n)}
                      disabled={comissao <= 0}
                      aria-label={`Dividir em ${n} ${n === 1 ? 'parcela' : 'parcelas'} iguais`}
                    >
                      {n}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="fantasma"
                    size="md"
                    icone={Plus}
                    onClick={() =>
                      setParcelas((p) => [
                        ...p,
                        {
                          idx: p.length + 1,
                          expected_date: p[p.length - 1]?.expected_date ?? toDateOnly(new Date()),
                          amount: 0,
                        },
                      ])
                    }
                  >
                    Acrescentar parcela
                  </Button>
                </div>

                <p className="text-nota text-t-meta">
                  Contrato de construtora costuma pagar por gatilho, não por mês fixo. Corrija a data e o valor de
                  cada parcela conforme o quadro resumo.
                </p>

                <div role="list" aria-label="Parcelas desta venda" className="flex flex-col border-b border-fio-linha">
                  {parcelas.map((p, i) => (
                    <LinhaDeParcela
                      key={i}
                      parcela={p}
                      indice={i}
                      total={parcelas.length}
                      aoMudarData={(data) =>
                        setParcelas((arr) => arr.map((x, j) => (j === i ? { ...x, expected_date: data } : x)))
                      }
                      aoMudarValor={(v) =>
                        setParcelas((arr) => arr.map((x, j) => (j === i ? { ...x, amount: v ?? 0 } : x)))
                      }
                      aoRemover={() =>
                        setParcelas((arr) => arr.filter((_, j) => j !== i).map((x, j) => ({ ...x, idx: j + 1 })))
                      }
                    />
                  ))}
                </div>

                {/*
                 * O fechamento é uma conta, então é escrito como conta: fio acima
                 * do total e a diferença dita em reais.
                 */}
                <div className="flex flex-col gap-2">
                  <Demonstrativo
                    rotuloAcessivel="As parcelas contra a comissão"
                    linhas={[
                      { chave: 'bruto', rotulo: 'Comissão da imobiliária', sinal: '+', valor: comissao },
                      { chave: 'fica', rotulo: 'Soma das parcelas', sinal: '=', valor: soma },
                    ]}
                  />
                  {fecha ? (
                    <p className="flex items-start gap-2 text-nota text-t-meta">
                      <span className="flex h-4 shrink-0 items-center text-success-ink">
                        <Icone icone={CircleCheck} tamanho={12} />
                      </span>
                      Fecha com a comissão da imobiliária.
                    </p>
                  ) : (
                    <p className="flex items-start gap-2 text-texto font-medium text-error-ink" role="alert">
                      <span className="flex h-5 shrink-0 items-center">
                        <Icone icone={CircleAlert} tamanho={16} />
                      </span>
                      {textoDaDiferenca(diferenca)}
                    </p>
                  )}
                </div>

                <Excecao
                  titulo="Observação"
                  resumo={observacao ? observacao : 'nenhuma observação nesta venda'}
                  aberta={painel === 'observacao'}
                  aoAlternar={() => setPainel((p) => (p === 'observacao' ? null : 'observacao'))}
                >
                  <FormField
                    label="O que registrar sobre esta venda"
                    htmlFor="v-obs"
                    hint="texto livre, fica no histórico da venda. Opcional"
                  >
                    <Textarea
                      id="v-obs"
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      placeholder="Ex.: 50% na assinatura e 50% quando o comprador atingir 8% pago"
                    />
                  </FormField>
                </Excecao>
              </Bloco>

              <PreviaDaConta {...previaProps} />
            </>
          )}
        </form>
      </SidePanel>

      <ConfirmDialog
        aberto={descartar}
        aoFechar={() => setDescartar(false)}
        titulo="Descartar a venda?"
        descricao="O que foi preenchido neste cadastro some. Nada foi gravado ainda."
        rotuloConfirmar="Descartar"
        aoConfirmar={() => {
          setDescartar(false)
          onFechar()
        }}
      />
    </>
  )
}

/* ------------------------------------------------------------------------- */

const SIM_NAO: { id: 'sim' | 'nao'; rotulo: string }[] = [
  { id: 'sim', rotulo: 'Sim' },
  { id: 'nao', rotulo: 'Não' },
]

/** Percentual como o Brasil escreve: 5,5% e não 5.5%. */
function formatarPct(n: number | null): string {
  return `${(n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

/** O estado dos impostos numa frase, para ler com a dobra fechada. */
function resumoDosImpostos(
  temNota: boolean,
  pctSimples: number | null,
  retemIss: boolean,
  pctIss: number | null,
): string {
  const nota = temNota ? `nota fiscal com Simples de ${formatarPct(pctSimples)}` : 'sem nota fiscal e sem Simples'
  const iss = retemIss ? `construtora retém ${formatarPct(pctIss)} de ISS` : 'construtora não retém ISS'
  return `${nota} · ${iss}`
}

/** O que fazer quando as parcelas não batem com a comissão. */
function textoDaDiferenca(diferenca: number): string {
  return diferenca > 0
    ? `Faltam ${formatCurrency(diferenca)}. Aumente o valor de uma parcela ou acrescente outra.`
    : `Sobram ${formatCurrency(Math.abs(diferenca))}. Reduza o valor de uma parcela ou remova uma.`
}

/** Um bloco com nome dentro do painel: ícone 16 + `titulo-secao`, sem caixa (7.10). */
function Bloco({
  titulo,
  icone,
  descricao,
  separado,
  children,
}: {
  titulo: ReactNode
  icone: LucideIcon
  descricao?: ReactNode
  /** Fio de linha acima: separa o bloco do anterior (9.6). */
  separado?: boolean
  children: ReactNode
}) {
  return (
    <section className={cn('flex flex-col gap-6', separado && 'border-t border-fio-linha pt-8')}>
      <div className="flex min-w-0 items-start gap-2">
        <span className="flex h-6 shrink-0 items-center text-t3">
          <Icone icone={icone} tamanho={16} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-heading text-titulo-secao text-t1">{titulo}</h3>
          {descricao && <p className="text-texto-meta text-t-meta">{descricao}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

/**
 * Rótulo visível para um grupo de escolha. `FormField` emite `<label for=…>`,
 * que não aponta para um radiogroup; o nome acessível vem do `rotuloAcessivel`.
 */
function Escolha({ rotulo, hint, children }: { rotulo: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p aria-hidden className="text-texto-meta font-medium text-t2">
        {rotulo}
      </p>
      {children}
      {hint && <p className="text-nota text-t-meta">{hint}</p>}
    </div>
  )
}

const TRANSICAO_COR: CSSProperties = {
  transitionProperty: 'background-color',
  transitionDuration: 'var(--dur-micro)',
  transitionTimingFunction: 'var(--curva-cor)',
}

/**
 * A DOBRA DA EXCEÇÃO: recolhe o CONTROLE e mantém a INFORMAÇÃO. O resumo diz
 * o que está valendo agora; quem tem a exceção abre e mexe. Fio, não caixa.
 */
function Excecao({
  titulo,
  resumo,
  aberta,
  aoAlternar,
  children,
}: {
  titulo: string
  resumo: string
  aberta: boolean
  aoAlternar: () => void
  children: ReactNode
}) {
  const id = useId()
  return (
    <div className="flex flex-col border-y border-fio-linha">
      <button
        type="button"
        onClick={aoAlternar}
        aria-expanded={aberta}
        aria-controls={id}
        style={TRANSICAO_COR}
        className="flex min-h-14 w-full items-center gap-3 rounded-controle px-2 py-2 text-left hover:bg-linha-hover active:bg-linha-press"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-texto-titulo font-medium text-t1">{titulo}</span>
          <span className="truncate text-texto-meta text-t-meta">{resumo}</span>
        </span>
        <span
          className={cn('flex shrink-0 text-t3', aberta && 'rotate-90')}
          style={{ transitionProperty: 'transform', transitionDuration: 'var(--dur-micro)' }}
        >
          <Icone icone={ChevronRight} tamanho={16} />
        </span>
      </button>
      {aberta && (
        <div id={id} className="flex flex-col gap-6 px-2 pb-6 pt-2">
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * Uma parcela: ordinal no selo, a data com verbo e os dois campos que se
 * corrigem. O número que se ajusta é o mesmo que se compara.
 */
function LinhaDeParcela({
  parcela,
  indice,
  total,
  aoMudarData,
  aoMudarValor,
  aoRemover,
}: {
  parcela: NewInstallment
  indice: number
  total: number
  aoMudarData: (data: string) => void
  aoMudarValor: (valor: number | null) => void
  aoRemover: () => void
}) {
  const id = useId()
  const ordinal = total > 1 ? `${indice + 1}ª de ${total}` : 'Parcela única'
  return (
    <div role="listitem" className="flex flex-col gap-4 border-t border-fio-linha py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex w-7 shrink-0 justify-center">
          <Selo situacao="prevista" idx={parcela.idx} count={total} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-texto-titulo font-medium text-t1">{ordinal}</span>
          <FraseDeTempo situacao="prevista" prevista={parcela.expected_date} className="text-texto-meta text-t-meta" />
        </span>
        {/* Texto em vez de lixeira: ícone solto é o controle mais fácil de tocar por engano. */}
        <Button type="button" variant="fantasma" size="sm" onClick={aoRemover} aria-label={`Remover a parcela ${ordinal}`}>
          Remover
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 pl-10 sm:grid-cols-2">
        <FormField label="Prevista para" htmlFor={`${id}-data`} hint="dia/mês/ano">
          <Input
            id={`${id}-data`}
            type="date"
            value={parcela.expected_date}
            onChange={(e) => aoMudarData(e.target.value)}
          />
        </FormField>
        <FormField label="Valor da parcela" htmlFor={`${id}-valor`} hint="em reais, com centavos">
          <CurrencyInput id={`${id}-valor`} value={parcela.amount} onChange={aoMudarValor} />
        </FormField>
      </div>
    </div>
  )
}

/**
 * A PRÉVIA DA CONTA, antes de gravar, na ordem fixa da migração 009: ISS
 * retido, Simples sobre o que sobrou, corretor sobre a BASE. A base só aparece
 * com corretor: sem ele a base e o líquido são o mesmo número.
 */
function PreviaDaConta({
  previa,
  comissao,
  temNota,
  retemIss,
  pctSimples,
  pctIss,
  pctCorretor,
}: {
  previa: { iss: number; simples: number; base: number; broker: number; net: number }
  comissao: number
  temNota: boolean
  retemIss: boolean
  pctSimples: number | null
  pctIss: number | null
  pctCorretor: number | null
}) {
  if (comissao <= 0) return null
  const fatia = Math.round((previa.net / comissao) * 100)
  const linhas: LinhaDemonstrativo[] = [{ chave: 'bruto', rotulo: 'Comissão da imobiliária', sinal: '+', valor: comissao }]
  if (retemIss)
    linhas.push({
      chave: 'iss',
      rotulo: 'ISS retido na fonte',
      detalhe: `${formatarPct(pctIss)} sobre a comissão`,
      sinal: '−',
      valor: previa.iss,
    })
  if (temNota)
    linhas.push({
      chave: 'simples',
      rotulo: 'Imposto do Simples Nacional',
      detalhe: retemIss
        ? `${formatarPct(pctSimples)} sobre a comissão menos o ISS`
        : `${formatarPct(pctSimples)} sobre a comissão`,
      sinal: '−',
      valor: previa.simples,
    })
  if (previa.broker > 0) {
    linhas.push({ chave: 'base', rotulo: 'Base depois do imposto', sinal: '=', valor: previa.base })
    linhas.push({
      chave: 'corretor',
      rotulo: 'Comissão do corretor',
      detalhe: `base × ${formatarPct(pctCorretor)}`,
      sinal: '−',
      valor: previa.broker,
    })
  }
  linhas.push({ chave: 'fica', rotulo: 'Fica para a imobiliária', sinal: '=', valor: previa.net })
  return (
    <Bloco titulo="O que sobra desta venda" icone={Calculator} separado>
      <div className="flex flex-col gap-2">
        <Demonstrativo linhas={linhas} rotuloAcessivel="O que sobra desta venda" />
        <p className="text-nota text-t-meta">
          {fatia}% da comissão da imobiliária. O dinheiro entra parcela a parcela, na medida em que a construtora
          paga.
        </p>
      </div>
    </Bloco>
  )
}
