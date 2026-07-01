import { useMemo, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, Users, Building2 } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { Modal } from '@/components/ui/Modal'
import { FormField, Input, Textarea } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { sumByContact } from '@/lib/finance'
import { formatCurrency } from '@/lib/format'
import type { Contact, ContactType } from '@/types'

export function ContatosPage() {
  const { contacts, transactions } = useAppData()
  const [type, setType] = useState<ContactType>('broker')
  const [editing, setEditing] = useState<Contact | null>(null)
  const [creating, setCreating] = useState(false)

  const summaries = useMemo(() => sumByContact(transactions, contacts), [transactions, contacts])
  const summaryOf = (id: string) => summaries.find((s) => s.contact.id === id)
  const list = contacts.filter((c) => c.type === type)

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-content">Contatos</h1>
          <p className="text-sm text-content-faint">Corretores e fornecedores</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo</span>
        </Button>
      </div>

      <Segmented
        ariaLabel="Tipo de contato"
        value={type}
        onChange={setType}
        options={[
          { value: 'broker', label: 'Corretores' },
          { value: 'supplier', label: 'Fornecedores' },
        ]}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={type === 'broker' ? <Users className="h-8 w-8" /> : <Building2 className="h-8 w-8" />}
          title={type === 'broker' ? 'Nenhum corretor cadastrado' : 'Nenhum fornecedor cadastrado'}
          description={
            type === 'broker'
              ? 'Cadastre corretores para acompanhar quanto repassou a cada um.'
              : 'Cadastre fornecedores (Meta Ads, internet, aluguel…) para acompanhar seus gastos.'
          }
          action={<Button onClick={() => setCreating(true)}>Cadastrar</Button>}
        />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {list.map((c) => {
            const s = summaryOf(c.id)
            return (
              <div key={c.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-content">{c.name}</p>
                  <p className="text-xs text-content-faint">
                    {[c.document, c.phone].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tnum text-sm font-semibold text-content">
                    {formatCurrency(s?.total ?? 0)}
                  </p>
                  <p className="text-[11px] text-content-faint">
                    {type === 'broker' ? 'repassado' : 'gasto'}
                    {s && s.pending > 0 ? ` · ${formatCurrency(s.pending)} pend.` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setEditing(c)}
                    className="rounded-lg p-2 text-content-faint hover:bg-surface-2 hover:text-content"
                    aria-label={`Editar ${c.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <DeleteContactButton contact={c} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(creating || editing) && (
        <ContactModal
          type={type}
          contact={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function DeleteContactButton({ contact }: { contact: Contact }) {
  const { deleteContact } = useAppData()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={async () => {
            setDeleting(true)
            try {
              await deleteContact(contact.id)
            } finally {
              setDeleting(false)
            }
          }}
          disabled={deleting}
          className="rounded-lg bg-expense/10 px-2 py-1 text-xs font-medium text-expense"
        >
          {deleting ? '…' : 'Excluir'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-lg px-2 py-1 text-xs text-content-muted hover:bg-surface-2"
        >
          Não
        </button>
      </div>
    )
  }
  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-lg p-2 text-content-faint hover:bg-surface-2 hover:text-expense"
      aria-label={`Excluir ${contact.name}`}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}

function ContactModal({
  type,
  contact,
  onClose,
}: {
  type: ContactType
  contact: Contact | null
  onClose: () => void
}) {
  const { createContact, updateContact } = useAppData()
  const [name, setName] = useState(contact?.name ?? '')
  const [document, setDocument] = useState(contact?.document ?? '')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const [email, setEmail] = useState(contact?.email ?? '')
  const [notes, setNotes] = useState(contact?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const label = (contact?.type ?? type) === 'broker' ? 'corretor' : 'fornecedor'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Informe o nome.')
    setSaving(true)
    setError(null)
    const payload = {
      type: contact?.type ?? type,
      name: name.trim(),
      document: document.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      notes: notes.trim() || null,
      is_active: true,
    }
    try {
      if (contact) await updateContact(contact.id, payload)
      else await createContact(payload)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={contact ? `Editar ${label}` : `Novo ${label}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Nome" htmlFor="ct-name">
          <Input id="ct-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Nome completo" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="CPF/CNPJ" htmlFor="ct-doc">
            <Input id="ct-doc" value={document} onChange={(e) => setDocument(e.target.value)} placeholder="Opcional" />
          </FormField>
          <FormField label="Telefone" htmlFor="ct-phone">
            <Input id="ct-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Opcional" />
          </FormField>
        </div>
        <FormField label="E-mail" htmlFor="ct-email">
          <Input id="ct-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Opcional" />
        </FormField>
        <FormField label="Observações" htmlFor="ct-notes">
          <Textarea id="ct-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
        </FormField>
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
            {saving ? <Spinner className="h-5 w-5" /> : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
