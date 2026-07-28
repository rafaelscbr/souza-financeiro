import { useMemo, useState, type FormEvent } from 'react'
import {
  Landmark,
  Home,
  Car,
  Briefcase,
  TrendingUp,
  Banknote,
  Plus,
  Pencil,
  Trash2,
  Database,
} from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { FormField, Input, Select } from '@/components/ui/Field'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { Segmented } from '@/components/ui/Segmented'
import { Spinner } from '@/components/ui/Spinner'
import { Tip } from '@/components/ui/Tip'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProfitTrendChart } from '@/features/dashboard/Charts'
import { lastNMonths } from '@/lib/finance'
import { netWorth, netWorthSeries } from '@/lib/personal'
import { formatCurrency, formatDate, formatMonthShort, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AssetCategory, PersonalAsset, PersonalAssetInput } from '@/types'

const CATEGORY_LABEL: Record<AssetCategory, string> = {
  imovel: 'Imóvel',
  veiculo: 'Veículo',
  participacao: 'Participação em empresa',
  investimento: 'Investimento fora do sistema',
  financiamento: 'Financiamento',
  emprestimo: 'Empréstimo',
  outro: 'Outro',
}

const CATEGORY_ICON: Record<AssetCategory, typeof Home> = {
  imovel: Home,
  veiculo: Car,
  participacao: Briefcase,
  investimento: TrendingUp,
  financiamento: Landmark,
  emprestimo: Landmark,
  outro: Banknote,
}

const ASSET_CATEGORIES: AssetCategory[] = ['imovel', 'veiculo', 'participacao', 'investimento', 'outro']
const LIABILITY_CATEGORIES: AssetCategory[] = ['financiamento', 'emprestimo', 'outro']

/** Avaliação mais velha que isso merece um aviso — patrimônio envelhece. */
const STALE_DAYS = 365

/**
 * Patrimônio líquido: o número que responde "estou ficando mais rico ou só
 * girando dinheiro?". Contas, investimentos e faturas o sistema já sabe; aqui
 * entram os bens e dívidas que só você conhece.
 */
