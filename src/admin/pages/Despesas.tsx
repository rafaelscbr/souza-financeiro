import { useMemo, useState } from 'react'
import { Download, Plus, Receipt, RotateCcw, Trash2 } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { LancarDespesa } from '../LancarDespesa'
import { BaixarLancamento } from '../BaixarLancamento'
import { useComposicao } from '@/components/composicao/Composicao'
import { Heroi } from '@/components/ui/Assinatura'
import { Secao } from '@/components/ui/Secao'
import { Lista, Linha } from '@/components/ui/Lista'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { Selo } from '@/components/ui/Selo'
import { ChipSituacao } from '@/components/ui/Situacao'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { buildRecurringInput, pendingRecurring } from '@/lib/recurring'
import { situacaoDeTela, type Situacao } from '@/lib/situacao'
import { formatCurrency, formatDate, formatMonthYear } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/types'

/*
 * DESPESAS E OUTRAS ENTRADAS — o razão do dia a dia.
 *
 * O recorte não mudou e continua sendo o certo: comissão, imposto e repasse
 * vivem na ficha da venda, e misturá-los aqui era o que fazia a lista ter 40
 * linhas por venda e virar ilegível.
 *
 * O que mudou é a apresentação, e ela estava fora do sistema em quatro pontos
 * verificáveis:
 *
 * 1. Dois CARTÕES com `shadow-card` lado a lado. `--c-base` e `--c-surface` são
 *    o mesmo hex desde a virada do sistema, então o cartão era uma sombra em
 *    volta de nada — e `shadow-card` nem existe mais. Separação é fio.
 *
 * 2. Uma GRADE DE INDICADORES ("Saiu no mês" / "Entrou fora de venda") no lugar
 *    de um herói. A regra de um número em degrau herói por tela é a mesma regra
 *    que obriga a tela a declarar qual pergunta responde. A pergunta desta tela
 *    é "quanto de despesa neste mês": "Saiu" virou o herói, "Entrou" virou uma
 *    linha, e os dois pararam de disputar o mesmo posto.
 *
 * 3. Rótulos em `text-[11px]` — abaixo do piso de 12px — e o dinheiro da lista
 *    em `text-sm`, que é o degrau do metadado, não o de comparação. Conferir 20
 *    lançamentos contra o extrato depende de eles estarem todos no mesmo degrau
 *    (22px) e pousarem na mesma borda direita.
 *
 * 4. O aviso de despesa fixa vinha em `bg-brandblue-soft` com borda colorida —
 *    um azul que nunca existiu na marca e que saiu junto com o token.
 *
 * E o total passa a ter origem: ele abre nos lançamentos que o formam, um a um,
 * e diz quantos deles ainda estão em aberto.
 *
 * DEFEITO CONHECIDO, DEIXADO COMO ESTÁ (esta passagem é só de apresentação):
 * `totais` é somado sobre `doMes`, que já vem filtrado pelo seletor
 * Todos/Liquidados/Em aberto. Trocar o filtro muda o número do herói. A
 * correção mexe no cálculo e no conteúdo do CSV, então ficou relatada em vez de
 * feita aqui.
 */

const FILTROS = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'pagos', rotulo: 'Liquidados' },
  { valor: 'abertos', rotulo: 'Em aberto' },
] as const

