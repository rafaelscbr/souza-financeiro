import { useEffect, useState } from 'react'
import { Wallet } from 'lucide-react'
import { useAdmin } from './AdminData'
import { SidePanel } from '@/components/ui/SidePanel'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/Field'
import { CurrencyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/format'
import { BlocoDaFolha, RodapeDaFolha } from './FolhaDeLancamento'

/*
 * O TETO DE GASTOS DO MÊS (040): um valor só, o mesmo todo mês. É ele que o
 * Início, o lançamento de despesa, o sino e o relatório Orçamento usam.
 */
export function TetoDoOrcamento({
  aberto,
  aoFechar,
  sugestao,
}: {
  aberto: boolean
  aoFechar: () => void
  /** O maior mês dos gastos fixos confirmados: o piso que faz sentido. */
  sugestao: number
}) {
  const { company, salvarTeto } = useAdmin()
  const { showToast } = useToast()
  const [valor, setValor] = useState<number | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) return
    setValor(company?.monthly_budget ?? (sugestao || null))
    setErro(null)
  }, [aberto, company, sugestao])

  async function salvar() {
    if (!valor || valor <= 0) {
      setErro('Informe o teto em reais.')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      await salvarTeto(valor)
      showToast({ message: 'Teto de gastos atualizado', detail: `${formatCurrency(valor)} por mês` })
      aoFechar()
    } catch (e) {
      setErro(e instanceof Error ? `Não foi gravado: ${e.message}` : 'Não foi gravado. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <SidePanel
      aberto={aberto}
      aoFechar={() => !salvando && aoFechar()}
      titulo="Teto de gastos do mês"
      subtitulo="Quanto a imobiliária pode gastar por mês"
      rodape={
        <RodapeDaFolha erro={erro} tituloDoErro="Teto não salvo">
          <Button variant="secundario" size="lg" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="primario" size="lg" onClick={salvar} carregando={salvando}>
            Salvar teto
          </Button>
        </RodapeDaFolha>
      }
    >
      <BlocoDaFolha titulo="O teto" icone={Wallet}>
        <FormField
          label="Teto por mês"
          htmlFor="t-valor"
          required
          hint={
            sugestao > 0
              ? `Os gastos fixos confirmados chegam a ${formatCurrency(sugestao)} no mês mais caro. Abaixo disso, algum mês já nasce acima do teto.`
              : 'O mesmo valor vale para todos os meses.'
          }
        >
          <CurrencyInput id="t-valor" value={valor} onChange={setValor} data-foco-inicial />
        </FormField>
      </BlocoDaFolha>
    </SidePanel>
  )
}
