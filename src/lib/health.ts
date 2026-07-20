import type { HealthStatus } from '@/types'
import type { Kpis } from './finance'

/**
 * Saúde da empresa por quatro fatores.
 *
 * O critério anterior era margem líquida sozinha, e isso mente nos dois
 * sentidos: empresa com margem alta e caixa vazio quebra, e empresa com
 * margem apertada mas caixa forte e recebíveis em dia está bem. Aqui cada
 * fator vale pontos e o resultado vem com o motivo escrito.
 */
export interface HealthFactor {
  id: 'margin' | 'runway' | 'overdue' | 'commission'
  label: string
  status: HealthStatus
  detail: string
  /** 0 a 100. */
  score: number
}

export interface HealthReport {
  status: HealthStatus
  /** Média ponderada dos fatores, 0 a 100. */
  score: number
  factors: HealthFactor[]
  headline: string
}

export interface HealthInput {
  kpis: Kpis
  /** Meses de fôlego de caixa. `null` quando não há conta cadastrada. */
  runwayMonths: number | null
  /** Total vencido e não pago/recebido. */
  overdueAmount: number
  /** Meta de receita do mês, se houver. */
  revenueGoal?: number
}

// A soma dos pesos é 100. Caixa pesa mais que margem de propósito:
// falta de caixa mata mais rápido que margem apertada.
const WEIGHTS = { margin: 30, runway: 35, overdue: 20, commission: 15 }

export function computeHealth(input: HealthInput): HealthReport {
  const { kpis, runwayMonths, overdueAmount } = input
  const factors: HealthFactor[] = []

  // 1. Lucratividade — agora medida DEPOIS do imposto, então as faixas
  // são mais baixas do que o antigo critério de 20%.
  factors.push(marginFactor(kpis))

  // 2. Fôlego de caixa
  factors.push(runwayFactor(runwayMonths))

  // 3. Inadimplência
  factors.push(overdueFactor(kpis, overdueAmount))

  // 4. Concentração em comissão
  factors.push(commissionFactor(kpis))

  const applicable = factors.filter((f) => f.score >= 0)
  const totalWeight = applicable.reduce((s, f) => s + WEIGHTS[f.id], 0)
  const score =
    totalWeight > 0
      ? Math.round(applicable.reduce((s, f) => s + f.score * WEIGHTS[f.id], 0) / totalWeight)
      : 0

  const status: HealthStatus = score >= 70 ? 'healthy' : score >= 45 ? 'warning' : 'critical'

  const worst = [...applicable].sort((a, b) => a.score - b.score)[0]
  const headline =
    status === 'healthy'
      ? 'Operação saudável'
      : worst
        ? `Atenção: ${worst.label.toLowerCase()}`
        : 'Sem dados suficientes'

  return { status, score, factors, headline }
}

function marginFactor(kpis: Kpis): HealthFactor {
  if (kpis.revenue === 0) {
    return {
      id: 'margin',
      label: 'Lucratividade',
      status: 'warning',
      detail: 'Sem receita no período.',
      score: -1,
    }
  }

  const m = kpis.netMargin
  const pct = `${(m * 100).toFixed(0)}%`

  if (m < 0) {
    return {
      id: 'margin',
      label: 'Lucratividade',
      status: 'critical',
      detail: `Prejuízo: margem de ${pct}. As despesas superam o que sobra da receita.`,
      score: 0,
    }
  }
  if (m < 0.1) {
    return {
      id: 'margin',
      label: 'Lucratividade',
      status: 'warning',
      detail: `Margem de ${pct} — apertada para o setor. Qualquer imprevisto vira prejuízo.`,
      score: 40,
    }
  }
  if (m < 0.2) {
    return {
      id: 'margin',
      label: 'Lucratividade',
      status: 'healthy',
      detail: `Margem de ${pct}, dentro do razoável para intermediação imobiliária.`,
      score: 75,
    }
  }
  return {
    id: 'margin',
    label: 'Lucratividade',
    status: 'healthy',
    detail: `Margem de ${pct} — confortável.`,
    score: 100,
  }
}

function runwayFactor(months: number | null): HealthFactor {
  if (months === null) {
    return {
      id: 'runway',
      label: 'Fôlego de caixa',
      status: 'warning',
      detail: 'Cadastre suas contas para o sistema medir quanto tempo a empresa aguenta.',
      score: -1,
    }
  }
  if (!isFinite(months)) {
    return {
      id: 'runway',
      label: 'Fôlego de caixa',
      status: 'healthy',
      detail: 'Sem custo fixo registrado — não há queima mensal a cobrir.',
      score: 100,
    }
  }

  const n = months.toLocaleString('pt-BR')
  if (months < 1) {
    return {
      id: 'runway',
      label: 'Fôlego de caixa',
      status: 'critical',
      detail: `Menos de um mês de caixa. Um mês sem vender e as contas não fecham.`,
      score: 0,
    }
  }
  if (months < 3) {
    return {
      id: 'runway',
      label: 'Fôlego de caixa',
      status: 'warning',
      detail: `${n} meses de caixa — abaixo dos 3 meses de reserva recomendados.`,
      score: 45,
    }
  }
  if (months < 6) {
    return {
      id: 'runway',
      label: 'Fôlego de caixa',
      status: 'healthy',
      detail: `${n} meses de caixa. Reserva formada.`,
      score: 85,
    }
  }
  return {
    id: 'runway',
    label: 'Fôlego de caixa',
    status: 'healthy',
    detail: `${n} meses de caixa — folga confortável para investir.`,
    score: 100,
  }
}

function overdueFactor(kpis: Kpis, overdueAmount: number): HealthFactor {
  if (overdueAmount === 0) {
    return {
      id: 'overdue',
      label: 'Contas em dia',
      status: 'healthy',
      detail: 'Nada vencido.',
      score: 100,
    }
  }

  const base = kpis.revenue > 0 ? kpis.revenue : overdueAmount
  const ratio = overdueAmount / base
  const money = overdueAmount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })

  if (ratio > 0.3) {
    return {
      id: 'overdue',
      label: 'Contas vencidas',
      status: 'critical',
      detail: `${money} vencidos — mais de 30% da receita do período.`,
      score: 10,
    }
  }
  if (ratio > 0.1) {
    return {
      id: 'overdue',
      label: 'Contas vencidas',
      status: 'warning',
      detail: `${money} vencidos e ainda em aberto.`,
      score: 50,
    }
  }
  return {
    id: 'overdue',
    label: 'Contas em dia',
    status: 'healthy',
    detail: `${money} vencidos — volume pequeno.`,
    score: 85,
  }
}

function commissionFactor(kpis: Kpis): HealthFactor {
  if (kpis.revenue === 0) {
    return {
      id: 'commission',
      label: 'Custo de comissão',
      status: 'warning',
      detail: 'Sem receita no período.',
      score: -1,
    }
  }

  const ratio = kpis.costOfSale / kpis.revenue
  const pct = `${(ratio * 100).toFixed(0)}%`

  if (ratio > 0.6) {
    return {
      id: 'commission',
      label: 'Custo de comissão',
      status: 'critical',
      detail: `Corretores levam ${pct} da comissão. Sobra pouco para a estrutura.`,
      score: 15,
    }
  }
  if (ratio > 0.5) {
    return {
      id: 'commission',
      label: 'Custo de comissão',
      status: 'warning',
      detail: `Corretores levam ${pct} — no limite do sustentável.`,
      score: 55,
    }
  }
  return {
    id: 'commission',
    label: 'Custo de comissão',
    status: 'healthy',
    detail: `Corretores levam ${pct} da comissão.`,
    score: 100,
  }
}
