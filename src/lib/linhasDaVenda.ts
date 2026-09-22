import type { SaleInstallment } from '@/types'
import type { CorretorParcela } from '@/corretor/CorretorData'
import type { SaleView } from './sales'
import type { Situacao } from './situacao'
import { formatCurrency } from './format'

/*
 * As linhas do Demonstrativo (7.3.1).
 *
 * SÓ APRESENTAÇÃO. Nenhuma conta nova mora aqui: cada valor é um campo que já
 * chega gravado do banco (parcela por parcela) ou o que `cascadeOf()` de
 * sales.ts já devolve para a tela da Venda. As subtrações que aparecem abaixo
 * são exatamente as que as telas já faziam (Venda.tsx: `base`,
 * `corretorContratado`; MinhasVendas.tsx: `ContaDaParcela`), movidas para um
 * lugar só.
 *
 * Perfil corretor: a linha "Fica para a imobiliária" NÃO é gerada. Não é
 * escondida por prop: ela simplesmente não é escrita (teste em
 * scripts/teste-linhas-da-venda.mjs).
 */

export type Perfil = 'admin' | 'corretor'
export type SinalLinha = '+' | '−' | '='

/** Onde o número abre (drill-down). A tela decide o que desenhar para cada tipo. */
export type OrigemLinha =
  | { tipo: 'transacao'; id: string }
  | { tipo: 'parcela'; id: string }
  | { tipo: 'venda'; id: string }

/** Identidade da linha, para o resumo e para a tela achar a linha certa. */
export type ChaveLinha =
  | 'bruto'
  | 'iss'
  | 'simples'
  | 'impostos'
  | 'base'
  | 'corretor'
  | 'desconto'
  | 'socio'
  | 'fica'
  /* Só a tela de Simulação usa estas duas: a estrutura entra na conta dela. */
  | 'estrutura'
  | 'nova'
  /* A conta do VGL (22/09/2026): VGV firme − parceria − nota. */
  | 'vgv'
  | 'parceria'
  | 'notaFiscal'
  | 'vgl'

export interface LinhaDemonstrativo {
  chave: ChaveLinha
  rotulo: string
  detalhe?: string
  sinal: SinalLinha
  /** Sempre o módulo; o sinal tem coluna própria. */
  valor: number
  origem?: OrigemLinha
  situacao?: Situacao
}

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

// ---------------------------------------------------------------------------
// Parcela
// ---------------------------------------------------------------------------

/** A parcela como o admin a recebe (SaleInstallment) ou como o corretor a recebe (CorretorParcela). */
export type ParcelaDaConta = SaleInstallment | CorretorParcela

export interface OpcoesDaParcela {
  /** Percentuais gravados na venda, só para escrever o detalhe ("3%"). */
  venda?: Pick<SaleView, 'iss_pct' | 'simples_pct' | 'broker_pct' | 'brokerName'>
  /** Situação da comissão do corretor nesta parcela (a tela já a tem via situacaoDeTela). */
  situacaoCorretor?: Situacao
}

function ehDoCorretor(p: ParcelaDaConta): p is CorretorParcela {
  return 'installment_amount' in p
}

function detalheCorretor(pct: number | null | undefined, ajuste: number): string | undefined {
  const partes: string[] = []
  if (pct != null) partes.push(`${pct}% da base`)
  if (ajuste > 0) partes.push(`com desconto combinado de ${formatCurrency(ajuste)}`)
  return partes.length ? partes.join(' · ') : undefined
}

/**
 * As linhas da conta de UMA parcela, de cima para baixo: bruto, menos, igual.
 * Admin: bruto · − ISS · − Simples · − corretor · − sócio · = Fica para a imobiliária.
 * Corretor: parcela · − ISS · − Simples · = base · sua comissão · − desconto · = Fica para você.
 */
