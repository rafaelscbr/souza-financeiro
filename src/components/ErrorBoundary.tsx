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
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4">
          {versaoVelha ? (
            <div role="alert" className="flex flex-col items-center px-recuo py-12 text-center">
              <IconeTom icone={CloudDownload} tom="info" tamanho="lg" />
              <div className="flex flex-col items-center gap-1 pt-4">
                <h2 className={'font-heading text-t1 ' + 'text-titulo-painel'}>Saiu uma versão nova do sistema</h2>
                <p className={'max-w-[48ch] text-t3 ' + 'text-texto-corrido'}>
                  Seu aparelho está com a versão anterior guardada. Toque abaixo para baixar a atualização — leva um
                  segundo e você não perde nada.
                </p>
              </div>
              <div className="pt-6">
                <Button type="button" icone={CloudDownload} onClick={forcarAtualizacao}>
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
          <details className="flex w-full max-w-md flex-col gap-2 text-left">
            <summary className={'cursor-pointer text-center text-t-meta ' + 'text-nota'}>Detalhes técnicos</summary>
            <pre className={'overflow-x-auto rounded-controle bg-s2 p-3 text-t3 ' + 'text-nota'}>{this.state.error.message}</pre>
          </details>
        </div>
      )
    }

    return this.props.children
  }
}
