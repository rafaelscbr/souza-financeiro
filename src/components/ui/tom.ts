import type { Situacao } from '@/lib/situacao'

/*
 * OS SEIS TONS (docs/souza-os-fundamentos.md 5.1 e 7.7).
 *
 * Cor é significado, nunca decoração. Todo componente que pinta situação lê
 * desta tabela; nenhum escreve a própria combinação de fundo, borda e tinta.
 *
 *   marca    ouro: o único ouro da tela (herói). Racionado.
 *   sucesso  recebido, pago, feito.
 *   atencao  liberada: é dinheiro esperando alguém.
 *   risco    vencida (recebido e não repassado), negativo real.
 *   info     prevista: tem data, ainda não é dinheiro.
 *   neutro   cancelada, contexto.
 *
 * O texto usa os tokens `*-ink` (5.1), que passam contraste sobre o `*-bg`
 * nos dois temas. As classes estão escritas por inteiro (nada de
 * `text-${tom}`): o Tailwind só gera a classe que encontra literal no código.
 */
export type Tom = 'marca' | 'sucesso' | 'atencao' | 'risco' | 'info' | 'neutro'

export interface ClassesDoTom {
  /** Tinta de texto e ícone. */
  texto: string
  fundo: string
  borda: string
  /** Fundo sólido de marcação pequena (ponto, contador). */
  ponto: string
  /** Cor CSS para `style` (barra). */
  solido: string
}

export const TOM = {
  marca: {
    texto: 'text-brand-text',
    fundo: 'bg-brand-tint',
    borda: 'border-transparent',
    ponto: 'bg-brand',
    solido: 'var(--brand)',
  },
  sucesso: {
    texto: 'text-success-ink',
    fundo: 'bg-success-bg',
    borda: 'border-transparent',
    ponto: 'bg-success',
    solido: 'var(--success)',
  },
  atencao: {
    texto: 'text-warning-ink',
    fundo: 'bg-warning-bg',
    borda: 'border-transparent',
    ponto: 'bg-warning',
    solido: 'var(--warning)',
  },
  risco: {
    texto: 'text-error-ink',
    fundo: 'bg-error-bg',
    borda: 'border-transparent',
    ponto: 'bg-error',
    solido: 'var(--error)',
  },
  info: {
    texto: 'text-info-ink',
    fundo: 'bg-info-bg',
    borda: 'border-transparent',
    ponto: 'bg-info',
    solido: 'var(--info)',
  },
  neutro: {
    texto: 'text-t2',
    fundo: 'bg-s3',
    borda: 'border-transparent',
    ponto: 'bg-t4',
    solido: 'var(--t3)',
  },
} as const satisfies Record<Tom, ClassesDoTom>

/*
 * Situação de tela → tom. A situação vem sempre de situacaoDeTela()
 * (src/lib/situacao.ts); aqui ela só vira cor. PREVISTA é informação, nunca
 * âmbar nem vermelho: parcela que a construtora não pagou é espera, não dívida.
 */
/* Souza 3.0: prevista é cinza (espera, sem cor); a cor fica para o que pede ação ou já aconteceu. */
export const TOM_DA_SITUACAO: Record<Situacao, Tom> = {
  prevista: 'neutro',
  liberada: 'atencao',
  vencida: 'risco',
  recebida: 'sucesso',
  cancelada: 'neutro',
}

/* DEPRECADO — apagar na limpeza final. Nomes da paleta anterior, ainda usados
 * por Secao.tsx e Assinatura.tsx. */
export type TomLegado = 'ouro' | 'verde' | 'critico'
/* DEPRECADO — apagar na limpeza final. */
export type TomAceito = Tom | TomLegado

/* DEPRECADO — apagar na limpeza final. */
export function normalizarTom(tom: TomAceito): Tom {
  if (tom === 'ouro') return 'marca'
  if (tom === 'verde') return 'sucesso'
  if (tom === 'critico') return 'risco'
  return tom
}
