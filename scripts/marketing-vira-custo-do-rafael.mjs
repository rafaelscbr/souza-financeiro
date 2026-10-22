// Tira da Souza Imobiliária o marketing pago no cartão pessoal do Rafael
// (Meta Ads, OLX e ZP *ANGELOERI). Pedido dele em 22/10/2026, no mesmo molde
// das despesas fixas (reembolso-de-julho-vira-distribuicao.mjs):
//   · até jun/2026, liquidados sem conta (acumulado perdoado em agosto): o
//     dinheiro nunca saiu da imobiliária, então se apagam;
//   · jul/2026, reembolsados pelo Bradesco PJ: viram distribuição de lucro,
//     senão o saldo deixa de bater com o extrato.
// Simulação por padrão; --go grava a cópia e aplica.
import { writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const U = process.env.VITE_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const GO = process.argv.includes('--go');
const api = async (method, path, body) => {
  const r = await fetch(`${U}/rest/v1/${path}`, { method, headers: H, body: body && JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
};

const COMPANY = '28b91773-6db9-4f1b-9ba3-1cb33e873a09';
// O que se espera achar; qualquer diferença aborta antes de gravar.
const ESPERADO = { apagar: { n: 36, cents: 475388 }, converter: { n: 8, cents: 88499 } };

const linhas = await api('GET', `transactions?company_id=eq.${COMPANY}&kind=eq.expense`
  + `&category=eq.${encodeURIComponent('Marketing/Tráfego Pago')}&status=eq.settled`
  + `&counterparty=eq.${encodeURIComponent('Rafael (cartão pessoal)')}&order=competence_date`);
const apagar = linhas.filter(t => !t.account_id && t.competence_date < '2026-07-01');
const converter = linhas.filter(t => t.account_id);
const soma = ls => ls.reduce((s, t) => s + Math.round(Number(t.amount) * 100), 0);
console.log(`apagar: ${apagar.length}, R$ ${(soma(apagar) / 100).toFixed(2)}`);
console.log(`converter: ${converter.length}, R$ ${(soma(converter) / 100).toFixed(2)}`);
if (apagar.length + converter.length !== linhas.length) throw new Error('lançamento fora dos dois grupos: nada gravado');
for (const [nome, ls] of [['apagar', apagar], ['converter', converter]]) {
  if (ls.length !== ESPERADO[nome].n || soma(ls) !== ESPERADO[nome].cents) throw new Error(`${nome} não bate com o combinado: nada gravado`);
}

const fechados = await api('GET', `period_closings?company_id=eq.${COMPANY}&select=id`);
if (fechados.length) throw new Error('há mês fechado na imobiliária: conferir antes de gravar');

if (!GO) { console.log('simulação: nada gravado (use --go)'); process.exit(0); }

const copia = join(homedir(), 'Documents', 'backup-marketing-imobiliaria-2026-10-22.json');
writeFileSync(copia, JSON.stringify(linhas, null, 2));
console.log('cópia:', copia);

const apagados = await api('DELETE', `transactions?id=in.(${apagar.map(t => t.id).join(',')})`);
console.log(`apagados: ${apagados.length}`);
if (apagados.length !== ESPERADO.apagar.n) throw new Error(`apagou ${apagados.length}: restaurar da cópia`);

let feitos = 0;
for (const t of converter) {
  const [r] = await api('PATCH', `transactions?id=eq.${t.id}`, {
    kind: 'withdrawal',
    category: 'Distribuição de Lucro',
    dre_group: 'withdrawal',
    counterparty: 'Rafael',
    description: `Retirada Rafael — reembolso de ${t.description.replace(/ — (pago no )?cart[aã]o pessoal.*$/i, '')} (virou custo pessoal)`,
  });
  if (r?.kind === 'withdrawal') feitos++;
}
console.log(`convertidos: ${feitos}`);
if (feitos !== ESPERADO.converter.n) throw new Error(`converteu ${feitos}: restaurar da cópia`);
