import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAppData } from '@/context/AppDataContext'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { CurrencyInput, PercentInput } from '@/components/ui/MoneyInput'
import { Segmented } from '@/components/ui/Segmented'
import { Spinner } from '@/components/ui/Spinner'
import { ContactSelect } from '@/features/contacts/ContactSelect'
import { formatCurrency, toDateOnly } from '@/lib/format'
import type { DreGroup, Transaction, TransactionInput, TransactionKind } from '@/types'

const CUSTOM = '__custom__'
const COMMISSION_CATEGORY = 'Comissões de Venda'

const KIND_OPTIONS: { value: TransactionKind; label: string; activeClass: string }[] = [
  { value: 'income', label: 'Receita', activeClass: 'bg-income/12 text-income border border-income/25' },
  { value: 'expense', label: 'Despesa', activeClass: 'bg-expense/12 text-expense border border-expense/25' },
  { value: 'withdrawal', label: 'Retirada', activeClass: 'bg-withdrawal/12 text-withdrawal border border-withdrawal/25' },
]

interface Props {
  editing: Transaction | null
  prefill?: Partial<TransactionInput>
  submitting: boolean
  error: string | null
  onSubmit: (rows: TransactionInput[]) => void
  onCancel: () => void
}

export function TransactionForm({ editing, prefill, submitting, error, onSubmit, onCancel }: Props) {
  const { companies, categories, scopeCompanyId, accounts, treasuryReady, costCenters, costCentersReady } =
    useAppData()
  const base = editing ?? prefill

  const [kind, setKind] = useState<TransactionKind>(base?.kind ?? 'income')
  const [companyId, setCompanyId] = useState(base?.company_id ?? scopeCompanyId ?? companies[0]?.id ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [competenceDate, setCompetenceDate] = useState(base?.competence_date ?? toDateOnly(new Date()))
  const [contactId, setContactId] = useState<string | null>(editing?.contact_id ?? null)
  const [localError, setLocalError] = useState<string | null>(null)

  // valor genérico (receita não-comissão / despesa / retirada)
  const [amount, setAmount] = useState<number | null>(editing ? editing.amount : null)

  // comissão detalhada
  const [propertyValue, setPropertyValue] = useState<number | null>(editing?.property_value ?? null)
  const [commissionPct, setCommissionPct] = useState<number | null>(editing?.commission_pct ?? null)
  const [brokerPct, setBrokerPct] = useState<number | null>(editing?.broker_pct ?? null)

  // recebimento / pagamento
  const [receiveMode, setReceiveMode] = useState<'avista' | 'parcelado'>('avista')
  const [status, setStatus] = useState<'settled' | 'pending'>(editing?.status ?? 'settled')
  const [movementDate, setMovementDate] = useState(editing?.settled_date ?? editing?.due_date ?? toDateOnly(new Date()))
  const [installmentCount, setInstallmentCount] = useState(3)
  const [firstDate, setFirstDate] = useState(toDateOnly(new Date()))
  const [isRecurring, setIsRecurring] = useState(editing?.is_recurring ?? false)
  const [accountId, setAccountId] = useState<string>(editing?.account_id ?? '')
  // Apropriação: despesa anual paga de uma vez, mas que "pertence" a N meses.
  const [spreadMonths, setSpreadMonths] = useState(1)
  const [costCenterId, setCostCenterId] = useState<string>(editing?.cost_center_id ?? '')

  const availableCostCenters = useMemo(
    () => costCenters.filter((c) => c.is_active && c.company_id === companyId),
    [costCenters, companyId],
  )

  const availableAccounts = useMemo(
    () => accounts.filter((a) => a.is_active && a.company_id === companyId),
    [accounts, companyId],
  )

  const availableCategories = useMemo(
    () =>
      categories
        .filter((c) => c.kind === kind && (c.company_id === null || c.company_id === companyId))
        .sort((a, b) => a.sort_order - b.sort_order),
    [categories, kind, companyId],
  )

  const initialCategoryIsCustom = !!editing && !availableCategories.some((c) => c.name === editing.category)
  const [selectedCategory, setSelectedCategory] = useState(
    editing ? (initialCategoryIsCustom ? CUSTOM : editing.category) : availableCategories[0]?.name ?? CUSTOM,
  )
  const [customCategory, setCustomCategory] = useState(initialCategoryIsCustom ? editing!.category : '')

  useEffect(() => {
    if (selectedCategory === CUSTOM) return
    if (!availableCategories.some((c) => c.name === selectedCategory)) {
      setSelectedCategory(availableCategories[0]?.name ?? CUSTOM)
    }
  }, [availableCategories, selectedCategory])

  const resolvedCategory = selectedCategory === CUSTOM ? customCategory.trim() : selectedCategory
  const isCommission = kind === 'income' && resolvedCategory === COMMISSION_CATEGORY && !editing
  const isParcelable = (kind === 'income' || kind === 'expense') && !editing
  const showStatus = kind !== 'withdrawal'
  // Só faz sentido apropriar uma despesa já paga: é o caso do anual à vista.
  const canSpread = kind === 'expense' && !editing && receiveMode === 'avista' && status === 'settled'

  // valor base do lançamento
  const commissionGross =
    propertyValue != null && commissionPct != null
      ? Math.round(propertyValue * commissionPct) / 100
      : null
  const baseAmount = isCommission ? commissionGross ?? 0 : amount ?? 0
  const repasseTotal =
    isCommission && brokerPct != null ? Math.round(baseAmount * brokerPct) / 100 : 0

  const statusLabels =
    kind === 'expense' ? { settled: 'Pago', pending: 'A pagar' } : { settled: 'Recebido', pending: 'A receber' }
  const movementLabel =
    status === 'settled'
      ? kind === 'expense'
        ? 'Data do pagamento'
        : 'Data do recebimento'
      : kind === 'expense'
        ? 'Previsão de pagamento'
        : 'Previsão de recebimento'

  function dreGroupForCategory(): DreGroup {
    if (kind === 'income') return 'revenue'
    if (kind === 'withdrawal') return 'withdrawal'
    const cat = availableCategories.find((c) => c.name === resolvedCategory)
    return cat?.dre_group ?? 'variable_expense'
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLocalError(null)
    if (!companyId) return setLocalError('Selecione a empresa.')
    if (!resolvedCategory) return setLocalError('Selecione ou informe uma categoria.')
    if (baseAmount <= 0) return setLocalError('Informe um valor maior que zero.')
    if (isParcelable && receiveMode === 'parcelado' && installmentCount < 2)
      return setLocalError('Parcelado exige ao menos 2 parcelas.')

    const dre = dreGroupForCategory()
    const groupId = crypto.randomUUID()

    // Apropriação por competência: um pagamento único que cobre N meses vira
    // N linhas mensais. Sem isso, o seguro anual afunda o mês do pagamento e
    // deixa os outros onze artificialmente bonitos.
    if (canSpread && spreadMonths > 1) {
      const per = Math.floor((baseAmount / spreadMonths) * 100) / 100
      const [cy, cm, cd] = competenceDate.split('-').map(Number)
      const rows: TransactionInput[] = []

      for (let i = 0; i < spreadMonths; i++) {
        const amount =
          i === spreadMonths - 1
            ? Math.round((baseAmount - per * (spreadMonths - 1)) * 100) / 100
            : per
        rows.push({
          company_id: companyId,
          kind,
          category: resolvedCategory,
          dre_group: dre,
          description: description
            ? `${description} (${i + 1}/${spreadMonths})`
            : `Apropriação ${i + 1}/${spreadMonths}`,
          amount,
          // A competência caminha mês a mês…
          competence_date: toDateOnly(new Date(cy, cm - 1 + i, cd)),
          // …mas o dinheiro saiu de uma vez só. Todas as parcelas carregam a
          // MESMA data de pagamento e a mesma conta: assim o caixa registra a
          // saída inteira no dia certo, enquanto a competência distribui o
          // custo pelos meses que ele cobre.
          status: 'settled',
          settled_date: movementDate,
          due_date: null,
          is_recurring: false,
          contact_id: kind === 'expense' ? contactId : null,
          counterparty: null,
          property_value: null,
          commission_pct: null,
          broker_pct: null,
          group_id: groupId,
          installment_index: i + 1,
          installment_count: spreadMonths,
          account_id: accountId || null,
          cost_center_id: costCenterId || null,
        })
      }

      return onSubmit(rows)
    }

    // define as parcelas (à vista = 1 parcela)
    const parcels =
      isParcelable && receiveMode === 'parcelado'
        ? buildInstallments(baseAmount, installmentCount, firstDate)
        : [{ amount: baseAmount, due: showStatus ? movementDate : competenceDate }]

    const count = parcels.length
    const multi = count > 1 || (isCommission && repasseTotal > 0)
    const rows: TransactionInput[] = []

    parcels.forEach((p, i) => {
      const settled = count === 1 && status === 'settled'
      rows.push({
        company_id: companyId,
        kind,
        category: resolvedCategory,
        dre_group: dre,
        description,
        amount: p.amount,
        competence_date: competenceDate, // faturamento no mês da venda
        status: kind === 'withdrawal' ? 'settled' : settled ? 'settled' : 'pending',
        settled_date: kind === 'withdrawal' ? competenceDate : settled ? p.due : null,
        due_date: kind === 'withdrawal' || settled ? null : p.due,
        is_recurring: kind === 'expense' && count === 1 ? isRecurring : false,
        contact_id: kind === 'expense' ? contactId : null,
        counterparty: null,
        property_value: isCommission && i === 0 ? propertyValue : isCommission ? propertyValue : null,
        commission_pct: isCommission ? commissionPct : null,
        broker_pct: isCommission ? brokerPct : null,
        group_id: multi ? groupId : null,
        installment_index: count > 1 ? i + 1 : null,
        installment_count: count > 1 ? count : null,
        // Conta só faz sentido no que já se moveu; pendente recebe na baixa.
        account_id: settled || kind === 'withdrawal' ? accountId || null : null,
        cost_center_id: costCenterId || null,
      })

      // repasse ao corretor segue cada parcela (custo direto)
      if (isCommission && brokerPct != null && brokerPct > 0) {
        const repasse = Math.round(p.amount * brokerPct) / 100
        rows.push({
          company_id: companyId,
          kind: 'expense',
          category: 'Comissões de Corretores',
          dre_group: 'cost_of_sale',
          description: description ? `Comissão do corretor — ${description}` : 'Comissão do corretor',
          amount: repasse,
          competence_date: competenceDate,
          status: 'pending',
          settled_date: null,
          due_date: p.due,
          is_recurring: false,
          contact_id: contactId,
          counterparty: null,
          property_value: null,
          commission_pct: null,
          broker_pct: brokerPct,
          group_id: groupId,
          installment_index: count > 1 ? i + 1 : null,
          installment_count: count > 1 ? count : null,
          account_id: null,
          cost_center_id: costCenterId || null,
        })
      }
    })

    onSubmit(rows)
  }

  const shownError = localError ?? error

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Segmented ariaLabel="Tipo de lançamento" value={kind} onChange={setKind} options={KIND_OPTIONS} />

      <FormField label="Empresa" htmlFor="tx-company">
        <Select id="tx-company" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Categoria" htmlFor="tx-category">
        <Select id="tx-category" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
          {availableCategories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
          <option value={CUSTOM}>Outra…</option>
        </Select>
      </FormField>

      {selectedCategory === CUSTOM && (
        <FormField label="Nova categoria" htmlFor="tx-custom-category">
          <Input
            id="tx-custom-category"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            placeholder="Ex.: Infoproduto, Mentoria…"
            autoFocus
          />
        </FormField>
      )}

      {/* Calculadora de comissão */}
      {isCommission ? (
        <div className="space-y-3 rounded-xl border border-brandblue/20 bg-brandblue-soft/50 p-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Valor do imóvel" htmlFor="tx-property">
              <CurrencyInput id="tx-property" value={propertyValue} onChange={setPropertyValue} />
            </FormField>
            <FormField label="% comissão da venda" htmlFor="tx-comm-pct">
              <PercentInput id="tx-comm-pct" value={commissionPct} onChange={setCommissionPct} />
            </FormField>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
            <span className="text-content-muted">Comissão bruta</span>
            <span className="tnum font-bold text-income">{formatCurrency(commissionGross ?? 0)}</span>
          </div>
          <FormField label="Corretor" htmlFor="tx-broker">
            <ContactSelect id="tx-broker" type="broker" value={contactId} onChange={setContactId} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="% do corretor" htmlFor="tx-broker-pct" hint="sobre a comissão">
              <PercentInput id="tx-broker-pct" value={brokerPct} onChange={setBrokerPct} />
            </FormField>
            <div className="flex flex-col justify-end">
              <span className="mb-1.5 text-sm font-medium text-content-muted">Custo do corretor</span>
              <div className="flex h-11 items-center rounded-xl bg-white px-3.5">
                <span className="tnum font-bold text-expense">− {formatCurrency(repasseTotal)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-brandblue/15 pt-2 text-sm">
            <span className="font-medium text-content">Fica para a imobiliária</span>
            <span className="tnum font-bold text-content">{formatCurrency(baseAmount - repasseTotal)}</span>
          </div>
        </div>
      ) : (
        <FormField label="Valor" htmlFor="tx-amount">
          <CurrencyInput id="tx-amount" value={amount} onChange={setAmount} autoFocus={!editing} />
        </FormField>
      )}

      {/* Fornecedor (despesa) */}
      {kind === 'expense' && (
        <FormField label="Fornecedor" htmlFor="tx-supplier">
          <ContactSelect id="tx-supplier" type="supplier" value={contactId} onChange={setContactId} />
        </FormField>
      )}

      <FormField label="Descrição" htmlFor="tx-description">
        <Input
          id="tx-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={kind === 'income' ? 'Ex.: Venda apto 302 — Ed. Aurora' : 'Ex.: Meta Ads maio'}
        />
      </FormField>

      <FormField
        label={kind === 'income' ? 'Data da venda (competência)' : 'Competência'}
        htmlFor="tx-competence"
        hint="Mês em que conta no faturamento"
      >
        <Input id="tx-competence" type="date" value={competenceDate} onChange={(e) => setCompetenceDate(e.target.value)} />
      </FormField>

      {/* Forma de recebimento / pagamento */}
      {isParcelable && (
        <Segmented
          ariaLabel="Forma de recebimento"
          value={receiveMode}
          onChange={setReceiveMode}
          options={[
            { value: 'avista', label: kind === 'expense' ? 'À vista' : 'À vista' },
            { value: 'parcelado', label: 'Parcelado' },
          ]}
        />
      )}

      {(!isParcelable || receiveMode === 'avista') && showStatus ? (
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Situação" htmlFor="tx-status">
            <Segmented
              ariaLabel="Situação"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'settled', label: statusLabels.settled },
                { value: 'pending', label: statusLabels.pending, activeClass: 'bg-pending/15 text-pending border border-pending/25' },
              ]}
            />
          </FormField>
          <FormField label={movementLabel} htmlFor="tx-movement">
            <Input id="tx-movement" type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} />
          </FormField>
        </div>
      ) : null}

      {isParcelable && receiveMode === 'parcelado' && (
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Nº de parcelas" htmlFor="tx-parcels">
            <Select id="tx-parcels" value={installmentCount} onChange={(e) => setInstallmentCount(Number(e.target.value))}>
              {Array.from({ length: 23 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n}× de {formatCurrency(baseAmount / n)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="1ª parcela em" htmlFor="tx-first">
            <Input id="tx-first" type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} />
          </FormField>
        </div>
      )}

      {/* Empreendimento (centro de custo) */}
      {costCentersReady && availableCostCenters.length > 0 && (
        <FormField
          label="Empreendimento"
          htmlFor="tx-cost-center"
          hint="Marque para saber depois qual produto realmente dá lucro"
        >
          <Select
            id="tx-cost-center"
            value={costCenterId}
            onChange={(e) => setCostCenterId(e.target.value)}
          >
            <option value="">Nenhum</option>
            {availableCostCenters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      {/* Apropriação de despesa que cobre vários meses */}
      {canSpread && (
        <FormField
          label="Esta despesa cobre quantos meses?"
          htmlFor="tx-spread"
          hint={
            spreadMonths > 1
              ? `${formatCurrency(baseAmount / spreadMonths)} por mês no resultado — o pagamento continua sendo um só`
              : 'Use para anuidades: contador, seguro, licença paga de uma vez'
          }
        >
          <Select
            id="tx-spread"
            value={spreadMonths}
            onChange={(e) => setSpreadMonths(Number(e.target.value))}
          >
            <option value={1}>Só este mês</option>
            {[2, 3, 6, 12, 24].map((n) => (
              <option key={n} value={n}>
                {n} meses
              </option>
            ))}
          </Select>
        </FormField>
      )}

      {/* Conta — só quando o dinheiro já se moveu */}
      {treasuryReady && (status === 'settled' || kind === 'withdrawal') && (
        <FormField
          label="Conta"
          htmlFor="tx-account"
          hint={
            availableAccounts.length === 0
              ? 'Nenhuma conta cadastrada para esta empresa — cadastre em Contas'
              : `Onde o dinheiro ${kind === 'income' ? 'entrou' : 'saiu'}`
          }
        >
          <Select
            id="tx-account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            disabled={availableAccounts.length === 0}
          >
            <option value="">Definir depois</option>
            {availableAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      {/* Recorrência (despesa à vista) */}
      {kind === 'expense' && (!isParcelable || receiveMode === 'avista') && (
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3">
          <span className="text-sm text-content">Despesa fixa (recorrente todo mês)</span>
          <input type="checkbox" className="peer sr-only" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
          <span
            className="relative h-6 w-11 rounded-full bg-surface-3 transition-colors peer-checked:bg-emerald peer-focus-visible:ring-2 peer-focus-visible:ring-emerald peer-focus-visible:ring-offset-2 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:after:translate-x-5"
            aria-hidden
          />
        </label>
      )}

      {shownError && (
        <p className="text-sm text-expense" role="alert">
          {shownError}
        </p>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={submitting}>
          {submitting ? <Spinner className="h-5 w-5" /> : editing ? 'Salvar' : 'Lançar'}
        </Button>
      </div>
    </form>
  )
}

// Divide um total em N parcelas (última absorve o arredondamento) com datas mensais.
function buildInstallments(total: number, count: number, firstDate: string): { amount: number; due: string }[] {
  const base = Math.floor((total / count) * 100) / 100
  const [y, m, d] = firstDate.split('-').map(Number)
  const out: { amount: number; due: string }[] = []
  for (let i = 0; i < count; i++) {
    const amount = i === count - 1 ? Math.round((total - base * (count - 1)) * 100) / 100 : base
    out.push({ amount, due: toDateOnly(new Date(y, m - 1 + i, d)) })
  }
  return out
}
