import { useState, type FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
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
    <Modal
      key={aberto ? 'aberto' : 'fechado'}
      open={aberto}
      onClose={onFechar}
      title="Trocar minha senha"
      description="Vale imediatamente, neste aparelho e nos outros."
    >
      <form onSubmit={enviar} className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-xl bg-surface-2 px-3.5 py-3">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-content-faint" />
          <p className="text-xs text-content-muted">
            Se você entrou com uma senha temporária, troque agora por uma que só você saiba.
          </p>
        </div>

        <FormField label="Nova senha" htmlFor="ts-nova" hint="Pelo menos 8 caracteres">
          <Input
            id="ts-nova"
            type="password"
            autoComplete="new-password"
            required
            autoFocus
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

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={salvando}>
            {salvando ? <Spinner className="h-5 w-5" /> : 'Trocar senha'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
