import type { BrokerProfile, CommissionSettings, NivelCorretor, Sale, SalesGoal } from '@/types'

/*
 * O MOTOR DO PLANO DE CARREIRA (Fase 1, 23/10/2026).
 *
 * Todas as regras de comissão, nível, gestão e meta moram aqui, e só aqui.
 * As telas perguntam; não calculam. Fontes: os PDFs de plano de carreira de
 * outubro/2026 e as decisões de 22-23/10 (docs/plano-reconstrucao-2026-10.md,
 * seção 3.1). Os percentuais vêm de `commission_settings` (041), editáveis e
 * com vigência; os valores abaixo só valem se a tabela ainda não existir.
 *
 * A conta de uma parcela é a mesma do banco (register_sale), com centavo
 * arredondado em cada passo:
 *   comissão − ISS (só se a construtora retém) − DAS sobre o que sobrou = BASE
 *   corretor = base × % do nível;  gestão = base × % do gestor
 *   brinde: meio a meio — metade sai do corretor, metade da imobiliária
 *   imobiliária = base − corretor − gestão − metade do brinde
 */

export const PADRAO: Omit<CommissionSettings, 'id' | 'company_id' | 'valid_from' | 'notes' | 'created_at'> = {
  launch_commission_pct: 5,
  resale_commission_pct: 6,
  iss_pct: 3,
  das_pct: 6,
  manager_base_pct: 3,
  manager_bonus_pct: 8,
  level1_pct: 40,
  level2_pct: 45,
  level3_pct: 50,
  level2_from_vgv: 5000000,
  level3_from_vgv: 10000000,
  maintenance_vgv_12m: 2500000,
}

export type Percentuais = typeof PADRAO

const r2 = (v: number) => Math.round(v * 100) / 100

/** Os % que valem numa data: a linha mais recente que começa até ela. */
export function configVigente(configs: CommissionSettings[], data: string): Percentuais {
  const vigentes = configs.filter((c) => c.valid_from <= data).sort((a, b) => a.valid_from.localeCompare(b.valid_from))
  return vigentes[vigentes.length - 1] ?? configs[0] ?? PADRAO
}

// ---------------------------------------------------------------------------
// A conta de uma comissão
// ---------------------------------------------------------------------------

export interface ContaDaComissao {
  comissao: number
  iss: number
  das: number
  base: number
  corretor: number
  gestao: number
  brindeCorretor: number
  brindeImobiliaria: number
  imobiliaria: number
}

export function calcularComissao(p: {
  comissao: number
  retemIss: boolean
  issPct: number
  emiteNota: boolean
  dasPct: number
  corretorPct: number | null
  gestaoPct?: number | null
  brinde?: number
}): ContaDaComissao {
  const iss = p.retemIss ? r2((p.comissao * p.issPct) / 100) : 0
  const das = p.emiteNota ? r2(((p.comissao - iss) * p.dasPct) / 100) : 0
  const base = r2(p.comissao - iss - das)
  const corretorCheio = p.corretorPct ? r2((base * p.corretorPct) / 100) : 0
  const gestao = p.gestaoPct ? r2((base * p.gestaoPct) / 100) : 0
  // Brinde meio a meio (23/10/2026); sem corretor, a imobiliária paga inteiro.
  const brinde = r2(p.brinde ?? 0)
  const brindeCorretor = corretorCheio > 0 ? r2(brinde / 2) : 0
  const brindeImobiliaria = r2(brinde - brindeCorretor)
  return {
    comissao: r2(p.comissao),
    iss,
    das,
    base,
    corretor: r2(corretorCheio - brindeCorretor),
    gestao,
    brindeCorretor,
    brindeImobiliaria,
    imobiliaria: r2(base - corretorCheio - gestao - brindeImobiliaria),
  }
}

/** A comissão padrão de contrato pelo tipo do imóvel. */
export function comissaoPadrao(cfg: Percentuais, tipo: 'lancamento' | 'terceiros'): number {
  return tipo === 'terceiros' ? cfg.resale_commission_pct : cfg.launch_commission_pct
}

// ---------------------------------------------------------------------------
// VGV, VLV e nível
// ---------------------------------------------------------------------------

/** Venda que conta: da imobiliária (não de pessoa física) e não cancelada. */
export function vendaConta(s: Sale): boolean {
  return !s.is_personal && s.status !== 'cancelada'
}

/** VGV = valor geral vendido: o imóvel inteiro, mesmo em parceria (decisão de 23/10). */
export function vgvDaVenda(s: Sale): number {
  return s.property_value ?? 0
}

/**
 * VLV = Valor Líquido Vendido (23/10/2026): a parte proporcional da Souza.
 * Em parceria, o VGV vezes a fatia da Souza; sem parceria, igual ao VGV.
 */
export function vlvDaVenda(s: Sale): number {
  return r2((vgvDaVenda(s) * (s.partner_share_pct ?? 100)) / 100)
}

/** VGV acumulado do corretor até uma data (inclusive), para o nível. */
export function vgvAcumulado(sales: Sale[], contactId: string, ate: string): number {
  return r2(
    sales
      .filter((s) => vendaConta(s) && s.broker_id === contactId && s.sale_date <= ate)
      .reduce((t, s) => t + vgvDaVenda(s), 0),
  )
}

