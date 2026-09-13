import type { Situacao } from '@/lib/situacao'

/*
 * OS SEIS TONS (seção 1 e seção 8 do docs/souza-os.md).
 *
 * Cor é significado, nunca decoração. Cada tom tem um trabalho só, e todo
 * componente que pinta status lê desta tabela — nenhum escreve a própria
 * combinação de fundo, borda e texto. É o que garante que "atenção" tenha a
 * mesma cara no chip, no ícone, na barra e na dica, nos dois temas.
 *
 *   marca    ouro: marca, dinheiro, meta. Racionado: um bloco dourado por tela.
 *   sucesso  verde: ganho, feito, recebido.
 *   atencao  âmbar: prazo, pendente de alguém.
 *   risco    vermelho: vencido, negativo.
 *   info     azul-petróleo: informação neutra, agendado, PREVISTO.
 *   neutro   o que ainda não aconteceu, contexto.
 *
 * As classes estão escritas por inteiro (nada de `text-${tom}`) porque o
 * Tailwind só gera a classe que encontra literal no código.
 */
export type Tom = 'marca' | 'sucesso' | 'atencao' | 'risco' | 'info' | 'neutro'

export const TOM = {
  marca: { texto: 'text-brand-text', fundo: 'bg-brand-tint', borda: 'border-brand/25', ponto: 'bg-brand', solido: 'var(--brand)' },
  sucesso: { texto: 'text-success', fundo: 'bg-success-bg', borda: 'border-success-line', ponto: 'bg-success', solido: 'var(--success)' },
  atencao: { texto: 'text-warning', fundo: 'bg-warning-bg', borda: 'border-warning-line', ponto: 'bg-warning', solido: 'var(--warning)' },
  risco: { texto: 'text-error', fundo: 'bg-error-bg', borda: 'border-error-line', ponto: 'bg-error', solido: 'var(--error)' },
  info: { texto: 'text-info', fundo: 'bg-info-bg', borda: 'border-info-line', ponto: 'bg-info', solido: 'var(--info)' },
  neutro: { texto: 'text-t3', fundo: 'bg-s3/60', borda: 'border-line', ponto: 'bg-t4', solido: 'var(--t3)' },
} as const satisfies Record<Tom, { texto: string; fundo: string; borda: string; ponto: string; solido: string }>

/*
 * Os nomes da paleta anterior. Telas que ainda não migraram passam 'ouro',
 * 'verde' e 'critico' para Secao e Heroi; os componentes aceitam os dois
 * vocabulários e traduzem aqui, num lugar só, até a última tela migrar.
 */
export type TomLegado = 'ouro' | 'verde' | 'critico'
export type TomAceito = Tom | TomLegado

export function normalizarTom(tom: TomAceito): Tom {
  if (tom === 'ouro') return 'marca'
  if (tom === 'verde') return 'sucesso'
  if (tom === 'critico') return 'risco'
  return tom
}

/*
 * Situação de tela → tom. Igual em todas as telas, e é a regra de negócio
 * virando cor: PREVISTA é informação (azul-petróleo), nunca âmbar nem
 * vermelho, porque parcela que a construtora não pagou é espera e não dívida.
 * Vermelho só para `vencida`, que é o que a imobiliária JÁ recebeu e não
 * repassou. A situação em si vem sempre de situacaoDeTela().
 */
export const TOM_DA_SITUACAO: Record<Situacao, Tom> = {
  prevista: 'info',
  liberada: 'atencao',
  vencida: 'risco',
  recebida: 'sucesso',
  cancelada: 'neutro',
}