export function NetWorthPanel() {
  const { accounts, personalTransactions, transfers, personalAssets, assetsReady, personalCompany, period } =
    useAppData()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PersonalAsset | null>(null)

  const personalAccounts = useMemo(
    () => accounts.filter((a) => a.company_id === personalCompany?.id),
    [accounts, personalCompany],
  )

  const nw = useMemo(
    () => netWorth(personalAccounts, personalTransactions, transfers, personalAssets),
    [personalAccounts, personalTransactions, transfers, personalAssets],
  )

  const series = useMemo(
    () =>
      netWorthSeries(
        personalAccounts,
        personalTransactions,
        transfers,
        personalAssets,
        lastNMonths(period, 12),
      ),
    [personalAccounts, personalTransactions, transfers, personalAssets, period],
  )

  const chartData = series.map((p) => ({ label: formatMonthShort(p.date), lucro: p.net }))
  const hasHistory = series.some((p) => p.net !== 0)

  if (!assetsReady) {
    return (
      <Section title="Patrimônio líquido">
        <EmptyState
          icon={<Database className="h-8 w-8" />}
          title="Falta aplicar a migração do patrimônio"
          description="Abra o SQL Editor do Supabase, cole o conteúdo de supabase/migrations/006_patrimonio_pessoal.sql e clique em Run. Depois recarregue esta tela."
        />
      </Section>
    )
  }

  const staleCount = personalAssets.filter(
    (a) =>
      a.is_active &&
      (Date.now() - new Date(a.valued_at).getTime()) / 86_400_000 > STALE_DAYS,
  ).length

  return (
    <Section
      title="Patrimônio líquido"
      subtitle="Tudo que você tem, menos tudo que você deve"
      action={
        <button
          onClick={() => {
            setEditing(null)
            setModalOpen(true)
          }}
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          Bem ou dívida
        </button>
      }
    >
      <div className="space-y-4">
        {/* Número principal */}
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-content-faint">
              Patrimônio líquido hoje
            </span>
            <Tip label="Como é calculado" align="start">
              Contas, poupança e investimentos, mais os bens que você cadastrou, menos as faturas
              de cartão em aberto e os financiamentos. É a foto do que sobraria se você liquidasse
              tudo hoje.
            </Tip>
          </div>
          <p
            className={cn(
              'tnum mt-1 text-3xl font-bold',
              nw.net >= 0 ? 'text-content' : 'text-expense',
            )}
          >
            {formatCurrency(nw.net)}
          </p>
        </div>

        {/* Composição */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Composition label="Contas e investimentos" value={nw.cash} tone="positive" />
          <Composition label="Bens cadastrados" value={nw.assets} tone="positive" />
          <Composition label="Faturas de cartão" value={-nw.cardDebt} tone="negative" />
          <Composition label="Financiamentos" value={-nw.debts} tone="negative" />
        </div>

        {/* Evolução */}
        {hasHistory && (
          <div>
            <p className="mb-1 text-xs font-medium text-content-muted">Evolução (12 meses)</p>
            <ProfitTrendChart data={chartData} />
            <p className="mt-1 text-[11px] text-content-faint">
              Os saldos de conta são recalculados mês a mês. Os bens entram pelo valor atual em
              todos os meses — a curva mostra a variação do seu caixa e das dívidas, não a
              valorização dos imóveis.
            </p>
          </div>
        )}

        {staleCount > 0 && (
          <p className="text-xs text-pending">
            {staleCount} {staleCount === 1 ? 'bem está' : 'bens estão'} com avaliação de mais de um
            ano. Atualize o valor para o patrimônio continuar fiel.
          </p>
        )}

        {/* Lista de bens */}
        {personalAssets.length === 0 ? (
          <p className="text-sm text-content-muted">
            Nenhum bem cadastrado ainda.{' '}
            <button
              onClick={() => {
                setEditing(null)
                setModalOpen(true)
              }}
              className="font-medium text-emerald hover:underline"
            >
              Cadastrar imóvel, veículo ou financiamento
            </button>
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {personalAssets.map((a) => (
              <AssetRow
                key={a.id}
                asset={a}
                onEdit={() => {
                  setEditing(a)
                  setModalOpen(true)
                }}
              />
            ))}
          </ul>
        )}
      </div>

      <AssetModal
        key={editing?.id ?? 'novo'}
        open={modalOpen}
        editing={editing}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
      />
    </Section>
  )
}

function Composition({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'positive' | 'negative'
}) {
  if (value === 0) return null
  return (
    <div className="rounded-xl border border-line bg-surface-2/50 p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-content-faint">{label}</p>
      <p
        className={cn(
          'tnum mt-0.5 text-sm font-bold',
          tone === 'positive' ? 'text-content' : 'text-expense',
        )}
      >
        {formatCurrency(value)}
      </p>
    </div>
  )
}

function AssetRow({ asset, onEdit }: { asset: PersonalAsset; onEdit: () => void }) {
  const { deletePersonalAsset } = useAppData()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const Icon = CATEGORY_ICON[asset.category]
  const isDebt = asset.kind === 'liability'

  return (
    <li className={cn('flex items-center gap-3 py-2.5', !asset.is_active && 'opacity-50')}>
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          isDebt ? 'bg-expense/10 text-expense' : 'bg-emerald-soft text-emerald-dark',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content">{asset.name}</p>
        <p className="truncate text-[11px] text-content-faint">
          {CATEGORY_LABEL[asset.category]} · avaliado em {formatDate(asset.valued_at)}
          {!asset.is_active && ' · inativo'}
        </p>
      </div>
      <span
        className={cn('tnum shrink-0 text-sm font-semibold', isDebt ? 'text-expense' : 'text-content')}
      >
        {isDebt ? '−' : ''} {formatCurrency(asset.value)}
      </span>
      <div className="flex w-[68px] shrink-0 items-center justify-end gap-1">
        {confirming ? (
          <button
            onClick={async () => {
              setDeleting(true)
              try {
                await deletePersonalAsset(asset.id)
              } finally {
                setDeleting(false)
                setConfirming(false)
              }
            }}
            disabled={deleting}
            className="rounded-lg bg-expense/15 px-2 py-1 text-xs font-medium text-expense"
          >
            {deleting ? '…' : 'Excluir'}
          </button>
        ) : (
          <>
            <button
              onClick={onEdit}
              className="rounded-lg p-2 text-content-faint hover:bg-surface-2 hover:text-content"
              aria-label={`Editar ${asset.name}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="rounded-lg p-2 text-content-faint hover:bg-surface-2 hover:text-expense"
              aria-label={`Excluir ${asset.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </li>
  )
}

function AssetModal({
  open,
  editing,
  onClose,
}: {
  open: boolean
  editing: PersonalAsset | null
  onClose: () => void
}) {
  const { createPersonalAsset, updatePersonalAsset } = useAppData()

  const [kind, setKind] = useState<'asset' | 'liability'>(editing?.kind ?? 'asset')
  const [category, setCategory] = useState<AssetCategory>(editing?.category ?? 'imovel')
  const [name, setName] = useState(editing?.name ?? '')
  const [value, setValue] = useState<number | null>(editing?.value ?? null)
  const [valuedAt, setValuedAt] = useState(editing?.valued_at ?? toDateOnly(new Date()))
  const [isActive, setIsActive] = useState(editing?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const options = kind === 'asset' ? ASSET_CATEGORIES : LIABILITY_CATEGORIES
  // Trocar ativo↔dívida muda a lista; manter a categoria antiga gravaria algo
  // incoerente (um "imóvel" no lado das dívidas).
  const resolvedCategory = options.includes(category) ? category : options[0]

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Dê um nome ao item.')
    if ((value ?? 0) <= 0) return setError('Informe um valor maior que zero.')

    const input: PersonalAssetInput = {
      kind,
      category: resolvedCategory,
      name: name.trim(),
      value: value ?? 0,
      valued_at: valuedAt,
      notes: null,
      is_active: isActive,
      sort_order: editing?.sort_order ?? 0,
    }

    setSaving(true)
    try {
      if (editing) await updatePersonalAsset(editing.id, input)
      else await createPersonalAsset(input)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar item do patrimônio' : 'Novo bem ou dívida'}
      description="O que o sistema não tem como saber sozinho: imóveis, veículos, participações e financiamentos."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Segmented
          ariaLabel="Tipo"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'asset', label: 'Bem (tenho)', activeClass: 'bg-income/12 text-income border border-income/25' },
            {
              value: 'liability',
              label: 'Dívida (devo)',
              activeClass: 'bg-expense/12 text-expense border border-expense/25',
            },
          ]}
        />

        <FormField label="Nome" htmlFor="as-name">
          <Input
            id="as-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === 'asset' ? 'Ex.: Apartamento Itajaí' : 'Ex.: Financiamento do carro'}
            autoFocus
          />
        </FormField>

        <FormField label="Tipo de item" htmlFor="as-category">
          <Select
            id="as-category"
            value={resolvedCategory}
            onChange={(e) => setCategory(e.target.value as AssetCategory)}
          >
            {options.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField
          label={kind === 'asset' ? 'Valor estimado' : 'Saldo devedor'}
          htmlFor="as-value"
          hint={
            kind === 'asset'
              ? 'Quanto valeria se vendesse hoje'
              : 'Quanto falta pagar — não a parcela, o total'
          }
        >
          <CurrencyInput id="as-value" value={value} onChange={setValue} />
        </FormField>

        <FormField
          label="Data desta avaliação"
          htmlFor="as-valued"
          hint="A tela avisa quando o valor ficar velho"
        >
          <Input
            id="as-valued"
            type="date"
            value={valuedAt}
            onChange={(e) => e.target.value && setValuedAt(e.target.value)}
          />
        </FormField>

        {editing && (
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3">
            <span className="text-sm text-content">
              Ainda faz parte do patrimônio
              <span className="mt-0.5 block text-xs text-content-faint">
                Desmarque quando vender o bem ou quitar a dívida
              </span>
            </span>
            <input
              type="checkbox"
              className="peer sr-only"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span
              className="relative h-6 w-11 shrink-0 rounded-full bg-surface-3 transition-colors peer-checked:bg-emerald after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:after:translate-x-5"
              aria-hidden
            />
          </label>
        )}

        {error && (
          <p className="text-sm text-expense" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? <Spinner className="h-5 w-5" /> : editing ? 'Salvar' : 'Adicionar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
