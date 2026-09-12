import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useAdmin } from './AdminData'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select, Textarea } from '@/components/ui/Field'
import { CurrencyInput, PercentInput } from '@/components/ui/MoneyInput'
import { Segmented } from '@/components/ui/Segmented'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDateShort, toDateOnly } from '@/lib/format'
import { previewCascade, suggestInstallments } from '@/lib/sales'
import { cn } from '@/lib/utils'
import type { NewInstallment } from '@/types'

/**
 * Registrar uma venda em três passos curtos.
 *
 * A cascata fica à vista enquanto se digita, porque o número que importa não é
 * a comissão: é o que sobra depois de imposto e corretor. O formulário antigo
 * mostrava "fica para a imobiliária" calculando a comissão do corretor sobre o
 * valor BRUTO — o que pagava o parceiro a mais. Aqui a prévia usa a mesma
 * ordem da função do banco (ISS, depois Simples, depois o corretor).
 */
export function RegistrarVenda({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { costCenters, contacts, registrarVenda } = useAdmin()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [passo, setPasso] = useState(1)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

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
        return setErro('Informe ao menos o empreendimento, a unidade ou o comprador.')
      }
    }
    if (n === 3) {
      if (comissao <= 0) return setErro('Informe o valor da comissão da imobiliária.')
      if (corretor && !pctCorretor) return setErro('Informe o percentual do corretor.')
      if (parcelas.length === 0) setParcelas(suggestInstallments(comissao, 1, toDateOnly(new Date())))
    }
    setPasso(n)
  }

  async function salvar() {
    setErro(null)
    if (!fecha) return setErro('As parcelas precisam somar exatamente a comissão da imobiliária.')
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
      setErro(e instanceof Error ? e.message : 'Não deu para registrar a venda.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      open={aberto}
      onClose={onFechar}
      title="Registrar venda"
      description={`Passo ${passo} de 3`}
      className="sm:max-w-2xl"
      footer={
        <div className="flex gap-3">
          {passo > 1 ? (
            <Button variant="secondary" onClick={() => irPara(passo - 1)} disabled={salvando}>
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          ) : (
            <Button variant="secondary" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
          )}
          {passo < 3 ? (
            <Button className="flex-1" onClick={() => irPara(passo + 1)}>
              Continuar
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button className="flex-1" onClick={salvar} disabled={salvando || !fecha}>
              {salvando ? <Spinner className="h-5 w-5" /> : <Check className="h-4 w-4" />}
              Registrar venda
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {passo === 1 && (
          <>
            <FormField label="Empreendimento" htmlFor="v-cc">
              <Select id="v-cc" value={empreendimento} onChange={(e) => escolherEmpreendimento(e.target.value)}>
                <option value="">Selecione…</option>
                {empreendimentos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.developer ? ` · ${c.developer}` : ''}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Unidade" htmlFor="v-unid" hint="Ex.: 414-D, apto 1302A">
                <Input id="v-unid" value={unidade} onChange={(e) => setUnidade(e.target.value)} />
              </FormField>
              <FormField label="Data da venda" htmlFor="v-data">
                <Input id="v-data" type="date" value={dataVenda} onChange={(e) => setDataVenda(e.target.value)} />
              </FormField>
            </div>
            <FormField label="Comprador" htmlFor="v-cli">
              <Input
                id="v-cli"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nome de quem comprou"
              />
            </FormField>
            <FormField label="Valor do imóvel" htmlFor="v-vgv" hint="Deixe vazio se ainda não souber">
              <CurrencyInput id="v-vgv" value={valorImovel} onChange={setValorImovel} />
            </FormField>
          </>
        )}

        {passo === 2 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="% da comissão" htmlFor="v-pct" hint="sobre o valor do imóvel">
                <PercentInput id="v-pct" value={pctComissao} onChange={setPctComissao} />
              </FormField>
              <div className="flex flex-col justify-end">
                <span className="mb-1.5 text-sm font-medium text-content-muted">Comissão do negócio</span>
                <div className="flex h-11 items-center rounded-xl bg-surface-2 px-3.5">
                  <span className="tnum font-semibold text-content">
                    {comissaoNegocio == null ? '—' : formatCurrency(comissaoNegocio)}
                  </span>
                </div>
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3">
              <span className="text-sm text-content">Venda em parceria com outra imobiliária</span>
              <input type="checkbox" checked={parceria} onChange={(e) => setParceria(e.target.checked)} />
            </label>

            {parceria && (
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Imobiliária parceira" htmlFor="v-parc">
                  <Input id="v-parc" value={parceiro} onChange={(e) => setParceiro(e.target.value)} placeholder="Ex.: Rogga" />
                </FormField>
                <FormField label="% que é da Souza" htmlFor="v-pctsouza">
                  <PercentInput id="v-pctsouza" value={pctSouza} onChange={setPctSouza} />
                </FormField>
              </div>
            )}

            <FormField
              label="Comissão da imobiliária"
              htmlFor="v-com"
              hint={comissaoManual ? 'valor informado à mão' : 'calculado; pode ajustar se o contrato traz outro valor'}
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

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Emite nota fiscal?" htmlFor="v-nf" hint={temNota ? 'Simples incide' : 'sem imposto'}>
                <Segmented
                  ariaLabel="Emite nota"
                  value={temNota ? 'sim' : 'nao'}
                  onChange={(v) => setTemNota(v === 'sim')}
                  options={[
                    { value: 'sim', label: 'Sim' },
                    { value: 'nao', label: 'Não' },
                  ]}
                />
              </FormField>
              {temNota && (
                <FormField label="% do Simples" htmlFor="v-simples">
                  <PercentInput id="v-simples" value={pctSimples} onChange={setPctSimples} />
                </FormField>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Construtora retém ISS?"
                htmlFor="v-iss"
                hint={retemIss ? 'desconta no pagamento' : 'não desconta'}
              >
                <Segmented
                  ariaLabel="Retém ISS"
                  value={retemIss ? 'sim' : 'nao'}
                  onChange={(v) => setRetemIss(v === 'sim')}
                  options={[
                    { value: 'sim', label: 'Sim' },
                    { value: 'nao', label: 'Não' },
                  ]}
                />
              </FormField>
              {retemIss && (
                <FormField label="% do ISS" htmlFor="v-isspct">
                  <PercentInput id="v-isspct" value={pctIss} onChange={setPctIss} />
                </FormField>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Corretor" htmlFor="v-corr" hint="deixe vazio se não há comissão a pagar">
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
                <FormField label="% do corretor" htmlFor="v-corrpct" hint="sobre a comissão líquida de imposto">
                  <PercentInput id="v-corrpct" value={pctCorretor} onChange={setPctCorretor} />
                </FormField>
              )}
            </div>

            <Cascata previa={previa} comissao={comissao} temNota={temNota} retemIss={retemIss} />
          </>
        )}

        {passo === 3 && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-content-muted">Em quantas parcelas?</span>
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => gerarParcelas(n)}
                  className={cn(
                    'h-9 w-9 rounded-lg border text-sm font-semibold transition-colors',
                    parcelas.length === n
                      ? 'border-brandblue bg-brandblue-soft text-brandblue'
                      : 'border-line bg-surface-2 text-content-muted hover:text-content',
                  )}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
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
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-dashed border-line px-2.5 text-sm text-content-muted hover:text-content"
              >
                <Plus className="h-3.5 w-3.5" />
                Outra
              </button>
            </div>

            <p className="text-xs text-content-faint">
              Contrato de construtora costuma pagar por gatilho, não por mês fixo. Ajuste cada data e
              cada valor conforme o quadro resumo.
            </p>

            <div className="space-y-2">
              {parcelas.map((p, i) => (
                <div key={i} className="flex items-end gap-2">
                  <span className="tnum w-8 pb-3 text-xs font-semibold text-content-faint">{i + 1}º</span>
                  <div className="flex-1">
                    <Input
                      type="date"
                      aria-label={`Data da parcela ${i + 1}`}
                      value={p.expected_date}
                      onChange={(e) =>
                        setParcelas((arr) =>
                          arr.map((x, j) => (j === i ? { ...x, expected_date: e.target.value } : x)),
                        )
                      }
                    />
                  </div>
                  <div className="w-36">
                    <CurrencyInput
                      aria-label={`Valor da parcela ${i + 1}`}
                      value={p.amount}
                      onChange={(v) =>
                        setParcelas((arr) => arr.map((x, j) => (j === i ? { ...x, amount: v ?? 0 } : x)))
                      }
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setParcelas((arr) => arr.filter((_, j) => j !== i).map((x, j) => ({ ...x, idx: j + 1 })))
                    }
                    className="mb-0.5 rounded-lg p-2.5 text-content-faint hover:bg-surface-2 hover:text-expense"
                    aria-label={`Remover parcela ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div
              className={cn(
                'flex items-center justify-between rounded-xl px-4 py-3 text-sm',
                fecha ? 'bg-surface-2' : 'bg-pending/10',
              )}
            >
              <span className={fecha ? 'text-content-muted' : 'font-medium text-pending'}>
                {fecha ? 'As parcelas fecham com a comissão' : 'As parcelas não fecham'}
              </span>
              <span className="tnum font-bold text-content">
                {formatCurrency(soma)}
                {!fecha && <span className="ml-1 font-normal text-content-muted">de {formatCurrency(comissao)}</span>}
              </span>
            </div>

            <FormField label="Observação" htmlFor="v-obs" hint="opcional">
              <Textarea
                id="v-obs"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex.: 50% na assinatura e 50% quando o comprador atingir 8% pago"
              />
            </FormField>

            <Cascata previa={previa} comissao={comissao} temNota={temNota} retemIss={retemIss} />

            {parcelas.length > 0 && fecha && (
              <p className="text-xs text-content-faint">
                Vai gerar {parcelas.length} recebimento(s) previsto(s):{' '}
                {parcelas.map((p) => formatDateShort(p.expected_date)).join(', ')}.
              </p>
            )}
          </>
        )}

        {erro && (
          <p className="flex items-start gap-2 rounded-xl bg-expense/10 px-3.5 py-2.5 text-sm text-expense" role="alert">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}

/** A conta que importa, atualizando enquanto se digita. */
function Cascata({
  previa,
  comissao,
  temNota,
  retemIss,
}: {
  previa: { iss: number; simples: number; base: number; broker: number; net: number }
  comissao: number
  temNota: boolean
  retemIss: boolean
}) {
  if (comissao <= 0) return null
  return (
    <div className="rounded-xl border border-line bg-surface-2/60 p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-content-faint">
        O que sobra desta venda
      </p>
      <Linha rotulo="Comissão da imobiliária" valor={comissao} forte />
      {retemIss && <Linha rotulo="(−) ISS retido na fonte" valor={-previa.iss} />}
      {temNota && <Linha rotulo="(−) Simples" valor={-previa.simples} />}
      {previa.broker > 0 && <Linha rotulo="(−) Comissão do corretor" valor={-previa.broker} />}
      <div className="my-2 border-t border-line" />
      <Linha rotulo="Fica para a imobiliária" valor={previa.net} forte destaque />
      <p className="mt-1 text-right text-[11px] text-content-faint">
        {comissao > 0 ? `${Math.round((previa.net / comissao) * 100)}% da comissão` : ''}
      </p>
    </div>
  )
}

function Linha({
  rotulo,
  valor,
  forte,
  destaque,
}: {
  rotulo: string
  valor: number
  forte?: boolean
  destaque?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className={cn('text-sm', forte ? 'font-semibold text-content' : 'text-content-muted')}>{rotulo}</span>
      <span
        className={cn(
          'tnum shrink-0 font-semibold',
          destaque ? 'text-base text-income' : valor < 0 ? 'text-expense' : 'text-content',
        )}
      >
        {formatCurrency(valor)}
      </span>
    </div>
  )
}
