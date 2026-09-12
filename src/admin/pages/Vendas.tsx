import { useMemo, useState } from 'react'
import { Handshake, Search } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { useComposicao } from '@/components/composicao/Composicao'
import { Heroi } from '@/components/ui/Assinatura'
import { Secao, SubtotalDuplo } from '@/components/ui/Secao'
import { Lista, Linha } from '@/components/ui/Lista'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { ChipSituacao } from '@/components/ui/Situacao'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { formatCurrency, formatDateShort } from '@/lib/format'
import type { Situacao } from '@/lib/situacao'
import type { SaleView } from '@/lib/sales'

/*
 * A CARTEIRA DE VENDAS.
 *
 * A tela anterior tinha quatro defeitos, e três deles eram de estrutura:
 *
 * 1. Quatro indicadores no topo (comissão contratada, já recebido, ainda a
 *    receber e comissão a pagar) somavam a lista filtrada — e NENHUM deles era
 *    o número que o cartão destacava, que era o líquido da venda
 *    (`cascade.net`, escrito "Fica limpo"). A tela somava quatro grandezas e
 *    destacava uma quinta. A grade de quatro indicadores é vetada por escrito
 *    (docs/sistema-visual.md §10): um herói, e o resto em linhas.
 *
 * 2. Quatro filtros para uma carteira pequena, e dois deles — corretor e
 *    empreendimento — filtravam por id exatamente o que a busca já cobria por
 *    texto. Sobraram dois controles: a busca, que passou a incluir o nome do
 *    corretor, e a situação em três opções ("Canceladas" sumiu como opção
 *    própria porque "Todas" já as mostra, e elas chegam riscadas).
 *
 * 3. Cada venda era um cartão com sombra, borda que acendia em `brandblue` no
 *    hover, selos com cor em alpha (`bg-critical/12`) e rótulo de 10 e 11px.
 *    Nada disso existe mais: sem cartão, sem sombra, chip com par tinta+fundo
 *    declarado e piso de 12px.
 *
 * 4. A `Progress` de cada cartão vinha com `color="#059669"` cravado em
 *    hexadecimal — o esmeralda, fora de qualquer token. Vinte barras numa
 *    lista não se comparam entre si; o progresso passa a ser escrito, e a
 *    barra fica só onde ela é a conta inteira de uma venda só: na ficha.
 *
 * O herói é "Comissão em carteira": a comissão contratada que ainda não
 * entrou, somando as parcelas previstas de todas as vendas não canceladas.
 * Ele não segue o filtro de propósito — o filtro muda a lista, não o tamanho
 * da carteira —, e o subtotal do grupo, esse sim, acompanha a lista, sempre em
 * duas parcelas: o que já entrou e o que ainda é promessa da construtora.
 */
