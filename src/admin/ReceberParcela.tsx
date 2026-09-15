import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import {
  Banknote,
  Calculator,
  CircleAlert,
  CircleCheck,
  HandCoins,
  Landmark,
  Receipt,
  Scale,
  type LucideIcon,
} from 'lucide-react'
import { useAdmin } from './AdminData'
import { SidePanel } from '@/components/ui/SidePanel'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { FiltrosRapidos } from '@/components/ui/FiltrosRapidos'
import { useToast } from '@/components/ui/Toast'
import { Demonstrativo } from '@/components/ui/Demonstrativo'
import { Lista, Linha } from '@/components/ui/Lista'
import { Selo } from '@/components/ui/Selo'
import { Icone } from '@/components/ui/Icone'
import { ChipSituacao, FraseDeTempo } from '@/components/ui/Situacao'
import { Valor } from '@/components/ui/Valor'
import { Dica } from '@/components/ui/Dica'
import { formatCurrency, toDateOnly } from '@/lib/format'
import { situacaoDeTela } from '@/lib/situacao'
import { previewCascade, type SaleView } from '@/lib/sales'
import type { LinhaDemonstrativo } from '@/lib/linhasDaVenda'
import { cn } from '@/lib/utils'
import type { SaleInstallment } from '@/types'

type Diferenca = 'iss' | 'desconto'

