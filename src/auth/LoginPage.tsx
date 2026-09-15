import { useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { CalendarCheck, Calculator, Smartphone, type LucideIcon } from 'lucide-react'
import { Lockup, MarcaDagua } from '@/components/marca/Marca'
import { Icone } from '@/components/ui/Icone'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/Field'

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
 * Os contrastes do painel são medidos no ponto MAIS CLARO do degradê, que é
 * onde eles são piores (docs/souza-os-fundamentos.md, 9.9).
 */

/*
 * O degradê do painel sai de tokens que valem o mesmo nos dois temas
 * (--brand-fill-text é o Marinho, --brand-fill é a Areia): o painel não troca
 * de cor quando a tela troca de tema. Os tons de texto são misturas de branco
 * com essas tintas, medidos no ponto mais claro do degradê (aceite, item 20).
 */
const PAINEL =
  'linear-gradient(158deg, color-mix(in srgb, var(--brand-fill-text) 86%, white) 0%, var(--brand-fill-text) 52%, color-mix(in srgb, var(--brand-fill-text) 52%, black) 100%)'
const CREME = 'color-mix(in srgb, white 94%, var(--brand-fill))'
const SECUNDARIA = 'color-mix(in srgb, white 76%, var(--brand-fill-text))'
const RODAPE = 'color-mix(in srgb, white 64%, var(--brand-fill-text))'

function Prova({ icone, children }: { icone: LucideIcon; children: ReactNode }) {
  return (
    <p className="flex items-start gap-3 text-texto-corrido" style={{ color: SECUNDARIA }}>
      <span className="flex h-5 shrink-0 items-center" style={{ color: 'var(--brand-fill)' }}>
        <Icone icone={icone} tamanho={16} />
      </span>
      <span>{children}</span>
    </p>
  )
}

/** O painel da marca. Sempre escuro: é a capa do produto. Não anima. */
function Painel() {
  return (
    <div
      data-painel-marca
      className="relative isolate flex h-40 flex-col justify-center overflow-hidden px-6 lg:h-auto lg:min-h-dvh lg:justify-start lg:p-12"
      style={{ backgroundImage: PAINEL }}
    >
      {/* Marca d'água: só o "S", sangrando pela borda de baixo. Decorativa. */}
      <span
        className="pointer-events-none absolute inset-y-0 left-0 flex w-1/2 translate-x-1/2 translate-y-1/4 items-end lg:w-3/4 lg:translate-x-0"
        style={{ color: CREME }}
      >
        <MarcaDagua className="h-full w-auto opacity-[.05]" />
      </span>

      <div className="relative flex flex-col lg:grid lg:h-full lg:grid-rows-[auto_1fr_auto] lg:gap-12" style={{ color: CREME }}>
        <Lockup className="h-10 w-auto self-start lg:h-12" tema="escuro" />

        <div className="hidden max-w-[30rem] flex-col gap-6 self-center lg:flex">
          <p className="font-heading text-numero-heroi font-bold" style={{ color: CREME }}>
            Da venda ao repasse,
            <br />
            sem planilha.
          </p>
          <p className="text-texto-corrido" style={{ color: SECUNDARIA }}>
            Cada parcela da comissão, o que já entrou, o que a construtora ainda deve e quanto fica
            para a Souza.
          </p>
          <div className="flex flex-col gap-3">
            <Prova icone={Calculator}>A comissão do corretor sai calculada no recebimento, não no chute</Prova>
            <Prova icone={Smartphone}>O corretor acompanha sozinho o que tem a receber, e quando</Prova>
            <Prova icone={CalendarCheck}>ISS retido e Simples lançados no mês certo</Prova>
          </div>
        </div>

        <p className="hidden text-nota lg:block" style={{ color: RODAPE }}>
          Financeiro · Itajaí SC
        </p>
      </div>
    </div>
  )
}

/** A moldura: painel à esquerda, trabalho à direita. */
function Moldura({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-page lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(28rem,36rem)]">
      <Painel />
      <main className="flex justify-center px-6 pb-12 pt-8 lg:items-center lg:px-12 lg:py-12">
        <div className="entrada-pagina flex w-full max-w-[22rem] flex-col gap-6 lg:gap-8">{children}</div>
      </main>
    </div>
  )
}

