import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

/** Alterna entre claro e escuro; a preferência fica salva no aparelho. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      className={cn(
        'flex h-toque w-toque items-center justify-center rounded-lg text-content-muted transition-colors hover:bg-surface-2 hover:text-content',
        className,
      )}
      aria-label={dark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={dark ? 'Tema claro' : 'Tema escuro'}
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}
