import { useState, type FormEvent } from 'react'
import { useAuth } from './AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { Lockup } from '@/components/marca/Marca'
import { Assinatura } from '@/components/ui/Assinatura'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'

/*
 * A porta de entrada.
 *
 * Antes: um quadrado arredondado de 64px com o ícone `Building2` da lucide
 * pintado de #B08900 sobre #1E3A8A — duas cores que não existem na marca —
 * centralizado sobre "Souza Imobiliária / Vendas e financeiro", dentro de um
 * cartão flutuante. À pergunta "esta tela diz de quem é o sistema?", a
 * resposta era: diz de quem é o Tailwind. E o botão "Entrar" era branco sobre
 * esmeralda, a 2,54:1.
 *
 * Agora: o lockup real, reconstruído em SVG a partir das medidas do arquivo,
 * com o símbolo pendendo os 24px que ele pende no original — centralizar
 * ingenuamente destrói a única assimetria que a marca tem. Sob ele, uma linha
 * só: "FINANCEIRO" com o ponto de ouro. Ela nomeia o produto (é o financeiro,
 * não o CRM) e executa a assinatura do sistema na primeira tela que qualquer
 * pessoa vê — quem abre já aprendeu a gramática antes de digitar a senha.
 *
 * Nada centralizado verticalmente: a coluna fica a 14% da altura, não no meio
 * da tela, e o conteúdo é alinhado à esquerda. Sem gradiente, sem ilustração.
 *
 * O formulário vive num bloco de papel sobre o chão, como todas as seções do
 * app — a marca e a assinatura ficam FORA dele, sobre o chão, porque são a
 * identidade do produto e não um campo a preencher.
 */
function Moldura({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme()
  return (
    <div className="min-h-screen bg-papel px-6 pb-16 pt-[12vh] sm:px-10">
      <div className="mx-auto w-full max-w-[22rem]">
        <Lockup className="h-auto w-[13rem]" tema={theme === 'dark' ? 'escuro' : 'claro'} />
        <Assinatura className="mt-3">Financeiro</Assinatura>
        <div className="mt-7 rounded-2xl border border-line bg-surface px-5 py-6 shadow-card">
          {children}
        </div>
      </div>
    </div>
  )
}

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

  if (modo === 'enviado') {
    return (
      <Moldura>
        <h1 className="text-lg font-semibold text-content">Pedido registrado</h1>
        {/*
         * Não afirma que a mensagem chegou. Os acessos deste sistema são
         * criados sem e-mail, num login interno que não recebe mensagem — o
         * texto anterior ("o link chegou por e-mail") mandava o corretor
         * esperar num beco sem saída.
         */}
        <p className="mt-2 text-base text-content-muted">
          Se <strong className="font-medium text-content">{email}</strong> for uma caixa de e-mail de
          verdade e existir conta ligada a ela, o link chega em alguns minutos e vale por uma hora.
        </p>
        <p className="mt-3 text-base text-content-muted">
          Se você é corretor, seu acesso não tem e-mail: fale com a imobiliária para redefinir a senha.
        </p>
        <Button variant="secondary" className="mt-6 w-full" onClick={() => setModo('entrar')}>
          Voltar
        </Button>
      </Moldura>
    )
  }

  return (
    <Moldura>
      <form onSubmit={enviar} className="space-y-4">
        {modo === 'esqueci' && (
          <p className="text-base text-content-muted">
            Informe seu e-mail. Isto só funciona para acesso criado com caixa de e-mail de verdade.
          </p>
        )}

        <FormField label={modo === 'entrar' ? 'Login' : 'E-mail'} htmlFor="email">
          <Input
            id="email"
            data-foco-inicial
            type={modo === 'entrar' ? 'text' : 'email'}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            autoFocus
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
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </FormField>
        )}

        {modo === 'esqueci' && erro && (
          <p className="text-base text-critical" role="alert">
            {erro}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={ocupado}>
          {ocupado ? <Spinner className="h-5 w-5" /> : modo === 'entrar' ? 'Entrar' : 'Enviar link'}
        </Button>

        {modo === 'entrar' ? (
          <div className="space-y-1 pt-1">
            <p className="text-sm text-content-faint">
              Corretor: sua senha é redefinida pela imobiliária. Fale com o Rafael.
            </p>
            <button
              type="button"
              onClick={() => {
                setErro(null)
                setModo('esqueci')
              }}
              className="-mx-2 inline-flex min-h-toque items-center rounded-lg px-2 text-sm font-medium text-action-soft-ink underline decoration-1 underline-offset-2 transition-colors hover:bg-action-soft"
            >
              Tenho e-mail cadastrado
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setErro(null)
              setModo('entrar')
            }}
            className="-mx-2 inline-flex min-h-toque items-center rounded-lg px-2 text-sm font-medium text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
          >
            Voltar para entrar
          </button>
        )}
      </form>
    </Moldura>
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
    // 8 caracteres, igual à troca de senha dentro do app. Antes esta tela
    // pedia 6 e a outra 8 — a mesma senha era aceita num lugar e recusada no
    // outro.
    if (senha.length < 8) return setErro('Use pelo menos 8 caracteres.')
    if (senha !== repetida) return setErro('As duas senhas não são iguais.')
    setOcupado(true)
    const { erro } = await definirSenha(senha)
    setOcupado(false)
    if (erro) setErro(erro)
  }

  return (
    <Moldura>
      <form onSubmit={enviar} className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-content">Criar uma senha nova</h1>
          <p className="mt-1 text-base text-content-muted">
            Escolha a senha que vai usar de agora em diante.
          </p>
        </div>
        <FormField label="Nova senha" htmlFor="nova" hint="Pelo menos 8 caracteres">
          <Input
            id="nova"
            data-foco-inicial
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
          className="-mx-2 inline-flex min-h-toque items-center rounded-lg px-2 text-sm font-medium text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
        >
          Cancelar
        </button>
      </form>
    </Moldura>
  )
}

/** Logado, mas sem perfil: o administrador ainda não liberou o acesso. */
export function SemAcessoPage() {
  const { email, sair, recarregarPerfil } = useAuth()
  return (
    <Moldura>
      <h1 className="text-lg font-semibold text-content">Acesso ainda não liberado</h1>
      <p className="mt-2 text-base text-content-muted">
        A conta <strong className="font-medium text-content">{email}</strong> existe, mas ainda não
        está ligada a um corretor. Peça para a imobiliária liberar e tente de novo.
      </p>
      <Button variant="secondary" className="mt-6 w-full" onClick={() => recarregarPerfil()}>
        Já liberaram, verificar
      </Button>
      <button
        onClick={() => sair()}
        className="-mx-2 mt-2 inline-flex min-h-toque items-center rounded-lg px-2 text-sm font-medium text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
      >
        Sair
      </button>
    </Moldura>
  )
}
