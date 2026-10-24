import { Activity, BarChart3, HandCoins, Landmark, Megaphone, Target } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { Cartao } from '@/components/ui/Cartao'
import { Linha } from '@/components/ui/Lista'
import { IconeTom } from '@/components/ui/IconeTom'
import type { LucideIcon } from 'lucide-react'

/*
 * RELATÓRIOS — a porta de entrada (22/10/2026).
 *
 * A tela antiga empilhava DRE, VGV, carteira, caixa, ponto de equilíbrio,
 * empreendimento, corretor, saldo e categoria numa rolagem só. O Rafael pediu
 * para recomeçar: primeiro a tela pergunta qual relatório ele quer ver, e cada
 * relatório vive na sua própria tela, fácil de ler. Um relatório novo é uma
 * linha nesta lista e uma rota.
 */

interface OpcaoDeRelatorio {
  para: string
  icone: LucideIcon
  titulo: string
  meta: string
}

/*
 * Os dois relatórios que dizem a saúde da empresa (decisão de 22/10/2026):
 * o DRE responde "ela dá lucro?" e o Fluxo de caixa, "ela tem dinheiro?".
 * Empresa com lucro e sem caixa quebra; com caixa e sem lucro, se consome.
 * O Orçamento, do mesmo dia, mede os dois contra o plano de custos dele.
 */
const RELATORIOS: OpcaoDeRelatorio[] = [
  {
    para: '/relatorios/dre',
    icone: BarChart3,
    titulo: 'DRE · A imobiliária dá lucro?',
    meta: 'Quanto ela ganhou com as vendas do período, depois de impostos, corretores e despesas. Por competência.',
  },
  {
    para: '/relatorios/caixa',
    icone: Landmark,
    titulo: 'Fluxo de caixa · A imobiliária tem dinheiro?',
    meta: 'Quanto dinheiro entrou e saiu das contas dela, e com quanto ela começou e terminou o período.',
  },
  {
    para: '/relatorios/comissoes',
    icone: HandCoins,
    titulo: 'Comissões e repasses · Quanto foi para cada corretor?',
    meta: 'O que a imobiliária repassou no período a cada corretor e ao gestor, e o que ainda deve a cada um.',
  },
  {
    para: '/relatorios/indicadores',
    icone: Activity,
    titulo: 'Indicadores · Como está a saúde do negócio?',
    meta: 'VGV, ticket, margem, prazo de recebimento, atraso, concentração e fôlego, cada um com a conta escrita.',
  },
  {
    para: '/relatorios/marketing',
    icone: Megaphone,
    titulo: 'Marketing · Quanto cada canal trouxe?',
    meta: 'O investido em cada canal contra as vendas e a comissão que ele trouxe, com custo por venda e retorno.',
  },
  {
    para: '/relatorios/orcamento',
    icone: Target,
    titulo: 'Orçamento · As vendas cobrem a estrutura?',
    meta: 'Os custos que você planejou, confirmados e possíveis, contra o que as vendas deixam. E quantas vendas faltam.',
  },
]

export function Relatorios() {
  return (
    <PageLayout subtitulo="Escolha o relatório que você quer ver." largura="leitura">
      <Cartao>
        <Cartao.Cabecalho titulo="Qual relatório você quer ver?" />
        <Cartao.Lista colunas={{ goteira: true, fim: true }} rotuloAcessivel="Relatórios disponíveis">
          {RELATORIOS.map((r) => (
            <Linha
              key={r.para}
              goteira={<IconeTom icone={r.icone} tom="marca" tamanho="sm" />}
              titulo={r.titulo}
              meta={r.meta}
              para={r.para}
            />
          ))}
        </Cartao.Lista>
      </Cartao>
    </PageLayout>
  )
}
