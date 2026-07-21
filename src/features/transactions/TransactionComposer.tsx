import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAppData } from '@/context/AppDataContext'
import { Modal } from '@/components/ui/Modal'
import type { Transaction, TransactionInput } from '@/types'
import { TransactionForm } from './TransactionForm'
import { QuickEntryForm } from './QuickEntryForm'

interface ComposerValue {
  openNew: (prefill?: Partial<TransactionInput>) => void
  openEdit: (tx: Transaction) => void
}

const ComposerContext = createContext<ComposerValue | null>(null)

export function TransactionComposerProvider({ children }: { children: ReactNode }) {
  const { createTransactions, updateTransaction } = useAppData()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [prefill, setPrefill] = useState<Partial<TransactionInput> | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 'quick' = lançamento em poucos toques · 'full' = formulário completo
  const [mode, setMode] = useState<'quick' | 'full'>('quick')
  // chave para reinicializar o estado do formulário a cada abertura
  const [formKey, setFormKey] = useState(0)

  const openNew = useCallback((pf?: Partial<TransactionInput>) => {
    setEditing(null)
    setPrefill(pf)
    setError(null)
    // Prefill (ex.: "novo lançamento desta empresa/venda") já vai direto ao
    // completo; entrada solta começa no rápido.
    setMode(pf ? 'full' : 'quick')
    setFormKey((k) => k + 1)
    setOpen(true)
  }, [])

  const openEdit = useCallback((tx: Transaction) => {
    setEditing(tx)
    setPrefill(undefined)
    setError(null)
    setMode('full')
    setFormKey((k) => k + 1)
    setOpen(true)
  }, [])

  const close = useCallback(() => {
    if (submitting) return
    setOpen(false)
  }, [submitting])

  const handleSubmit = useCallback(
    async (rows: TransactionInput[]) => {
      if (rows.length === 0) return
      setSubmitting(true)
      setError(null)
      try {
        if (editing) {
          await updateTransaction(editing.id, rows[0])
        } else {
          await createTransactions(rows)
        }
        setOpen(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao salvar o lançamento.')
      } finally {
        setSubmitting(false)
      }
    },
    [editing, createTransactions, updateTransaction],
  )

  const value = useMemo<ComposerValue>(() => ({ openNew, openEdit }), [openNew, openEdit])

  return (
    <ComposerContext.Provider value={value}>
      {children}
      <Modal
        open={open}
        onClose={close}
        title={editing ? 'Editar lançamento' : mode === 'quick' ? 'Lançamento rápido' : 'Novo lançamento'}
        description={
          editing
            ? undefined
            : mode === 'quick'
              ? 'Registre em poucos toques o que já entrou ou saiu.'
              : 'Receita, despesa, venda com comissão ou parcelamento.'
        }
      >
        {mode === 'quick' && !editing ? (
          <QuickEntryForm
            key={formKey}
            submitting={submitting}
            error={error}
            onSubmit={handleSubmit}
            onSwitchToFull={() => setMode('full')}
            onCancel={close}
          />
        ) : (
          <TransactionForm
            key={formKey}
            editing={editing}
            prefill={prefill}
            submitting={submitting}
            error={error}
            onSubmit={handleSubmit}
            onCancel={close}
          />
        )}
      </Modal>
    </ComposerContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useComposer() {
  const ctx = useContext(ComposerContext)
  if (!ctx) throw new Error('useComposer deve ser usado dentro de <TransactionComposerProvider>')
  return ctx
}
