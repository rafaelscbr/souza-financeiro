#!/usr/bin/env node
// Redefine a senha de um acesso do sistema (corretor ou administrador).
//
// Os acessos foram criados sem e-mail de verdade (login interno
// @souzaimobiliaria.local), então o "Reset password" do painel do Supabase,
// que manda um e-mail, não chega a ninguém. Este script troca a senha direto,
// com a chave de administração do .env — que nunca vai para o navegador.
//
// Uso:
//   node --env-file=.env scripts/redefinir-senha.mjs dionata
//   node --env-file=.env scripts/redefinir-senha.mjs dionata@souzaimobiliaria.local
//
// A senha é pedida no terminal, sem aparecer na tela, e digitada duas vezes.

import { createInterface } from 'node:readline'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !chave) {
  console.error('Faltam VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY. Rode com --env-file=.env.')
  process.exit(1)
}

const alvo = (process.argv[2] ?? '').trim().toLowerCase()
if (!alvo) {
  console.error('Diga de quem é a senha: node --env-file=.env scripts/redefinir-senha.mjs dionata')
  process.exit(1)
}
const email = alvo.includes('@') ? alvo : `${alvo}@souzaimobiliaria.local`

/** Pergunta sem ecoar o que é digitado. */
function perguntarEscondido(pergunta) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = (s) => {
      if (s.startsWith(pergunta)) rl.output.write(pergunta)
    }
    rl.question(pergunta, (resposta) => {
      rl.close()
      process.stdout.write('\n')
      resolve(resposta)
    })
  })
}

const sb = createClient(url, chave, { auth: { persistSession: false } })

const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 })
if (error) {
  console.error('Não consegui ler os acessos:', error.message)
  process.exit(1)
}
const usuario = data.users.find((u) => u.email?.toLowerCase() === email)
if (!usuario) {
  console.error(`Nenhum acesso com o login ${email}.`)
  console.error('Logins que existem:', data.users.map((u) => u.email).join(', '))
  process.exit(1)
}

console.log(`Nova senha para ${email}`)
const senha = await perguntarEscondido('Senha nova: ')
const confirmacao = await perguntarEscondido('Repita a senha: ')
if (senha !== confirmacao) {
  console.error('As duas não batem. Nada foi alterado.')
  process.exit(1)
}
if (senha.length < 6) {
  console.error('A senha precisa de pelo menos 6 caracteres. Nada foi alterado.')
  process.exit(1)
}

const { error: erroTroca } = await sb.auth.admin.updateUserById(usuario.id, { password: senha })
if (erroTroca) {
  console.error('O Supabase recusou a troca:', erroTroca.message)
  process.exit(1)
}
console.log(`Pronto. ${email} já entra com a senha nova.`)
