import logoImobiliaria from './logo-imobiliaria.png'
import logoEscola from './logo-escola.png'
import logoAssessoria from './logo-assessoria.png'

/** Logo de cada empresa por slug. */
export const COMPANY_LOGOS: Record<string, string> = {
  imobiliaria: logoImobiliaria,
  escola: logoEscola,
  assessoria: logoAssessoria,
}

/** Nome curto para gráficos e espaços reduzidos. */
export const COMPANY_SHORT_NAME: Record<string, string> = {
  imobiliaria: 'Imobiliária',
  escola: 'Escola',
  assessoria: 'Assessoria',
  pessoal: 'Pessoal',
}

/**
 * Cor de destaque segura (a marca da Assessoria é preta e some, então usamos
 * o grafite/prata do accent como cor utilizável).
 */
export function companyDisplayColor(slug: string, brandColor: string, accentColor: string): string {
  return slug === 'assessoria' ? accentColor : brandColor
}
