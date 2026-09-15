import { useNavigate } from 'react-router-dom'
import { CircleCheck, ListChecks, type LucideIcon } from 'lucide-react'
import { Cartao } from '@/components/ui/Cartao'
import { Linha } from '@/components/ui/Lista'
import { IconeTom } from '@/components/ui/IconeTom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Valor, type EstadoValor } from '@/components/ui/Valor'
import { EstadoVazio } from '@/components/ui/Estados'
import type { Tom } from '@/components/ui/tom'

/*
 * FILA DE AÇÃO (Fase 4; substitui ProximaAcao).
 *
 * Um cartão com o que pede alguém, na ordem em que a tela passa (quem conhece
 * o dado sabe o que é mais urgente; aqui nada é reordenado nem somado). Cada
 * item é uma Linha: ícone com significado na goteira, título, motivo e prazo
 * na meta, valor na coluna de valor e a ação SEMPRE visível na linha.
 * Sem ponto decorativo, sem pulso, sem ouro. Vazio nunca é silêncio:
 * "Tudo em dia" com a frase que a tela mandar.
 */

export interface AcaoDaFila {
  rotulo: string
  /** Leva a esta rota. */
  para?: string
  /** Executa nesta tela (abre painel, composição). */
  aoClicar?: () => void
}

export interface ItemFila {
  id: string
  /** O ícone diz o assunto (HandCoins comissão, CircleAlert vencido…). */
  icone: LucideIcon
  tom: Tom
  titulo: string
  /** O porquê, escrito com o número real que a tela observou. */
  motivo: string
  /** Frase de tempo ("liberada há 3 dias"). */
  prazo?: string
  /** Valor do item, se houver; o estado só com estado real. */
  valor?: number
  estadoValor?: EstadoValor
  acao: AcaoDaFila
}

export interface FilaDeAcaoProps {
  itens: ItemFila[]
  /** Título do cartão. Padrão "Próxima ação". */
  titulo?: string
  /** Frase de "Tudo em dia" quando a fila está vazia. */
  vazio?: { titulo: string; descricao?: string }
  className?: string
}

export function FilaDeAcao({ itens, titulo = 'Próxima ação', vazio, className }: FilaDeAcaoProps) {
  const navigate = useNavigate()
  const temValor = itens.some((i) => typeof i.valor === 'number')

  return (
    <Cartao className={className}>
      <Cartao.Cabecalho
        titulo={titulo}
        icone={ListChecks}
        extra={itens.length > 0 ? <Badge risco={itens.some((i) => i.tom === 'risco')}>{itens.length}</Badge> : undefined}
      />
      {itens.length === 0 ? (
        <Cartao.Corpo>
          <EstadoVazio
            icone={CircleCheck}
            titulo={vazio?.titulo ?? 'Tudo em dia'}
            descricao={vazio?.descricao ?? 'Nenhuma pendência observada agora.'}
          />
        </Cartao.Corpo>
      ) : (
        <Cartao.Lista
          colunas={{ goteira: true, valor: temValor, acao: 'auto' }}
          rotuloAcessivel={titulo}
          chaveEscada="fila-de-acao"
        >
          {itens.map((item) => (
            <Linha
              key={item.id}
              goteira={<IconeTom icone={item.icone} tom={item.tom} tamanho="sm" />}
              titulo={item.titulo}
              meta={
                <span className="meta">
                  <span data-longo>{item.motivo}</span>
                  {item.prazo && <span>{item.prazo}</span>}
                </span>
              }
              valor={
                typeof item.valor === 'number' ? (
                  <Valor posto="linha" valor={item.valor} estado={item.estadoValor} />
                ) : undefined
              }
              acao={
                <Button
                  variant="secundario"
                  size="sm"
                  className="max-sm:flex-1"
                  onClick={() => {
                    item.acao.aoClicar?.()
                    if (item.acao.para) navigate(item.acao.para)
                  }}
                >
                  {item.acao.rotulo}
                </Button>
              }
            />
          ))}
        </Cartao.Lista>
      )}
    </Cartao>
  )
}
