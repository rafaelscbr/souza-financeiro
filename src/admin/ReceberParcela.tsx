import { useEffect, useMemo, useState } from 'react'
import { Banknote, Calculator, CircleCheck, HandCoins, Landmark, Receipt, Scale } from 'lucide-react'
import { useAdmin } from './AdminData'
import { SidePanel } from '@/components/ui/SidePanel'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { Segmented } from '@/components/ui/Segmented'
import { useToast } from '@/components/ui/Toast'
import { Cascata, LinhaCascata, TotalCascata } from '@/components/ui/Cascata'
import { Linha } from '@/components/ui/Lista'
import { Selo } from '@/components/ui/Selo'
import { ChipSituacao, FraseDeTempo } from '@/components/ui/Situacao'
import { Valor } from '@/components/ui/Valor'
import { Dica } from '@/components/ui/Dica'
import { formatCurrency, toDateOnly } from '@/lib/format'
import { situacaoDeTela } from '@/lib/situacao'
import { previewCascade, type SaleView } from '@/lib/sales'
import type { SaleInstallment } from '@/types'
import {
  AoConfirmar,
  AvisoDaFolha,
  BlocoDaFolha,
  EscolhaDaFolha,
  ListaNaFolha,
  QuadroDaConta,
  RodapeDaFolha,
} from './FolhaDeLancamento'

type Diferenca = 'iss' | 'desconto'

