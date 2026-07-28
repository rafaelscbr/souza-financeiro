import { useMemo, useState } from 'react'
import { Delete, Bookmark, BookmarkPlus, X, CalendarDays } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { buildCardPurchase } from '@/lib/cards'
import { budgetLimitOf } from '@/lib/budgets'
import { splitAmount } from '@/lib/installments'
import { inMonth, monthKeyOf } from '@/lib/finance'
import { LAST_PERSONAL_ACCOUNT_KEY } from '@/lib/personalDefaults'
import { formatCurrency, formatDateShort, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Category, Transaction, TransactionInput, TransactionTemplate } from '@/types'

const NO_ACCOUNT = ''
const MAX_VISIBLE_CATS = 7

/**
 * Lançamento pessoal em 3 toques: abrir → digitar o valor no teclado próprio →
 * tocar na categoria (o toque na categoria SALVA). Sem botão de confirmar:
 * a segurança vem do toast com Desfazer.
 */
export function PersonalQuickSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Novo lançamento" className="sm:max-w-md">
      {open && <SheetBody onClose={onClose} />}
    </Modal>
  )
}

function loadLastAccount(): string {
  try {
    return localStorage.getItem(LAST_PERSONAL_ACCOUNT_KEY) ?? NO_ACCOUNT
  } catch {
    return NO_ACCOUNT
  }
}

function saveLastAccount(id: string) {
  try {
    localStorage.setItem(LAST_PERSONAL_ACCOUNT_KEY, id)
  } catch {
    // sem localStorage a preferência só não persiste
  }
}

