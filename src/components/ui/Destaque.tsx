import type { ReactNode } from 'react'

/*
 * A PALAVRA DE DESTAQUE (Folha Clara, 03/11/2026): pedido do Rafael, "mais
 * dourado com itálico nas frases e nos títulos". Num título de duas ou mais
 * palavras, a última vira Instrument Serif itálico dourado (classe .destaque):
 * "A receber" → "A *receber*", "Pede você" → "Pede *você*".
 *
 * Só uma palavra por frase, e só quando ela é palavra comum: nome próprio
 * (maiúscula), número, sigla ou palavra de menos de 3 letras ficam como estão
 * ("Comissão de Bruno" não vira "*Bruno*"). Nunca em botão, campo, tabela ou
 * número: use só em título de tela e de cartão.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function comDestaque(texto: ReactNode): ReactNode {
  if (typeof texto !== 'string') return texto
  const t = texto.trim()
  const i = t.lastIndexOf(' ')
  if (i <= 0) return texto
  const ultima = t.slice(i + 1)
  if (!/^[a-zà-ÿ]{3,}[.,:;!?]?$/.test(ultima)) return texto
  return (
    <>
      {t.slice(0, i)} <em className="destaque text-ouro">{ultima}</em>
    </>
  )
}
