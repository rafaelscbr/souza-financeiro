import { useMemo, useState } from 'react'
import { KeyRound, Plus, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { FormField, Input, Select } from '@/components/ui/Field'
import { PercentInput } from '@/components/ui/MoneyInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { brokerProduction } from '@/lib/sales'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Contact } from '@/types'

/**
 * Quem vende, quanto produz e quem tem acesso ao próprio painel.
 *
 * O acesso do corretor é ligado aqui, mas o convite em si sai do painel do
 * Supabase: criar usuário pede chave de administração, que não pode viver no
 * navegador. O caminho está escrito na tela para não depender de memória.
 */
export function Corretores() {
  const { vendas, contacts, usuarios, contatosComAcesso, salvarContato, salvarAcesso } = useAdmin()
  const { showToast } = useToast()
  const [editando, setEditando] = useState<Contact | 'novo' | null>(null)
  const [vinculando, setVinculando] = useState(false)


  const producao = useMemo(
    () => brokerProduction({ vendas, contacts, comAcesso: contatosComAcesso, year: null }),
    [vendas, contacts, contatosComAcesso],
  )
  const semVinculo = usuarios.filter((u) => u.role === 'corretor' && !u.contact_id)

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-content">Corretores</h1>
          <p className="text-sm text-content-faint">{producao.length} cadastrado(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setVinculando(true)}>
            <KeyRound className="h-3.5 w-3.5" />
            Acessos
          </Button>
          <Button size="sm" onClick={() => setEditando('novo')}>
            <Plus className="h-4 w-4" />
            Novo corretor
          </Button>
        </div>
      </div>

      {semVinculo.length > 0 && (
        <div className="rounded-2xl border border-pending/30 bg-pending/8 p-4">
          <p className="text-sm font-semibold text-content">
            {semVinculo.length} login sem corretor vinculado
          </p>
          <p className="mt-0.5 text-xs text-content-muted">
            Essas pessoas entram e veem "acesso ainda não liberado". Ligue cada uma a um corretor em
            Acessos.
          </p>
        </div>
      )}

      {producao.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="Nenhum corretor cadastrado"
          description="Cadastre quem vende para poder registrar a comissão e, se quiser, dar acesso ao painel dele."
          action={
            <Button onClick={() => setEditando('novo')}>
              <UserPlus className="h-4 w-4" />
              Cadastrar corretor
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {producao.map((p) => (
            <li key={p.contact.id} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[15px] font-bold text-content">{p.contact.name}</h2>
                    {p.hasAccess && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-income/12 px-1.5 py-0.5 text-[10px] font-semibold text-income">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        com acesso
                      </span>
                    )}
                    {(p.contact as Contact & { is_owner?: boolean }).is_owner && (
                      <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold text-content-muted">
                        você
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-content-faint">
                    {p.sales} venda{p.sales === 1 ? '' : 's'} · VGV {formatCurrency(p.vgv)}
                    {p.salesWithoutVgv > 0 ? ` (${p.salesWithoutVgv} sem valor informado)` : ''}
                    {(p.contact as Contact & { default_broker_pct?: number | null }).default_broker_pct != null
                      ? ` · padrão ${(p.contact as Contact & { default_broker_pct?: number | null }).default_broker_pct}%`
                      : ''}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setEditando(p.contact)}>
                  Editar
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <Mini rotulo="Comissão total" valor={p.commissionTotal} />
                <Mini rotulo="Já paga" valor={p.paid} tom="text-content-muted" />
                <Mini rotulo="Liberada" valor={p.released} tom={p.released > 0 ? 'text-pending' : undefined} />
                <Mini rotulo="Prevista" valor={p.expected} tom="text-content-muted" />
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="px-1 text-xs text-content-faint">
        Produção considera todas as vendas não canceladas, de qualquer ano. O corretor vê os números
        dele por ano no painel próprio.
      </p>

      <EditarCorretor
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
    </div>
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
  const [pct, setPct] = useState<number | null>(
    (existente as (Contact & { default_broker_pct?: number | null }) | null)?.default_broker_pct ?? null,
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  return (
    <Modal
      key={existente?.id ?? (alvo === 'novo' ? 'novo' : 'fechado')}
      open={!!alvo}
      onClose={onFechar}
      title={existente ? 'Editar corretor' : 'Novo corretor'}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={salvando}
            onClick={async () => {
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
            }}
          >
            {salvando ? <Spinner className="h-5 w-5" /> : 'Salvar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="Nome" htmlFor="c-nome">
          <Input id="c-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
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
        <FormField
          label="Percentual padrão"
          htmlFor="c-pct"
          hint="preenche o formulário de venda; dá para mudar em cada venda"
        >
          <PercentInput id="c-pct" value={pct} onChange={setPct} />
        </FormField>
        {erro && (
          <p className="text-sm text-expense" role="alert">
            {erro}
          </p>
        )}
      </div>
    </Modal>
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
    <Modal
      open={aberto}
      onClose={onFechar}
      title="Acessos ao sistema"
      description="Quem entra e o que cada um vê"
      className="sm:max-w-xl"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-surface-2/60 p-3.5 text-xs text-content-muted">
          <p className="mb-1 font-semibold text-content">Como dar acesso a um corretor</p>
          <ol className="list-decimal space-y-0.5 pl-4">
            <li>No painel do Supabase: Authentication → Users → Invite user, com o e-mail dele.</li>
            <li>Ele recebe o convite e cria a senha.</li>
            <li>Volte aqui e ligue o login ao corretor na lista abaixo.</li>
          </ol>
          <p className="mt-1.5">
            Criar usuário exige chave de administração, que não pode ficar no navegador — por isso
            essa parte é no painel.
          </p>
        </div>

        {usuarios.length === 0 ? (
          <p className="text-sm text-content-muted">Nenhum usuário além de você.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {usuarios.map((u) => (
              <li key={u.id} className="space-y-2 px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-content">
                      {u.name ?? u.email ?? u.id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-content-faint">
                      {u.role === 'admin' ? 'administrador' : 'corretor'}
                      {u.is_active ? '' : ' · desativado'}
                    </p>
                  </div>
                  <button
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
                    disabled={ocupado === u.id}
                    className={cn(
                      'shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
                      u.is_active
                        ? 'text-expense hover:bg-expense/10'
                        : 'text-income hover:bg-income/10',
                    )}
                  >
                    {ocupado === u.id ? '…' : u.is_active ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
                {u.role === 'corretor' && (
                  <Select
                    aria-label={`Corretor de ${u.name ?? u.id}`}
                    value={u.contact_id ?? ''}
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}

function Mini({ rotulo, valor, tom = 'text-content' }: { rotulo: string; valor: number; tom?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/60 p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-content-faint">{rotulo}</p>
      <p className={cn('tnum text-sm font-bold', tom)}>{formatCurrency(valor)}</p>
    </div>
  )
}
