import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useAdmin } from './AdminData'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select, Textarea } from '@/components/ui/Field'
import { CurrencyInput, PercentInput } from '@/components/ui/MoneyInput'
import { Segmented } from '@/components/ui/Segmented'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { Secao } from '@/components/ui/Secao'
import { Lista } from '@/components/ui/Lista'
import { Cascata, LinhaCascata, TotalCascata } from '@/components/ui/Cascata'
import { Valor } from '@/components/ui/Valor'
import { Selo } from '@/components/ui/Selo'
import { FraseDeTempo } from '@/components/ui/Situacao'
import { formatCurrency, toDateOnly } from '@/lib/format'
import { previewCascade, suggestInstallments } from '@/lib/sales'
import { cn } from '@/lib/utils'
import type { NewInstallment } from '@/types'

/*
 * REGISTRAR UMA VENDA.
 *
 * Este é o formulário mais longo do app, e o comprimento não é acidente: uma
 * venda carrega 17 campos no payload (`NewSale`), e quatro deles — parceria,
 * nota fiscal, ISS retido, percentual do corretor — são EXCEÇÃO, não regra. A
 * versão anterior punha os 17 no mesmo plano, em três passos que só cortavam o
 * formulário em pedaços: o passo 2 sozinho tinha nove campos visíveis, dos
 * quais cinco não se aplicam à venda típica (à vista, com nota, Simples de 6%,
 * sem parceira).
 *
 * A reorganização tem duas camadas, e é isso que muda o trabalho:
 *
 * 1. OS TRÊS PASSOS CONTINUAM, mas cada um responde a uma pergunta inteira —
 *    qual venda é, quanto sobra dela, quando o dinheiro chega — e cada um tem
 *    UMA ação primária, que diz para onde leva ("Continuar para a comissão").
 *
 * 2. DENTRO DO PASSO, a exceção fica RECOLHIDA, e o estado atual dela fica
 *    escrito em texto na própria dobra: "nota fiscal com Simples de 6% ·
 *    construtora retém 3% de ISS". Recolher sem dizer o estado seria esconder;
 *    o que se recolhe aqui é o CONTROLE, nunca a informação.
 *
 * A prévia da conta usa a mesma cascata do resto do sistema, na ordem fixa da
 * migração 009 (ISS, depois Simples, depois o corretor sobre a base). O
 * formulário mais antigo calculava a comissão do corretor sobre o valor BRUTO
 * e pagava o parceiro a mais — por isso a conta aparece inteira, com o "(−)" e
 * o nome completo de cada tributo, antes de gravar. Conferir antes é mais
 * barato que estornar depois.
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
  // Qual parcela está em edição. A lista se lê como extrato; editar é o desvio.
  const [editando, setEditando] = useState<number | null>(null)

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
    setEditando(null)
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
    setEditando(null)
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

  return (
    <Modal
      open={aberto}
      onClose={onFechar}
      title="Registrar venda"
      description={`Passo ${passo} de 3 · ${titulosDoPasso[passo - 1]}`}
      largura="largo"
      footer={
        /*
         * Dois botões, e só dois: uma primária e uma saída. A primária diz para
         * onde leva, porque "Continuar" três vezes seguidas não informa em que
         * ponto do cadastro a pessoa está.
         *
         * A primária do passo 3 NÃO fica desabilitada quando as parcelas não
         * fecham: botão desabilitado não explica o que falta. A trava continua
         * onde sempre esteve, dentro de `salvar()`, e quem toca recebe a conta
         * da diferença escrita.
         */
        <div className="flex gap-3">
          {passo > 1 ? (
            <Button variant="secondary" onClick={() => irPara(passo - 1)} disabled={salvando}>
              Voltar
            </Button>
          ) : (
            <Button variant="secondary" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
          )}
          {passo < 3 ? (
            <Button variant="primary" className="flex-1" onClick={() => irPara(passo + 1)}>
              Continuar para {passo === 1 ? 'a comissão' : 'as parcelas'}
            </Button>
          ) : (
            <Button variant="primary" className="flex-1" onClick={salvar} disabled={salvando}>
              {salvando && <Spinner className="h-5 w-5" />}
              Registrar venda
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {passo === 1 && (
          <>
            {/*
             * O empreendimento vem primeiro porque ele PREENCHE o resto: traz o
             * ISS da construtora e a comissão habitual. Começar por ele é o que
             * transforma os campos seguintes em conferência em vez de digitação.
             */}
            <FormField
              label="Empreendimento"
              htmlFor="v-cc"
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Unidade" htmlFor="v-unid" hint="como está no contrato. Ex.: 414-D, apto 1302A">
                <Input id="v-unid" value={unidade} onChange={(e) => setUnidade(e.target.value)} />
              </FormField>
              <FormField label="Data da venda" htmlFor="v-data" hint="dia/mês/ano">
                <Input id="v-data" type="date" value={dataVenda} onChange={(e) => setDataVenda(e.target.value)} />
              </FormField>
            </div>

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
          </>
        )}

        {passo === 2 && (
          <>
            <FormField
              label="% da comissão"
              htmlFor="v-pct"
              hint="em %, sobre o valor do imóvel. Use vírgula para decimal: 5,5"
            >
              <PercentInput id="v-pct" value={pctComissao} onChange={setPctComissao} />
            </FormField>

            {/*
             * A comissão do negócio é resultado, não campo — então não veste
             * caixa de campo. E quando falta dado ela diz o que falta, em vez
             * de mostrar um travessão ou um zero que pareceria resposta.
             */}
            <p className="flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
              <span className="text-base text-content-muted">Comissão do negócio</span>
              {comissaoNegocio == null ? (
                <span className="text-sm text-content-faint">falta o valor do imóvel ou o percentual</span>
              ) : (
                <Valor valor={comissaoNegocio} posto="fato" />
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
                <Segmented
                  ariaLabel="Venda em parceria"
                  value={parceria ? 'sim' : 'nao'}
                  onChange={(v) => setParceria(v === 'sim')}
                  options={[
                    { value: 'sim', label: 'Sim' },
                    { value: 'nao', label: 'Não' },
                  ]}
                />
              </Escolha>
              {parceria && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <Segmented
                  ariaLabel="Emite nota fiscal"
                  value={temNota ? 'sim' : 'nao'}
                  onChange={(v) => setTemNota(v === 'sim')}
                  options={[
                    { value: 'sim', label: 'Sim' },
                    { value: 'nao', label: 'Não' },
                  ]}
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
                <Segmented
                  ariaLabel="Construtora retém ISS"
                  value={retemIss ? 'sim' : 'nao'}
                  onChange={(v) => setRetemIss(v === 'sim')}
                  options={[
                    { value: 'sim', label: 'Sim' },
                    { value: 'nao', label: 'Não' },
                  ]}
                />
              </Escolha>
              {retemIss && (
                <FormField label="% do ISS" htmlFor="v-isspct" hint="em %, sobre a comissão">
                  <PercentInput id="v-isspct" value={pctIss} onChange={setPctIss} />
                </FormField>
              )}
            </Excecao>

            <PreviaDaConta
              previa={previa}
              comissao={comissao}
              temNota={temNota}
              retemIss={retemIss}
              pctSimples={pctSimples}
              pctIss={pctIss}
              pctCorretor={pctCorretor}
            />
          </>
        )}

        {passo === 3 && (
          <>
            <Secao
              titulo="As parcelas"
              subtotal={
                <span className="text-sm text-content-muted">
                  {parcelas.length === 1 ? '1 parcela' : `${parcelas.length} parcelas`}
                </span>
              }
            >
              {/*
               * Os números são AÇÕES ("divida em 3 iguais"), não um estado
               * selecionado. A versão anterior acendia o botão quando
               * `parcelas.length === n`, e aí quatro parcelas de valores
               * irregulares, digitadas à mão, apareciam como se fossem a
               * sugestão de quatro iguais — o botão mentia sobre o conteúdo da
               * lista.
               */}
              <div className="flex flex-wrap items-center gap-2 pt-1" role="group" aria-label="Dividir a comissão">
                <span className="text-base text-content-muted">Dividir em partes iguais:</span>
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => gerarParcelas(n)}
                    disabled={comissao <= 0}
                    aria-label={`Dividir em ${n} ${n === 1 ? 'parcela' : 'parcelas'} iguais`}
                    className="cifra h-toque w-toque rounded-lg border border-line bg-surface-2 text-base font-semibold text-content transition-colors hover:bg-action-soft disabled:opacity-50"
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setParcelas((p) => [
                      ...p,
                      {
                        idx: p.length + 1,
                        expected_date: p[p.length - 1]?.expected_date ?? toDateOnly(new Date()),
                        amount: 0,
                      },
                    ])
                    // A parcela nova nasce em R$ 0,00 e sem data própria: abrir
                    // já editando poupa o toque que ninguém quer dar duas vezes.
                    setEditando(parcelas.length)
                  }}
                  className="inline-flex h-toque items-center rounded-lg border border-line px-3.5 text-base text-content-muted transition-colors hover:bg-action-soft hover:text-content"
                >
                  Acrescentar parcela
                </button>
              </div>

              <p className="mt-2 text-sm text-content-faint">
                Contrato de construtora costuma pagar por gatilho, não por mês fixo. Toque na parcela
                para corrigir a data e o valor conforme o quadro resumo.
              </p>

              {/*
               * A lista se lê como extrato: selo com o ordinal real, a frase de
               * tempo com verbo, e o dinheiro no degrau de comparação pousando
               * numa única borda direita. É o que deixa R$ 201,61 e R$ 2.692,89
               * se compararem por contagem de dígitos, sem ler.
               */}
              <Lista className="mt-3">
                {parcelas.map((p, i) => (
                  <LinhaDeParcela
                    key={i}
                    parcela={p}
                    indice={i}
                    total={parcelas.length}
                    aberta={editando === i}
                    aoAlternar={() => setEditando((e) => (e === i ? null : i))}
                    aoMudarData={(data) =>
                      setParcelas((arr) => arr.map((x, j) => (j === i ? { ...x, expected_date: data } : x)))
                    }
                    aoMudarValor={(v) =>
                      setParcelas((arr) => arr.map((x, j) => (j === i ? { ...x, amount: v ?? 0 } : x)))
                    }
                    aoRemover={() => {
                      setParcelas((arr) => arr.filter((_, j) => j !== i).map((x, j) => ({ ...x, idx: j + 1 })))
                      setEditando(null)
                    }}
                  />
                ))}
              </Lista>

              {/*
               * O fechamento é uma conta, então é escrito como conta: fio
               * estrutural acima do total e a diferença dita em reais. "As
               * parcelas não fecham" sozinho obriga a fazer a subtração de
               * cabeça — e é exatamente essa subtração que trava o cadastro.
               */}
              <Cascata densidade="compacta" className="mt-4">
                <LinhaCascata rotulo="Comissão da imobiliária" valor={comissao} />
                <TotalCascata
                  rotulo="Soma das parcelas"
                  valor={soma}
                  tinta={fecha ? undefined : 'text-critical-ink'}
                  nota={fecha ? 'Fecha com a comissão da imobiliária.' : undefined}
                />
              </Cascata>
              {!fecha && (
                <p className="mt-2 text-base text-critical-ink" role="alert">
                  {textoDaDiferenca(diferenca)}
                </p>
              )}
            </Secao>

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

            <PreviaDaConta
              previa={previa}
              comissao={comissao}
              temNota={temNota}
              retemIss={retemIss}
              pctSimples={pctSimples}
              pctIss={pctIss}
              pctCorretor={pctCorretor}
            />
          </>
        )}

        {/*
         * O erro fica no PÉ do conteúdo, encostado no rodapé: quem acabou de
         * tocar em "Continuar" está com os olhos ali, e é ali que a resposta
         * precisa aparecer.
         */}
        {erro && (
          <p
            className="rounded-lg bg-critical-field px-3.5 py-2.5 text-base text-critical-ink"
            role="alert"
          >
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------------- */

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

/**
 * Rótulo para um controle que NÃO é um `<input>`.
 *
 * `FormField` emite um `<label for=…>`, e um `label` apontando para um
 * `radiogroup` não aponta para nada — o leitor de tela anuncia o grupo sem
 * nome. Aqui o nome acessível vem do `ariaLabel` do próprio `Segmented`, e este
 * texto é só a versão visível.
 */
function Escolha({ rotulo, hint, children }: { rotulo: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-content-muted">{rotulo}</p>
      {children}
      {hint && <p className="mt-1 text-xs text-content-faint">{hint}</p>}
    </div>
  )
}

/**
 * A DOBRA DA EXCEÇÃO.
 *
 * Recolhe o CONTROLE e mantém a INFORMAÇÃO: o resumo diz, em texto corrido, o
 * que está valendo agora ("nota fiscal com Simples de 6% · construtora retém 3%
 * de ISS"). Quem cadastra a venda típica lê a frase e segue; quem tem a exceção
 * abre e mexe.
 *
 * É fio e não caixa: `--c-base` e `--c-surface` são o mesmo hex, então não
 * existe cartão para desenhar dentro da folha. E é chevron, o único glifo de
 * navegação do sistema, girado 90° quando aberto.
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
    <div className="border-y border-line">
      <button
        type="button"
        onClick={aoAlternar}
        aria-expanded={aberta}
        aria-controls={id}
        className="flex min-h-toque w-full items-center gap-3 py-2 text-left transition-colors hover:bg-action-soft"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-medium text-content">{titulo}</span>
          <span className="truncate text-sm text-content-faint">{resumo}</span>
        </span>
        <ChevronRight
          className={cn('h-4 w-4 shrink-0 text-content-faint transition-transform', aberta && 'rotate-90')}
          aria-hidden
        />
      </button>
      {aberta && (
        <div id={id} className="space-y-4 pb-4 pt-1">
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * Uma parcela: linha de extrato fechada, formulário aberto.
 *
 * Fechada, ela é o que se confere — ordinal no selo, a data com verbo e o valor
 * no degrau de comparação. Aberta, ela é o que se corrige. As duas coisas no
 * mesmo lugar significam que o número que se ajusta é o mesmo número que se
 * compara, sem um segundo quadro repetindo os mesmos valores.
 */
function LinhaDeParcela({
  parcela,
  indice,
  total,
  aberta,
  aoAlternar,
  aoMudarData,
  aoMudarValor,
  aoRemover,
}: {
  parcela: NewInstallment
  indice: number
  total: number
  aberta: boolean
  aoAlternar: () => void
  aoMudarData: (data: string) => void
  aoMudarValor: (valor: number | null) => void
  aoRemover: () => void
}) {
  const id = useId()
  const ordinal = total > 1 ? `${indice + 1}ª de ${total}` : 'Parcela única'
  return (
    <li>
      <button
        type="button"
        onClick={aoAlternar}
        aria-expanded={aberta}
        aria-controls={id}
        className="flex min-h-[3.5rem] w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-action-soft"
      >
        <span className="flex w-6 shrink-0 justify-center pt-0.5">
          <Selo situacao="prevista" idx={parcela.idx} count={total} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-medium text-content">{ordinal}</span>
          <FraseDeTempo situacao="prevista" prevista={parcela.expected_date} />
        </span>
        {/* Previsto não recebe cor tônica: só tinta neutra. */}
        <Valor valor={parcela.amount} posto="linha" tinta="text-content-muted" />
        <ChevronRight
          className={cn('h-4 w-4 shrink-0 text-content-faint transition-transform', aberta && 'rotate-90')}
          aria-hidden
        />
      </button>

      {aberta && (
        <div id={id} className="space-y-4 pb-4 pl-9 pr-1 pt-1">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          {/* Texto em vez de lixeira: um ícone de 16px num alvo de 36px era o
              controle mais fácil de tocar por engano da tela. */}
          <Button variant="ghost" onClick={aoRemover}>
            Remover esta parcela
          </Button>
        </div>
      )}
    </li>
  )
}

/**
 * A PRÉVIA DA CONTA — a cascata do sistema, antes de gravar.
 *
 * A ordem é a fixa da migração 009, e é a ordem que o formulário antigo errava:
 * ISS retido, depois Simples sobre o que sobrou, depois o corretor sobre a
 * BASE. Cada subtração traz o "(−)" e o nome inteiro do tributo, e cada uma diz
 * sobre o que incide — "6% sobre a comissão menos o ISS" —, porque a pergunta
 * que trava o cadastro nunca é quanto, é sobre o quê.
 *
 * A linha da base só aparece quando existe corretor: sem ele a base e o líquido
 * são o mesmo número, e dois totais iguais um sobre o outro não somam
 * informação.
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
  return (
    // O `pt-4` repõe o respiro de 32px entre seções: o `space-y-4` da folha tem
    // seletor mais específico que o `mt-8` do próprio `Secao` e o venceria.
    <Secao titulo="O que sobra desta venda" variante="simples" className="pt-4">
      <Cascata className="pt-1">
        <LinhaCascata rotulo="Comissão da imobiliária" valor={comissao} />
        {retemIss && (
          <LinhaCascata
            rotulo="ISS retido na fonte"
            valor={previa.iss}
            subtracao
            detalhe={`${formatarPct(pctIss)} sobre a comissão`}
          />
        )}
        {temNota && (
          <LinhaCascata
            rotulo="Imposto do Simples Nacional"
            valor={previa.simples}
            subtracao
            detalhe={
              retemIss
                ? `${formatarPct(pctSimples)} sobre a comissão menos o ISS`
                : `${formatarPct(pctSimples)} sobre a comissão`
            }
          />
        )}
        {previa.broker > 0 && (
          <>
            <TotalCascata rotulo="Base depois do imposto" valor={previa.base} />
            <LinhaCascata
              rotulo="Comissão do corretor"
              valor={previa.broker}
              subtracao
              detalhe={`base × ${formatarPct(pctCorretor)}`}
            />
          </>
        )}
        <TotalCascata
          rotulo="Fica para a imobiliária"
          valor={previa.net}
          nota={`${fatia}% da comissão da imobiliária. O dinheiro entra parcela a parcela, na medida em que a construtora paga.`}
        />
      </Cascata>
    </Secao>
  )
}
