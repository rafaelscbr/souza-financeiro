import { Search } from 'lucide-react'
import { Input } from './Field'
import { cn } from '@/lib/utils'

/*
 * CAMPO DE BUSCA (Souza 2.0, 24/10/2026): a lupa dentro do campo, 36px,
 * o mesmo nas listas, na biblioteca de relatórios e nas tabelas.
 */
export function CampoDeBusca({
  valor,
  aoMudar,
  rotulo,
  className,
}: {
  valor: string
  aoMudar: (v: string) => void
  /** Nome acessível e texto de exemplo ("Buscar relatório"). */
  rotulo: string
  className?: string
}) {
  return (
    <div className={cn('relative w-full sm:w-64', className)}>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-t4">
        <Search size={16} strokeWidth={1.75} />
      </span>
      <Input
        type="search"
        aria-label={rotulo}
        placeholder={rotulo}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="pl-10"
      />
    </div>
  )
}
