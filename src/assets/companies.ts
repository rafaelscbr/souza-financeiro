import logoImobiliaria from './logo-imobiliaria.png'
import logoEscola from './logo-escola.png'
import logoAssessoria from './logo-assessoria.png'
import type { CompanySlug } from '@/types'

/** Logo de cada empresa por slug. */
export const COMPANY_LOGOS: Record<CompanySlug, string> = {
  imobiliaria: logoImobiliaria,
  escola: logoEscola,
  assessoria: logoAssessoria,
}

/** Nome curto para gráficos e espaços reduzidos. */
export const COMPANY_SHORT_NAME: Record<CompanySlug, string> = {
  imobiliaria: 'Imobiliária',
  escola: 'Escola',
  assessoria: 'Assessoria',
}

/**
 * Cor de destaque segura para o dark mode (a marca da Assessoria é preta e some no
 * fundo escuro, então usamos o grafite/prata do accent como cor utilizável).
 */
export function companyDisplayColor(slug: CompanySlug, brandColor: string, accentColor: string): string {
  return slug === 'assessoria' ? accentColor : brandColor
}
