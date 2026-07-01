import { Layers } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { companyDisplayColor } from '@/assets/companies'
import { cn } from '@/lib/utils'

/** Pílulas de escopo: Grupo + cada empresa. Dirige toda a tela. */
export function ScopeSwitcher() {
  const { companies, scopeCompanyId, setScope } = useAppData()

  return (
    <div
      className="flex items-center gap-1.5 overflow-x-auto pb-1"
      role="tablist"
      aria-label="Selecionar empresa ou grupo"
    >
      <Pill
        active={scopeCompanyId === null}
        color="#10B981"
        onClick={() => setScope(null)}
        icon={<Layers className="h-3.5 w-3.5" />}
      >
        Grupo
      </Pill>

      {companies.map((c) => {
        const color = companyDisplayColor(c.slug, c.brand_color, c.accent_color)
        return (
          <Pill
            key={c.id}
            active={scopeCompanyId === c.id}
            color={color}
            onClick={() => setScope(c.id)}
          >
            {c.name}
          </Pill>
        )
      })}
    </div>
  )
}

function Pill({
  active,
  color,
  onClick,
  children,
  icon,
}: {
  active: boolean
  color: string
  onClick: () => void
  children: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-transparent text-white'
          : 'border-line bg-surface text-content-muted hover:bg-surface-2 hover:text-content',
      )}
      style={
        active
          ? { backgroundColor: color, boxShadow: `0 4px 16px -6px ${color}` }
          : undefined
      }
    >
      {!active && !icon && (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      )}
      {icon}
      {children}
    </button>
  )
}
