import { Valor } from './Valor'

/*
 * A RÉGUA (Souza 3.0, 02/11/2026): um todo dividido em partes numa barra de
 * 100%, que se preenche ao abrir, com a lista das partes embaixo (cor, nome,
 * valor, %). Usada na comissão (para onde vai cada real) e no ano do
 * corretor (quanto já caiu). A primeira parte é o dado principal: marinho.
 */
export interface ParteDaRegua {
  nome: string
  valor: number
  cor: string
}

export function Regua({ partes, rotuloAcessivel }: { partes: ParteDaRegua[]; rotuloAcessivel: string }) {
  return (
    <div role="img" aria-label={rotuloAcessivel} className="flex h-9 gap-0.5 overflow-hidden rounded-kbd bg-s3">
      {partes.map((p, i) =>
        p.valor > 0 ? (
          <span
            key={p.nome}
            className="block h-full origin-left"
            style={{
              flexGrow: p.valor,
              background: p.cor,
              animation: `barraEnche var(--dur-contagem) var(--curva-entra) ${i * 80}ms backwards`,
            }}
          />
        ) : null,
      )}
    </div>
  )
}

export function PartesDaRegua({ partes, rotuloAcessivel }: { partes: ParteDaRegua[]; rotuloAcessivel: string }) {
  const total = partes.reduce((s, p) => s + p.valor, 0)
  return (
    <ul aria-label={rotuloAcessivel} className="flex flex-col">
      {partes.map((p) => (
        <li
          key={p.nome}
          className="grid grid-cols-[10px_minmax(0,1fr)_auto_3rem] items-center gap-3 border-t border-fio-linha px-recuo py-2.5"
        >
          <span aria-hidden className="size-2.5 rounded-ponto" style={{ background: p.cor }} />
          <span className="truncate text-t2 text-texto">{p.nome}</span>
          <Valor valor={p.valor} posto="linha" />
          <span className="num text-right text-t4 text-texto-meta">{total > 0 ? Math.round((p.valor / total) * 100) : 0}%</span>
        </li>
      ))}
    </ul>
  )
}
