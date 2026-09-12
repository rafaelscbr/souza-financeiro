import { parseDateOnly, toDateOnly } from './format'

/*
 * O vocabulário de situação, num lugar só.
 *
 * Antes: a mesma informação era desenhada de cinco formas em cinco arquivos,
 * "Prevista" e "Recebida" tinham a mesma forma, o mesmo peso e o mesmo
 * tamanho — mudando apenas de matiz. Quem não distingue as duas cores (ou
 * está no sol, ou imprimiu) não distinguia dinheiro que existe de dinheiro
 * que talvez venha.
 *
 * Agora cada estado carrega QUATRO sinais redundantes, e a cor é o quarto:
 *   1. a forma do marcador  — anel · disco · quadrado · check · riscado
 *   2. o preenchimento do selo — vazio · sólido · sólido · sólido · riscado
 *   3. a palavra
 *   4. a frase com verbo e tempo
 * Em preto e branco o app continua legível.
 *
 * A distinção mais importante é de negócio, não de desenho: PREVISTA não tem
 * cor tônica nenhuma. A ausência de cor é o sinal — cor significa "dinheiro
 * que existe"; neutro significa "ainda não é dinheiro". É isso que impede
 * estruturalmente que uma previsão se pareça com um pagamento.
 */

export type Situacao = 'prevista' | 'liberada' | 'vencida' | 'recebida' | 'cancelada'

/** Forma do marcador. Reconhecível por silhueta, sem cor. */
export type Marcador = 'anel' | 'disco' | 'quadrado' | 'check' | 'riscado'

export interface Vocabulario {
  marcador: Marcador
  /** Palavra no app do administrador. */
  palavra: string
  /** Palavra no app do corretor. "Liberada" não existe no vocabulário dele. */
  palavraCorretor: string
  /** Por que este estado é o que é — em uma frase, sem jargão. */
  explica: string
  /** Classe do selo: par tinta+fundo explícito, nunca cor com alpha. */
  selo: string
  /** Tinta do valor quando ele merece tônica. Previsto NUNCA recebe. */
  tinta: string
}

export const VOCABULARIO: Record<Situacao, Vocabulario> = {
  prevista: {
    marcador: 'anel',
    palavra: 'Prevista',
    palavraCorretor: 'Prevista',
    explica: 'A construtora ainda não pagou esta parcela. Não é dívida hoje.',
    // O ÚNICO estado sem preenchimento, e é assim que se reconhece. Borda
    // sólida — não tracejada, que a 1px desaparece no celular sob sol.
    // Previsto não recebe cor tônica nem numa casa que usa ouro à vontade:
    // pintá-lo de ouro o faria parecer dinheiro que já existe.
    selo: 'border border-forecast-border text-forecast-ink',
    tinta: 'text-content-muted',
  },
  liberada: {
    marcador: 'disco',
    palavra: 'Liberada',
    palavraCorretor: 'A receber',
    explica: 'A imobiliária já recebeu. Esta comissão está a pagar.',
    // Pílula de ouro: campo sólido com tinta de ouro e borda tônica, no
    // desenho dos chips do CRM. 7,73:1 no escuro, 5,70:1 no claro.
    selo: 'bg-action-soft border border-action/40 text-action-soft-ink',
    tinta: 'text-content',
  },
  vencida: {
    marcador: 'quadrado',
    palavra: 'Vencida',
    palavraCorretor: 'Atrasada',
    explica: 'A imobiliária recebeu e ainda não repassou. Vale um lembrete.',
    selo: 'bg-critical-field border border-critical/40 text-critical-ink',
    tinta: 'text-critical',
  },
  recebida: {
    marcador: 'check',
    palavra: 'Recebida',
    palavraCorretor: 'Recebida',
    explica: 'O dinheiro entrou.',
    selo: 'bg-income-field border border-income/40 text-income-ink',
    tinta: 'text-income',
  },
  cancelada: {
    marcador: 'riscado',
    palavra: 'Cancelada',
    palavraCorretor: 'Cancelada',
    explica: 'Esta parcela foi cancelada. Fica no histórico, riscada.',
    selo: 'border border-line text-content-faint line-through',
    tinta: 'text-content-faint line-through',
  },
}

/**
 * Converte a situação do banco na situação de TELA.
 *
 * A única regra de negócio aqui, e ela é a distinção mais honesta do sistema:
 * **atraso é só o que a imobiliária já recebeu e não pagou.** Uma parcela que
 * a construtora não pagou é espera, não atraso. Por isso "vencida" nunca se
 * aplica a "prevista" — o corretor não está sendo lesado quando a obra atrasa,
 * e chamar isso de atraso inventaria uma dívida que não existe.
 */
export function situacaoDeTela(
  status: 'prevista' | 'liberada' | 'recebida' | 'cancelada' | string,
  dataPrevista: string,
  hoje = toDateOnly(new Date()),
): Situacao {
  if (status === 'liberada' && dataPrevista < hoje) return 'vencida'
  if (status === 'prevista' || status === 'liberada' || status === 'recebida' || status === 'cancelada')
    return status
  return 'prevista'
}

/** Dias inteiros entre duas datas 'YYYY-MM-DD'. */
export function diasEntre(de: string, ate: string): number {
  const a = parseDateOnly(de).getTime()
  const b = parseDateOnly(ate).getTime()
  return Math.round((b - a) / 86400000)
}

/**
 * A frase de tempo — o quarto sinal, e o que carrega o estado sozinho quando
 * tudo mais falha.
 *
 * Datas nunca aparecem sozinhas neste sistema: sempre com verbo. "12/03" não
 * diz nada; "vencida desde 12/03 · 14 dias" diz o estado, a data e a urgência
 * em seis palavras. `received_date` vem do banco desde a migração 008 e nunca
 * tinha sido exibida.
 */
export function fraseDeTempo(
  s: Situacao,
  datas: { prevista: string; liberada?: string | null; recebida?: string | null },
  hoje = toDateOnly(new Date()),
): string {
  const d = (iso: string) => parseDateOnly(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  switch (s) {
    case 'recebida':
      return datas.recebida ? `recebida em ${d(datas.recebida)}` : 'recebida'
    case 'vencida': {
      const base = datas.liberada ?? datas.prevista
      const dias = diasEntre(base, hoje)
      return `liberada em ${d(base)} · ${dias} dia${dias === 1 ? '' : 's'} esperando`
    }
    case 'liberada':
      return datas.liberada ? `liberada em ${d(datas.liberada)}` : 'liberada, a pagar'
    case 'cancelada':
      return 'cancelada'
    default: {
      const dias = diasEntre(hoje, datas.prevista)
      if (dias < 0) return `era prevista para ${d(datas.prevista)} · a construtora atrasou`
      return `prevista para ${d(datas.prevista)}`
    }
  }
}
