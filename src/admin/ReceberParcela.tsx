import { useEffect, useMemo, useState } from 'react'
import { useAdmin } from './AdminData'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input, Select } from '@/components/ui/Field'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { Segmented } from '@/components/ui/Segmented'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { Cascata, LinhaCascata, TotalCascata } from '@/components/ui/Cascata'
import { Lista, Linha } from '@/components/ui/Lista'
import { Selo } from '@/components/ui/Selo'
import { ChipSituacao, FraseDeTempo } from '@/components/ui/Situacao'
import { Valor } from '@/components/ui/Valor'
import { formatCurrency, toDateOnly } from '@/lib/format'
import { situacaoDeTela } from '@/lib/situacao'
import { previewCascade, type SaleView } from '@/lib/sales'
import type { SaleInstallment } from '@/types'

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
 * O que mudou é o que a folha MOSTRA antes de gravar.
 *
 * 1. A conta virou CASCATA, na ordem do banco (migração 009): parcela,
 *    (−) ISS retido, (−) Simples, base, base × % do corretor, total. Antes ela
 *    era uma lista em prosa sob um rótulo de 11px — o líquido da imobiliária
 *    saía escondido dentro de um <strong> no meio de uma frase, que é
 *    exatamente o número que o Rafael precisa conferir antes de confirmar.
 *    Agora a conta inteira é um documento, alinhado numa borda direita só, e
 *    é possível bater contra o extrato antes de o lançamento existir.
 *
 * 2. O ISS retido ganhou texto próprio. Ele é a única linha da cascata que
 *    NÃO sai do caixa: a construtora desconta no ato e recolhe no lugar da
 *    imobiliária. Quem não sabe disso lê a dedução como despesa e procura um
 *    pagamento que nunca vai existir.
 *
 * 3. O foco entra no campo do valor (`data-foco-inicial`). Quem abre esta
 *    folha tem o extrato na mão e quer digitar um número; a data já vem com
 *    hoje e a conta já vem com a primeira ativa.
 *
 * 4. Saíram os três cartões dentro da folha (o bloco cinza da parcela, a caixa
 *    âmbar da diferença e a caixa do resumo). Não existe cartão neste sistema:
 *    separação é fio, não caixa.
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
    <Modal
      open={!!parcela}
      onClose={onFechar}
      title="Confirmar recebimento"
      // Sem repetir o nome da venda: ele já é o título da linha logo abaixo.
      description={[venda.development, venda.unit].filter(Boolean).join(' · ') || undefined}
      footer={
        /*
         * UMA ação primária. "Cancelar" é fantasma de propósito: dois botões
         * preenchidos lado a lado fazem a pessoa escolher entre dois destaques
         * iguais, e só um deles grava.
         */
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={confirmar} disabled={salvando}>
            {salvando ? <Spinner className="h-5 w-5" /> : 'Confirmar recebimento'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/*
         * A parcela como linha de extrato — selo com o ordinal real, frase com
         * verbo, valor no degrau de comparação. O bloco cinza que havia aqui
         * era um cartão dentro da folha e dizia a data sem verbo nenhum
         * ("vencimento 30/06"), que é uma data que não conta o que aconteceu.
         */}
        <Lista>
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
        </Lista>

        <div>
          <FormField label="Quanto caiu na conta" htmlFor="r-valor">
            <CurrencyInput id="r-valor" value={recebido} onChange={setRecebido} data-foco-inicial />
          </FormField>
          <p className="mt-1.5 text-sm text-content-faint">
            Em reais, o valor do extrato — não o da parcela. Quando a construtora retém ISS os dois
            são diferentes, e é dessa diferença que sai o imposto certo.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FormField label="Data" htmlFor="r-data">
              <Input id="r-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </FormField>
            <p className="mt-1.5 text-sm text-content-faint">o dia em que caiu, não o do vencimento</p>
          </div>
          <div>
            <FormField label="Conta" htmlFor="r-conta">
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
            <p className="mt-1.5 text-sm text-content-faint">
              {contas.length === 0
                ? 'Nenhuma conta cadastrada ainda. Cadastre em Ajustes › Contas para o saldo bater.'
                : 'onde o dinheiro entrou'}
            </p>
          </div>
        </div>

        {diferenca > 0.01 && (
          <div className="space-y-3 border-t border-line pt-4">
            <p className="text-base text-content">
              Faltaram <Valor valor={diferenca} posto="fato" /> em relação à parcela. O que foi?
            </p>
            <Segmented
              ariaLabel="Motivo da diferença"
              value={tipoDiferenca}
              onChange={setTipoDiferenca}
              options={[
                { value: 'iss', label: 'ISS retido' },
                { value: 'desconto', label: 'Desconto' },
              ]}
            />
            <p className="text-sm text-content-muted">
              {tipoDiferenca === 'iss'
                ? 'A construtora desconta o ISS no ato do pagamento e recolhe no lugar da imobiliária: esse dinheiro nunca passa pelo caixa. O Simples passa a incidir sobre a parcela já líquida de ISS.'
                : 'Desconto concedido no recebimento: sai do que fica para a imobiliária e fica registrado com a observação abaixo, em vez de virar diferença sem nome.'}
            </p>
            <FormField label="Observação" htmlFor="r-nota">
              <Input
                id="r-nota"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ex.: ISS retido pela construtora"
              />
            </FormField>
          </div>
        )}

        {sobra && (
          <p className="border-t border-line pt-4 text-base text-critical">
            Caiu mais do que a parcela de {formatCurrency(parcela.amount)}. Deixe aqui o valor da
            parcela e lance a sobra como entrada avulsa: juros e correção não são comissão e não
            entram nesta conta.
          </p>
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
        <div className="border-t border-rule pt-4">
          <p className="mb-2 text-sm font-medium text-content-muted">A conta que vai ser gravada</p>
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

          {iss > 0 && (
            <p className="mt-3 text-sm text-content-muted">
              O ISS retido na fonte não sai do caixa da imobiliária: a construtora já desconta no
              ato do pagamento e recolhe no lugar dela. Ele aparece como dedução da parcela, e
              nunca como guia a pagar.
            </p>
          )}

          <ul className="mt-3 space-y-1 text-sm text-content-muted">
            <li>
              A receita de {formatCurrency(parcela.amount)} é liquidada
              {conta ? ` em ${conta.name}` : ', com a conta a definir'}.
            </li>
            {previa.simples > 0 && (
              <li>
                O Simples de {formatCurrency(previa.simples)} entra em A pagar, com guia no dia 20
                do mês seguinte.
              </li>
            )}
            {previa.broker > 0 && (
              <li>
                A comissão de {corretor}, de {formatCurrency(previa.broker)}, fica liberada para
                pagamento.
              </li>
            )}
          </ul>
        </div>

        {erro && (
          <p className="border-t border-line pt-4 text-base text-critical" role="alert">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  )
}
