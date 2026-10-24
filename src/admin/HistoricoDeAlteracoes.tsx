import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Cartao } from '@/components/ui/Cartao'
import { Linha } from '@/components/ui/Lista'
import { EstadoVazio } from '@/components/ui/Estados'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/format'

/*
 * HISTÓRICO DE ALTERAÇÕES (Fase 9, 23/10/2026, migração 045).
 *
 * O banco grava sozinho cada mudança nas tabelas de dinheiro: quem, quando,
 * o quê, de quanto para quanto. Aqui só se lê — ninguém apaga nem corrige o
 * histórico pelo app. As 200 mudanças mais recentes, com "ver mais".
 */

interface Registro {
  id: number
  at: string
  user_name: string | null
  table_name: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  changed: string[] | null
}

const TABELA: Record<string, string> = {
  sales: 'Venda',
  sale_installments: 'Parcela',
  transactions: 'Lançamento',
  transfers: 'Transferência',
  accounts: 'Conta',
  contacts: 'Contato',
  companies: 'Empresa',
  commission_settings: 'Percentuais',
  sales_goals: 'Meta',
  broker_profiles: 'Plano do corretor',
  budget_lines: 'Orçamento',
}
const OPERACAO = { INSERT: 'criou', UPDATE: 'alterou', DELETE: 'apagou' } as const

/** Campos de dinheiro: aparecem como "R$ antes → R$ depois". */
const DINHEIRO = /amount|value|total|vgv|budget/

function nomeDoRegistro(r: Registro): string {
  const d = r.new_data ?? r.old_data ?? {}
  return String(d.title ?? d.description ?? d.name ?? d.category ?? '').slice(0, 80)
}

function mudancas(r: Registro): string {
  if (r.operation !== 'UPDATE' || !r.changed) return ''
  return r.changed
    .slice(0, 4)
    .map((campo) => {
      const antes = r.old_data?.[campo]
      const depois = r.new_data?.[campo]
      if (DINHEIRO.test(campo) && typeof depois !== 'object') {
        const f = (v: unknown) => (v == null ? '—' : formatCurrency(Number(v)))
        return `${campo}: ${f(antes)} → ${f(depois)}`
      }
      const t = (v: unknown) => (v == null ? '—' : String(v).slice(0, 30))
      return `${campo}: ${t(antes)} → ${t(depois)}`
    })
    .join(' · ')
}

export function HistoricoDeAlteracoes() {
  const [registros, setRegistros] = useState<Registro[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [limite, setLimite] = useState(200)

  useEffect(() => {
    let vivo = true
    supabase
      .from('audit_log')
      .select('id, at, user_name, table_name, operation, old_data, new_data, changed')
      .order('id', { ascending: false })
      .limit(limite)
      .then(({ data, error }) => {
        if (!vivo) return
        if (error) setErro('Não foi possível carregar o histórico.')
        else setRegistros((data as Registro[]) ?? [])
      })
    return () => {
      vivo = false
    }
  }, [limite])

  return (
    <Cartao>
      <Cartao.Cabecalho
        titulo="Histórico de alterações"
        icone={History}
        meta="quem mudou o quê, quando, e de quanto para quanto"
      />
      {erro ? (
        <Cartao.Corpo>
          <p className="text-texto-corrido text-t3">{erro}</p>
        </Cartao.Corpo>
      ) : registros && registros.length === 0 ? (
        <Cartao.Corpo>
          <EstadoVazio
            icone={History}
            titulo="Nada alterado ainda"
            descricao="A partir de agora, toda mudança em vendas, parcelas, lançamentos, contas, metas e percentuais aparece aqui."
          />
        </Cartao.Corpo>
      ) : (
        <Cartao.Lista rotuloAcessivel="Histórico de alterações">
          {(registros ?? []).map((r) => (
            <Linha
              key={r.id}
              titulo={`${r.user_name ?? 'Sistema'} ${OPERACAO[r.operation]} ${TABELA[r.table_name] ?? r.table_name}${
                nomeDoRegistro(r) ? ` · ${nomeDoRegistro(r)}` : ''
              }`}
              meta={[
                new Date(r.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
                mudancas(r),
              ]
                .filter(Boolean)
                .join(' · ')}
            />
          ))}
        </Cartao.Lista>
      )}
      {registros && registros.length >= limite && (
        <Cartao.Rodape>
          <Button variant="fantasma" size="sm" onClick={() => setLimite((l) => l + 200)}>
            Ver mais
          </Button>
        </Cartao.Rodape>
      )}
    </Cartao>
  )
}
