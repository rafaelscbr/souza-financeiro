import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarDays,
  Handshake,
  Home,
  PieChart,
  Receipt,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Tom } from '@/components/ui/tom'

/*
 * A LISTA ÚNICA DE NAVEGAÇÃO (docs/souza-os.md, seção 6).
 *
 * Trilho, barra do polegar, "Mais" e busca ⌘K leem daqui. Antes cada casca
 * tinha o próprio MENU e a barra do polegar filtrava uma cópia dele: renomear
 * "Receber" num lugar deixava o outro para trás. Agora um destino existe uma
 * vez, com um ícone só, e é esse ícone que a tela usa no cabeçalho (memória de
 * lugar: o mesmo desenho no menu e no título).
 */

export interface ItemNav {
  para: string
  rotulo: string
  icone: LucideIcon
  /** Casa só o caminho exato (o Início, que é prefixo de tudo). */
  fim?: boolean
  contador?: number
  tomContador?: Tom
  /**
   * O que o contador significa, dito para o leitor de tela e para a dica do
   * trilho recolhido ("3 recebimentos vencidos"). Um número sem nome não diz
   * nada a quem não está vendo a cor do selo.
   */
  leituraContador?: string
}

export interface SecaoNav {
  rotulo: string
  itens: ItemNav[]
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/*
 * Os dois contadores do administrador têm significados diferentes, e por isso
 * dois tons: vencido em Receber é promessa quebrada (risco); comissão liberada
 * em Pagar é trabalho esperando alguém (atenção). As contas são as mesmas que
 * a casca sempre fez; só a cor mudou de nome.
 */
export function navAdmin({ vencidos, esperando }: { vencidos: number; esperando: number }): SecaoNav[] {
  return [
    {
      rotulo: 'Operação',
      itens: [
        { para: '/', rotulo: 'Início', icone: Home, fim: true },
        { para: '/vendas', rotulo: 'Vendas', icone: Handshake },
        {
          para: '/receber',
          rotulo: 'Receber',
          icone: ArrowDownCircle,
          contador: vencidos,
          tomContador: 'risco',
          leituraContador: plural(vencidos, 'recebimento vencido', 'recebimentos vencidos'),
        },
        {
          para: '/pagar',
          rotulo: 'Pagar',
          icone: ArrowUpCircle,
          contador: esperando,
          tomContador: 'atencao',
          leituraContador: plural(esperando, 'pagamento esperando', 'pagamentos esperando'),
        },
      ],
    },
    {
      rotulo: 'Financeiro',
      itens: [
        { para: '/despesas', rotulo: 'Despesas', icone: Receipt },
        { para: '/corretores', rotulo: 'Corretores', icone: Users },
      ],
    },
    {
      rotulo: 'Relatórios',
      itens: [{ para: '/relatorios', rotulo: 'Relatórios', icone: PieChart }],
    },
    {
      rotulo: 'Sistema',
      itens: [{ para: '/config', rotulo: 'Configurações', icone: Settings }],
    },
  ]
}

/** Os cinco destinos da barra do polegar do administrador; o resto vai para "Mais". */
export const POLEGAR_ADMIN = ['/', '/vendas', '/receber', '/pagar', '/despesas']

/*
 * O corretor tem três destinos e nada para criar. Uma seção só: dividir três
 * itens em grupos seria arrumação sem conteúdo.
 */
export function navCorretor(): SecaoNav[] {
  return [
    {
      rotulo: 'Suas comissões',
      itens: [
        { para: '/', rotulo: 'Início', icone: Home, fim: true },
        { para: '/minhas-vendas', rotulo: 'Vendas', icone: Handshake },
        { para: '/recebimentos', rotulo: 'Recebimentos', icone: CalendarDays },
      ],
    },
  ]
}

export const POLEGAR_CORRETOR = ['/', '/minhas-vendas', '/recebimentos']

export function itensDe(secoes: SecaoNav[]): ItemNav[] {
  return secoes.flatMap((s) => s.itens)
}

/** Separa a lista na ordem dela: o que vai no polegar e o que vai para "Mais". */
export function separarPolegar(secoes: SecaoNav[], polegar: string[]): { destinos: ItemNav[]; mais: ItemNav[] } {
  const itens = itensDe(secoes)
  return {
    destinos: polegar.map((p) => itens.find((i) => i.para === p)).filter((i): i is ItemNav => Boolean(i)),
    mais: itens.filter((i) => !polegar.includes(i.para)),
  }
}

/** A mesma regra do NavLink: `fim` casa exato; os outros casam o caminho e o que vem abaixo dele. */
export function estaAtivo(pathname: string, item: ItemNav): boolean {
  if (item.fim) return pathname === item.para
  return pathname === item.para || pathname.startsWith(`${item.para}/`)
}
