import { useMemo, useState } from 'react'
import { Search, ChevronDown, BookOpen, Lightbulb } from 'lucide-react'
import { Input } from '@/components/ui/Field'
import { Section } from '@/components/ui/Section'
import { EmptyState } from '@/components/ui/EmptyState'
import { GLOSSARY_GROUPS, searchGlossary, type GlossaryEntry } from '@/lib/glossary'
import { cn } from '@/lib/utils'

export function AjudaPage() {
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchGlossary(query), [query])

  const byGroup = useMemo(
    () =>
      GLOSSARY_GROUPS.map((group) => ({
        group,
        entries: results.filter((e) => e.group === group),
      })).filter((g) => g.entries.length > 0),
    [results],
  )

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-xl font-bold text-content">Ajuda</h1>
        <p className="text-sm text-content-faint">
          Todo termo do sistema explicado, com exemplo de imobiliária
        </p>
      </div>

      {/* Como usar, em 4 passos */}
      <Section title="Como usar o sistema" subtitle="Se você está começando agora, é nesta ordem">
        <ol className="space-y-3">
          <Step n={1} title="Cadastre suas contas">
            Em <strong>Contas</strong>, informe cada banco e o saldo que existe hoje. É daí que o
            sistema parte para acompanhar seu dinheiro.
          </Step>
          <Step n={2} title="Configure sua alíquota de imposto">
            Em <strong>Relatórios → Configuração tributária</strong>. Sem ela o lucro que aparece
            na tela é maior do que o real.
          </Step>
          <Step n={3} title="Lance suas receitas e despesas">
            Botão <strong>Novo</strong>. Se já recebeu, marque como recebido e escolha a conta. Se
            ainda vai receber, marque a data prevista — depois é só clicar no ✓ para dar baixa.
          </Step>
          <Step n={4} title="Use a chave Caixa ⇄ Competência">
            No topo da tela. <strong>Caixa</strong> responde “o que entrou na conta”.{' '}
            <strong>Competência</strong> responde “o que a empresa produziu”. Trocar não altera
            nada — só muda a pergunta.
          </Step>
        </ol>
      </Section>

      {/* Busca */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
        <Input
          className="pl-9"
          placeholder="Buscar termo… (ex.: margem, repasse, ponto de equilíbrio)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {byGroup.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-8 w-8" />}
          title="Nenhum termo encontrado"
          description={`Nada no glossário corresponde a “${query}”. Tente uma palavra mais curta.`}
        />
      ) : (
        byGroup.map(({ group, entries }) => (
          <Section key={group} title={group} bodyClassName="pt-1">
            <div className="divide-y divide-line">
              {entries.map((e) => (
                <GlossaryItem key={e.id} entry={e} defaultOpen={!!query} />
              ))}
            </div>
          </Section>
        ))
      )}
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-soft text-xs font-bold text-emerald-dark">
        {n}
      </span>
      <div>
        <p className="text-sm font-semibold text-content">{title}</p>
        <p className="text-sm text-content-muted">{children}</p>
      </div>
    </li>
  )
}

function GlossaryItem({ entry, defaultOpen }: { entry: GlossaryEntry; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="py-1">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
      >
        <span className="text-sm font-semibold text-content">{entry.term}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-content-faint transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="animate-fade-in space-y-2.5 pb-3">
          <p className="text-sm text-content-muted">{entry.what}</p>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-content-faint">
              Por que importa
            </p>
            <p className="text-sm text-content-muted">{entry.why}</p>
          </div>

          {entry.example && (
            <div className="flex gap-2 rounded-lg bg-emerald-soft px-3 py-2.5">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-dark" />
              <p className="text-sm text-content">{entry.example}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