function SheetBody({ onClose }: { onClose: () => void }) {
  const {
    personalCompany,
    personalTransactions,
    personalBudgets,
    categories,
    accounts,
    templates,
    templatesReady,
    treasuryReady,
    personalReady,
    createTransactions,
    deleteTransactions,
    createTemplate,
    seedPersonalCategories,
  } = useAppData()
  const { showToast } = useToast()

  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const [cents, setCents] = useState(0)
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(toDateOnly(new Date()))
  const [showDate, setShowDate] = useState(false)
  const [pending, setPending] = useState(false)
  const [installments, setInstallments] = useState(1)
  const [expanded, setExpanded] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [customName, setCustomName] = useState('')
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Favoritos (atalhos de 1 toque)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateCategory, setTemplateCategory] = useState('')

  const amount = cents / 100

  const personalAccounts = useMemo(
    () => accounts.filter((a) => a.is_active && a.company_id === personalCompany?.id),
    [accounts, personalCompany],
  )
  const [accountId, setAccountId] = useState<string>(() => {
    const last = loadLastAccount()
    return personalAccounts.some((a) => a.id === last) ? last : NO_ACCOUNT
  })
  const selectedAccount = personalAccounts.find((a) => a.id === accountId) ?? null
  const isCard = !!selectedAccount && selectedAccount.type === 'credit_card' && personalReady

  // Categorias do tipo atual, ordenadas por frequência de uso (últimos 90 dias)
  const myCategories = useMemo(() => {
    const cutoff = toDateOnly(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
    const freq = new Map<string, number>()
    for (const t of personalTransactions) {
      const d = t.settled_date ?? t.competence_date
      if (d >= cutoff) freq.set(t.category, (freq.get(t.category) ?? 0) + 1)
    }
    return categories
      .filter((c) => c.company_id === personalCompany?.id && c.kind === kind)
      .sort((a, b) => {
        const fa = freq.get(a.name) ?? 0
        const fb = freq.get(b.name) ?? 0
        if (fa !== fb) return fb - fa
        return a.sort_order - b.sort_order
      })
  }, [categories, personalCompany, kind, personalTransactions])

  const visibleCats = expanded ? myCategories : myCategories.slice(0, MAX_VISIBLE_CATS)
  const hasMore = myCategories.length > MAX_VISIBLE_CATS

  const myTemplates = useMemo(
    () =>
      templates.filter(
        (t) =>
          t.company_id === personalCompany?.id && (t.kind === 'expense' || t.kind === 'income'),
      ),
    [templates, personalCompany],
  )

  // Sugestão inteligente: mesmo valor já lançado antes → repetir em 1 toque.
  const suggestion = useMemo(() => {
    if (kind !== 'expense' || cents === 0) return null
    const matches = personalTransactions
      .filter((t) => t.kind === 'expense' && Math.round(t.amount * 100) === cents)
      .sort((a, b) =>
        (a.settled_date ?? a.competence_date) < (b.settled_date ?? b.competence_date) ? 1 : -1,
      )
    const last = matches[0]
    if (!last) return null
    return { category: last.category, description: last.description }
  }, [personalTransactions, kind, cents])

  const suggestionCategory = suggestion
    ? categories.find(
        (c) => c.company_id === personalCompany?.id && c.kind === 'expense' && c.name === suggestion.category,
      ) ?? null
    : null

  function pressDigit(d: number) {
    setCents((c) => (c >= 10_000_000_00 ? c : c * 10 + d))
  }
  function pressBackspace() {
    setCents((c) => Math.floor(c / 10))
  }

  /**
   * Contexto de orçamento para o toast. `monthFirstDay` é o mês em que o gasto
   * REALMENTE pesa: no cartão é o mês da fatura, não o da compra — senão uma
   * compra feita depois do fechamento mostraria o consumo do mês errado.
   */
  function budgetDetail(
    category: string,
    extraSpent: number,
    monthFirstDay = `${monthKeyOf(date)}-01`,
  ): string | undefined {
    const limit = budgetLimitOf(personalBudgets, category, monthFirstDay)
    if (limit == null || limit <= 0) return undefined
    const monthDate = new Date(
      Number(monthFirstDay.slice(0, 4)),
      Number(monthFirstDay.slice(5, 7)) - 1,
      1,
    )
    const spent =
      personalTransactions
        .filter((t) => t.kind === 'expense' && t.category === category && inMonth(t, monthDate, 'cash'))
        .reduce((s, t) => s + t.amount, 0) + extraSpent
    const pct = Math.round((spent / limit) * 100)
    if (spent > limit)
      return `${category}: estourou ${formatCurrency(spent - limit)} (${pct}% do orçamento)`
    return `${category}: ${formatCurrency(spent)} de ${formatCurrency(limit)} (${pct}%)`
  }

  async function save(category: string, descriptionOverride?: string) {
    if (!personalCompany) return setError('Empresa pessoal não encontrada.')
    if (cents === 0) return setError('Digite o valor primeiro.')
    if (saving) return

    setError(null)
    setSaving(true)
    const desc = (descriptionOverride ?? description).trim()

    try {
      let rows: TransactionInput[]

      if (isCard && selectedAccount) {
        // Compra no cartão: 1x ou parcelada, carimbada na fatura do ciclo.
        rows = buildCardPurchase({
          base: {
            company_id: personalCompany.id,
            kind,
            category,
            dre_group: null,
            description: desc,
            competence_date: date,
            is_recurring: false,
            contact_id: null,
            counterparty: null,
            property_value: null,
            commission_pct: null,
            broker_pct: null,
            account_id: selectedAccount.id,
          },
          total: amount,
          installments: kind === 'expense' ? installments : 1,
          purchaseDate: date,
          account: selectedAccount,
        })
      } else {
        const isPending = pending && kind === 'expense'
        rows = [
          {
            company_id: personalCompany.id,
            kind,
            category,
            dre_group: null,
            description: desc,
            amount,
            competence_date: date,
            status: isPending ? 'pending' : 'settled',
            settled_date: isPending ? null : date,
            // Pendente recebe a conta na baixa — mesma convenção do empresarial.
            due_date: isPending ? date : null,
            is_recurring: false,
            contact_id: null,
            counterparty: null,
            property_value: null,
            commission_pct: null,
            broker_pct: null,
            group_id: null,
            installment_index: null,
            installment_count: null,
            account_id: isPending ? null : accountId || null,
            ...(personalReady ? { card_cycle_month: null } : {}),
          },
        ]
      }

      const created = await createTransactions(rows)
      // Grava sempre — inclusive "Sem conta" (string vazia). Sem isto a escolha
      // de não informar conta era esquecida e o sheet reabria na conta anterior.
      saveLastAccount(accountId)
      if ('vibrate' in navigator) navigator.vibrate?.(10)

      const ids = created.map((t: Transaction) => t.id)
      const kindLabel = kind === 'expense' ? 'Gasto' : 'Entrada'
      const parcelInfo =
        rows.length > 1 ? ` em ${rows.length}× de ${formatCurrency(rows[0].amount)}` : ''
      // Gasto "ainda não paguei" nasce pendente e NÃO consome orçamento no
      // regime de caixa — mostrar consumo aqui divergiria do painel.
      const contaNoOrcamento = kind === 'expense' && !(pending && !isCard)
      showToast({
        message: `${kindLabel} de ${formatCurrency(amount)} em ${category}${parcelInfo} ✓`,
        // O estado local ainda não viu o lançamento novo — soma a 1ª parcela à
        // mão, no mês em que ela realmente pesa (fatura, se for cartão).
        detail: contaNoOrcamento
          ? budgetDetail(
              category,
              rows[0].amount,
              rows[0].card_cycle_month ?? `${monthKeyOf(date)}-01`,
            )
          : undefined,
        actionLabel: 'Desfazer',
        onAction: () => deleteTransactions(ids),
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function applyTemplate(t: TransactionTemplate) {
    if (t.kind !== 'expense' && t.kind !== 'income') return
    setKind(t.kind)
    if (t.amount != null && t.amount > 0) {
      // Atalho completo: lança direto com 1 toque. O `kind` vai explícito —
      // `setKind` só vale no próximo render, e ler o estado aqui gravaria uma
      // entrada como gasto (e vice-versa).
      await saveWithAmount(t.category, t.amount, t.name !== t.category ? t.name : '', t.kind)
    } else {
      // Atalho sem valor: preenche e deixa o teclado para o valor.
      setCustomOpen(false)
      setCents(0)
      setDescription(t.name)
    }
  }

  // Variante de save usada pelos atalhos (valor vem do template, não do teclado).
  // `kindOverride` existe porque o atalho troca o tipo e salva no mesmo gesto:
  // o estado só mudaria no render seguinte.
  async function saveWithAmount(
    category: string,
    value: number,
    desc: string,
    kindOverride?: 'expense' | 'income',
  ) {
    if (!personalCompany || saving) return
    const effectiveKind = kindOverride ?? kind
    setError(null)
    setSaving(true)
    try {
      const isPending = false
      const rows: TransactionInput[] =
        isCard && selectedAccount
          ? buildCardPurchase({
              base: {
                company_id: personalCompany.id,
                kind: effectiveKind,
                category,
                dre_group: null,
                description: desc,
                competence_date: date,
                is_recurring: false,
                contact_id: null,
                counterparty: null,
                property_value: null,
                commission_pct: null,
                broker_pct: null,
                account_id: selectedAccount.id,
              },
              total: value,
              installments: 1,
              purchaseDate: date,
              account: selectedAccount,
            })
          : [
              {
                company_id: personalCompany.id,
                kind: effectiveKind,
                category,
                dre_group: null,
                description: desc,
                amount: value,
                competence_date: date,
                status: isPending ? 'pending' : 'settled',
                settled_date: date,
                due_date: null,
                is_recurring: false,
                contact_id: null,
                counterparty: null,
                property_value: null,
                commission_pct: null,
                broker_pct: null,
                group_id: null,
                installment_index: null,
                installment_count: null,
                account_id: accountId || null,
                ...(personalReady ? { card_cycle_month: null } : {}),
              },
            ]
      const created = await createTransactions(rows)
      // Grava sempre — inclusive "Sem conta" (string vazia). Sem isto a escolha
      // de não informar conta era esquecida e o sheet reabria na conta anterior.
      saveLastAccount(accountId)
      if ('vibrate' in navigator) navigator.vibrate?.(10)
      const ids = created.map((t: Transaction) => t.id)
      showToast({
        message: `${effectiveKind === 'expense' ? 'Gasto' : 'Entrada'} de ${formatCurrency(value)} em ${category} ✓`,
        detail:
          effectiveKind === 'expense'
            ? budgetDetail(category, value, rows[0].card_cycle_month ?? `${monthKeyOf(date)}-01`)
            : undefined,
        actionLabel: 'Desfazer',
        onAction: () => deleteTransactions(ids),
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSeed() {
    setSeeding(true)
    setError(null)
    try {
      await seedPersonalCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar as categorias.')
    } finally {
      setSeeding(false)
    }
  }

  async function handleSaveTemplate() {
    // A lista de categorias muda com Saiu/Entrou; se o tipo foi trocado depois
    // de abrir o formulário, a seleção antiga é de outro tipo — cai na primeira
    // categoria válida em vez de gravar um atalho incoerente.
    const cat = myCategories.some((c) => c.name === templateCategory)
      ? templateCategory
      : myCategories[0]?.name ?? ''
    if (!cat) return setError('Escolha a categoria do atalho.')
    const name = templateName.trim() || cat
    try {
      await createTemplate({
        company_id: personalCompany?.id ?? null,
        name,
        kind,
        category: cat,
        dre_group: null,
        amount: cents > 0 ? amount : null,
        contact_id: null,
        sort_order: 0,
      })
      setTemplateOpen(false)
      setTemplateName('')
      showToast({ message: `Atalho "${name}" criado` })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o atalho.')
    }
  }

  const isToday = date === toDateOnly(new Date())
  const perInstallment = installments > 1 ? splitAmount(amount, installments)[0] : amount

  return (
    <div className="space-y-4">
      {/* Entrou/Saiu + data */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl border border-line bg-surface-2 p-1" role="radiogroup" aria-label="Tipo">
          {(
            [
              { value: 'expense', label: 'Saiu' },
              { value: 'income', label: 'Entrou' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={kind === opt.value}
              onClick={() => setKind(opt.value)}
              className={cn(
                'h-8 rounded-lg px-3.5 text-sm font-medium transition-colors',
                kind === opt.value
                  ? opt.value === 'expense'
                    ? 'bg-expense/12 text-expense border border-expense/25'
                    : 'bg-income/12 text-income border border-income/25'
                  : 'text-content-muted hover:text-content',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {showDate ? (
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              // Data vazia corromperia todo o cálculo de ciclo/competência.
              // E só fecha o campo quando a data está completa: o input dispara
              // onChange enquanto o usuário ainda está digitando o ano.
              const v = e.target.value
              if (!v) return
              setDate(v)
            }}
            onBlur={() => setShowDate(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') setShowDate(false)
            }}
            className="h-8 w-auto px-2 text-sm"
            aria-label="Data do lançamento"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowDate(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-content-muted transition-colors hover:text-content"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {isToday ? 'Hoje' : formatDateShort(date)}
          </button>
        )}
      </div>

      {/* Valor gigante */}
      <div className="text-center">
        <p
          className={cn(
            'tnum text-4xl font-bold tracking-tight',
            cents === 0 ? 'text-content-faint' : kind === 'expense' ? 'text-expense' : 'text-income',
          )}
          aria-live="polite"
        >
          {formatCurrency(amount)}
        </p>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrição (opcional)"
          aria-label="Descrição"
          className="mt-1 w-full border-0 bg-transparent text-center text-sm text-content placeholder:text-content-faint focus:outline-none"
        />
      </div>

      {/* Contas em chips */}
      {treasuryReady && personalAccounts.length > 0 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          <AccountChip
            label="Sem conta"
            color={null}
            active={accountId === NO_ACCOUNT}
            onClick={() => setAccountId(NO_ACCOUNT)}
          />
          {personalAccounts.map((a) => (
            <AccountChip
              key={a.id}
              label={a.type === 'credit_card' ? `💳 ${a.name}` : a.name}
              color={a.color}
              active={accountId === a.id}
              onClick={() => {
                setAccountId(a.id)
                if (a.type !== 'credit_card') setInstallments(1)
              }}
            />
          ))}
        </div>
      )}

      {/* Parcelas (só cartão + gasto) */}
      {isCard && kind === 'expense' && (
        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
          {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setInstallments(n)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                installments === n
                  ? 'border-withdrawal/40 bg-withdrawal/12 text-withdrawal'
                  : 'border-line bg-surface-2 text-content-muted hover:text-content',
              )}
            >
              {n === 1 ? 'À vista' : `${n}×`}
            </button>
          ))}
          {installments > 1 && cents > 0 && (
            <span className="tnum shrink-0 text-xs text-content-muted">
              {installments}× de {formatCurrency(perInstallment)}
            </span>
          )}
        </div>
      )}

      {/* "Ainda não paguei" (gasto fora do cartão) */}
      {kind === 'expense' && !isCard && (
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-2.5">
          <span className="text-sm text-content">Ainda não paguei</span>
          <input
            type="checkbox"
            className="peer sr-only"
            checked={pending}
            onChange={(e) => setPending(e.target.checked)}
          />
          <span
            className="relative h-5 w-10 rounded-full bg-surface-3 transition-colors peer-checked:bg-pending after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:after:translate-x-5"
            aria-hidden
          />
        </label>
      )}

      {/* Favoritos — o bloco sempre aparece quando há modelos disponíveis,
          senão o botão de criar o PRIMEIRO atalho ficaria dentro de uma
          condição que só é verdadeira depois que ele já existe. */}
      {templatesReady && (
        <div className="flex flex-wrap items-center gap-1.5">
          {myTemplates.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={saving}
              onClick={() => void applyTemplate(t)}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-content-muted transition-colors hover:border-emerald/40 hover:text-content disabled:opacity-50"
            >
              <Bookmark className="h-3 w-3" />
              {t.name}
              {t.amount != null && <span className="text-content-faint">· {formatCurrency(t.amount)}</span>}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setTemplateOpen((v) => !v)
              setTemplateCategory(myCategories[0]?.name ?? '')
            }}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2.5 py-1 text-xs font-medium text-content-faint transition-colors hover:text-content"
            title="Criar atalho de 1 toque"
          >
            <BookmarkPlus className="h-3 w-3" />
            Atalho
          </button>
        </div>
      )}

      {templateOpen && (
        <div className="space-y-2 rounded-xl border border-line bg-surface-2/60 p-3">
          <div className="flex items-center gap-2">
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Nome (ex.: Café da padaria)"
              aria-label="Nome do atalho"
              className="h-9 text-sm"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setTemplateOpen(false)}
              className="shrink-0 rounded-lg p-2 text-content-faint hover:bg-surface-2"
              aria-label="Cancelar atalho"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Select
              // Espelha a mesma resolução do salvar: se o tipo mudou, o select
              // mostra a categoria válida em vez de um valor fantasma.
              value={
                myCategories.some((c) => c.name === templateCategory)
                  ? templateCategory
                  : myCategories[0]?.name ?? ''
              }
              onChange={(e) => setTemplateCategory(e.target.value)}
              aria-label="Categoria do atalho"
              className="h-9 text-sm"
            >
              {myCategories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Button type="button" size="sm" onClick={() => void handleSaveTemplate()} className="shrink-0">
              {cents > 0 ? `Salvar · ${formatCurrency(amount)}` : 'Salvar'}
            </Button>
          </div>
        </div>
      )}

      {/* Sugestão inteligente */}
      {suggestion && suggestionCategory && !saving && (
        <button
          type="button"
          onClick={() => void save(suggestion.category, suggestion.description)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald/40 bg-emerald-soft/60 px-3 py-2.5 text-sm font-medium text-emerald-dark transition-colors hover:bg-emerald-soft"
        >
          <span aria-hidden>{suggestionCategory.icon ?? '↻'}</span>
          {suggestion.category}
          {suggestion.description && (
            <span className="font-normal text-content-muted">· {suggestion.description}</span>
          )}
          <span className="font-semibold">— repetir?</span>
        </button>
      )}

      {/* Grade de categorias — tocar = salvar */}
      {myCategories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-4 text-center">
          <p className="text-sm text-content-muted">
            Você ainda não tem categorias pessoais{kind === 'income' ? ' de entrada' : ''}.
          </p>
          <Button type="button" size="sm" className="mt-2" onClick={() => void handleSeed()} disabled={seeding}>
            {seeding ? 'Criando…' : 'Criar categorias padrão'}
          </Button>
        </div>
      ) : (
        <div>
          <p className="mb-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-content-faint">
            {cents === 0 ? 'Digite o valor e toque na categoria' : 'Toque na categoria para salvar'}
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {visibleCats.map((c) => (
              <CategoryCell key={c.id} category={c} disabled={saving} onPick={() => void save(c.name)} />
            ))}
            {hasMore && !expanded && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line px-1 py-2.5 text-content-muted transition-colors hover:bg-surface-2"
              >
                <span className="text-base leading-none" aria-hidden>⋯</span>
                <span className="text-[10px] font-medium">Mais</span>
              </button>
            )}
            {(expanded || !hasMore) && (
              <button
                type="button"
                onClick={() => setCustomOpen((v) => !v)}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line px-1 py-2.5 text-content-muted transition-colors hover:bg-surface-2"
              >
                <span className="text-base leading-none" aria-hidden>＋</span>
                <span className="text-[10px] font-medium">Nova</span>
              </button>
            )}
          </div>
        </div>
      )}

      {customOpen && (
        <div className="flex items-center gap-2">
          <Input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Nome da nova categoria"
            aria-label="Nova categoria"
            className="h-10 text-sm"
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            className="h-10 shrink-0"
            disabled={!customName.trim() || saving}
            onClick={() => void save(customName.trim())}
          >
            Lançar
          </Button>
        </div>
      )}

      {error && (
        <p className="text-sm text-expense" role="alert">
          {error}
        </p>
      )}

      {/* Teclado numérico próprio — o teclado do iOS não empurra o sheet */}
      <div className="grid grid-cols-3 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <KeypadKey key={n} label={String(n)} onPress={() => pressDigit(n)} />
        ))}
        <KeypadKey label="," onPress={() => undefined} muted />
        <KeypadKey label="0" onPress={() => pressDigit(0)} />
        <button
          type="button"
          onClick={pressBackspace}
          onDoubleClick={() => setCents(0)}
          aria-label="Apagar"
          className="flex h-12 items-center justify-center rounded-xl border border-line bg-surface-2 text-content-muted transition-colors active:bg-surface-3"
        >
          <Delete className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

function AccountChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string
  color: string | null
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-emerald/50 bg-emerald-soft text-emerald-dark'
          : 'border-line bg-surface-2 text-content-muted hover:text-content',
      )}
    >
      {color && (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      )}
      {label}
    </button>
  )
}

function CategoryCell({
  category,
  disabled,
  onPick,
}: {
  category: Category
  disabled: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className="flex flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface-2 px-1 py-2.5 transition-all hover:border-emerald/40 active:scale-95 disabled:opacity-50"
      style={category.color ? { borderLeft: `3px solid ${category.color}` } : undefined}
    >
      <span className="text-base leading-none" aria-hidden>
        {category.icon ?? '·'}
      </span>
      <span className="w-full truncate text-center text-[10px] font-medium text-content">
        {category.name}
      </span>
    </button>
  )
}

function KeypadKey({
  label,
  onPress,
  muted,
}: {
  label: string
  onPress: () => void
  muted?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        'h-12 rounded-xl border border-line bg-surface-2 text-lg font-semibold transition-colors active:bg-surface-3',
        muted ? 'text-content-faint' : 'text-content',
      )}
    >
      {label}
    </button>
  )
}
