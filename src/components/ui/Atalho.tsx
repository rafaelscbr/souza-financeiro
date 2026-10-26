import { Link } from 'react-router-dom'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { IconeTom } from './IconeTom'

/*
 * ATALHO (Souza 2.0, 24/10/2026): um destino da biblioteca — ícone neutro,
 * nome, a pergunta que ele responde, a descrição e marcas curtas. A caixa
 * inteira é o link.
 */
export function Atalho({
  para,
  icone,
  titulo,
  pergunta,
  descricao,
  marcas = [],
}: {
  para: string
  icone: LucideIcon
  titulo: string
  pergunta: string
  descricao: string
  marcas?: string[]
}) {
  return (
    <Link
      to={para}
      data-caixa=""
      className="group flex min-w-0 gap-4 rounded-caixa border border-fio-caixa bg-surface p-5 shadow-card transition-colors duration-micro hover:border-[color:var(--line-input)] hover:bg-s2"
    >
      <IconeTom icone={icone} tom="neutro" tamanho="sm" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center justify-between gap-3">
          <span className="font-semibold text-t1 text-texto-titulo">{titulo}</span>
          <ChevronRight
            aria-hidden
            size={16}
            strokeWidth={1.75}
            className="shrink-0 text-t5 transition-colors group-hover:text-t2"
          />
        </span>
        <span className="text-t2 text-texto">{pergunta}</span>
        <span className="text-t-meta text-texto-meta">{descricao}</span>
        {marcas.length > 0 && (
          <span className="flex flex-wrap gap-1.5 pt-2">
            {marcas.map((m) => (
              <span key={m} className="inline-flex h-5 items-center rounded-badge bg-s3 px-1.5 text-t3 text-chip">
                {m}
              </span>
            ))}
          </span>
        )}
      </span>
    </Link>
  )
}