export function Vendas() {
  const { vendas } = useAdmin()
  const { abrir } = useComposicao()
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState<'andamento' | 'concluidas' | 'todas'>('andamento')

  /** Venda cancelada não é carteira: o que sobrou dela já foi cancelado no banco. */
  const ativas = useMemo(() => vendas.filter((v) => v.status !== 'cancelada'), [vendas])

  /*
   * O número herói. `toReceive` é a soma das parcelas ainda previstas, gravada
   * parcela a parcela pela migração 009 — esta tela não recalcula comissão
   * nenhuma, só soma o que já está gravado.
   */
  const emCarteira = useMemo(() => soma(ativas.map((v) => v.toReceive)), [ativas])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return vendas.filter((v) => {
      if (situacao === 'andamento' && v.status !== 'ativa') return false
      if (situacao === 'concluidas' && v.status !== 'concluida') return false
      if (
        q &&
        !`${v.title} ${v.client_name ?? ''} ${v.development ?? ''} ${v.brokerName ?? ''}`
          .toLowerCase()
          .includes(q)
      )
        return false
      return true
    })
  }, [vendas, busca, situacao])

  /*
   * O subtotal do grupo, nas duas parcelas que o sistema exige: o que já
   * entrou e o que depende da construtora. Somar os dois num número só seria
   * misturar o que a imobiliária tem com o que ela espera — e as duas metades
   * somam exatamente a coluna de valores ao lado, porque `received` e
   * `toReceive` são as duas partes da mesma comissão contratada.
   */
  const jaEntrou = useMemo(() => soma(filtradas.map((v) => v.received)), [filtradas])
  const aReceber = useMemo(() => soma(filtradas.map((v) => v.toReceive)), [filtradas])

  if (vendas.length === 0) {
    return (
      <EmptyState
        icon={<Handshake className="h-8 w-8" />}
        title="Nenhuma venda registrada"
        description="Registre a primeira e ela aparece aqui com as parcelas, o imposto e a comissão do corretor já organizados."
      />
    )
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-lg font-semibold tracking-[-0.005em] text-content">Vendas</h1>

      <Heroi
        rotulo="Comissão em carteira"
        contexto="Comissão já contratada que ainda não entrou, somando as parcelas previstas de todas as vendas ativas. Não é dinheiro em conta, e não muda com o filtro abaixo."
      >
        <ValorComOrigem
          valor={emCarteira}
          posto="heroi"
          rotuloAcessivel="Ver de quais vendas vem a comissão em carteira"
          aoAbrir={() =>
            abrir({
              rotulo: 'Em carteira',
              titulo: 'De quais vendas vem',
              explica:
                'O que cada venda ainda tem para receber. A data de cada parcela depende da construtora pagar — por isso nada aqui é dívida de ninguém hoje.',
              total: emCarteira,
              itens: ativas
                .filter((v) => v.toReceive > 0)
                .map((v) => ({
                  id: v.id,
                  titulo: v.title,
                  meta: [
                    v.development,
                    v.nextDate
                      ? v.hasOverdue
                        ? `a construtora atrasou a parcela de ${formatDateShort(v.nextDate)}`
                        : `próxima em ${formatDateShort(v.nextDate)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · '),
                  valor: v.toReceive,
                  // Parcela que a construtora não pagou é espera, não atraso:
                  // "prevista" mesmo quando a data já passou.
                  situacao: 'prevista' as const,
                  para: `/vendas/${v.id}`,
                })),
              vazio: 'Nenhuma venda com parcela em aberto.',
            })
          }
        />
      </Heroi>

      <Secao
        titulo="Cada venda"
        subtotal={
          <SubtotalDuplo
            rotuloAgora="já entrou"
            agora={<span className="cifra">{formatCurrency(jaEntrou)}</span>}
            previsto={<span className="cifra">{formatCurrency(aReceber)}</span>}
          />
        }
      >
        {/*
         * Dois controles, não quatro. A busca cobre unidade, comprador,
         * empreendimento e corretor — os mesmos alvos dos dois selects que
         * saíram, num campo só.
         */}
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint"
              aria-hidden
            />
            <Input
              className="pl-9"
              placeholder="Buscar por unidade, comprador, empreendimento ou corretor"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar venda"
            />
          </div>
          <Segmented
            ariaLabel="Situação da venda"
            value={situacao}
            onChange={setSituacao}
            options={[
              { value: 'andamento', label: 'Em andamento' },
              { value: 'concluidas', label: 'Concluídas' },
              { value: 'todas', label: 'Todas' },
            ]}
            className="sm:w-80"
          />
        </div>

        {filtradas.length === 0 ? (
          <EmptyState title="Nada com esse filtro" description="Ajuste a busca ou troque a situação." />
        ) : (
          <>
            <Lista>
              {filtradas.map((v) => {
                const s = situacaoDaVenda(v)
                return (
                  <Linha
                    key={v.id}
                    titulo={v.title}
                    meta={metaDaVenda(v)}
                    situacao={<ChipSituacao situacao={s} />}
                    /*
                     * O valor que se compara entre vendas é a comissão
                     * contratada — e as duas metades dela estão escritas no
                     * metadado, do mesmo jeito que o subtotal do grupo separa
                     * o que entrou do que é promessa. Sem cor tônica: parte
                     * deste número ainda não é dinheiro.
                     */
                    valor={
                      <Valor
                        valor={v.cascade.commission}
                        posto="linha"
                        tinta={s === 'cancelada' ? 'text-content-faint line-through' : undefined}
                      />
                    }
                    para={`/vendas/${v.id}`}
                  />
                )
              })}
            </Lista>
            <p className="mt-2 text-sm text-content-faint">
              {filtradas.length === vendas.length
                ? `${vendas.length} ${vendas.length === 1 ? 'venda' : 'vendas'} registradas`
                : `${filtradas.length} de ${vendas.length} ${vendas.length === 1 ? 'venda' : 'vendas'}`}
              . O valor à direita é a comissão contratada da imobiliária.
            </p>
          </>
        )}
      </Secao>
    </div>
  )
}

const soma = (l: number[]) => Math.round(l.reduce((s, v) => s + v, 0) * 100) / 100

/**
 * A situação de uma VENDA — que não é a situação de uma parcela.
 *
 * Aqui mora a regra de negócio mais importante do sistema, na forma do que
 * esta função NÃO devolve: `hasOverdue` (parcela prevista com data passada)
 * nunca vira "Vencida". Vencido é só o que a imobiliária já recebeu e não
 * pagou; quando a construtora atrasa, a venda continua "Prevista" e o atraso é
 * dito com todas as letras no metadado. O selo vermelho que a tela antiga
 * punha nesse caso inventava uma dívida que não existe.
 */
function situacaoDaVenda(v: SaleView): Situacao {
  if (v.status === 'cancelada') return 'cancelada'
  if (v.status === 'concluida') return 'recebida'
  return 'prevista'
}

/** Empreendimento, progresso escrito e — quando é o caso — o atraso da construtora. */
function metaDaVenda(v: SaleView): string {
  const partes: (string | null)[] = [v.development ?? 'sem empreendimento']
  if (v.status === 'cancelada') {
    partes.push('cancelada')
  } else if (v.toReceive === 0) {
    partes.push('comissão recebida por inteiro')
  } else {
    partes.push(`recebido ${formatCurrency(v.received)} · falta ${formatCurrency(v.toReceive)}`)
    if (v.hasOverdue && v.nextDate) {
      partes.push(`a construtora atrasou a parcela de ${formatDateShort(v.nextDate)}`)
    }
  }
  return partes.filter(Boolean).join(' · ')
}