/** Título e frase de apoio do formulário: 8px entre os dois. */
function Abertura({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-heading text-titulo-pagina-m text-t1 lg:text-titulo-pagina">{titulo}</h1>
      <div className="flex flex-col gap-3 text-texto-meta text-t2">{children}</div>
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
        {/*
         * Não afirma que a mensagem chegou. Os acessos deste sistema são
         * criados sem e-mail, num login interno que não recebe mensagem — o
         * texto anterior mandava o corretor esperar num beco sem saída.
         */}
        <Abertura titulo="Pedido registrado">
          <p>
            Se <strong className="font-medium text-t1">{email}</strong> for uma caixa de e-mail de
            verdade e existir conta ligada a ela, o link chega em alguns minutos e vale por uma hora.
          </p>
          <p>
            Se você é corretor, seu acesso não tem e-mail: fale com a imobiliária para redefinir a
            senha.
          </p>
        </Abertura>
        <Button variant="secundario" size="lg" className="w-full" onClick={() => setModo('entrar')}>
          Voltar
        </Button>
      </Moldura>
    )
  }

  return (
    <Moldura>
      <Abertura titulo={modo === 'entrar' ? 'Entrar' : 'Recuperar acesso'}>
        <p>
          {modo === 'entrar'
            ? 'Use o login que a imobiliária criou para você.'
            : 'Isto só funciona para acesso criado com caixa de e-mail de verdade.'}
        </p>
      </Abertura>

      <form onSubmit={enviar} className="flex flex-col gap-8">
        <div className="flex flex-col gap-6">
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
            <p className="text-nota font-medium text-error-ink" role="alert">
              {erro}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Button type="submit" size="lg" className="w-full" carregando={ocupado}>
            {modo === 'entrar' ? 'Entrar' : 'Enviar link'}
          </Button>

          {modo === 'entrar' ? (
            <>
              <Button
                variant="fantasma"
                className="w-full"
                onClick={() => {
                  setErro(null)
                  setModo('esqueci')
                }}
              >
                Tenho e-mail cadastrado
              </Button>
              <p className="text-center text-nota text-t-meta">
                Corretor: sua senha é redefinida pela imobiliária. Fale com o Rafael.
              </p>
            </>
          ) : (
            <Button
              variant="fantasma"
              className="w-full"
              onClick={() => {
                setErro(null)
                setModo('entrar')
              }}
            >
              Voltar para entrar
            </Button>
          )}
        </div>
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
      <Abertura titulo="Criar uma senha nova">
        <p>Escolha a senha que vai usar de agora em diante.</p>
      </Abertura>
      <form onSubmit={enviar} className="flex flex-col gap-8">
        <div className="flex flex-col gap-6">
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
        </div>
        <div className="flex flex-col gap-4">
          <Button type="submit" size="lg" className="w-full" carregando={ocupado}>
            Salvar e entrar
          </Button>
          <Button variant="fantasma" className="w-full" onClick={() => sair()}>
            Cancelar
          </Button>
        </div>
      </form>
    </Moldura>
  )
}

/** Logado, mas sem perfil: o administrador ainda não liberou o acesso. */
export function SemAcessoPage() {
  const { email, sair, recarregarPerfil } = useAuth()
  return (
    <Moldura>
      <Abertura titulo="Acesso ainda não liberado">
        <p>
          A conta <strong className="font-medium text-t1">{email}</strong> existe, mas ainda não está
          ligada a um corretor. Peça para a imobiliária liberar e tente de novo.
        </p>
      </Abertura>
      <div className="flex flex-col gap-4">
        <Button variant="secundario" size="lg" className="w-full" onClick={() => recarregarPerfil()}>
          Já liberaram, verificar
        </Button>
        <Button variant="fantasma" className="w-full" onClick={() => sair()}>
          Sair
        </Button>
      </div>
    </Moldura>
  )
}
