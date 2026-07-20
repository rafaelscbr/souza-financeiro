import { useState } from 'react'
import { Check, AlertTriangle } from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { Section } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { PercentInput } from '@/components/ui/MoneyInput'
import { Tip } from '@/components/ui/Tip'
import { companyDisplayColor } from '@/assets/companies'
import { formatCurrency } from '@/lib/format'
import type { Company, TaxRegime } from '@/types'

const REGIMES: { value: TaxRegime; label: string }[] = [
  { value: 'simples', label: 'Simples Nacional' },
  { value: 'presumido', label: 'Lucro Presumido' },
  { value: 'real', label: 'Lucro Real' },
  { value: 'none', label: 'Não contribuinte' },
]

/**
 * Sem alíquota configurada o DRE mostra lucro que não existe. Esta seção
 * é o que impede o sistema de mentir para o dono.
 */
export function TaxSettings() {
  const { businessCompanies } = useAppData()
  const missing = businessCompanies.filter((c) => c.tax_rate == null)

  return (
    <Section
      title="Configuração tributária"
      subtitle="Alíquota efetiva sobre o faturamento de cada empresa"
      action={
        <Tip label="Onde encontrar sua alíquota efetiva">
          Não é a alíquota nominal da tabela do Simples. É a{' '}
          <strong className="text-content">efetiva</strong>: pegue o valor do DAS pago e divida
          pela receita daquele mês.
          <span className="mt-2 block">
            No portal: Receita Federal → Simples Nacional → PGDAS-D → extrato do período. A
            alíquota efetiva vem impressa no extrato.
          </span>
        </Tip>
      }
    >
      {missing.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-pending/10 px-3 py-2 text-xs text-content-muted">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pending" />
          <span>
            {missing.length === 1
              ? `${missing[0].name} está sem alíquota.`
              : `${missing.length} empresas estão sem alíquota.`}{' '}
            Enquanto isso, o imposto delas entra como zero no DRE e no simulador.
          </span>
        </div>
      )}

      <div className="space-y-3">
        {businessCompanies.map((c) => (
          <CompanyTaxRow key={c.id} company={c} />
        ))}
      </div>
    </Section>
  )
}

function CompanyTaxRow({ company }: { company: Company }) {
  const { updateCompanyTax } = useAppData()
  const [regime, setRegime] = useState<TaxRegime>(company.tax_regime ?? 'simples')
  const [rate, setRate] = useState<number | null>(company.tax_rate)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const color = companyDisplayColor(company.slug, company.brand_color, company.accent_color)
  const dirty = regime !== (company.tax_regime ?? 'simples') || rate !== company.tax_rate
  const exempt = regime === 'none'

  async function save() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await updateCompanyTax(company.id, regime, exempt ? 0 : rate)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      // A coluna só existe depois da migração 001.
      setError(
        e instanceof Error && /column|tax_rate|tax_regime/i.test(e.message)
          ? 'Rode a migração 001 no Supabase antes de configurar impostos.'
          : 'Não foi possível salvar.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface-2/50 p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-semibold text-content">{company.name}</span>
        {company.tax_rate == null && (
          <span className="rounded-full bg-pending/15 px-1.5 py-0.5 text-[10px] font-medium text-pending">
            não configurada
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem_auto]">
        <Select
          value={regime}
          onChange={(e) => setRegime(e.target.value as TaxRegime)}
          aria-label={`Regime tributário de ${company.name}`}
        >
          {REGIMES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>

        <PercentInput
          value={exempt ? 0 : rate}
          onChange={setRate}
          disabled={exempt}
          aria-label={`Alíquota efetiva de ${company.name}`}
        />

        <Button size="sm" onClick={save} disabled={!dirty || saving} className="h-11">
          {saved ? <Check className="h-4 w-4" /> : saving ? '…' : 'Salvar'}
        </Button>
      </div>

      {rate != null && rate > 0 && !exempt && (
        <p className="mt-2 text-[11px] text-content-faint">
          A cada {formatCurrency(100000)} faturados, {formatCurrency(100000 * (rate / 100))} vão
          para imposto.
        </p>
      )}

      {error && (
        <p className="mt-2 text-xs text-expense" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
