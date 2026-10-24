import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgePercent, Calculator, Gift, HandCoins, Wallet } from 'lucide-react'
import { useAdmin } from './AdminData'
import { SidePanel } from '@/components/ui/SidePanel'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { Demonstrativo } from '@/components/ui/Demonstrativo'
import { Linha } from '@/components/ui/Lista'
import { Selo } from '@/components/ui/Selo'
import { ChipSituacao, FraseDeTempo } from '@/components/ui/Situacao'
import { Valor, ValorComOrigem } from '@/components/ui/Valor'
import { Dica } from '@/components/ui/Dica'
import { FiltrosRapidos } from '@/components/ui/FiltrosRapidos'
import { formatCurrency, toDateOnly } from '@/lib/format'
import type { LinhaDemonstrativo } from '@/lib/linhasDaVenda'
import { situacaoDeTela } from '@/lib/situacao'
import { BlocoDaFolha, ListaNaFolha, QuadroDaConta, RodapeDaFolha } from './FolhaDeLancamento'

export interface ComissaoAPagar {
  installmentId: string
  brokerName: string
  saleTitle: string
  parcela: string
  amount: number
  dueDate: string
  /**
   * A venda da parcela. Opcional: quando a tela que abre a folha informa, o
   * valor da parcela vira link para a parcela na venda (7.10, fim do
   * drill-down). Sem ele, o valor continua só exibido, como antes.
   */
  saleId?: string
}

/**
 * O ordinal real da parcela, extraído do rótulo que a tela de A pagar monta
 * ("parcela 3/9").
 *
 * O selo existe para carregar o ORDINAL — o "3" de 3/9 — e é isso que
 * transforma uma lista de seis linhas parecidas em seis linhas reconhecíveis.
 * O número já viaja até aqui, só que dentro de uma frase; lê-lo de volta é
 * apresentação. Passar `idx`/`count` no contrato seria melhor, mas isso é
 * mudança em `src/admin/pages/Pagar.tsx`, fora desta folha.
 */
function ordinal(rotulo: string): { idx?: number; count?: number } {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(rotulo)
  if (!m) return {}
  return { idx: Number(m[1]), count: Number(m[2]) }
}

/*
 * PAGAR COMISSÃO LIBERADA.
 *
 * "Liberada" tem um significado exato neste sistema: a imobiliária JÁ recebeu
 * a parcela da construtora, então o dinheiro do corretor existe e está apenas
 * esperando um humano. Liberada que passou da data é atraso de verdade — a
 * imobiliária recebeu e não repassou — e por isso a situação passa por
 * `situacaoDeTela`, que é quem decide entre "Liberada" e "Vencida".
 *
 * A folha aceita várias parcelas do mesmo corretor de uma vez, porque é assim
 * que acontece na prática. O desconto combinado só é oferecido quando há uma
 * parcela só: aplicar um desconto sobre um lote seria ambíguo, e foi um
 * desconto desses (a cesta de R$ 399,44 na 414-D) que já ficou registrado
 * apenas na descrição do lançamento, sem campo próprio.
 *
 * Abre no painel lateral (princípio 10), com a lista de A pagar visível atrás.
 * Três blocos com nome — as parcelas, o pagamento, o total — e a ação no
 * rodapé fixo dizendo quanto vai sair. O painel só fecha depois que o banco
 * confirma; em falha, data, conta e desconto continuam como foram digitados.
 *
 * O RPC continua sendo `pagarComissoes`, com o mesmo payload.
 *
 * TEVE BRINDE? (23/10/2026). Com uma parcela só, a folha pergunta. O brinde é
 * meio a meio (decisão de 23/10): metade sai deste repasse, como desconto do
 * corretor, e o brinde inteiro vira despesa da venda, paga na mesma data e
 * conta. A imobiliária fica, assim, com a outra metade.
 */

