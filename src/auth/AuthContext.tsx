import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

/**
 * Quem entrou e o que essa pessoa pode ver.
 *
 * A diferença em relação ao sistema antigo está aqui: antes, estar autenticado
 * era suficiente para ver tudo. Agora a sessão só vale acompanhada de um
 * PERFIL, e é o papel do perfil que decide qual dos dois aplicativos carrega.
 *
 * O perfil vem da função `my_profile()` do banco, não de uma leitura direta da
 * tabela: assim funciona igual para administrador e corretor, e a política de
 * acesso continua sendo a do banco. Sem perfil, o acesso não foi liberado — e
 * essa é uma situação normal (corretor convidado antes do cadastro terminar),
 * não um erro.
 */

type Estado = 'carregando' | 'deslogado' | 'sem_perfil' | 'pronto' | 'recuperando_senha'

interface AuthValue {
  estado: Estado
  session: Session | null
  profile: Profile | null
  email: string | null
  entrar: (email: string, senha: string) => Promise<{ erro: string | null }>
  sair: () => Promise<void>
  pedirRecuperacao: (email: string) => Promise<{ erro: string | null }>
  definirSenha: (senha: string) => Promise<{ erro: string | null }>
  recarregarPerfil: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [recuperando, setRecuperando] = useState(false)

  const buscarPerfil = useCallback(async (): Promise<Profile | null> => {
    const { data, error } = await supabase.rpc('my_profile')
    if (error) return null
    const linha = Array.isArray(data) ? data[0] : data
    return (linha as Profile | undefined) ?? null
  }, [])

  useEffect(() => {
    let vivo = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!vivo) return
      setSession(data.session)
      if (data.session) setProfile(await buscarPerfil())
      setCarregando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (evento, nova) => {
      if (!vivo) return
      // Link de recuperação: a sessão existe, mas o destino é trocar a senha,
      // não entrar no sistema. Sem tratar este evento, o usuário cai no app
      // com uma senha que ele não sabe qual é.
      if (evento === 'PASSWORD_RECOVERY') {
        setRecuperando(true)
        setSession(nova)
        return
      }
      setSession(nova)
      setProfile(nova ? await buscarPerfil() : null)
    })

    return () => {
      vivo = false
      sub.subscription.unsubscribe()
    }
  }, [buscarPerfil])

  const value = useMemo<AuthValue>(() => {
    const estado: Estado = carregando
      ? 'carregando'
      : recuperando
        ? 'recuperando_senha'
        : !session
          ? 'deslogado'
          : !profile || !profile.is_active
            ? 'sem_perfil'
            : 'pronto'

    return {
      estado,
      session,
      profile,
      email: session?.user?.email ?? null,
      async entrar(email, senha) {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
        return { erro: error ? traduzir(error.message) : null }
      },
      async sair() {
        await supabase.auth.signOut()
        setProfile(null)
        setRecuperando(false)
      },
      async pedirRecuperacao(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        return { erro: error ? traduzir(error.message) : null }
      },
      async definirSenha(senha) {
        const { error } = await supabase.auth.updateUser({ password: senha })
        if (error) return { erro: traduzir(error.message) }
        setRecuperando(false)
        setProfile(await buscarPerfil())
        return { erro: null }
      },
      async recarregarPerfil() {
        setProfile(await buscarPerfil())
      },
    }
  }, [session, profile, carregando, recuperando, buscarPerfil])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}

function traduzir(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar.'
  if (/rate limit|too many/i.test(msg)) return 'Muitas tentativas. Espere um minuto.'
  if (/should be at least|password.*6/i.test(msg)) return 'A senha precisa de pelo menos 6 caracteres.'
  if (/same as the old|different from the old/i.test(msg)) return 'A nova senha tem de ser diferente da atual.'
  return 'Não deu para completar. Tente de novo.'
}
