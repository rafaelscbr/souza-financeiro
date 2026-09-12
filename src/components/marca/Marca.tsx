import { S_PATH, TEXTO_PATH } from './paths'

/*
 * Antes deste arquivo, a identidade visível do sistema era o ícone `Building2`
 * da lucide, pintado de #1E3A8A com acento #B08900, em quatro telas — inclusive
 * o login. Nenhuma dessas duas cores existe na marca, e o logotipo real nunca
 * era importado. A pergunta "a tela de login diz de quem é este sistema?" tinha
 * como resposta: diz de quem é o Tailwind.
 */

const NAVY = '#0F1730' // 98,97% da tinta do logotipo
const OURO = '#E4B23C' // 0,15% — o ponto final de "IMOBILIÁRIA."

/**
 * O símbolo: moldura de traço fino com o "S" dentro.
 *
 * A moldura é desenhada por geometria (é um retângulo arredondado exato no
 * arquivo) e o "S" vem do contorno traçado. `currentColor` na tinta permite
 * inverter no tema escuro sem um segundo arquivo.
 */
export function Simbolo({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 272 272"
      className={className}
      fill="none"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {/* traço de 15px = 5,51% do lado; raio de 64px descontando meio traço */}
      <rect
        x="7.5"
        y="7.5"
        width="257"
        height="257"
        rx="56.5"
        stroke="currentColor"
        strokeWidth="15"
      />
      <path d={S_PATH} fill="currentColor" fillRule="evenodd" />
    </svg>
  )
}

/**
 * O lockup completo. Usado no login e em nenhum outro lugar — é grande, e a
 * marca a 208px numa tela de entrada é uma afirmação; repetida em cada
 * cabeçalho seria ruído.
 *
 * O ponto de ouro é um DISCO. Medi o perfil do glifo linha por linha
 * (6, 8, 10, 10, 10, 11, 10, 10, 9, 7, 1 px) e ele é redondo — duas das cinco
 * propostas de design o descreveram como quadrado e apostaram a assinatura
 * nisso.
 */
export function Lockup({
  className,
  tema = 'claro',
}: {
  className?: string
  /** No escuro a tinta inverte; o ouro fica igual, porque foi feito para navy. */
  tema?: 'claro' | 'escuro'
}) {
  const tinta = tema === 'escuro' ? '#E7ECF6' : NAVY
  return (
    <svg viewBox="0 0 960 272" className={className} fill="none" role="img">
      <title>Souza Imobiliária</title>
      <g stroke={tinta} fill="none">
        <rect x="7.5" y="7.5" width="257" height="257" rx="56.5" strokeWidth="15" />
      </g>
      <path d={S_PATH} fill={tinta} fillRule="evenodd" />
      {/* o bloco de texto começa 343px à direita da borda do símbolo */}
      <g transform="translate(343 0)">
        <path d={TEXTO_PATH} fill={tinta} fillRule="evenodd" />
      </g>
      {/* o ponto: disco de 11px, centro em (962, 260) no arquivo */}
      <circle cx="954" cy="214" r="5.5" fill={OURO} />
    </svg>
  )
}

/**
 * A MARCA D'ÁGUA — só o "S", sem a moldura.
 *
 * O glifo mede 108x128 dentro do símbolo de 272x272, a partir de (81, 71).
 * A viewBox aqui é justamente essa caixa, para o S encher o elemento e poder
 * sangrar pela borda sem arrastar junto um retângulo arredondado gigante.
 *
 * É decorativo: `aria-hidden` sempre, e a opacidade fica com quem usa.
 */
export function MarcaDagua({ className }: { className?: string }) {
  return (
    <svg viewBox="81 71 108 128" className={className} fill="none" aria-hidden>
      <path d={S_PATH} fill="currentColor" fillRule="evenodd" />
    </svg>
  )
}
