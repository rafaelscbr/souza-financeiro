import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

/**
 * Alterna entre claro e escuro; a preferência fica salva no aparelho.
 *
 * Mantido por compatibilidade com as cascas antigas. O guia pede, no popover
 * do avatar, um seletor "Claro / Escuro" de duas opções com nome (seção 2), e
 * não um interruptor: quem montar a casca nova usa useTheme().setTheme.
 *
 * Alvo de 44px (h-toque): botão só de ícone ainda é alvo de toque. Sem
 * transição de cor: movimento só em transform (princípio 9), por isso o único
 * gesto é o aperto do active:scale.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'flex h-toque w-toque items-center justify-center rounded-lg text-t3 transition-transform duration-150 hover:bg-nav-hover hover:text-t1 active:scale-[0.98]',
        className,
      )}
      aria-label={dark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={dark ? 'Tema claro' : 'Tema escuro'}
    >
      {dark ? (
        <Sun className="h-[18px] w-[18px]" strokeWidth={1.6} aria-hidden />
      ) : (
        <Moon className="h-[18px] w-[18px]" strokeWidth={1.6} aria-hidden />
      )}
    </button>
  )
}
