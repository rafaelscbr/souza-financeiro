import { useMemo, useState } from 'react'
import { CalendarCheck, Download, MoreHorizontal, Receipt, RotateCcw, Trash2 } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { LancarDespesa } from '../LancarDespesa'
import { BaixarLancamento } from '../BaixarLancamento'
import { CartaoDoTeto } from '../CartaoDoTeto'
import { BaixaNaLinha, useBaixaDeLancamento } from '../BaixaNaLinha'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { FaixaDeMetricas } from '@/components/ui/FaixaDeMetricas'
import { Cartao } from '@/components/ui/Cartao'
import { Linha } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { TabelaDeDados } from '@/components/ui/TabelaDeDados'
import { ChipSituacao } from '@/components/ui/Situacao'
import { Button } from '@/components/ui/Button'
import { EstadoVazio } from '@/components/ui/Estados'
import { FiltrosRapidos } from '@/components/ui/FiltrosRapidos'
import { SidePanel } from '@/components/ui/SidePanel'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { buildRecurringInput, pendingRecurring } from '@/lib/recurring'
import { situacaoDeTela, type Situacao } from '@/lib/situacao'
import { formatCurrency, formatDate, formatMonthYear } from '@/lib/format'
import type { Transaction } from '@/types'

/*
 * DESPESAS E OUTRAS ENTRADAS — o razão do dia a dia (9.7).
 *
 * Comissão, imposto e repasse vivem na ficha da venda; aqui só o que foi
 * lançado fora de venda. A migração é só de APRESENTAÇÃO: o recorte do mês, o
 * filtro, os totais, as situações, o CSV e as ações são os de antes.
 *
 * SOUZA 3.0 (02/11/2026, docs/redesenho-3/GUIA-DE-TELA.md):
 *
 * 1. Frase do título: quanto saiu no mês e quantos lançamentos estão em aberto.
 * 2. Faixa de números: "Despesa no mês" é a líder; "Outras entradas" (não
 *    soma) e "Em aberto" (leva ao filtro) são os apoios. Os valores abrem os
 *    lançamentos que os formam, como no herói de antes.
 * 3. Lançamentos (2/3) ao lado do orçamento do mês e das fixas ainda não
 *    lançadas (1/3).
 * 4. Na linha: "Paguei"/"Recebi" grava com dois toques (BaixaNaLinha), com
 *    Desfazer no aviso. O "⋯" abre o painel de sempre: escolher data e conta
 *    da baixa, ou excluir (que confirma no ConfirmDialog).
 *
 * Carregando e erro são da casca (CascaDaPagina); o vazio mora no cartão.
 *
 * DEFEITO CONHECIDO, DEIXADO COMO ESTÁ (esta passagem é só de apresentação):
 * `totais` é somado sobre `doMes`, que já vem filtrado pelo seletor
 * Todos/Liquidados/Em aberto. Trocar o filtro muda o número líder.
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
  const [menuDe, setMenuDe] = useState<Transaction | null>(null)
  const [excluindo, setExcluindo] = useState<Transaction | null>(null)
  const [apagando, setApagando] = useState(false)
  const baixaDeLancamento = useBaixaDeLancamento()

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
  const emAberto = doMes.filter((t) => t.status === 'pending').length

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

  const nomeDe = (t: Transaction) => t.description || t.category

  /** O lançamento aberto sozinho: o que ele é, na folha de composição. */
  const abrirLancamento = (t: Transaction) =>
    abrir({
      rotulo: t.kind === 'income' ? 'Entrada' : 'Despesa',
      titulo: nomeDe(t),
      total: t.amount,
      itens: [item(t)],
    })

  const abrirSaidas = () =>
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

  const abrirEntradas = () =>
    abrir({
      rotulo: 'Entrou, fora de venda',
      titulo: `Entradas de ${formatMonthYear(mes)}`,
      explica: 'Receita lançada à mão neste mês. Comissão de venda não entra aqui — ela nasce da ficha da venda.',
      total: totais.entrou,
      itens: entradas.map(item),
      vazio: 'Nenhuma entrada neste mês.',
    })

  async function confirmarExclusao() {
    if (!excluindo) return
    setApagando(true)
    try {
      await excluirLancamento(excluindo.id)
    } finally {
      setApagando(false)
      setExcluindo(null)
    }
  }

  const faixa = (
    <FiltrosRapidos
      rotuloAcessivel="Filtrar lançamentos"
      ativo={filtro}
      aoMudar={setFiltro}
      filtros={FILTROS.map((f) => ({ id: f.valor, rotulo: f.rotulo }))}
    />
  )

  const nomeDoMes = formatMonthYear(mes).toLowerCase()
  const frase = (
    <>
      <b>
        <Valor valor={totais.saiu} posto="fato" tinta="text-t1" /> de despesa em {nomeDoMes.split(' ')[0]}
      </b>
      {' · '}
      {doMes.length === 1 ? '1 lançamento' : `${doMes.length} lançamentos`} fora de venda
      {emAberto > 0 && `, ${emAberto} em aberto`}
    </>
  )

  const fixas = fixasPendentes.length > 0 && (
    <Cartao rotuloAcessivel="Despesas fixas ainda não lançadas">
      <Cartao.Cabecalho
        titulo="Fixas a lançar"
        meta={`${fixasPendentes.length === 1 ? '1 despesa fixa' : `${fixasPendentes.length} despesas fixas`} ainda fora de ${nomeDoMes.split(' ')[0]}`}
      />
      <Cartao.Lista rotuloAcessivel="Despesas fixas ainda não lançadas" colunas={{ valor: true, fim: true }}>
        {fixasPendentes.map((c) => {
          const titulo = c.template.description || c.template.category
          const meta = `modelo do lançamento de ${c.sourceMonth.slice(5, 7)}/${c.sourceMonth.slice(0, 4)}`
          return (
            <Linha
              key={c.template.id}
              titulo={titulo}
              meta={meta}
              valor={<Valor valor={c.template.amount} posto="linha" previsto />}
              aoClicar={() =>
                abrir({
                  rotulo: 'Despesa fixa',
                  titulo,
                  explica: 'Ainda não lançada neste mês. Nasce em aberto, com o valor do último mês.',
                  total: c.template.amount,
                  itens: [{ id: c.template.id, titulo, meta, valor: c.template.amount, situacao: 'prevista' }],
                })
              }
            />
          )
        })}
      </Cartao.Lista>
      <Cartao.Rodape>
        <span className="min-w-0">Nascem em aberto, com o valor do último mês.</span>
        <Button variant="secundario" icone={CalendarCheck} onClick={gerarFixas} carregando={gerando} disabled={gerando}>
          Lançar todas
        </Button>
      </Cartao.Rodape>
    </Cartao>
  )

  return (
    <PageLayout
      subtitulo={frase}
      faixa={faixa}
      cta={{ rotulo: 'Lançar despesa', rotuloCurto: 'Lançar', aoClicar: () => setNova(true) }}
    >
      <FaixaDeMetricas
        rotuloAcessivel={`Números de ${nomeDoMes}`}
        metricas={[
          {
            rotulo: 'Despesa no mês',
            valor: totais.saiu,
            lider: true,
            nota:
              saidas.length === 0
                ? 'nada saiu fora de venda'
                : `${saidas.length === 1 ? '1 saída' : `${saidas.length} saídas`}${saidasEmAberto > 0 ? `, ${saidasEmAberto} ainda em aberto` : ', todas pagas'}`,
            aoClicar: abrirSaidas,
          },
          {
            rotulo: 'Outras entradas',
            valor: totais.entrou,
            nota: entradas.length === 0 ? 'nada entrou fora de venda' : 'fora de venda, não soma na despesa',
            aoClicar: abrirEntradas,
          },
          {
            rotulo: 'Em aberto',
            valor: emAberto,
            texto: String(emAberto),
            nota: emAberto === 0 ? 'tudo baixado' : emAberto === 1 ? 'lançamento esperando baixa' : 'lançamentos esperando baixa',
            aoClicar: emAberto > 0 && filtro !== 'abertos' ? () => setFiltro('abertos') : undefined,
          },
        ]}
      />

      {/* Souza 3.0: o orçamento do mês saiu do Início e mora aqui, junto da despesa.
          Com fixas a lançar, os dois formam par; items-start: cada um com a sua altura. */}
      {fixas ? (
        <div className="grid items-start gap-bloco lg:grid-cols-2">
          <CartaoDoTeto />
          {fixas}
        </div>
      ) : (
        <CartaoDoTeto />
      )}

      <Cartao rotuloAcessivel="Lançamentos">
        <Cartao.Cabecalho
          titulo="Lançamentos"
          meta="comissão, imposto e repasse ficam na ficha da venda"
          extra={
            doMes.length > 0 ? (
              <Button variant="fantasma" size="sm" icone={Download} onClick={exportar}>
                Baixar CSV
              </Button>
            ) : undefined
          }
        />
        {doMes.length === 0 ? (
          <EstadoVazio
            icone={Receipt}
            titulo={filtro === 'todos' ? 'Nada lançado neste mês' : 'Nada neste filtro'}
            descricao="Use o botão Lançar para registrar uma despesa em três toques."
          />
        ) : (
          <TabelaDeDados
            rotuloAcessivel="Lançamentos do mês"
            linhas={doMes}
            chave={(t) => t.id}
            chaveDeReinicio={filtro}
            nomes={['lançamento', 'lançamentos']}
            porPagina={15}
            ordemInicial={{ coluna: 'data', direcao: 'desc' }}
            aoAbrirLinha={abrirLancamento}
            rotuloAbrir={(t) => `Abrir ${nomeDe(t)}`}
            colunas={[
              {
                id: 'lancamento',
                rotulo: 'Lançamento',
                ordenar: (t) => nomeDe(t),
                celula: (t) => (
                  <span className="flex min-w-0 max-w-[11rem] flex-col sm:max-w-[24rem]">
                    <span className="truncate font-medium text-t1">{nomeDe(t)}</span>
                    <span className="truncate text-t-meta text-nota">
                      {[t.category, t.contact_id ? nomePorContato.get(t.contact_id) : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                ),
              },
              {
                id: 'data',
                rotulo: 'Data',
                ordenar: (t) => dataDe(t),
                esconder: 'sm',
                celula: (t) => <span className="num whitespace-nowrap text-t3">{formatDate(dataDe(t))}</span>,
              },
              {
                id: 'situacao',
                rotulo: 'Situação',
                esconder: 'md',
                celula: (t) => <ChipSituacao situacao={situacaoDoLancamento(t)} />,
              },
              {
                id: 'valor',
                rotulo: 'Valor',
                numerica: true,
                ordenar: (t) => (t.kind === 'income' ? t.amount : -t.amount),
                celula: (t) => (
                  <Valor
                    valor={t.kind === 'income' ? t.amount : -t.amount}
                    posto="linha"
                    estado={t.kind === 'income' ? 'recebido' : undefined}
                  />
                ),
              },
              {
                id: 'acoes',
                rotulo: '',
                numerica: true,
                celula: (t) =>
                  t.status === 'pending' ? (
                    // Paguei/Recebi na linha (Confirmar, com Desfazer no aviso); o "⋯" abre o painel do lançamento.
                    <BaixaNaLinha
                      rotulo={t.kind === 'income' ? 'Recebi' : 'Paguei'}
                      baixar={baixaDeLancamento([t])}
                      aoDetalhar={() => setMenuDe(t)}
                    />
                  ) : (
                    // As ações não abrem a linha: o clique para aqui.
                    <span className="inline-flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="fantasma"
                        icone={RotateCcw}
                        onClick={() => estornarLancamento(t.id, t.settled_date ?? t.competence_date)}
                        aria-label={`Desfazer baixa de ${nomeDe(t)}`}
                      >
                        Desfazer
                      </Button>
                      <Button
                        size="icone"
                        variant="fantasma"
                        icone={MoreHorizontal}
                        aria-label={`Mais ações de ${nomeDe(t)}: excluir`}
                        onClick={() => setMenuDe(t)}
                      />
                    </span>
                  ),
              },
            ]}
          />
        )}
      </Cartao>

      {/* O "⋯" do lançamento: excluir sai da linha e passa por confirmação. */}
      <SidePanel
        aberto={!!menuDe}
        aoFechar={() => setMenuDe(null)}
        titulo="Ações do lançamento"
        subtitulo={menuDe ? `${nomeDe(menuDe)} · ${formatCurrency(menuDe.amount)}` : undefined}
        forma="folha"
      >
        <div className="flex flex-col gap-3">
          {menuDe?.status === 'pending' && (
            <Button
              variant="secundario"
              size="lg"
              onClick={() => {
                setBaixando(menuDe)
                setMenuDe(null)
              }}
            >
              {menuDe.kind === 'income' ? 'Recebi: escolher data e conta' : 'Paguei: escolher data e conta'}
            </Button>
          )}
          <Button
            variant="perigo"
            size="lg"
            icone={Trash2}
            onClick={() => {
              setExcluindo(menuDe)
              setMenuDe(null)
            }}
          >
            Excluir lançamento
          </Button>
        </div>
      </SidePanel>

      <ConfirmDialog
        aberto={!!excluindo}
        aoFechar={() => setExcluindo(null)}
        titulo={excluindo ? `Excluir "${nomeDe(excluindo)}" de ${formatCurrency(excluindo.amount)}?` : 'Excluir lançamento?'}
        rotuloConfirmar="Excluir"
        aoConfirmar={confirmarExclusao}
        ocupado={apagando}
      />

      <LancarDespesa aberto={nova} onFechar={() => setNova(false)} />
      <BaixarLancamento tx={baixando} onFechar={() => setBaixando(null)} />
    </PageLayout>
  )
}