/** Percentual sem casa inventada: 3 → "3%", 2,5 → "2,5%". */
const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`

/*
 * CONFIRMAR QUE O DINHEIRO CAIU (9.6, 7.9, 7.10).
 *
 * A regra de negócio não mudou e não podia mudar: a tela parte do valor que
 * REALMENTE entrou na conta, não do valor da parcela. Na venda 414-D a
 * construtora retém 3% de ISS no ato do pagamento; sem classificar essa
 * diferença o Simples de 6% seria calculado sobre a base errada.
 *
 * Anatomia: SidePanel md com blocos sem caixa (a parcela como Linha, o que
 * caiu na conta, a diferença, o que acontece ao confirmar). A conta que vai
 * ser gravada (Demonstrativo) mora no rodapé fixo a partir de 640px, visível
 * enquanto se digita; no celular ela desce para o corpo, porque um rodapé de
 * 300px cobriria o campo que está sendo digitado.
 *
 * O painel só fecha depois que o banco confirma; em falha, tudo o que foi
 * digitado continua e o erro aparece no rodapé, junto do botão.
 *
 * O cálculo continua sendo `previewCascade`, e a gravação continua sendo o RPC
 * `receberParcela`. Esta tela não faz conta nenhuma por fora deles.
 */
export function ReceberParcela({
  venda,
  parcela,
  onFechar,
}: {
  venda: SaleView | null
  parcela: SaleInstallment | null
  onFechar: () => void
}) {
  const { accounts, receberParcela, hoje } = useAdmin()
  const { showToast } = useToast()
  const idForm = useId()

  const [data, setData] = useState(toDateOnly(new Date()))
  const [contaId, setContaId] = useState('')
  const [recebido, setRecebido] = useState<number | null>(null)
  const [tipoDiferenca, setTipoDiferenca] = useState<Diferenca>('iss')
  const [nota, setNota] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const contas = useMemo(() => accounts.filter((a) => a.is_active && a.type !== 'credit_card'), [accounts])

  useEffect(() => {
    if (!parcela) return
    setData(toDateOnly(new Date()))
    setContaId(contas[0]?.id ?? '')
    // Já sugere o líquido quando a construtora retém: é o valor que vai cair.
    const issPrevisto = venda?.retains_iss ? Math.round(parcela.amount * (venda.iss_pct ?? 0)) / 100 : 0
    setRecebido(Math.round((parcela.amount - issPrevisto) * 100) / 100)
    setTipoDiferenca('iss')
    setNota('')
    setErro(null)
  }, [parcela, venda, contas])

  if (!venda || !parcela) return null

  const valorRecebido = recebido ?? 0
  const diferenca = Math.round((parcela.amount - valorRecebido) * 100) / 100
  const iss = tipoDiferenca === 'iss' ? Math.max(0, diferenca) : 0
  const outro = tipoDiferenca === 'desconto' ? Math.max(0, diferenca) : 0
  const sobra = diferenca < -0.01

  const previa = previewCascade({
    amount: parcela.amount,
    issuesInvoice: venda.issues_invoice,
    simplesPct: venda.simples_pct,
    retainsIss: iss > 0,
    issPct: parcela.amount > 0 ? (iss / parcela.amount) * 100 : 0,
    brokerPct: venda.broker_pct,
  })

  /*
   * A situação NUNCA é escrita à mão: sai de `situacaoDeTela`, que já aplica a
   * regra mais importante do sistema — parcela que a construtora não pagou é
   * espera, não atraso, e por isso jamais aparece como "vencida" aqui.
   */
  const situacao = situacaoDeTela(parcela.status, parcela.expected_date, hoje)
  const conta = contas.find((a) => a.id === contaId)
  const corretor = venda.brokerName ?? 'corretor'

  function fechar() {
    if (!salvando) onFechar()
  }

  async function confirmar() {
    setErro(null)
    if (sobra)
      return setErro(
        `Você informou ${formatCurrency(valorRecebido)} e a parcela é de ${formatCurrency(parcela!.amount)}. ` +
          'Deixe aqui o valor da parcela e lance a sobra como entrada avulsa — juros e correção não são comissão e não podem entrar nesta cascata.',
      )
    setSalvando(true)
    try {
      await receberParcela({
        installmentId: parcela!.id,
        date: data,
        accountId: contaId || null,
        received: valorRecebido,
        iss,
        other: outro,
        note: nota || null,
      })
      const efeitos = [
        previa.simples > 0 ? `Simples de ${formatCurrency(previa.simples)} a pagar` : null,
        previa.broker > 0 ? `comissão de ${venda!.brokerName ?? 'corretor'} liberada` : null,
      ].filter(Boolean)
      showToast({
        message: `Recebido ${formatCurrency(valorRecebido)}`,
        detail: efeitos.join(' · ') || undefined,
      })
      onFechar()
    } catch (e) {
      setErro(
        e instanceof Error
          ? `O recebimento não foi gravado: ${e.message}`
          : 'O recebimento não foi gravado e nada mudou na venda. Confira a conexão e confirme de novo.',
      )
    } finally {
      setSalvando(false)
    }
  }

  /*
   * A conta, na ordem do banco (migração 009) e a mesma da ficha da venda.
   * O total não leva tinta verde: aqui nada se moveu ainda.
   */
  const linhasDaConta: LinhaDemonstrativo[] = [
    {
      chave: 'bruto',
      rotulo: 'Parcela da comissão',
      detalhe: parcela.count > 1 ? `${parcela.idx} de ${parcela.count}` : undefined,
      sinal: '+',
      valor: parcela.amount,
    },
    ...(iss > 0
      ? [
          {
            chave: 'iss' as const,
            rotulo: 'ISS retido na fonte',
            detalhe: `${pct(parcela.amount > 0 ? (iss / parcela.amount) * 100 : 0)} retido pela construtora`,
            sinal: '−' as const,
            valor: iss,
          },
        ]
      : []),
    ...(previa.simples > 0
      ? [
          {
            chave: 'simples' as const,
            rotulo: 'Imposto (Simples)',
            detalhe: `${pct(venda.simples_pct)} sobre a parcela líquida de ISS`,
            sinal: '−' as const,
            valor: previa.simples,
          },
        ]
      : []),
    { chave: 'base', rotulo: 'Base de cálculo', detalhe: 'o que sobra depois dos impostos', sinal: '=', valor: previa.base },
    ...(previa.broker > 0
      ? [
          {
            chave: 'corretor' as const,
            rotulo: `Comissão de ${corretor}`,
            detalhe: `base × ${pct(venda.broker_pct ?? 0)}`,
            sinal: '−' as const,
            valor: previa.broker,
          },
        ]
      : []),
    ...(outro > 0 ? [{ chave: 'desconto' as const, rotulo: 'Desconto concedido', sinal: '−' as const, valor: outro }] : []),
    { chave: 'fica', rotulo: 'Fica para a imobiliária', sinal: '=', valor: previa.net - outro },
  ]

  const contaGravada = <Demonstrativo linhas={linhasDaConta} rotuloAcessivel="A conta que vai ser gravada" />

  const aoConfirmar: { icone: LucideIcon; texto: string }[] = [
    {
      icone: CircleCheck,
      texto: `A receita de ${formatCurrency(parcela.amount)} é liquidada${conta ? ` em ${conta.name}` : ', com a conta a definir'}.`,
    },
    ...(previa.simples > 0
      ? [
          {
            icone: Landmark,
            texto: `O Simples de ${formatCurrency(previa.simples)} entra em A pagar, com guia no dia 20 do mês seguinte.`,
          },
        ]
      : []),
    ...(previa.broker > 0
      ? [
          {
            icone: HandCoins,
            texto: `A comissão de ${corretor}, de ${formatCurrency(previa.broker)}, fica liberada para pagamento.`,
          },
        ]
      : []),
  ]

  return (
    <SidePanel
      aberto={!!parcela}
      aoFechar={fechar}
      titulo="Confirmar recebimento"
      // Sem repetir o nome da venda: ele já é o título da linha logo abaixo.
      subtitulo={[venda.development, venda.unit].filter(Boolean).join(' · ') || undefined}
      rodape={
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* A partir de 640px a conta fica à vista enquanto se digita. */}
          <div className="flex flex-col gap-2 max-sm:hidden">
            <p className="text-texto-meta text-t-meta">
              A conta que vai ser gravada · na ordem do banco: impostos, base e corretor
            </p>
            {contaGravada}
          </div>
          {erro && (
            <Aviso titulo="Recebimento não gravado" papel="alert">
              {erro}
            </Aviso>
          )}
          {/*
           * UMA ação primária. "Cancelar" é fantasma de propósito: só um dos
           * dois botões grava.
           */}
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="fantasma"
              size="lg"
              className="max-sm:flex-1"
              onClick={fechar}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button type="submit" form={idForm} size="lg" className="max-sm:flex-1" carregando={salvando}>
              Confirmar recebimento
            </Button>
          </div>
        </div>
      }
    >
      <form
        id={idForm}
        noValidate
        className="flex flex-col gap-8"
        onSubmit={(e) => {
          e.preventDefault()
          if (!salvando) void confirmar()
        }}
      >
        {/* A parcela como linha de extrato: selo com o ordinal real, frase com verbo, chip e valor. */}
        <Bloco titulo="A parcela" icone={Receipt}>
          <Lista
            contexto="sobreposicao"
            colunas={{ goteira: true, situacao: true, valor: true }}
            rotuloAcessivel="Parcela a confirmar"
            semEscada
          >
            <Linha
              goteira={<Selo situacao={situacao} idx={parcela.idx} count={parcela.count} />}
              titulo={venda.title}
              meta={
                <FraseDeTempo situacao={situacao} prevista={parcela.expected_date} recebida={parcela.received_date} />
              }
              situacao={<ChipSituacao situacao={situacao} />}
              valor={<Valor valor={parcela.amount} posto="linha" />}
            />
          </Lista>
        </Bloco>

        <Bloco titulo="O que caiu na conta" icone={Banknote} separado>
          <FormField
            label="Quanto caiu na conta"
            htmlFor="r-valor"
            hint="Em reais, o valor do extrato — não o da parcela. Quando a construtora retém ISS os dois são diferentes, e é dessa diferença que sai o imposto certo."
          >
            <CurrencyInput id="r-valor" value={recebido} onChange={setRecebido} data-foco-inicial />
          </FormField>

          <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2">
            <FormField label="Data" htmlFor="r-data" hint="o dia em que caiu, não o do vencimento">
              <Input id="r-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </FormField>
            <FormField
              label="Conta"
              htmlFor="r-conta"
              hint={
                contas.length === 0
                  ? 'Nenhuma conta cadastrada ainda. Cadastre em Ajustes › Contas para o saldo bater.'
                  : 'onde o dinheiro entrou'
              }
            >
              <Select
                id="r-conta"
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

          {/*
           * Caiu mais do que a parcela: a trava continua dentro de `confirmar`,
           * mas o aviso aparece já, como status, para não interromper a digitação.
           */}
          {sobra && (
            <Aviso titulo="Caiu mais do que a parcela" papel="status">
              A parcela é de <Valor valor={parcela.amount} posto="fato" />. Deixe aqui o valor da parcela e lance a
              sobra como entrada avulsa: juros e correção não são comissão e não entram nesta conta.
            </Aviso>
          )}
        </Bloco>

        {diferenca > 0.01 && (
          <Bloco
            titulo="A diferença"
            icone={Scale}
            separado
            descricao={
              <>
                faltaram <Valor valor={diferenca} posto="fato" /> em relação à parcela
              </>
            }
          >
            <div className="flex flex-col gap-2">
              {/* Rótulo visível; o nome acessível do grupo vem de `rotuloAcessivel`. */}
              <p aria-hidden className="text-texto-meta font-medium text-t2">
                O que foi?
              </p>
              <FiltrosRapidos
                rotuloAcessivel="Motivo da diferença"
                ativo={tipoDiferenca}
                aoMudar={setTipoDiferenca}
                filtros={[
                  { id: 'iss', rotulo: 'ISS retido' },
                  { id: 'desconto', rotulo: 'Desconto' },
                ]}
              />
            </div>
            <Dica>
              {tipoDiferenca === 'iss'
                ? 'A construtora desconta o ISS no ato do pagamento e recolhe no lugar da imobiliária: esse dinheiro nunca passa pelo caixa. O Simples passa a incidir sobre a parcela já líquida de ISS.'
                : 'Desconto concedido no recebimento: sai do que fica para a imobiliária e fica registrado com a observação abaixo, em vez de virar diferença sem nome.'}
            </Dica>
            <FormField label="Observação" htmlFor="r-nota">
              <Input
                id="r-nota"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ex.: ISS retido pela construtora"
              />
            </FormField>
          </Bloco>
        )}

        {/* No celular a conta desce para o corpo; a partir de 640px ela está no rodapé. */}
        <Bloco
          titulo="A conta que vai ser gravada"
          icone={Calculator}
          separado
          descricao="na ordem do banco: impostos, base e corretor"
          className="sm:hidden"
        >
          {contaGravada}
        </Bloco>

        <Bloco titulo="Ao confirmar" icone={CircleCheck} separado>
          {iss > 0 && (
            <Dica>
              O ISS retido na fonte não sai do caixa da imobiliária: a construtora já desconta no ato do
              pagamento e recolhe no lugar dela. Ele aparece como dedução da parcela, e nunca como guia a
              pagar.
            </Dica>
          )}
          <div className="flex flex-col gap-2">
            {aoConfirmar.map((item) => (
              <p key={item.texto} className="flex items-start gap-3 text-texto-corrido text-t2">
                <span className="flex h-5 shrink-0 items-center text-t3">
                  <Icone icone={item.icone} tamanho={16} />
                </span>
                <span className="min-w-0">{item.texto}</span>
              </p>
            ))}
          </div>
        </Bloco>
      </form>
    </SidePanel>
  )
}

/** Um bloco com nome dentro do painel: ícone 16 + `titulo-secao`, sem caixa (7.10). */
function Bloco({
  titulo,
  icone,
  descricao,
  separado,
  className,
  children,
}: {
  titulo: ReactNode
  icone: LucideIcon
  descricao?: ReactNode
  /** Fio de linha acima: separa o bloco do anterior (9.6). */
  separado?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn('flex flex-col gap-4', separado && 'border-t border-fio-linha pt-8', className)}>
      <div className="flex min-w-0 items-start gap-2">
        <span className="flex h-6 shrink-0 items-center text-t3">
          <Icone icone={icone} tamanho={16} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-heading text-titulo-secao text-t1">{titulo}</h3>
          {descricao && <p className="text-texto-meta text-t-meta">{descricao}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

/**
 * Aviso de risco: ícone e título dizem o estado (cor nunca sozinha, 5.1).
 * `status` enquanto se digita, `alert` quando a gravação falhou.
 */
function Aviso({ titulo, papel, children }: { titulo: string; papel: 'alert' | 'status'; children: ReactNode }) {
  return (
    <div role={papel} className="flex items-start gap-3 rounded-caixa border border-error-line bg-error-bg px-4 py-3">
      <span className="flex h-5 shrink-0 items-center text-error-ink">
        <Icone icone={CircleAlert} tamanho={16} />
      </span>
      <div className="flex min-w-0 flex-col gap-1 text-texto-corrido">
        <p className="font-medium text-t1">{titulo}</p>
        <p className="text-t2">{children}</p>
      </div>
    </div>
  )
}
