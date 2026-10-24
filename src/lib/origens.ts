/*
 * DE ONDE VEIO A VENDA (Fase 8, 23/10/2026, migração 044).
 *
 * As quatro origens que o Rafael escolheu. A mesma lista serve à venda
 * (sales.origin) e ao canal da despesa de marketing
 * (transactions.marketing_channel): é assim que o investimento de um canal
 * encontra as vendas que ele trouxe.
 */
export type Origem = 'trafego_pago' | 'indicacao' | 'portais' | 'carteira'

export const ORIGENS: { id: Origem; rotulo: string; explica: string }[] = [
  { id: 'trafego_pago', rotulo: 'Tráfego pago', explica: 'anúncios no Meta e no Google' },
  { id: 'indicacao', rotulo: 'Indicação', explica: 'cliente, amigo ou parceiro que indicou' },
  { id: 'portais', rotulo: 'Portais', explica: 'OLX, ZAP, VivaReal e afins' },
  { id: 'carteira', rotulo: 'Carteira e relacionamento', explica: 'cliente antigo, rede do corretor, construtora, plantão' },
]

export const NOME_DA_ORIGEM: Record<Origem, string> = Object.fromEntries(ORIGENS.map((o) => [o.id, o.rotulo])) as Record<
  Origem,
  string
>

/** Categoria de despesa que pergunta o canal. */
export const ehCategoriaDeMarketing = (categoria: string) => /^marketing/i.test(categoria)