export const NOME_DO_NIVEL: Record<NivelCorretor, string> = {
  corretor: 'Corretor',
  pleno: 'Pleno',
  senior: 'Sênior',
}

export interface NivelDoCorretor {
  nivel: NivelCorretor
  pct: number
  /** De onde veio: decisão da diretoria, % próprio ou o VGV acumulado. */
  origem: 'decisao' | 'pct_proprio' | 'vgv'
  vgv: number
  /** Quanto falta de VGV para o próximo nível, quando há. */
  proximo: { nivel: NivelCorretor; falta: number } | null
}

export function nivelDoCorretor(p: { perfil?: BrokerProfile; vgv: number; cfg: Percentuais }): NivelDoCorretor {
  const { cfg, vgv } = p
  const pctDe = (n: NivelCorretor) => (n === 'senior' ? cfg.level3_pct : n === 'pleno' ? cfg.level2_pct : cfg.level1_pct)
  const peloVgv: NivelCorretor = vgv >= cfg.level3_from_vgv ? 'senior' : vgv >= cfg.level2_from_vgv ? 'pleno' : 'corretor'
  const nivel = p.perfil?.level_override ?? peloVgv
  const proximo =
    nivel === 'senior'
      ? null
      : nivel === 'pleno'
        ? { nivel: 'senior' as const, falta: r2(Math.max(0, cfg.level3_from_vgv - vgv)) }
        : { nivel: 'pleno' as const, falta: r2(Math.max(0, cfg.level2_from_vgv - vgv)) }
  if (p.perfil?.pct_override != null) {
    return { nivel, pct: p.perfil.pct_override, origem: 'pct_proprio', vgv, proximo }
  }
  return { nivel, pct: pctDe(nivel), origem: p.perfil?.level_override ? 'decisao' : 'vgv', vgv, proximo }
}

/** O gestor que ganha gestão sobre a venda deste corretor. Nunca o próprio corretor. */
export function gestorDoCorretor(perfis: BrokerProfile[], brokerId: string | null): string | null {
  if (!brokerId) return null
  const gestor = perfis.find((p) => p.contact_id === brokerId)?.manager_id ?? null
  return gestor && gestor !== brokerId ? gestor : null
}

// ---------------------------------------------------------------------------
// Metas
// ---------------------------------------------------------------------------

/** A meta de VGV do mês (`YYYY-MM`). `contactId` nulo = a meta geral. */
export function metaDoMes(metas: SalesGoal[], contactId: string | null, mes: string): number | null {
  const vigentes = metas
    .filter((m) => (m.contact_id ?? null) === contactId)
    .filter((m) => m.start_month.slice(0, 7) <= mes && (m.end_month === null || m.end_month.slice(0, 7) >= mes))
    .sort((a, b) => a.start_month.localeCompare(b.start_month))
  return vigentes.length ? vigentes[vigentes.length - 1].monthly_vgv : null
}

/** A venda entra na meta? Precisa de corretor, e o corretor tem de contar (as do Rafael não contam). */
export function contaParaMeta(s: Sale, perfis: BrokerProfile[]): boolean {
  if (!vendaConta(s) || !s.broker_id) return false
  return perfis.find((p) => p.contact_id === s.broker_id)?.counts_for_goals ?? true
}

export interface SituacaoDaMeta {
  meta: number | null
  vgv: number
  vlv: number
  vendas: Sale[]
  falta: number
  /** Fração atingida (1 = 100%). Nulo sem meta. */
  atingido: number | null
  bateu: boolean
}

/** O mês da imobiliária (contactId nulo) ou de um corretor, pela data da venda. */
export function situacaoDaMeta(p: {
  sales: Sale[]
  perfis: BrokerProfile[]
  metas: SalesGoal[]
  mes: string
  contactId: string | null
}): SituacaoDaMeta {
  const vendas = p.sales.filter(
    (s) =>
      s.sale_date.slice(0, 7) === p.mes &&
      contaParaMeta(s, p.perfis) &&
      (p.contactId === null || s.broker_id === p.contactId),
  )
  const vgv = r2(vendas.reduce((t, s) => t + vgvDaVenda(s), 0))
  const vlv = r2(vendas.reduce((t, s) => t + vlvDaVenda(s), 0))
  const meta = metaDoMes(p.metas, p.contactId, p.mes)
  return {
    meta,
    vgv,
    vlv,
    vendas,
    falta: meta == null ? 0 : r2(Math.max(0, meta - vgv)),
    atingido: meta ? vgv / meta : null,
    bateu: meta != null && vgv >= meta,
  }
}

/** A gestão de um mês: quantas vendas do time têm gestor e com que %. */
export function gestaoDoMes(sales: Sale[], mes: string) {
  const doTime = sales.filter((s) => vendaConta(s) && s.manager_id && s.sale_date.slice(0, 7) === mes)
  const pcts = [...new Set(doTime.map((s) => s.manager_pct ?? 0))]
  return { vendas: doTime, pcts }
}
