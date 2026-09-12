import { useState, type FormEvent } from 'react'
import { Building2, ArrowLeft, MailCheck } from 'lucide-react'
import { useAuth } from './AuthContext'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'

/** Entrar, e o caminho de volta quando a senha foi esquecida. */
export function LoginPage() {
  const { entrar, pedirRecuperacao } = useAuth()
  const [modo, setModo] = useState<'entrar' | 'esqueci' | 'enviado'>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setOcupado(true)
    if (modo === 'entrar') {
      const { erro } = await entrar(email.trim(), senha)
      setOcupado(false)
      if (erro) setErro(erro)
    } else {
      const { erro } = await pedirRecuperacao(email.trim())
      setOcupado(false)
      if (erro) setErro(erro)
      else setModo('enviado')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-imobiliaria shadow-pop">
            <Building2 className="h-8 w-8 text-brand-imobiliaria-accent" />
          </div>
          <h1 className="text-2xl font-bold text-content">Souza Imobiliária</h1>
          <p className="mt-1 text-sm text-content-muted">Vendas e financeiro</p>
        </div>

        {modo === 'enviado' ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-card">
            <MailCheck className="mx-auto mb-3 h-8 w-8 text-income" />
            <h2 className="text-base font-semibold text-content">Link enviado</h2>
            <p className="mt-1 text-sm text-content-muted">
              Se existe conta para <strong className="text-content">{email}</strong>, o link para
              criar uma senha nova chegou por e-mail. Ele vale por uma hora.
            </p>
            <Button variant="secondary" className="mt-5 w-full" onClick={() => setModo('entrar')}>
              Voltar
            </Button>
          </div>
        ) : (
          <form
            onSubmit={enviar}
            className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-card"
          >
            {modo === 'esqueci' && (
              <p className="text-sm text-content-muted">
                Informe seu e-mail e enviamos um link para você criar uma senha nova.
              </p>
            )}

            <FormField label="E-mail" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                autoFocus
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>

            {modo === 'entrar' && (
              <FormField label="Senha" htmlFor="senha" error={erro ?? undefined}>
                <Input
                  id="senha"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </FormField>
            )}

            {modo === 'esqueci' && erro && (
              <p className="text-sm text-expense" role="alert">
                {erro}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={ocupado}>
              {ocupado ? <Spinner className="h-5 w-5" /> : modo === 'entrar' ? 'Entrar' : 'Enviar link'}
            </Button>

            <button
              type="button"
              onClick={() => {
                setErro(null)
                setModo(modo === 'entrar' ? 'esqueci' : 'entrar')
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium text-content-muted transition-colors hover:text-content"
            >
              {modo === 'entrar' ? (
                'Esqueci minha senha'
              ) : (
                <>
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para entrar
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

/** Tela do link de recuperação: define a senha nova e entra. */
export function NovaSenhaPage() {
  const { definirSenha, sair } = useAuth()
  const [senha, setSenha] = useState('')
  const [repetida, setRepetida] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (senha.length < 6) return setErro('A senha precisa de pelo menos 6 caracteres.')
    if (senha !== repetida) return setErro('As duas senhas não são iguais.')
    setOcupado(true)
    const { erro } = await definirSenha(senha)
    setOcupado(false)
    if (erro) setErro(erro)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-4 py-10">
      <form onSubmit={enviar} className="w-full max-w-sm space-y-4">
        <div className="mb-2 text-center">
          <h1 className="text-xl font-bold text-content">Criar uma senha nova</h1>
          <p className="mt-1 text-sm text-content-muted">
            Escolha a senha que vai usar de agora em diante.
          </p>
        </div>
        <div className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-card">
          <FormField label="Nova senha" htmlFor="nova" hint="Pelo menos 6 caracteres">
            <Input
              id="nova"
              type="password"
              autoComplete="new-password"
              required
              autoFocus
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </FormField>
          <FormField label="Repita a senha" htmlFor="repetir" error={erro ?? undefined}>
            <Input
              id="repetir"
              type="password"
              autoComplete="new-password"
              required
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
            />
          </FormField>
          <Button type="submit" size="lg" className="w-full" disabled={ocupado}>
            {ocupado ? <Spinner className="h-5 w-5" /> : 'Salvar e entrar'}
          </Button>
          <button
            type="button"
            onClick={() => sair()}
            className="w-full rounded-lg py-2 text-sm font-medium text-content-muted transition-colors hover:text-content"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

/** Logado, mas sem perfil: o administrador ainda não liberou o acesso. */
export function SemAcessoPage() {
  const { email, sair, recarregarPerfil } = useAuth()
  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 text-center shadow-card">
        <h1 className="text-lg font-bold text-content">Acesso ainda não liberado</h1>
        <p className="mt-2 text-sm text-content-muted">
          Sua conta <strong className="text-content">{email}</strong> existe, mas ainda não está
          ligada a um corretor. Peça para a imobiliária liberar e tente de novo.
        </p>
        <Button variant="secondary" className="mt-5 w-full" onClick={() => recarregarPerfil()}>
          Já liberaram, verificar
        </Button>
        <button
          onClick={() => sair()}
          className="mt-2 w-full rounded-lg py-2 text-sm font-medium text-content-muted transition-colors hover:text-content"
        >
          Sair
        </button>
      </div>
    </div>
  )
}