/** Prefixo da despesa de brinde: é por ele que a folha sabe que a venda já teve um. */
const BRINDE = 'Brinde'
const r2 = (v: number) => Math.round(v * 100) / 100
export function PagarComissao({
  itens,
  onFechar,
}: {
  itens: ComissaoAPagar[] | null
  onFechar: () => void
}) {
  const { accounts, sales, transactions, pagarComissoes, criarLancamento, hoje } = useAdmin()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [data, setData] = useState(toDateOnly(new Date()))
  const [contaId, setContaId] = useState('')
  const [desconto, setDesconto] = useState<number | null>(null)
  const [nota, setNota] = useState('')
  const [teveBrinde, setTeveBrinde] = useState(false)
  const [brinde, setBrinde] = useState<number | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const contas = useMemo(() => accounts.filter((a) => a.is_active && a.type !== 'credit_card'), [accounts])
  const unica = itens?.length === 1

  useEffect(() => {
    if (!itens) return
    setData(toDateOnly(new Date()))
    setContaId(contas[0]?.id ?? '')
    setDesconto(null)
    setNota('')
    setTeveBrinde(false)
    setBrinde(null)
    setErro(null)
  }, [itens, contas])

  if (!itens || itens.length === 0) return null

  const total = r2(itens.reduce((s, i) => s + i.amount, 0))
  const valorBrinde = unica && teveBrinde ? brinde ?? 0 : 0
  const metadeBrinde = r2(valorBrinde / 2)
  const aPagar = r2(total - (unica ? desconto ?? 0 : 0) - metadeBrinde)
  const corretor = itens[0].brokerName
  const venda = unica && itens[0].saleId ? sales.find((s) => s.id === itens[0].saleId) : undefined
  /** Brinde já lançado nesta venda: a folha avisa, para não descontar duas vezes. */
  const brindeAnterior = venda
    ? transactions.filter((t) => t.sale_id === venda.id && t.description?.startsWith(BRINDE))
    : []

  /*
   * A origem do total, em palavras: quantas parcelas, de quais vendas. É o que
   * permite conferir o lote sem abrir a ficha de cada venda.
   */
  const vendas = [...new Set(itens.map((i) => i.saleTitle))]
  const varias = vendas.length > 1
  const origem =
    vendas.length === 1
      ? `${itens.length} ${itens.length === 1 ? 'parcela' : 'parcelas'} de ${vendas[0]}`
      : `${itens.length} parcelas de ${vendas.length} vendas: ${vendas.join(' · ')}`

  /*
   * A mesma conta que a cascata antiga desenhava: comissão liberada, menos o
   * desconto (só com uma parcela e desconto maior que zero), igual a pagar.
   */
  const linhasDoTotal: LinhaDemonstrativo[] = [
    { chave: 'corretor', rotulo: 'Comissão liberada', sinal: '+', valor: total },
    ...((desconto ?? 0) > 0 && unica
      ? [{ chave: 'desconto', rotulo: 'Desconto combinado', detalhe: nota || undefined, sinal: '−', valor: desconto ?? 0 } as LinhaDemonstrativo]
      : []),
    ...(metadeBrinde > 0
      ? [{ chave: 'desconto', rotulo: 'Metade do brinde', detalhe: `brinde de ${formatCurrency(valorBrinde)}`, sinal: '−', valor: metadeBrinde } as LinhaDemonstrativo]
      : []),
    { chave: 'corretor', rotulo: 'A pagar agora', sinal: '=', valor: aPagar },
  ]

  function fechar() {
    if (!salvando) onFechar()
  }

  async function confirmar() {
    setErro(null)
    if (teveBrinde && valorBrinde <= 0) return setErro('Informe o valor do brinde, ou marque que não teve brinde.')
    if (aPagar < 0)
      return setErro(
        `Os descontos (${formatCurrency(total - aPagar)}) passam da comissão de ${formatCurrency(total)}. ` +
          'Reduza o desconto para no máximo o valor da comissão — pagamento negativo não existe no caixa.',
      )
    const notaDoBrinde =
      metadeBrinde > 0 ? `${BRINDE} de ${formatCurrency(valorBrinde)}: metade do corretor, ${formatCurrency(metadeBrinde)}` : ''
    setSalvando(true)
    try {
      await pagarComissoes({
        installmentIds: itens!.map((i) => i.installmentId),
        date: data,
        accountId: contaId || null,
        adjustment: unica ? r2((desconto ?? 0) + metadeBrinde) : 0,
        note: [notaDoBrinde, nota].filter(Boolean).join(' · ') || null,
      })
      if (valorBrinde > 0) {
        try {
          await criarLancamento({
            kind: 'expense',
            category: 'Outras Variáveis',
            dre_group: 'variable_expense',
            description: `${BRINDE} · ${itens![0].saleTitle}`,
            amount: valorBrinde,
            competence_date: data,
            status: 'settled',
            settled_date: data,
            due_date: null,
            is_recurring: false,
            account_id: contaId || null,
            sale_id: venda?.id ?? null,
            cost_center_id: venda?.cost_center_id ?? null,
          })
        } catch (e) {
          // A comissão já foi paga; só a despesa do brinde ficou de fora.
          showToast({
            message: 'Comissão paga, mas o brinde não foi lançado',
            detail: `Lance ${formatCurrency(valorBrinde)} em Despesas. ${e instanceof Error ? e.message : ''}`,
          })
          onFechar()
          return
        }
      }
      showToast({
        message: `Comissão paga a ${corretor}`,
        detail:
          `${formatCurrency(aPagar)} em ${itens!.length} parcela(s)` +
          (valorBrinde > 0 ? ` · brinde de ${formatCurrency(valorBrinde)} lançado` : ''),
      })
      onFechar()
    } catch (e) {
      setErro(
        e instanceof Error
          ? `O pagamento não foi gravado: ${e.message}`
          : 'O pagamento não foi gravado e a comissão continua liberada. Confira a conexão e confirme de novo.',
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <SidePanel
      aberto={!!itens}
      aoFechar={fechar}
      titulo="Pagar comissão"
      subtitulo={`${corretor} · ${itens.length === 1 ? '1 parcela' : `${itens.length} parcelas`}`}
      rodape={
        /* UMA ação primária, e ela diz quanto vai sair. */
        <RodapeDaFolha erro={erro} tituloDoErro="Pagamento não gravado">
          <Button variant="secundario" size="lg" onClick={fechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="primario" size="lg" onClick={confirmar} carregando={salvando}>
            Pagar <Valor valor={aPagar} posto="fato" tinta="text-brand-fill-text" />
          </Button>
        </RodapeDaFolha>
      }
    >
      <>
        {/*
         * Uma linha por parcela, o valor de todas na MESMA coluna à direita:
         * é assim que dois valores próximos se comparam por contagem de
         * dígitos, sem leitura.
         */}
        <BlocoDaFolha titulo="Parcelas a repassar" icone={HandCoins}>
          <ListaNaFolha rotuloAcessivel="Parcelas a repassar">
            {itens.map((i) => {
              /*
               * Parcelas de vendas diferentes não formam uma sequência: o
               * ordinal sai do selo e vai escrito no título ("· parcela 2/3"),
               * para os selos não parecerem 2, 2 de uma venda só.
               */
              const { idx, count } = varias ? {} : ordinal(i.parcela)
              const situacao = situacaoDeTela('liberada', i.dueDate, hoje)
              const saleId = i.saleId
              return (
                <Linha
                  key={i.installmentId}
                  selo={<Selo situacao={situacao} idx={idx} count={count} />}
                  titulo={varias ? `${i.saleTitle} · ${i.parcela}` : i.saleTitle}
                  meta={<FraseDeTempo situacao={situacao} prevista={i.dueDate} liberada={i.dueDate} />}
                  situacao={<ChipSituacao situacao={situacao} />}
                  valor={
                    saleId ? (
                      <ValorComOrigem
                        valor={i.amount}
                        posto="linha"
                        chevron="depois"
                        rotuloAcessivel={`Abrir a ${i.parcela} de ${i.saleTitle}`}
                        aoAbrir={() => {
                          if (salvando) return
                          onFechar()
                          navigate(`/vendas/${saleId}?parcela=${i.installmentId}`)
                        }}
                      />
                    ) : (
                      <Valor valor={i.amount} posto="linha" />
                    )
                  }
                />
              )
            })}
          </ListaNaFolha>
        </BlocoDaFolha>

        <BlocoDaFolha titulo="O pagamento" icone={Wallet}>
          <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2">
            <FormField label="Data do pagamento" htmlFor="p-data" hint="o dia em que o dinheiro saiu">
              <Input id="p-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </FormField>
            {/*
             * O foco inicial mora aqui, e não na data: o valor já vem da
             * parcela e a data já vem com hoje. A única coisa que de fato muda
             * de um pagamento para o outro é de qual conta ele sai.
             */}
            <FormField
              label="Conta"
              htmlFor="p-conta"
              hint={
                contas.length === 0
                  ? 'Nenhuma conta cadastrada ainda. Cadastre em Ajustes › Contas para o saldo bater.'
                  : 'de onde o dinheiro saiu'
              }
            >
              <Select
                id="p-conta"
                data-foco-inicial
                value={contaId}
                onChange={(e) => setContaId(e.target.value)}
                disabled={contas.length === 0}
              >
                <option value="">Definir depois</option>
                {contas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          {!unica && (
            <Dica>
              Brinde e desconto só em pagamento de uma parcela por vez: sobre um lote não dá para saber
              de qual venda ele saiu.
            </Dica>
          )}
        </BlocoDaFolha>

        {unica && (
          <BlocoDaFolha titulo="Brinde" icone={Gift}>
            <FormField label="Teve brinde?" htmlFor="p-brinde">
              <FiltrosRapidos
                rotuloAcessivel="Teve brinde nesta venda?"
                ativo={teveBrinde ? 'sim' : 'nao'}
                aoMudar={(v) => setTeveBrinde(v === 'sim')}
                filtros={[
                  { id: 'nao', rotulo: 'Não' },
                  { id: 'sim', rotulo: 'Sim' },
                ]}
              />
            </FormField>
            {brindeAnterior.length > 0 && (
              <Dica>
                Esta venda já teve brinde de{' '}
                <Valor valor={brindeAnterior.reduce((t, b) => t + b.amount, 0)} posto="fato" />. Marque Sim só se
                for outro.
              </Dica>
            )}
            {teveBrinde && (
              <FormField
                label="Valor do brinde"
                htmlFor="p-brinde-valor"
                hint={
                  valorBrinde > 0
                    ? `Metade, ${formatCurrency(metadeBrinde)}, sai deste repasse; a outra metade fica com a imobiliária. O brinde inteiro entra como despesa da venda.`
                    : 'Meio a meio: metade sai do repasse do corretor, metade fica com a imobiliária.'
                }
              >
                <CurrencyInput id="p-brinde-valor" value={brinde} onChange={setBrinde} />
              </FormField>
            )}
          </BlocoDaFolha>
        )}

        {unica && (
          <BlocoDaFolha titulo="Desconto combinado" icone={BadgePercent} descricao="opcional">
            <FormField
              label="Valor do desconto"
              htmlFor="p-desc"
              hint="Em reais. Sai do valor pago e fica registrado como desconto — não como comissão menor."
            >
              <CurrencyInput id="p-desc" value={desconto} onChange={setDesconto} />
            </FormField>
            {(desconto ?? 0) > 0 && (
              <FormField
                label="Do que foi o desconto"
                htmlFor="p-nota"
                hint="Sem esta frase o desconto vira um valor sem motivo daqui a seis meses."
              >
                <Input
                  id="p-nota"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Ex.: cesta de Natal"
                />
              </FormField>
            )}
          </BlocoDaFolha>
        )}

        {/* O total, com a origem escrita embaixo. */}
        <BlocoDaFolha titulo="O total" icone={Calculator}>
          <QuadroDaConta className="flex flex-col gap-2">
            <Demonstrativo linhas={linhasDoTotal} rotuloAcessivel="Total do pagamento" />
            <p className="text-t-meta text-nota">{origem}</p>
          </QuadroDaConta>
        </BlocoDaFolha>
      </>
    </SidePanel>
  )
}
