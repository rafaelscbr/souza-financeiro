import { Rows3, Rows4 } from 'lucide-react'
import { useDensidade, type Densidade } from '@/context/DensidadeContext'
import { OpcoesComMarca, type OpcaoComMarca } from './SeletorAparencia'

/*
 * Confortável / Compacta (docs/souza-os.md, seção 9). Muda só o ar das linhas
 * de lista; nenhuma informação some. Os ícones dizem isso por desenho: três
 * faixas com folga, quatro faixas no mesmo espaço.
 */
const OPCOES: OpcaoComMarca<Densidade>[] = [
  { valor: 'confortavel', rotulo: 'Confortável', icone: Rows3 },
  { valor: 'compacta', rotulo: 'Compacta', icone: Rows4 },
]

export function SeletorDensidade({ className }: { className?: string }) {
  const { densidade, setDensidade } = useDensidade()
  return (
    <OpcoesComMarca
      rotulo="Densidade"
      valor={densidade}
      opcoes={OPCOES}
      aoMudar={setDensidade}
      className={className}
    />
  )
}