export function linhasDaParcela(
  parcela: ParcelaDaConta,
  perfil: Perfil,
  opcoes: OpcoesDaParcela = {},
): LinhaDemonstrativo[] {
  const { venda, situacaoCorretor } = opcoes
  if (ehDoCorretor(parcela)) return linhasDoCorretor(parcela, situacaoCorretor)
  const p = parcela
  if (perfil === 'corretor')
    // O corretor nunca vê a conta da imobiliária: a mesma conta que ele já lia, só até a comissão dele.
    return linhasDoCorretor({
      installment_amount: p.amount,
      iss_amount: p.iss_amount,
      simples_amount: p.simples_amount,
      broker_pct: venda?.broker_pct ?? null,
      broker_amount: p.broker_amount,
      broker_adjustment: p.broker_adjustment,
    }, situacaoCorretor)
  const linhas: LinhaDemonstrativo[] = [
    {
      chave: 'bruto',
      rotulo: p.status === 'recebida' ? 'Parcela recebida' : 'Parcela da comissão',
      sinal: '+',
      valor: p.amount,
      origem: p.revenue_tx_id ? { tipo: 'transacao', id: p.revenue_tx_id } : { tipo: 'parcela', id: p.id },
    },
  ]
  if (p.iss_amount > 0)
    linhas.push({
      chave: 'iss',
      rotulo: 'ISS retido pela construtora',
      detalhe: venda ? `${venda.iss_pct}%` : undefined,
      sinal: '−',
      valor: p.iss_amount,
      origem: p.iss_tx_id ? { tipo: 'transacao', id: p.iss_tx_id } : undefined,
    })
  if (p.simples_amount > 0)
    linhas.push({
      chave: 'simples',
      rotulo: 'Simples Nacional',
      detalhe: venda ? `${venda.simples_pct}%` : undefined,
      sinal: '−',
      valor: p.simples_amount,
      origem: p.simples_tx_id ? { tipo: 'transacao', id: p.simples_tx_id } : undefined,
    })
  if (p.broker_amount > 0)
    linhas.push({
      chave: 'corretor',
      rotulo: venda?.brokerName ?? 'Corretor',
      detalhe: detalheCorretor(venda?.broker_pct, p.broker_adjustment),
      sinal: '−',
      valor: r2(p.broker_amount - p.broker_adjustment),
      origem: p.broker_tx_id ? { tipo: 'transacao', id: p.broker_tx_id } : undefined,
      situacao: situacaoCorretor,
    })
  if (p.owner_amount > 0)
    linhas.push({
      chave: 'socio',
      rotulo: 'Distribuição ao sócio',
      sinal: '−',
      valor: p.owner_amount,
      origem: p.owner_tx_id ? { tipo: 'transacao', id: p.owner_tx_id } : undefined,
    })
  // O mesmo campo gravado que a tela da Venda já mostra por parcela (p.net_amount).
  linhas.push({ chave: 'fica', rotulo: 'Fica para a imobiliária', sinal: '=', valor: p.net_amount })
  return linhas
}

/** A conta que o corretor já lia em MinhasVendas (ContaDaParcela), sem o líquido da imobiliária. */
type ContaDoCorretor = Pick<
  CorretorParcela,
  'installment_amount' | 'iss_amount' | 'simples_amount' | 'broker_pct' | 'broker_amount' | 'broker_adjustment'
>

function linhasDoCorretor(p: ContaDoCorretor, situacao?: Situacao): LinhaDemonstrativo[] {
  const linhas: LinhaDemonstrativo[] = [
    { chave: 'bruto', rotulo: 'Parcela da comissão', sinal: '+', valor: p.installment_amount },
  ]
  if (p.iss_amount > 0) linhas.push({ chave: 'iss', rotulo: 'ISS retido na fonte', sinal: '−', valor: p.iss_amount })
  if (p.simples_amount > 0)
    linhas.push({ chave: 'simples', rotulo: 'Simples Nacional', sinal: '−', valor: p.simples_amount })
  linhas.push({
    chave: 'base',
    rotulo: 'Base do cálculo',
    sinal: '=',
    valor: r2(p.installment_amount - p.iss_amount - p.simples_amount),
  })
  linhas.push({
    chave: 'corretor',
    rotulo: 'Sua comissão',
    detalhe: p.broker_pct != null ? `${p.broker_pct}% da base` : undefined,
    sinal: '+',
    valor: p.broker_amount,
  })
  if (p.broker_adjustment > 0)
    linhas.push({ chave: 'desconto', rotulo: 'Desconto combinado', sinal: '−', valor: p.broker_adjustment })
  linhas.push({
    chave: 'fica',
    rotulo: 'Fica para você',
    sinal: '=',
    valor: r2(p.broker_amount - p.broker_adjustment),
    situacao,
  })
  return linhas
}

// ---------------------------------------------------------------------------
// Venda
// ---------------------------------------------------------------------------

/**
 * A conta CONTRATADA da venda inteira, com os totais que `cascadeOf()` já
 * devolve (`venda.cascade`, o mesmo objeto que a tela da Venda usa).
 */
