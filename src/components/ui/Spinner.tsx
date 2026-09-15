import { cn } from '@/lib/utils'
import { CarregandoPagina } from './Estados'

/*
 * Spinner SÓ DENTRO DE BOTÃO (7.13). Solto na tela é proibido: um círculo
 * girando não diz o que vem nem quanto falta. Dentro do botão, o rótulo ao lado
 * diz o que foi pedido e o giro só confirma que o banco ainda não respondeu
 * (nada de atualização otimista). O `Button` com `carregando` já faz isso
 * sozinho; este componente fica para os botões das telas antigas.
 *
 * `decorativo` tira o papel de status quando o botão já anuncia `aria-busy`.
 * Girar é `transform`; com movimento reduzido a regra global zera a duração.
 */
export function Spinner({
  className,
  rotulo = 'Carregando',
  decorativo = false,
}: {
  className?: string
  rotulo?: string
  decorativo?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
      {...(decorativo ? { 'aria-hidden': true } : { role: 'status', 'aria-label': rotulo })}
    />
  )
}

/**
 * DEPRECADO — apagar na limpeza final. Use `CarregandoPagina` de './Estados'.
 * Ainda usam: App.tsx e components/layout/PageLayout.tsx.
 */
export function FullPageLoader({ label = 'Carregando…', className }: { label?: string; className?: string }) {
  return <CarregandoPagina rotulo={label} className={className} />
}
