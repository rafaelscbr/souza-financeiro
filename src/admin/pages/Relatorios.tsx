import { useState } from 'react'
import { Activity, BarChart3, HandCoins, Landmark, Megaphone, Search, Target } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { Cartao } from '@/components/ui/Cartao'
import { CampoDeBusca } from '@/components/ui/CampoDeBusca'
import { Atalho } from '@/components/ui/Atalho'
import { EstadoVazio } from '@/components/ui/Estados'
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
/*
 * A BIBLIOTECA DE RELATÓRIOS (Souza 2.0, 24/10/2026): agrupada pela
 * pergunta que o dono faz — resultado, dinheiro, comercial —, com busca.
 * Cada relatório diz a pergunta que responde, o regime e o que exporta.
 */
const GRUPOS: { titulo: string; descricao: string; itens: (OpcaoDeRelatorio & { pergunta: string; marcas: string[] })[] }[] = [
  {
    titulo: 'Resultado',
    descricao: 'A imobiliária ganha dinheiro?',
    itens: [
      {
        para: '/relatorios/dre',
        icone: BarChart3,
        titulo: 'DRE',
        pergunta: 'A imobiliária dá lucro?',
        meta: 'Receita, impostos, corretores e despesas do período, com o período anterior ao lado.',
        marcas: ['Competência', 'Planilha e PDF'],
      },
      {
        para: '/relatorios/indicadores',
        icone: Activity,
        titulo: 'Indicadores',
        pergunta: 'Como está a saúde do negócio?',
        meta: 'VGV, ticket, margem, prazo de recebimento, atraso, concentração, fôlego e ponto de equilíbrio.',
        marcas: ['12 meses', 'Fórmulas escritas'],
      },
    ],
  },
  {
    titulo: 'Dinheiro',
    descricao: 'Tem caixa para o que vem?',
    itens: [
      {
        para: '/relatorios/caixa',
        icone: Landmark,
        titulo: 'Fluxo de caixa',
        pergunta: 'Quanto entrou, saiu e ficou?',
        meta: 'O realizado do período nas contas da imobiliária e a previsão dos próximos seis meses.',
        marcas: ['Caixa', 'Realizado e previsto'],
      },
      {
        para: '/relatorios/orcamento',
        icone: Target,
        titulo: 'Orçamento',
        pergunta: 'As vendas cobrem a estrutura?',
        meta: 'Os custos planejados mês a mês contra o que as vendas deixam, e quantas vendas faltam.',
        marcas: ['Mês a mês', 'Planilha e PDF'],
      },
    ],
  },
  {
    titulo: 'Comercial',
    descricao: 'Quem vende, quanto custa vender?',
    itens: [
      {
        para: '/relatorios/comissoes',
        icone: HandCoins,
        titulo: 'Comissões e repasses',
        pergunta: 'Quanto foi para cada corretor?',
        meta: 'Repassado no período, liberado e previsto, por corretor e gestor — conciliado com o razão.',
        marcas: ['Caixa', 'Por pessoa'],
      },
      {
        para: '/relatorios/marketing',
        icone: Megaphone,
        titulo: 'Marketing',
        pergunta: 'Quanto cada canal trouxe?',
        meta: 'Investido por canal contra as vendas e a comissão que ele trouxe, com custo por venda e retorno.',
        marcas: ['Por canal', 'Retorno'],
      },
    ],
  },
]

const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function Relatorios() {
  const [busca, setBusca] = useState('')
  const termo = semAcento(busca.trim())
  const grupos = GRUPOS.map((g) => ({
    ...g,
    itens: g.itens.filter((r) => !termo || semAcento(`${r.titulo} ${r.pergunta} ${r.meta} ${r.marcas.join(' ')}`).includes(termo)),
  })).filter((g) => g.itens.length > 0)

  return (
    <PageLayout
      subtitulo="Seis relatórios, agrupados pela pergunta que respondem. Todos abrem nos lançamentos que somam."
      acoes={<CampoDeBusca valor={busca} aoMudar={setBusca} rotulo="Buscar relatório" />}
    >
      {grupos.length === 0 ? (
        <Cartao rotuloAcessivel="Nenhum relatório">
          <Cartao.Corpo>
            <EstadoVazio icone={Search} titulo="Nenhum relatório com esse nome" descricao="Tente DRE, caixa, comissão, marketing ou orçamento." />
          </Cartao.Corpo>
        </Cartao>
      ) : (
        grupos.map((g) => (
          <section key={g.titulo} aria-labelledby={`grupo-${g.titulo}`} className="flex flex-col gap-3">
            <div className="flex items-baseline gap-3">
              <h2 id={`grupo-${g.titulo}`} className="text-t1 text-titulo-secao">
                {g.titulo}
              </h2>
              <span className="text-t-meta text-texto-meta">{g.descricao}</span>
            </div>
            <div className="grid gap-bloco md:grid-cols-2">
              {g.itens.map((r) => (
                <Atalho key={r.para} para={r.para} icone={r.icone} titulo={r.titulo} pergunta={r.pergunta} descricao={r.meta} marcas={r.marcas} />
              ))}
            </div>
          </section>
        ))
      )}
    </PageLayout>
  )
}