export function linhasDaVenda(venda: SaleView, perfil: Perfil): LinhaDemonstrativo[] {
  const c = venda.cascade
  const vivas = venda.installments.filter((i) => i.status !== 'cancelada')
  const linhas: LinhaDemonstrativo[] = [
    {
      chave: 'bruto',
      rotulo: perfil === 'corretor' ? 'Comissão da venda' : 'Comissão da imobiliária',
      detalhe: vivas.length > 1 ? `soma das ${vivas.length} parcelas` : 'parcela única',
      sinal: '+',
      valor: c.commission,
      origem: { tipo: 'venda', id: venda.id },
    },
  ]
  if (c.iss > 0)
    linhas.push({ chave: 'iss', rotulo: 'ISS retido pela construtora', detalhe: `${venda.iss_pct}%`, sinal: '−', valor: c.iss })
  if (c.simples > 0)
    linhas.push({ chave: 'simples', rotulo: 'Simples Nacional', detalhe: `${venda.simples_pct}%`, sinal: '−', valor: c.simples })

  if (perfil === 'corretor') {
    // As mesmas contas de Venda.tsx (`base`, `corretorContratado`); sem o líquido da imobiliária.
    const conta = linhasDoCorretor({
      installment_amount: c.commission,
      iss_amount: c.iss,
      simples_amount: c.simples,
      broker_pct: venda.broker_pct,
      broker_amount: r2(vivas.reduce((s, p) => s + p.broker_amount, 0)),
      broker_adjustment: c.brokerAdjustment,
    })
    // bruto, ISS e Simples já estão escritos acima, com o detalhe da venda.
    linhas.push(...conta.filter((l) => l.chave !== 'bruto' && l.chave !== 'iss' && l.chave !== 'simples'))
    return linhas
  }

  if (c.broker > 0)
    linhas.push({
      chave: 'corretor',
      rotulo: venda.brokerName ?? 'Corretor',
      detalhe: detalheCorretor(venda.broker_pct, c.brokerAdjustment),
      sinal: '−',
      valor: c.broker,
    })
  if (c.owner > 0)
    linhas.push({
      chave: 'socio',
      rotulo: 'Distribuição ao sócio',
      detalhe: venda.owner_profit_pct != null ? `${venda.owner_profit_pct}%` : undefined,
      sinal: '−',
      valor: c.owner,
    })
  linhas.push({ chave: 'fica', rotulo: 'Fica para a imobiliária', sinal: '=', valor: c.net })
  return linhas
}

// ---------------------------------------------------------------------------
// Resumo da Parcela (7.3.3: colunas Impostos · Corretor · Fica)
// ---------------------------------------------------------------------------

export interface ResumoDaParcela {
  /** Parcela bruta. */
  valor: number
  /** ISS + Simples, os dois campos gravados, juntos numa célula (abre as duas linhas). */
  impostos: number
  /** A comissão do corretor nesta parcela (já com o desconto combinado, como em cascadeOf). */
  corretor: { valor: number; nome: string; detalhe?: string; situacao?: Situacao } | null
  /** "Fica para a imobiliária". Nunca existe no perfil corretor. */
  fica: number | null
  /** Demonstrativo resumido da forma C (celular). */
  linhas: LinhaDemonstrativo[]
}

export function resumoDaParcela(
  parcela: ParcelaDaConta,
  perfil: Perfil,
  opcoes: OpcoesDaParcela = {},
): ResumoDaParcela {
  const completas = linhasDaParcela(parcela, perfil, opcoes)
  const doCorretor = ehDoCorretor(parcela)
  const valor = doCorretor ? parcela.installment_amount : parcela.amount
  const impostos = r2(parcela.iss_amount + parcela.simples_amount)
  const linhaCorretor = completas.find((l) => l.chave === 'corretor')
  const linhaFica = completas.find((l) => l.chave === 'fica')

  if (perfil === 'corretor' || doCorretor) {
    // O corretor lê a conta dele inteira; nada da imobiliária.
    return {
      valor,
      impostos,
      corretor: linhaFica ? { valor: linhaFica.valor, nome: 'Você', situacao: linhaFica.situacao } : null,
      fica: null,
      linhas: completas,
    }
  }

  const linhas: LinhaDemonstrativo[] = []
  if (impostos > 0)
    linhas.push({ chave: 'impostos', rotulo: 'Impostos', detalhe: 'ISS e Simples', sinal: '−', valor: impostos })
  if (linhaCorretor) linhas.push(linhaCorretor)
  const socio = completas.find((l) => l.chave === 'socio')
  if (socio) linhas.push(socio)
  if (linhaFica) linhas.push(linhaFica)
  return {
    valor,
    impostos,
    corretor: linhaCorretor
      ? { valor: linhaCorretor.valor, nome: linhaCorretor.rotulo, detalhe: linhaCorretor.detalhe, situacao: linhaCorretor.situacao }
      : null,
    fica: linhaFica ? linhaFica.valor : null,
    linhas,
  }
}
