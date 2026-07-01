import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Select, Input } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import type { ContactType } from '@/types'

const NEW = '__new__'

export function ContactSelect({
  type,
  value,
  onChange,
  id,
}: {
  type: ContactType
  value: string | null
  onChange: (contactId: string | null) => void
  id?: string
}) {
  const { contacts, createContact } = useAppData()
  const list = contacts.filter((c) => c.type === type)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const label = type === 'broker' ? 'corretor' : 'fornecedor'

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const contact = await createContact({
        type,
        name: name.trim(),
        document: null,
        phone: null,
        email: null,
        notes: null,
        is_active: true,
      })
      onChange(contact.id)
      setCreating(false)
      setName('')
    } finally {
      setSaving(false)
    }
  }

  if (creating) {
    return (
      <div className="flex gap-2">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Nome do ${label}`}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreate())}
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={saving}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald text-white disabled:opacity-50"
          aria-label={`Salvar ${label}`}
        >
          {saving ? <Spinner className="h-4 w-4" /> : <Check className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={() => {
            setCreating(false)
            setName('')
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-content-muted"
          aria-label="Cancelar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    )
  }

  return (
    <Select
      id={id}
      value={value ?? ''}
      onChange={(e) => {
        if (e.target.value === NEW) {
          setCreating(true)
          return
        }
        onChange(e.target.value || null)
      }}
    >
      <option value="">— sem {label} —</option>
      {list.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
      <option value={NEW}>+ Cadastrar {label}…</option>
    </Select>
  )
}
