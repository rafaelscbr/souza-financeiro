import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

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
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-critical/10">
            <AlertTriangle className="h-6 w-6 text-critical" />
          </div>
          <div className="max-w-md">
            <h2 className="text-lg font-bold text-content">Algo nesta tela deu erro</h2>
            <p className="mt-1 text-sm text-content-muted">
              O resto do sistema continua funcionando. Você pode tentar de novo ou ir para outra
              parte pelo menu. Se persistir, me avise com o que estava fazendo.
            </p>
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald px-4 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
            Tentar novamente
          </button>
          <details className="mt-1 max-w-md text-left">
            <summary className="cursor-pointer text-xs text-content-faint">Detalhes técnicos</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-2 p-3 text-[11px] text-content-muted">
              {this.state.error.message}
            </pre>
          </details>
        </div>
      )
    }

    return this.props.children
  }
}
