import { BarChart3, Landmark } from 'lucide-react'
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
