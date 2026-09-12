import { useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { Lockup, MarcaDagua } from '@/components/marca/Marca'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'

/*
 * A PORTA DE ENTRADA.
 *
 * Duas versões morreram aqui antes desta. A primeira punha um ícone de prédio
 * da lucide, pintado com duas cores que não existem na marca, num cartão
 * centralizado: a tela dizia de quem era o Tailwind, não de quem era o
 * sistema. A segunda trocou o ícone pela marca de verdade mas manteve o
 * formato de formulário solto, e o Rafael cravou o diagnóstico: "isso é um
 * login de SaaS?".
 *
 * Não era. Um login de produto faz três coisas que um formulário não faz:
 * afirma a marca em tamanho grande, diz o que o sistema É antes de pedir
 * senha, e trata a entrada como uma chegada em vez de um pedágio.
 *
 * Daí a tela dividida. O painel é o lado da marca — gradiente na tinta da
 * casa, o "S" do símbolo como marca d'água saindo pela borda, e uma frase que
 * nomeia o produto. O outro lado é só o trabalho: dois campos e um botão.
 *
 * O painel é SEMPRE escuro, nos dois temas, porque ele é a capa. O lado do
 * formulário obedece à preferência do usuário.
 *
 * Todos os contrastes do painel foram calculados sobre o ponto MAIS CLARO do
 * gradiente, que é onde eles são piores: creme 13,11:1, secundária 7,83:1,
 * ouro 6,70:1.
 */

const PAINEL = 'linear-gradient(155deg, #101A38 0%, #1C2E5E 48%, #080D1C 100%)'

function Prova({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: '#E4B23C' }}
        aria-hidden
      />
      <span className="text-base leading-relaxed" style={{ color: '#B9C8EC' }}>
        {children}
      </span>
    </li>
  )
}

/** O painel da marca. Sempre escuro: é a capa do produto. */
function Painel() {
  return (
    <aside
      className="relative isolate overflow-hidden lg:min-h-screen"
      style={{ backgroundImage: PAINEL }}
    >
      {/*
       * Marca d'água: só o "S", em tamanho grande, sangrando pela borda de
       * baixo. Sem a moldura — ela viraria um retângulo arredondado gigante
       * competindo com o texto.
       */}
      <MarcaDagua className="pointer-events-none absolute -bottom-[22%] -left-[8%] h-[86%] w-auto text-white/[0.07] lg:-bottom-[18%] lg:-left-[4%]" />
      {/* Brilho de ouro no alto, na mesma proporção discreta do logotipo. */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(90% 55% at 85% 0%, rgba(228,178,60,0.16) 0%, transparent 62%)',
        }}
        aria-hidden
      />

      <div className="relative flex h-full flex-col justify-between gap-10 px-7 py-9 sm:px-10 lg:px-12 lg:py-14">
        <Lockup className="h-auto w-[11.5rem] lg:w-[14rem]" tema="escuro" />

        <div className="max-w-[30rem]">
          <h1
            className="cifra text-3xl font-bold leading-[1.12] tracking-[-0.02em] lg:text-4xl"
            style={{ color: '#F6F3EC' }}
          >
            Da venda ao repasse,
            <br />
            sem planilha.
          </h1>
          <p className="mt-4 text-base leading-relaxed" style={{ color: '#B9C8EC' }}>
            Cada parcela da comissão, o que já entrou, o que a construtora ainda deve e quanto fica
            para a Souza.
          </p>
          <ul className="mt-7 hidden space-y-3 lg:block">
            <Prova>A comissão do corretor sai calculada no recebimento, não no chute</Prova>
            <Prova>O corretor acompanha sozinho o que tem a receber, e quando</Prova>
            <Prova>ISS retido e Simples lançados no mês certo</Prova>
          </ul>
        </div>

        <p
          className="assinatura sem-ponto hidden lg:block"
          style={{ color: '#93A6D4' }}
        >
          Financeiro · Itajaí SC
        </p>
      </div>
    </aside>
  )
}

/** A moldura: painel à esquerda, trabalho à direita. */
function Moldura({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-papel lg:grid lg:grid-cols-[1.05fr_1fr]">
      <Painel />
      <main className="flex items-center justify-center px-6 py-12 sm:px-10 lg:py-0">
        <div className="w-full max-w-[22rem]">{children}</div>
      </main>
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
        <h2 className="text-lg font-semibold text-content">Pedido registrado</h2>
        {/*
         * Não afirma que a mensagem chegou. Os acessos deste sistema são
         * criados sem e-mail, num login interno que não recebe mensagem — o
         * texto anterior mandava o corretor esperar num beco sem saída.
         */}
        <p className="mt-2 text-base text-content-muted">
          Se <strong className="font-medium text-content">{email}</strong> for uma caixa de e-mail
          de verdade e existir conta ligada a ela, o link chega em alguns minutos e vale por uma
          hora.
        </p>
        <p className="mt-3 text-base text-content-muted">
          Se você é corretor, seu acesso não tem e-mail: fale com a imobiliária para redefinir a
          senha.
        </p>
        <Button variant="secondary" className="mt-6 w-full" onClick={() => setModo('entrar')}>
          Voltar
        </Button>
      </Moldura>
    )
  }

  return (
    <Moldura>
      <h2 className="text-lg font-semibold text-content">
        {modo === 'entrar' ? 'Entrar' : 'Recuperar acesso'}
      </h2>
      <p className="mt-1 text-base text-content-muted">
        {modo === 'entrar'
          ? 'Use o login que a imobiliária criou para você.'
          : 'Isto só funciona para acesso criado com caixa de e-mail de verdade.'}
      </p>

      <form onSubmit={enviar} className="mt-6 space-y-4">
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
              className="-mx-2 inline-flex min-h-toque items-center rounded-xl px-2 text-sm font-medium text-action-soft-ink underline decoration-1 underline-offset-2 transition-colors hover:bg-action-soft"
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
            className="-mx-2 inline-flex min-h-toque items-center rounded-xl px-2 text-sm font-medium text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
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
      <h2 className="text-lg font-semibold text-content">Criar uma senha nova</h2>
      <p className="mt-1 text-base text-content-muted">
        Escolha a senha que vai usar de agora em diante.
      </p>
      <form onSubmit={enviar} className="mt-6 space-y-4">
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
          className="-mx-2 inline-flex min-h-toque items-center rounded-xl px-2 text-sm font-medium text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
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
      <h2 className="text-lg font-semibold text-content">Acesso ainda não liberado</h2>
      <p className="mt-2 text-base text-content-muted">
        A conta <strong className="font-medium text-content">{email}</strong> existe, mas ainda não
        está ligada a um corretor. Peça para a imobiliária liberar e tente de novo.
      </p>
      <Button variant="secondary" className="mt-6 w-full" onClick={() => recarregarPerfil()}>
        Já liberaram, verificar
      </Button>
      <button
        onClick={() => sair()}
        className="-mx-2 mt-2 inline-flex min-h-toque items-center rounded-xl px-2 text-sm font-medium text-content-muted transition-colors hover:bg-surface-2 hover:text-content"
      >
        Sair
      </button>
    </Moldura>
  )
}
