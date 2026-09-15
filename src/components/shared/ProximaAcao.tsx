import { ArrowRight, CircleAlert, CircleCheck, Clock, Info, type LucideIcon } from 'lucide-react'
import type { Tom } from '@/components/ui/tom'
import { FilaDeAcao, type ItemFila } from './FilaDeAcao'

/*
 * DEPRECADO — apagar na limpeza final. Use `FilaDeAcao`.
 * Ainda usado por admin/pages/Vendas.tsx e corretor/pages/Recebimentos.tsx.
 *
 * Mantém a API antiga e desenha a fila nova: a principal vira o 1º item e as
 * outras seguem na ordem recebida. Sem ponto, sem pulso, sem `grad-brand`.
 */

interface Acao {
  rotulo: string
  aoClicar?: () => void
  para?: string
}

interface Principal {
  tom: Tom
  icone: LucideIcon
  titulo: string
  porque: string
  acao: Acao
}

interface Outra {
  id: string
  rotulo: string
  porque: string
  tom: Tom
  aoClicar?: () => void
  para?: string
}

/* As sugestões antigas não traziam ícone: o tom escolhe um com significado. */
const ICONE_DO_TOM: Record<Tom, LucideIcon> = {
  risco: CircleAlert,
  atencao: Clock,
  sucesso: CircleCheck,
  info: Info,
  marca: ArrowRight,
  neutro: ArrowRight,
}

export function ProximaAcao({
  principal,
  outras,
  tudoEmDia,
}: {
  principal?: Principal
  outras?: Outra[]
  tudoEmDia?: { titulo: string; sugestao: string }
}) {
  const itens: ItemFila[] = []
  if (principal) {
    itens.push({
      id: 'principal',
      icone: principal.icone,
      tom: principal.tom,
      titulo: principal.titulo,
      motivo: principal.porque,
      acao: principal.acao,
    })
  }
  for (const o of outras ?? []) {
    itens.push({
      id: o.id,
      icone: ICONE_DO_TOM[o.tom] ?? ArrowRight,
      tom: o.tom,
      titulo: o.rotulo,
      motivo: o.porque,
      acao: { rotulo: 'Ver', para: o.para, aoClicar: o.aoClicar },
    })
  }
  return (
    <FilaDeAcao
      itens={itens}
      vazio={tudoEmDia ? { titulo: tudoEmDia.titulo, descricao: tudoEmDia.sugestao } : undefined}
    />
  )
}
