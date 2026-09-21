import type { Developer, SaleInstallment } from '@/types'
import { parseDateOnly, toDateOnly } from './format'

/*
 * AS ETAPAS DE UMA PARCELA DE COMISSÃO (decisão do Rafael, 21/09/2026).
 *
 * Até aqui a parcela tinha uma data e dois estados: prevista ou recebida. Mas
 * o dinheiro atravessa uma corrente:
 *
 *   1. ESPERANDO O GATILHO — o cliente ainda não pagou à construtora o que o
 *      contrato exige (ex.: 5% do valor do imóvel). Não há nada a fazer além
 *      de acompanhar. Não é dívida de ninguém e não é atraso.
 *   2. A EMITIR NOTA — o gatilho foi atingido: a comissão está liberada e
 *      depende da imobiliária emitir a nota fiscal. Este é o degrau que o
 *      sistema precisa cobrar, porque o dinheiro só anda depois dele.
 *   3. NOTA EMITIDA — a nota saiu; agora é esperar o prazo da construtora
 *      (LOTISA: 10 dias úteis). Passou do prazo, vira cobrança.
 *   4. RECEBIDA — o dinheiro entrou.
 *
 * Este arquivo só LÊ o que está gravado e diz em que degrau a parcela está.
 * Nenhum valor, soma ou imposto é calculado aqui.
 */

export type EtapaDaParcela = 'aguardando_gatilho' | 'a_emitir_nota' | 'nota_emitida' | 'recebida' | 'cancelada'

export interface EtapaInfo {
  etapa: EtapaDaParcela
  /** A palavra que a tela usa. */
  palavra: string
  /** O que falta acontecer, em uma frase. */
  explica: string
  /** A data do marco que define a etapa, quando há. */
  desde: string | null
}

const VOCABULARIO: Record<EtapaDaParcela, { palavra: string; explica: string }> = {
  aguardando_gatilho: {
    palavra: 'Esperando o gatilho',
    explica: 'O cliente ainda não pagou à construtora o que o contrato exige para liberar esta comissão.',
  },
  a_emitir_nota: {
    palavra: 'Emitir nota',
    explica: 'O gatilho foi atingido: a comissão está liberada e espera a nota fiscal para a construtora.',
  },
  nota_emitida: {
    palavra: 'Nota emitida',
    explica: 'A nota saiu. Agora corre o prazo de pagamento da construtora.',
  },
  recebida: { palavra: 'Recebida', explica: 'O dinheiro entrou na conta.' },
  cancelada: { palavra: 'Cancelada', explica: 'Esta parcela foi cancelada.' },
}

export function etapaDaParcela(p: SaleInstallment): EtapaInfo {
  const etapa: EtapaDaParcela =
    p.status === 'cancelada'
      ? 'cancelada'
      : p.status === 'recebida'
        ? 'recebida'
        : p.invoice_issued_date
          ? 'nota_emitida'
          : p.trigger_met_date
            ? 'a_emitir_nota'
            : 'aguardando_gatilho'

  const desde =
    etapa === 'recebida'
      ? p.received_date
      : etapa === 'nota_emitida'
        ? p.invoice_issued_date
        : etapa === 'a_emitir_nota'
          ? p.trigger_met_date
          : null

  return { etapa, desde, ...VOCABULARIO[etapa] }
}

/** Dias inteiros entre duas datas 'YYYY-MM-DD'. */
function dias(de: string, ate: string): number {
  return Math.round((parseDateOnly(ate).getTime() - parseDateOnly(de).getTime()) / 86400000)
}

/**
 * A frase de tempo da etapa — a mesma ideia de `fraseDeTempo` da situação: a
 * data sozinha não diz nada, o verbo com o tempo diz.
 */
export function fraseDaEtapa(p: SaleInstallment, hoje = toDateOnly(new Date())): string {
  const { etapa, desde } = etapaDaParcela(p)
  const d = (iso: string) => parseDateOnly(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  switch (etapa) {
    case 'a_emitir_nota': {
      if (!desde) return 'liberada, falta a nota'
      const n = dias(desde, hoje)
      return n <= 0 ? `liberada hoje · emitir a nota` : `liberada em ${d(desde)} · ${n} dia${n === 1 ? '' : 's'} sem nota`
    }
    case 'nota_emitida': {
      const n = dias(hoje, p.expected_date)
      if (!desde) return `previsto para ${d(p.expected_date)}`
      if (n < 0) return `nota de ${d(desde)} · passou ${-n} dia${n === -1 ? '' : 's'} do prazo`
      if (n === 0) return `nota de ${d(desde)} · o pagamento é hoje`
      return `nota de ${d(desde)} · pagamento em ${n} dia${n === 1 ? '' : 's'}`
    }
    case 'aguardando_gatilho': {
      const n = dias(hoje, p.expected_date)
      return n < 0 ? `estimada para ${d(p.expected_date)} · a data passou` : `estimada para ${d(p.expected_date)}`
    }
    case 'recebida':
      return desde ? `recebida em ${d(desde)}` : 'recebida'
    default:
      return 'cancelada'
  }
}

/** O prazo da construtora, escrito para caber numa linha. */
export function prazoDaConstrutora(d: Developer | null | undefined): string | null {
  if (!d || d.payment_days == null) return null
  const n = d.payment_days
  return `paga em ${n} dia${n === 1 ? '' : 's'} ${d.payment_days_business ? 'útil' : 'corrido'}${n === 1 ? '' : 's'} depois da nota`
}

/**
 * Quando o dinheiro deve entrar se a nota for emitida nesta data. Espelha
 * `add_business_days` do banco (segunda a sexta, sem feriado) para a tela
 * poder mostrar a previsão antes de gravar.
 */
export function previsaoAPartirDaNota(dataDaNota: string, construtora: Developer | null | undefined): string | null {
  if (!construtora || construtora.payment_days == null) return null
  const base = parseDateOnly(dataDaNota)
  if (!construtora.payment_days_business) {
    base.setDate(base.getDate() + construtora.payment_days)
    return toDateOnly(base)
  }
  let contados = 0
  while (contados < construtora.payment_days) {
    base.setDate(base.getDate() + 1)
    const diaDaSemana = base.getDay()
    if (diaDaSemana !== 0 && diaDaSemana !== 6) contados += 1
  }
  return toDateOnly(base)
}
