import { useState } from 'react'
import { Search } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { Cartao } from '@/components/ui/Cartao'
import { CampoDeBusca } from '@/components/ui/CampoDeBusca'
import { Linha } from '@/components/ui/Lista'
import { EstadoVazio } from '@/components/ui/Estados'

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
 *
 * Souza 3.0 (02/11/2026): sem grade de cartões com ícone. Três colunas, uma
 * por pergunta do dono; em cada uma, a lista curta dos relatórios com a
 * pergunta que cada um responde. Bate o olho e escolhe. A descrição longa e
 * as marcas continuam valendo para a busca.
 */
const GRUPOS: { titulo: string; descricao: string; itens: (OpcaoDeRelatorio & { pergunta: string; marcas: string[] })[] }[] = [
  {
    titulo: 'Resultado',
    descricao: 'A imobiliária ganha dinheiro?',
    itens: [
      {
        para: '/relatorios/dre',
        titulo: 'DRE',
        pergunta: 'A imobiliária dá lucro?',
        meta: 'Receita, impostos, corretores e despesas do período, com o período anterior ao lado.',
        marcas: ['Competência', 'Planilha e PDF'],
      },
      {
        para: '/relatorios/indicadores',
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
        titulo: 'Fluxo de caixa',
        pergunta: 'Quanto entrou, saiu e ficou?',
        meta: 'O realizado do período nas contas da imobiliária e a previsão dos próximos seis meses.',
        marcas: ['Caixa', 'Realizado e previsto'],
      },
      {
        para: '/relatorios/orcamento',
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
        titulo: 'Comissões e repasses',
        pergunta: 'Quanto foi para cada corretor?',
        meta: 'Repassado no período, liberado e previsto, por corretor e gestor — conciliado com o razão.',
        marcas: ['Caixa', 'Por pessoa'],
      },
      {
        para: '/relatorios/marketing',
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

  const total = GRUPOS.reduce((n, g) => n + g.itens.length, 0)

  return (
    <PageLayout
      subtitulo={
        <>
          <b>{total} relatórios</b> · resultado, dinheiro e comercial, todos com planilha e PDF
        </>
      }
      acoes={<CampoDeBusca valor={busca} aoMudar={setBusca} rotulo="Buscar relatório" />}
    >
      {grupos.length === 0 ? (
        <Cartao rotuloAcessivel="Nenhum relatório">
          <Cartao.Corpo>
            <EstadoVazio icone={Search} titulo="Nenhum relatório com esse nome" descricao="Tente DRE, caixa, comissão, marketing ou orçamento." />
          </Cartao.Corpo>
        </Cartao>
      ) : (
        <div className="grid items-start gap-bloco lg:grid-cols-3">
          {grupos.map((g) => (
            <Cartao key={g.titulo}>
              <Cartao.Cabecalho titulo={g.titulo} meta={g.descricao} />
              <Cartao.Lista colunas={{ fim: true }} rotuloAcessivel={`Relatórios de ${g.titulo.toLowerCase()}`}>
                {g.itens.map((r) => (
                  <Linha key={r.para} para={r.para} titulo={r.titulo} meta={r.pergunta} />
                ))}
              </Cartao.Lista>
            </Cartao>
          ))}
        </div>
      )}
    </PageLayout>
  )
}