/** Percentual sem casa inventada: 3 → "3%", 2,5 → "2,5%". */
const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`

/*
 * CONFIRMAR QUE O DINHEIRO CAIU.
 *
 * A regra de negócio não mudou e não podia mudar: a tela parte do valor que
 * REALMENTE entrou na conta, não do valor da parcela. É o que a realidade
 * pediu — na venda 414-D a construtora retém 3% de ISS no ato do pagamento,
 * então caiu R$ 16.509,75 de uma parcela de R$ 17.020,36. Sem classificar
 * essa diferença o sistema teria um furo de R$ 510,61 sem nome, e o Simples
 * de 6% seria calculado sobre a base errada.
 *
 * O que a folha mostra antes de gravar:
 *
 * 1. A conta como CASCATA, na ordem do banco (migração 009): parcela,
 *    (−) ISS retido, (−) Simples, base, base × % do corretor, total — num
 *    quadro tonalizado, alinhada numa borda direita só, para bater contra o
 *    extrato antes de o lançamento existir.
 *
 * 2. O ISS retido com texto próprio, numa Dica. Ele é a única linha da cascata
 *    que NÃO sai do caixa: a construtora desconta no ato e recolhe no lugar da
 *    imobiliária. Quem não sabe disso lê a dedução como despesa e procura um
 *    pagamento que nunca vai existir.
 *
 * 3. O foco entra no campo do valor (`data-foco-inicial`). Quem abre esta
 *    folha tem o extrato na mão e quer digitar um número; a data já vem com
 *    hoje e a conta já vem com a primeira ativa.
 *
 * Abre no painel lateral (princípio 10), com a venda ou a lista de A receber
 * visível atrás, e o botão que grava fica no rodapé fixo. O painel só fecha
 * depois que o banco confirma; em falha, tudo o que foi digitado continua.
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

  return (
    <SidePanel
      aberto={!!parcela}
      aoFechar={fechar}
      titulo="Confirmar recebimento"
      // Sem repetir o nome da venda: ele já é o título da linha logo abaixo.
      subtitulo={[venda.development, venda.unit].filter(Boolean).join(' · ') || undefined}
      rodape={
        /*
         * UMA ação primária. "Cancelar" é fantasma de propósito: dois botões
         * preenchidos lado a lado fazem a pessoa escolher entre dois destaques
         * iguais, e só um deles grava.
         */
        <RodapeDaFolha erro={erro} tituloDoErro="Recebimento não gravado">
          <Button variant="ghost" size="lg" onClick={fechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button size="lg" className="flex-1" onClick={confirmar} carregando={salvando}>
            Confirmar recebimento
          </Button>
        </RodapeDaFolha>
      }
    >
      <div className="space-y-6">
        {/*
         * A parcela como linha de extrato — selo com o ordinal real, frase com
         * verbo, chip com a situação e o valor na coluna da direita.
         */}
        <BlocoDaFolha titulo="A parcela" icone={Receipt}>
          <ListaNaFolha>
            <Linha
              selo={<Selo situacao={situacao} idx={parcela.idx} count={parcela.count} />}
              titulo={venda.title}
              meta={
                <FraseDeTempo
                  situacao={situacao}
                  prevista={parcela.expected_date}
                  recebida={parcela.received_date}
                />
              }
              situacao={<ChipSituacao situacao={situacao} />}
              valor={<Valor valor={parcela.amount} posto="linha" />}
            />
          </ListaNaFolha>
        </BlocoDaFolha>

        <BlocoDaFolha titulo="O que caiu na conta" icone={Banknote}>
          <FormField
            label="Quanto caiu na conta"
            htmlFor="r-valor"
            hint="Em reais, o valor do extrato — não o da parcela. Quando a construtora retém ISS os dois são diferentes, e é dessa diferença que sai o imposto certo."
          >
            <CurrencyInput id="r-valor" value={recebido} onChange={setRecebido} data-foco-inicial />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
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
           * mas o aviso aparece já, enquanto se digita, como status e não
           * como alerta, para não interromper a digitação a cada tecla.
           */}
          {sobra && (
            <AvisoDaFolha titulo="Caiu mais do que a parcela" papel="status">
              A parcela é de {formatCurrency(parcela.amount)}. Deixe aqui o valor da parcela e lance a
              sobra como entrada avulsa: juros e correção não são comissão e não entram nesta conta.
            </AvisoDaFolha>
          )}
        </BlocoDaFolha>

        {diferenca > 0.01 && (
          <BlocoDaFolha
            titulo="A diferença"
            icone={Scale}
            descricao={<>faltaram {formatCurrency(diferenca)} em relação à parcela</>}
          >
            <EscolhaDaFolha rotulo="O que foi?">
              <Segmented
                ariaLabel="Motivo da diferença"
                value={tipoDiferenca}
                onChange={setTipoDiferenca}
                options={[
                  { value: 'iss', label: 'ISS retido' },
                  { value: 'desconto', label: 'Desconto' },
                ]}
              />
            </EscolhaDaFolha>
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
          </BlocoDaFolha>
        )}

        {/*
         * A CASCATA, antes de gravar.
         *
         * Esta é a chance de conferir a conta contra o extrato enquanto ela
         * ainda não existe. A ordem é a do banco (migração 009) e a mesma da
         * ficha da venda — mesma ordem, mesmo alinhamento, mesmo peso, para
         * que os dois números possam ser comparados sem tradução.
         *
         * O total NÃO leva tinta verde: verde significa dinheiro que se moveu,
         * e aqui nada se moveu ainda. Ele só fica verde depois da baixa.
         */}
        <BlocoDaFolha
          titulo="A conta que vai ser gravada"
          icone={Calculator}
          descricao="na ordem do banco: impostos, base e corretor"
        >
          <QuadroDaConta>
            <Cascata>
              <LinhaCascata
                rotulo="Parcela da comissão"
                detalhe={parcela.count > 1 ? `${parcela.idx} de ${parcela.count}` : undefined}
                valor={parcela.amount}
              />
              {iss > 0 && (
                <LinhaCascata
                  subtracao
                  rotulo="ISS retido na fonte"
                  detalhe={`${pct(parcela.amount > 0 ? (iss / parcela.amount) * 100 : 0)} retido pela construtora`}
                  valor={iss}
                />
              )}
              {previa.simples > 0 && (
                <LinhaCascata
                  subtracao
                  rotulo="Imposto (Simples)"
                  detalhe={`${pct(venda.simples_pct)} sobre a parcela líquida de ISS`}
                  valor={previa.simples}
                />
              )}
              <LinhaCascata
                rotulo="Base de cálculo"
                detalhe="o que sobra depois dos impostos"
                valor={previa.base}
              />
              {previa.broker > 0 && (
                <LinhaCascata
                  subtracao
                  rotulo={`Comissão de ${corretor}`}
                  detalhe={`base × ${pct(venda.broker_pct ?? 0)}`}
                  valor={previa.broker}
                />
              )}
              {outro > 0 && <LinhaCascata subtracao rotulo="Desconto concedido" valor={outro} />}
              <TotalCascata rotulo="Fica para a imobiliária" valor={previa.net - outro} />
            </Cascata>
          </QuadroDaConta>

          {iss > 0 && (
            <Dica>
              O ISS retido na fonte não sai do caixa da imobiliária: a construtora já desconta no ato do
              pagamento e recolhe no lugar dela. Ele aparece como dedução da parcela, e nunca como guia a
              pagar.
            </Dica>
          )}

          <AoConfirmar
            itens={[
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
            ]}
          />
        </BlocoDaFolha>
      </div>
    </SidePanel>
  )
}
