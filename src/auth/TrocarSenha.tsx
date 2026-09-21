import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { SidePanel } from '@/components/ui/SidePanel'
import { Dica } from '@/components/ui/Dica'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'

/**
 * Trocar a própria senha, dentro do app.
 *
 * Existe porque o acesso do corretor foi criado sem e-mail: ele entra com um
 * login interno (`@souzaimobiliaria.local`), que não recebe mensagem. Sem esta
 * tela, o "Esqueci minha senha" seria o único caminho — e ele depende de uma
 * caixa de e-mail que não existe, o que deixaria a senha temporária valendo
 * para sempre.
 *
 * Não pede a senha atual: quem está logado já provou que a tem, e é assim que
 * o Supabase trata a troca. Se alguém esquecer, o administrador redefine.
 */
export function TrocarSenha({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { showToast } = useToast()
  const [senha, setSenha] = useState('')
  const [repetida, setRepetida] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Cada abertura começa em branco: senha digitada e erro da vez passada não
  // podem estar na tela quando o painel volta.
  useEffect(() => {
    if (!aberto) return
    setSenha('')
    setRepetida('')
    setErro(null)
  }, [aberto])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (senha.length < 8) return setErro('Use pelo menos 8 caracteres.')
    if (senha !== repetida) return setErro('As duas senhas não são iguais.')
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvando(false)
    if (error) {
      setErro(
        /same as the old|different from the old/i.test(error.message)
          ? 'A nova senha tem de ser diferente da atual.'
          : 'Não deu para trocar a senha. Tente de novo.',
      )
      return
    }
    setSenha('')
    setRepetida('')
    showToast({ message: 'Senha trocada', detail: 'use a nova na próxima vez que entrar' })
    onFechar()
  }

  return (
    <SidePanel
      key={aberto ? 'aberto' : 'fechado'}
      aberto={aberto}
      aoFechar={onFechar}
      titulo="Trocar minha senha"
      subtitulo="Vale imediatamente, neste aparelho e nos outros."
      rodape={
        <>
          <Button type="button" variant="secundario" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" form="trocar-senha" carregando={salvando}>
            Trocar senha
          </Button>
        </>
      }
    >
      <form id="trocar-senha" onSubmit={enviar} className="flex flex-col gap-6">
        <Dica>Se você entrou com uma senha temporária, troque agora por uma que só você saiba.</Dica>

        <FormField label="Nova senha" htmlFor="ts-nova" hint="Pelo menos 8 caracteres">
          <Input
            id="ts-nova"
            data-foco-inicial
            type="password"
            autoComplete="new-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </FormField>

        <FormField label="Repita a nova senha" htmlFor="ts-rep" error={erro ?? undefined}>
          <Input
            id="ts-rep"
            type="password"
            autoComplete="new-password"
            required
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
          />
        </FormField>
      </form>
    </SidePanel>
  )
}