export function Despesas() {
  const { transactions, mes, hoje, categories, contacts, criarLancamento, excluirLancamento, estornarLancamento, company } =
    useAdmin()
  const { showToast } = useToast()
  const { abrir } = useComposicao()
  const [filtro, setFiltro] = useState<'todos' | 'pagos' | 'abertos'>('todos')
  const [nova, setNova] = useState(false)
  const [baixando, setBaixando] = useState<Transaction | null>(null)
  const [gerando, setGerando] = useState(false)

  const chaveMes = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`

  const doMes = useMemo(
    () =>
      transactions
        .filter((t) => !t.sale_id)
        .filter((t) => {
          const d = t.status === 'settled' ? t.settled_date ?? t.competence_date : t.due_date ?? t.competence_date
          return d.slice(0, 7) === chaveMes
        })
        .filter((t) => (filtro === 'pagos' ? t.status === 'settled' : filtro === 'abertos' ? t.status === 'pending' : true))
        .sort((a, b) => {
          const da = a.settled_date ?? a.due_date ?? a.competence_date
          const db = b.settled_date ?? b.due_date ?? b.competence_date
          return da < db ? 1 : -1
        }),
    [transactions, chaveMes, filtro],
  )

  const totais = useMemo(() => {
    let saiu = 0
    let entrou = 0
    for (const t of doMes) {
      if (t.kind === 'income') entrou += t.amount
      else saiu += t.amount
    }
    return { saiu: Math.round(saiu * 100) / 100, entrou: Math.round(entrou * 100) / 100 }
  }, [doMes])

  const fixasPendentes = useMemo(
    () => (company ? pendingRecurring(transactions.filter((t) => !t.sale_id), company.id, mes) : []),
    [transactions, company, mes],
  )

  const nomePorContato = useMemo(() => new Map(contacts.map((c) => [c.id, c.name])), [contacts])
  const dreDaCategoria = useMemo(() => new Map(categories.map((c) => [c.name, c.dre_group])), [categories])

  /* As duas metades do total, separadas só para a composição: o herói soma o
   * que saiu, a linha de baixo soma o que entrou fora de venda. Os números são
   * os mesmos de `totais` — nada é recalculado aqui. */
  const saidas = useMemo(() => doMes.filter((t) => t.kind !== 'income'), [doMes])
  const entradas = useMemo(() => doMes.filter((t) => t.kind === 'income'), [doMes])
  const saidasEmAberto = saidas.filter((t) => t.status === 'pending').length

  /** A data que a linha mostra: quando saiu, ou quando vence. */
  const dataDe = (t: Transaction) => t.settled_date ?? t.due_date ?? t.competence_date

  /*
   * A situação de cada lançamento, DERIVADA — nunca escrita à mão.
   *
   * O razão guarda dois estados ('settled' e 'pending') e o sistema tem cinco,
   * então a tradução precisa ser explícita: liquidado é dinheiro que se moveu,
   * e em aberto é obrigação da própria casa — por isso entra como 'liberada',
   * que é o único estado que `situacaoDeTela` promove a 'vencida' quando a data
   * já passou. Aqui isso é a leitura certa: conta vencida é atraso de verdade,
   * porque o dinheiro é da imobiliária. A regra que proíbe 'vencida' em
   * 'prevista' existe para a parcela que a construtora não pagou, que é espera,
   * não atraso — outro caso, outra tela.
   */
  const situacaoDoLancamento = (t: Transaction): Situacao =>
    situacaoDeTela(t.status === 'settled' ? 'recebida' : 'liberada', t.due_date ?? t.competence_date, hoje)

  /** Um lançamento virando item da folha de composição. */
  const item = (t: Transaction) => ({
    id: t.id,
    titulo: t.description || t.category,
    meta: [formatDate(dataDe(t)), t.category, t.contact_id ? nomePorContato.get(t.contact_id) : null]
      .filter(Boolean)
      .join(' · '),
    valor: t.amount,
    situacao: situacaoDoLancamento(t),
  })

  function exportar() {
    const linhas = [
      ['Data', 'Tipo', 'Categoria', 'Descrição', 'Fornecedor', 'Valor', 'Situação'],
      ...doMes.map((t) => [
        t.settled_date ?? t.due_date ?? t.competence_date,
        t.kind === 'income' ? 'Entrada' : 'Saída',
        t.category,
        t.description,
        t.contact_id ? nomePorContato.get(t.contact_id) ?? '' : '',
        String(t.amount).replace('.', ','),
        t.status === 'settled' ? 'Liquidado' : 'Em aberto',
      ]),
    ]
    const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `despesas-${chaveMes}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function gerarFixas() {
    setGerando(true)
    try {
      for (const c of fixasPendentes) {
        const input = buildRecurringInput(c, mes)
        await criarLancamento({
          ...input,
          dre_group: input.dre_group ?? dreDaCategoria.get(input.category) ?? 'variable_expense',
        })
      }
      showToast({
        message: `${fixasPendentes.length} despesa(s) fixa(s) lançada(s)`,
        detail: 'nascem em aberto, para você dar baixa quando pagar',
      })
    } finally {
      setGerando(false)
    }
  }

  return (
    <div className="animate-fade-in">
      {/* O nome da tela já está na navegação e o mês no cabeçalho da casca; o
       * rótulo assinatura do herói é o que declara a pergunta. O h1 fica para
       * quem lê com leitor de tela. */}
      <h1 className="sr-only">Despesas e outras entradas</h1>

      <Heroi
        rotulo="Despesa no mês"
        contexto={`Tudo que saiu e o que ainda vai sair em ${formatMonthYear(mes)}, fora da venda. Comissão, imposto e repasse não entram aqui: eles vivem na ficha da venda.`}
        acao={
          <Button onClick={() => setNova(true)}>
            <Plus className="h-4 w-4" />
            Lançar
          </Button>
        }
      >
        <ValorComOrigem
          valor={totais.saiu}
          posto="heroi"
          rotuloAcessivel="Ver quais lançamentos formam a despesa do mês"
          aoAbrir={() =>
            abrir({
              rotulo: 'Despesa no mês',
              titulo: `Despesas de ${formatMonthYear(mes)}`,
              explica:
                'Cada saída lançada fora de venda neste mês, paga ou ainda em aberto. Comissão, imposto e repasse de venda não entram: eles vivem na ficha da venda.',
              total: totais.saiu,
              itens: saidas.map(item),
              nota:
                saidasEmAberto > 0
                  ? `${saidasEmAberto} de ${saidas.length} ainda estão em aberto — este total soma o que já saiu com o que ainda vai sair.`
                  : undefined,
              vazio: 'Nenhuma saída neste mês.',
            })
          }
        />
      </Heroi>

      {fixasPendentes.length > 0 && (
        <Secao titulo="Despesas fixas ainda não lançadas">
          <Lista>
            {fixasPendentes.map((c) => (
              <Linha
                key={c.template.id}
                selo={<Selo situacao="prevista" glifo="traco" />}
                titulo={c.template.description || c.template.category}
                meta={`modelo do lançamento de ${c.sourceMonth.slice(5, 7)}/${c.sourceMonth.slice(0, 4)}`}
                valor={<Valor valor={c.template.amount} posto="linha" tinta="text-content-muted" />}
              />
            ))}
          </Lista>
          <Button className="mt-3" onClick={gerarFixas} disabled={gerando}>
            Lançar todas em aberto
          </Button>
          <p className="mt-2 text-sm text-content-faint">
            Nascem em aberto, com o valor do último mês. Dar baixa é que faz o dinheiro sair.
          </p>
        </Secao>
      )}

      <Secao titulo="Entrou, fora de venda">
        <Lista>
          <Linha
            titulo="Outras entradas do mês"
            meta="receita que não é comissão de venda — reembolso, aluguel, devolução"
            valor={
              entradas.length > 0 ? (
                <ValorComOrigem
                  valor={totais.entrou}
                  tinta="text-income"
                  rotuloAcessivel="Ver quais entradas formam este total"
                  aoAbrir={() =>
                    abrir({
                      rotulo: 'Entrou, fora de venda',
                      titulo: `Entradas de ${formatMonthYear(mes)}`,
                      explica:
                        'Receita lançada à mão neste mês. Comissão de venda não entra aqui — ela nasce da ficha da venda.',
                      total: totais.entrou,
                      itens: entradas.map(item),
                    })
                  }
                />
              ) : (
                <Valor valor={0} tinta="text-content-muted" />
              )
            }
          />
        </Lista>
      </Secao>

      <Secao
        titulo="Lançamentos"
        acao={
          /* O seletor é escrito aqui, e não com `Segmented`, por um motivo
           * medido: os botões daquele componente têm `h-9` — 36px, abaixo do
           * piso de toque de 44px do sistema. */
          <div role="radiogroup" aria-label="Filtrar lançamentos" className="flex gap-1">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                type="button"
                role="radio"
                aria-checked={filtro === f.valor}
                onClick={() => setFiltro(f.valor)}
                className={cn(
                  'min-h-toque rounded-lg px-3 text-base transition-colors',
                  filtro === f.valor
                    ? 'bg-action font-semibold text-action-ink'
                    : 'font-medium text-content-muted hover:bg-surface-2 hover:text-content',
                )}
              >
                {f.rotulo}
              </button>
            ))}
          </div>
        }
      >
        {doMes.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-8 w-8" />}
            title={filtro === 'todos' ? 'Nada lançado neste mês' : 'Nada neste filtro'}
            description="Use o botão Lançar para registrar uma despesa em três toques."
          />
        ) : (
          <>
            <Lista>
              {doMes.map((t) => {
                const s = situacaoDoLancamento(t)
                const entrada = t.kind === 'income'
                return (
                  <Linha
                    key={t.id}
                    selo={<Selo situacao={s} glifo="traco" />}
                    titulo={t.description || t.category}
                    meta={[formatDate(dataDe(t)), t.category, t.contact_id ? nomePorContato.get(t.contact_id) : null]
                      .filter(Boolean)
                      .join(' · ')}
                    situacao={<ChipSituacao situacao={s} />}
                    /* O sinal é o menos de verdade, em calha própria: entrada
                     * sobe, saída desce, e as duas continuam alinhadas na mesma
                     * borda direita. */
                    valor={
                      <Valor
                        valor={entrada ? t.amount : -t.amount}
                        posto="linha"
                        tinta={entrada ? 'text-income' : undefined}
                      />
                    }
                    acao={
                      <div className="flex items-center gap-1">
                        {t.status === 'pending' ? (
                          <Button variant="secondary" onClick={() => setBaixando(t)}>
                            {entrada ? 'Recebi' : 'Paguei'}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => estornarLancamento(t.id, t.settled_date ?? t.competence_date)}
                            aria-label={`Desfazer baixa de ${t.description || t.category}`}
                            title="Desfazer baixa"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Excluir "${t.description || t.category}" de ${formatCurrency(t.amount)}?`)) {
                              excluirLancamento(t.id)
                            }
                          }}
                          aria-label={`Excluir ${t.description || t.category}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    }
                  />
                )
              })}
            </Lista>
            <Button variant="secondary" className="mt-3" onClick={exportar}>
              <Download className="h-4 w-4" />
              Baixar CSV do mês
            </Button>
          </>
        )}
      </Secao>

      <p className="mt-8 border-t border-rule pt-3 text-sm text-content-muted">
        Esta tela é o razão fora da venda. Comissão de corretor, ISS, Simples e repasse de sócio
        nascem da ficha da venda e são conferidos lá — é o que mantém esta lista com o tamanho de um
        mês, e não com o tamanho da carteira.
      </p>

      <LancarDespesa aberto={nova} onFechar={() => setNova(false)} />
      <BaixarLancamento tx={baixando} onFechar={() => setBaixando(null)} />
    </div>
  )
}
