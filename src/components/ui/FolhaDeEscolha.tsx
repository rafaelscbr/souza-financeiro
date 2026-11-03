import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useArmadilhaDeFoco } from '@/components/ui/SidePanel'
import { usePresenca } from '@/lib/usePresenca'

/*
 * NOVO LANÇAMENTO (Souza 3.0, 02/11/2026).
 *
 * Um botão só para tudo que mexe em dinheiro, com a tecla N de qualquer
 * tela. Antes cada tela tinha o seu CTA ("Registrar venda" em Receber,
 * "Lançar despesa" em Despesas) e quem queria a outra ação ia procurar.
 *
 * Aqui só se ESCOLHE; nenhum formulário novo. Despesa e venda abrem os
 * painéis de sempre (AcoesAdmin); recebimento e pagamento levam à lista onde
 * a baixa é feita na própria linha. Cada escolha tem a sua letra.
 */

export interface EscolhaDeLancamento {
  id: string
  titulo: string
  descricao: string
  tecla: string
  aoEscolher: () => void
}

export function FolhaDeEscolha({
  titulo,
  aberto,
  aoFechar,
  escolhas,
}: {
  titulo: string
  aberto: boolean
  aoFechar: () => void
  escolhas: EscolhaDeLancamento[]
}) {
  const ref = useRef<HTMLDivElement>(null)
  const presenca = usePresenca(aberto, 180)
  useArmadilhaDeFoco(aberto, ref, aoFechar)

  // A letra de cada escolha, enquanto a folha está aberta.
  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return
      const escolha = escolhas.find((x) => x.tecla.toLowerCase() === e.key.toLowerCase())
      if (!escolha) return
      e.preventDefault()
      aoFechar()
      escolha.aoEscolher()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [aberto, escolhas, aoFechar])

  if (!presenca.montado) return null
  const saindo = presenca.estado === 'saindo'

  return createPortal(
    <div className="fixed inset-0 z-modal flex items-end justify-center sm:items-start sm:pt-24">
      <div
        aria-hidden
        onClick={aoFechar}
        className="absolute inset-0 bg-[color:var(--veu-modal)]"
        style={{ animation: saindo ? 'esmaeceSai var(--dur-saida) var(--curva-sai) both' : 'esmaeceEntra var(--dur-pagina) var(--curva-entra) backwards' }}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="folha-de-escolha-titulo"
        tabIndex={-1}
        {...presenca.props}
        style={{
          animation: saindo
            ? 'modalSai var(--dur-saida) var(--curva-sai) both'
            : 'modalEntra var(--dur-painel) var(--curva-entra) backwards',
        }}
        className="relative w-full max-w-[560px] rounded-t-sobreposicao bg-surface pb-safe shadow-modal outline-none sm:mx-4 sm:rounded-sobreposicao"
      >
        <div className="flex items-center gap-2 px-5 pb-2 pt-4">
          <h2 id="folha-de-escolha-titulo" data-foco-titulo tabIndex={-1} className="text-t1 text-titulo-painel outline-none">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="ms-auto flex size-9 items-center justify-center rounded-controle text-t3 transition-colors hover:bg-s3 hover:text-t1 max-lg:size-11"
          >
            <X size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="grid gap-2 px-5 pb-5 pt-1 sm:grid-cols-2">
          {escolhas.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => {
                aoFechar()
                x.aoEscolher()
              }}
              style={{ animation: saindo ? undefined : `sobe var(--dur-lista) var(--curva-entra) ${60 + i * 40}ms backwards` }}
              className="group grid grid-cols-[1fr_auto] items-start gap-x-2 gap-y-0.5 rounded-caixa border border-transparent bg-s2 px-4 py-3.5 text-left transition duration-micro hover:border-[color:var(--line-input)] hover:bg-surface active:scale-[.98] max-lg:min-h-11"
            >
              <span className="font-semibold text-t1 text-texto">{x.titulo}</span>
              <kbd className="row-span-1 hidden rounded-kbd bg-s3 px-1.5 py-0.5 font-medium text-t4 text-nota [@media(pointer:fine)]:inline">
                {x.tecla.toUpperCase()}
              </kbd>
              <span className="col-span-2 text-t4 text-texto-meta">{x.descricao}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
