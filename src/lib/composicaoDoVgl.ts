import type { Composicao } from '@/components/composicao/Composicao'
import type { LinhaDemonstrativo } from './linhasDaVenda'
import { vglDaVenda, type SaleView, type VolumeDeVendas } from './sales'
import { formatCurrency, formatDate } from './format'

/*
 * A COMPOSIÇÃO DO VGL — a mesma em toda tela que mostra o número.
 *
 * O VGL tem duas deduções e nenhuma delas é óbvia olhando o total: a fatia do
 * parceiro e o imposto da nota. Por isso o painel abre primeiro a CONTA (VGV
 * firme → parceria → nota → VGL) e só depois a lista de vendas — e cada venda
 * escreve, na linha de meta, exatamente o que saiu dela.
 *
 * Vive fora das telas porque Vendas e Relatórios mostram o mesmo VGL: dois
 * textos diferentes para o mesmo número seria a origem do próximo "mas na
 * outra tela está diferente".
 */
export function composicaoDoVgl(params: {
  volume: VolumeDeVendas
  /** As MESMAS vendas que geraram o volume. */
  vendas: SaleView[]
  /** As datas que a tela está mostrando ("2026-01".."2026-09"). */
  chavesDosMeses: string[]
  periodo: string
}): Composicao {
  const { volume, vendas, chavesDosMeses, periodo } = params

  const linhas: LinhaDemonstrativo[] = [
    { chave: 'vgv', rotulo: 'VGV das vendas firmes', sinal: '+', valor: volume.vgvFirme },
  ]
  if (volume.descontoParceria > 0)
    linhas.push({
      chave: 'parceria',
      rotulo: 'A parte do parceiro',
      detalhe:
        volume.vendasEmParceria === 1 ? '1 venda em parceria' : `${volume.vendasEmParceria} vendas em parceria`,
      sinal: '−',
      valor: volume.descontoParceria,
    })
  if (volume.descontoNota > 0)
    linhas.push({
      chave: 'notaFiscal',
      rotulo: 'Nota fiscal',
      detalhe: 'Simples sobre o valor; o ISS retido fica fora do VGL',
      sinal: '−',
      valor: volume.descontoNota,
    })
  linhas.push({ chave: 'vgl', rotulo: 'VGL', sinal: '=', valor: volume.vgl })

  const firmes = vendas
    .filter((v) => v.status !== 'cancelada' && chavesDosMeses.includes(v.sale_date.slice(0, 7)))
    .sort((a, b) => a.sale_date.localeCompare(b.sale_date))

  return {
    rotulo: 'VGL',
    titulo: `VGL ${periodo}`,
    explica:
      'O VGV que é de fato da Souza: na venda em parceria entra só a fatia dela, e do que sobra sai a nota fiscal. O ISS retido não entra, e distrato fica fora.',
    total: volume.vgl,
    linhas,
    itens: firmes.flatMap((v) => {
      const conta = vglDaVenda(v)
      if (!conta) return []
      const partes = [
        v.development,
        `vendida em ${formatDate(v.sale_date)}`,
        `VGV de ${formatCurrency(conta.vgv)}`,
      ]
      if (conta.parceria > 0)
        partes.push(`parceria: ${v.partner_share_pct}% da Souza, −${formatCurrency(conta.parceria)}`)
      if (conta.nota > 0) partes.push(`nota de ${v.simples_pct}%: −${formatCurrency(conta.nota)}`)
      return [
        {
          id: v.id,
          titulo: v.title,
          meta: partes.filter(Boolean).join(' · '),
          valor: conta.vgl,
          para: `/vendas/${v.id}`,
        },
      ]
    }),
    nota:
      volume.semValor > 0
        ? `${volume.semValor} ${volume.semValor === 1 ? 'venda ficou' : 'vendas ficaram'} de fora: o valor do imóvel não foi informado, e VGL sem VGV seria número inventado.`
        : undefined,
    vazio: 'Nenhuma venda firme com valor informado no período.',
  }
}
