import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, Info, Handshake } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatMonthYear, toDateOnly } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * O Início responde duas perguntas, nesta ordem: como está o mês, e o que
 * precisa da minha ação hoje.
 *
 * O painel antigo abria com quatro indicadores de DRE, saúde multifator,
 * previsão de doze meses, gráfico de seis meses e lista de alertas por
 * empresa. Informação boa, pergunta errada: nada ali dizia "o Dionata está
 * esperando comissão liberada há cinco dias".
 */
export function Inicio() {
  const { transactions, mes, atencao, receber, pagar, vendas } = useAdmin()

  const chaveMes = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`
  const kpis = useMemo(() => {
    let recebido = 0
    let pago = 0
    let aReceber = 0
    let aPagar = 0
    for (const t of transactions) {
      const entrada = t.kind === 'income'
      if (t.status === 'settled') {
        const d = t.settled_date ?? t.competence_date
        if (d.slice(0, 7) !== chaveMes) continue
        if (entrada) recebido += t.amount
        else pago += t.amount
      } else {
        const d = t.due_date ?? t.competence_date
        if (d.slice(0, 7) !== chaveMes) continue
        if (entrada) aReceber += t.amount
        else aPagar += t.amount
      }
    }
    return {
      recebido: Math.round(recebido * 100) / 100,
      pago: Math.round(pago * 100) / 100,
      aReceber: Math.round(aReceber * 100) / 100,
      aPagar: Math.round(aPagar * 100) / 100,
      resultado: Math.round((recebido - pago) * 100) / 100,
    }
  }, [transactions, chaveMes])

  const trintaDias = useMemo(() => {
    const limite = toDateOnly(new Date(Date.now() + 30 * 86400000))
    const entra = receber.filter((i) => i.date <= limite).reduce((s, i) => s + i.amount, 0)
    const sai = pagar.filter((i) => i.date <= limite).reduce((s, i) => s + i.amount, 0)
    return { entra: Math.round(entra * 100) / 100, sai: Math.round(sai * 100) / 100 }
  }, [receber, pagar])

  const vendasAtivas = vendas.filter((v) => v.status !== 'cancelada')

  if (vendasAtivas.length === 0 && transactions.length === 0) {
    return (
      <EmptyState
        icon={<Handshake className="h-8 w-8" />}
        title="Tudo pronto para a primeira venda"
        description="Registre uma venda e o sistema cuida do resto: parcelas a receber, imposto na hora certa e a comissão do corretor liberada quando o dinheiro entrar."
      />
    )
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-xl font-bold text-content">{formatMonthYear(mes)}</h1>
        <p className="text-sm text-content-faint">
          {vendasAtivas.length} venda{vendasAtivas.length === 1 ? '' : 's'} em carteira
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero rotulo="Recebido" valor={kpis.recebido} tom="income" />
        <Numero rotulo="A receber no mês" valor={kpis.aReceber} tom="pending" />
        <Numero rotulo="A pagar no mês" valor={kpis.aPagar} tom="expense" />
        <Numero
          rotulo="Resultado do mês"
          valor={kpis.resultado}
          tom={kpis.resultado >= 0 ? 'income' : 'expense'}
          detalhe="recebido menos pago"
        />
      </div>

      <section className="rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="text-sm font-semibold text-content">Precisa de atenção</h2>
          {atencao.length > 0 && (
            <span className="tnum text-xs text-content-faint">{atencao.length} item(ns)</span>
          )}
        </div>
        <div className="px-5 pb-5">
          {atencao.length === 0 ? (
            <div className="flex items-center gap-2.5 rounded-xl bg-income/8 px-4 py-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-income" />
              <p className="text-sm text-content">
                Nada vencido, nenhuma comissão liberada esperando e nenhum imposto em aberto.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {atencao.map((a) => (
                <li key={a.id}>
                  <Link
                    to={a.to}
                    className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-2"
                  >
                    {a.tone === 'critical' ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-critical" />
                    ) : a.tone === 'warning' ? (
                      <Circle className="h-4 w-4 shrink-0 fill-pending text-pending" />
                    ) : (
                      <Info className="h-4 w-4 shrink-0 text-content-faint" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-content">{a.title}</p>
                      <p className="truncate text-xs text-content-faint">{a.detail}</p>
                    </div>
                    <span className="tnum shrink-0 text-sm font-semibold text-content">
                      {formatCurrency(a.amount)}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-content-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-content">Próximos 30 dias</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-content-faint">Entra</p>
            <p className="tnum text-lg font-bold text-income">{formatCurrency(trintaDias.entra)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-content-faint">Sai</p>
            <p className="tnum text-lg font-bold text-expense">{formatCurrency(trintaDias.sai)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-content-faint">Diferença</p>
            <p
              className={cn(
                'tnum text-lg font-bold',
                trintaDias.entra - trintaDias.sai >= 0 ? 'text-content' : 'text-expense',
              )}
            >
              {formatCurrency(Math.round((trintaDias.entra - trintaDias.sai) * 100) / 100)}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-content-faint">
          Só o que já está contratado e lançado. Nenhuma estimativa.
        </p>
        <div className="mt-4 flex gap-2">
          <Link to="/receber" className="flex-1">
            <Button variant="secondary" className="w-full">
              A receber
            </Button>
          </Link>
          <Link to="/pagar" className="flex-1">
            <Button variant="secondary" className="w-full">
              A pagar
            </Button>
          </Link>
        </div>
      </section>

      {vendasAtivas.some((v) => v.hasOverdue) && (
        <p className="px-1 text-xs text-content-faint">
          Parcela vencida quase sempre é a construtora atrasando, não o cliente. Reagende na ficha da
          venda para a previsão voltar a fazer sentido — o corretor vê a data nova na hora.
        </p>
      )}
    </div>
  )
}

function Numero({
  rotulo,
  valor,
  tom,
  detalhe,
}: {
  rotulo: string
  valor: number
  tom: 'income' | 'expense' | 'pending' | 'neutro'
  detalhe?: string
}) {
  const cores = {
    income: 'text-income',
    expense: 'text-expense',
    pending: 'text-pending',
    neutro: 'text-content',
  }
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <p className="text-[11px] font-medium uppercase tracking-wide text-content-faint">{rotulo}</p>
      <p className={cn('tnum mt-1 text-xl font-bold leading-tight sm:text-2xl', cores[tom])}>
        {formatCurrency(valor)}
      </p>
      {detalhe && <p className="mt-0.5 text-[11px] text-content-faint">{detalhe}</p>}
    </div>
  )
}
