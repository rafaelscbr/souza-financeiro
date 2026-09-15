import { useMemo, useState } from 'react'
import { CalendarClock, Download, MoreHorizontal, Receipt, RotateCcw, Trash2 } from 'lucide-react'
import { useAdmin } from '../AdminData'
import { LancarDespesa } from '../LancarDespesa'
import { BaixarLancamento } from '../BaixarLancamento'
import { useComposicao } from '@/components/composicao/Composicao'
import { PageLayout } from '@/components/layout/PageLayout'
import { Heroi } from '@/components/ui/Heroi'
import { Cartao } from '@/components/ui/Cartao'
import { Linha } from '@/components/ui/Lista'
import { Valor } from '@/components/ui/Valor'
import { Selo } from '@/components/ui/Selo'
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
 * 1. Cabeçalho da casca com o CTA "Lançar despesa" (o mesmo painel de antes).
 * 2. Faixa: seletor de mês + filtros Todos / Liquidados / Em aberto.
 * 3. Herói ouro "Despesa no mês", com "Outras entradas do mês" como apoio
 *    (não soma). Os dois abrem os lançamentos que os formam.
 * 4. Cartão das fixas ainda não lançadas, com "Lançar todas em aberto".
 * 5. Cartão "Lançamentos": Paguei/Recebi (ou Desfazer) sempre visível; o "⋯"
 *    leva a Excluir, que confirma no ConfirmDialog.
 *
 * Carregando e erro são da casca (CascaDaPagina); o vazio mora no cartão.
 *
 * DEFEITO CONHECIDO, DEIXADO COMO ESTÁ (esta passagem é só de apresentação):
 * `totais` é somado sobre `doMes`, que já vem filtrado pelo seletor
 * Todos/Liquidados/Em aberto. Trocar o filtro muda o número do herói.
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

  return (
    <PageLayout
      subtitulo={`${doMes.length === 1 ? '1 lançamento' : `${doMes.length} lançamentos`} fora de venda em ${formatMonthYear(mes)}`}
      faixa={faixa}
      cta={{ rotulo: 'Lançar despesa', rotuloCurto: 'Lançar', aoClicar: () => setNova(true) }}
    >
      <Heroi
        variante="ouro"
        rotulo="Despesa no mês"
        valor={totais.saiu}
        aoAbrir={abrirSaidas}
        rotuloAcessivel="Ver quais lançamentos formam a despesa do mês"
        frase={`Tudo que saiu e o que ainda vai sair em ${formatMonthYear(mes)}, fora da venda. Comissão, imposto e repasse não entram aqui: eles vivem na ficha da venda.`}
        apoios={[
          {
            rotulo: 'Outras entradas do mês',
            valor: totais.entrou,
            aoAbrir: abrirEntradas,
            rotuloAcessivel: 'Ver quais entradas formam este total',
          },
        ]}
      />

      {fixasPendentes.length > 0 && (
        <Cartao rotuloAcessivel="Despesas fixas ainda não lançadas">
          <Cartao.Cabecalho titulo="Despesas fixas ainda não lançadas" icone={CalendarClock} />
          <Cartao.Lista
            rotuloAcessivel="Despesas fixas ainda não lançadas"
            colunas={{ goteira: true, valor: true, fim: true }}
          >
            {fixasPendentes.map((c) => {
              const titulo = c.template.description || c.template.category
              const meta = `modelo do lançamento de ${c.sourceMonth.slice(5, 7)}/${c.sourceMonth.slice(0, 4)}`
              return (
                <Linha
                  key={c.template.id}
                  goteira={<Selo situacao="prevista" />}
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
            <span className="min-w-0 max-w-[62ch]">
              Nascem em aberto, com o valor do último mês. Dar baixa é que faz o dinheiro sair.
            </span>
            <Button variant="secundario" onClick={gerarFixas} carregando={gerando} disabled={gerando}>
              Lançar todas em aberto
            </Button>
          </Cartao.Rodape>
        </Cartao>
      )}

      <Cartao rotuloAcessivel="Lançamentos">
        <Cartao.Cabecalho
          titulo="Lançamentos"
          icone={Receipt}
          extra={
            doMes.length > 0 ? (
              <Button variant="secundario" size="sm" icone={Download} onClick={exportar}>
                Baixar CSV do mês
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
          <Cartao.Lista
            rotuloAcessivel="Lançamentos do mês, do mais recente ao mais antigo"
            chaveEscada={filtro}
            colunas={{ goteira: true, situacao: true, valor: true, acao: '9.5rem', fim: true }}
          >
            {doMes.map((t) => {
              const s = situacaoDoLancamento(t)
              const entrada = t.kind === 'income'
              return (
                <Linha
                  key={t.id}
                  goteira={<Selo situacao={s} />}
                  titulo={nomeDe(t)}
                  meta={[formatDate(dataDe(t)), t.category, t.contact_id ? nomePorContato.get(t.contact_id) : null]
                    .filter(Boolean)
                    .join(' · ')}
                  situacao={<ChipSituacao situacao={s} />}
                  /* Entrada sobe, saída desce: o sinal é o "−" do próprio Valor. */
                  valor={
                    <Valor
                      valor={entrada ? t.amount : -t.amount}
                      posto="linha"
                      estado={entrada ? 'recebido' : undefined}
                    />
                  }
                  aoClicar={() => abrirLancamento(t)}
                  acao={
                    <>
                      {t.status === 'pending' ? (
                        <Button size="sm" variant="secundario" onClick={() => setBaixando(t)}>
                          {entrada ? 'Recebi' : 'Paguei'}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="fantasma"
                          icone={RotateCcw}
                          onClick={() => estornarLancamento(t.id, t.settled_date ?? t.competence_date)}
                          aria-label={`Desfazer baixa de ${nomeDe(t)}`}
                        >
                          Desfazer
                        </Button>
                      )}
                      <Button
                        size="icone"
                        variant="fantasma"
                        icone={MoreHorizontal}
                        aria-label={`Mais ações de ${nomeDe(t)}: excluir`}
                        onClick={() => setMenuDe(t)}
                      />
                    </>
                  }
                />
              )
            })}
          </Cartao.Lista>
        )}
        <Cartao.Rodape>
          <span className="min-w-0 max-w-[80ch]">
            Esta tela é o razão fora da venda. Comissão de corretor, ISS, Simples e repasse de sócio nascem da ficha
            da venda e são conferidos lá — é o que mantém esta lista com o tamanho de um mês, e não com o tamanho da
            carteira.
          </span>
        </Cartao.Rodape>
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
