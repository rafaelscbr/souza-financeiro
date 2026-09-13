import { Component, type ErrorInfo, type ReactNode } from 'react'
import { CloudDownload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EstadoErro } from '@/components/ui/Estados'
import { IconeTom } from '@/components/ui/IconeTom'
import { forcarAtualizacao } from '@/lib/chunkRecovery'

interface Props {
  children: ReactNode
  /** Muda de valor quando o usuário navega — reseta o boundary ao trocar de tela. */
  resetKey?: string
}

interface State {
  error: Error | null
}

/**
 * Impede que um erro em uma tela derrube o app inteiro (a "tela branca").
 * Mostra o que aconteceu e deixa o usuário tentar de novo ou seguir para
 * outra parte do sistema — sem perder a sessão.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(prev: Props) {
    // Ao navegar para outra rota, limpa o erro e tenta renderizar de novo.
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Fica no console para diagnóstico, sem expor nada sensível na tela.
    console.error('Erro capturado pela ErrorBoundary:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      // "Failed to fetch dynamically imported module" não é erro da tela: é
      // versão em cache apontando para arquivo que já não existe. Merece uma
      // saída própria, porque "tentar de novo" não resolve. E não é risco, é
      // informação: nada quebrou, só falta baixar a versão nova.
      const versaoVelha = /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(
        this.state.error.message,
      )
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
          {versaoVelha ? (
            <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
              <IconeTom icone={CloudDownload} tom="info" tamanho="lg" />
              <h2 className="mt-4 font-heading text-base font-bold tracking-[-0.015em] text-t1">
                Saiu uma versão nova do sistema
              </h2>
              <p className="mt-1 max-w-sm text-[13px] text-t3">
                Seu aparelho está com a versão anterior guardada. Toque abaixo para baixar a atualização — leva um
                segundo e você não perde nada.
              </p>
              <div className="mt-5">
                <Button type="button" onClick={forcarAtualizacao}>
                  <CloudDownload size={15} strokeWidth={1.6} aria-hidden />
                  Atualizar agora
                </Button>
              </div>
            </div>
          ) : (
            <EstadoErro
              titulo="Algo nesta tela deu erro"
              motivo="O resto do sistema continua funcionando. Você pode tentar de novo ou ir para outra parte pelo menu. Se persistir, me avise com o que estava fazendo."
              aoTentarDeNovo={() => this.setState({ error: null })}
            />
          )}
          <details className="-mt-6 w-full max-w-md text-left">
            <summary className="cursor-pointer text-center text-xs text-t4">Detalhes técnicos</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-s2 p-3 text-xs text-t3">{this.state.error.message}</pre>
          </details>
        </div>
      )
    }

    return this.props.children
  }
}
