// Tira da Souza Imobiliária as despesas fixas pagas no cartão pessoal do
// Rafael de dez/2025 a jun/2026 (EEmovel, MacBook, iPad, Armazém do
// Escritório, CapCut, GeniusBrain, WaSpeed, 3C Plus). Pedido dele em
// 22/10/2026, na sequência de despesas-fixas-viram-custo-do-rafael.mjs.
// São as do acumulado perdoado em agosto: liquidadas sem conta, o dinheiro
// nunca saiu da imobiliária. Julho fica, porque esse ela reembolsou de fato
// pelo Bradesco PJ e apagar deixaria o saldo sem bater com o extrato.
// Simulação por padrão; --go grava a cópia e apaga.
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
// O que se espera achar; qualquer diferença aborta antes de apagar.
const ESPERADO = { n: 41, cents: 769272 };

const linhas = await api('GET', `transactions?company_id=eq.${COMPANY}&kind=eq.expense`
  + `&dre_group=eq.operating_expense&status=eq.settled&account_id=is.null&competence_date=lt.2026-07-01`
  + `&counterparty=eq.${encodeURIComponent('Rafael (cartão pessoal)')}&order=competence_date`);
const cents = linhas.reduce((s, t) => s + Math.round(Number(t.amount) * 100), 0);
console.table(linhas.map(t => ({ comp: t.competence_date, valor: Number(t.amount), desc: t.description.slice(0, 55) })));
console.log(`${linhas.length} lançamentos, R$ ${(cents / 100).toFixed(2)}`);
if (linhas.length !== ESPERADO.n || cents !== ESPERADO.cents) throw new Error('não bate com o combinado: nada apagado');

// Mês fechado não se mexe.
const fechados = await api('GET', `period_closings?company_id=eq.${COMPANY}&select=id`);
if (fechados.length) throw new Error('há mês fechado na imobiliária: conferir antes de apagar');

// Nenhuma parcela de venda pode apontar para estes (é a única FK para transactions).
const ids = linhas.map(t => t.id);
const lista = `in.(${ids.join(',')})`;
const refs = await api('GET', `sale_installments?select=id&or=(${['revenue', 'iss', 'simples', 'broker', 'owner', 'other']
  .map(c => `${c}_tx_id.${lista}`).join(',')})`);
if (refs.length) throw new Error('há parcela de venda apontando para estes: nada apagado');

if (!GO) { console.log('simulação: nada gravado (use --go)'); process.exit(0); }

const copia = join(homedir(), 'Documents', 'backup-despesas-fixas-ate-junho-2026-10-22.json');
writeFileSync(copia, JSON.stringify(linhas, null, 2));
console.log('cópia:', copia);

const apagados = await api('DELETE', `transactions?id=${lista}`);
console.log(`apagados: ${apagados.length}`);
if (apagados.length !== ESPERADO.n) throw new Error(`apagou ${apagados.length}, esperava ${ESPERADO.n}: restaurar da cópia`);
