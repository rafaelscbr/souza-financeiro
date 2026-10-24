/*
 * EXPORTAR RELATÓRIO (Fase 6, 23/10/2026).
 *
 * Planilha: CSV no formato que o Excel em português abre direto — separador
 * ";", vírgula decimal, BOM para os acentos. Sem biblioteca nova: o arquivo
 * é texto e a tela já tem todos os números.
 *
 * PDF: a impressão do próprio navegador ("Salvar como PDF"), com a folha de
 * estilo de impressão do index.css (sem menu, sem botões) e sempre no tema
 * claro — papel escuro gasta tinta e não se lê impresso.
 *
 * A regra da fase: o total exportado é o da tela. Por isso as telas montam a
 * planilha a partir das MESMAS linhas que desenham, nunca de uma conta nova.
 */

export type Celula = string | number | null | undefined

function celula(v: Celula): string {
  if (v == null) return ''
  if (typeof v === 'number') {
    // "−0,00" assusta na planilha: zero é zero.
    if (Math.abs(v) < 0.005) v = 0
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })
  }
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** O texto do CSV, separado para poder ser conferido sem baixar nada. */
export function textoDaPlanilha(cabecalho: string[], linhas: Celula[][]): string {
  return [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n')
}

/** Nome de arquivo sem acento nem espaço: "DRE · out/2026" → "dre-out-2026". */
export function nomeDeArquivo(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function baixarPlanilha(nome: string, cabecalho: string[], linhas: Celula[][]): void {
  const blob = new Blob(['﻿' + textoDaPlanilha(cabecalho, linhas)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nomeDeArquivo(nome)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Abre a impressão no tema claro e devolve o tema da pessoa ao fechar. */
export function imprimirRelatorio(): void {
  const html = document.documentElement
  const estavaEscuro = !html.classList.contains('light')
  if (estavaEscuro) html.classList.add('light')
  const voltar = () => {
    if (estavaEscuro) html.classList.remove('light')
    window.removeEventListener('afterprint', voltar)
  }
  window.addEventListener('afterprint', voltar)
  window.print()
}
