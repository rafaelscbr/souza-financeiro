// Fecha a saída das despesas fixas da Souza Imobiliária: os 7 lançamentos de
// jul/2026 (R$ 1.080,50) que ela reembolsou ao Rafael pelo Bradesco PJ deixam
// de ser despesa e viram distribuição de lucro. Pedido dele em 22/10/2026
// ("remove tudo tudo dessas despesas"), na sequência de
// historico-ate-junho-vira-custo-do-rafael.mjs. Não se apaga: o dinheiro saiu
// da conta de verdade, e sem o lançamento o saldo não bateria com o extrato.
// Simulação por padrão; --go grava a cópia e converte.
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
const ESPERADO = { n: 7, cents: 108050 };

const linhas = await api('GET', `transactions?company_id=eq.${COMPANY}&kind=eq.expense`
  + `&dre_group=eq.operating_expense&status=eq.settled&account_id=not.is.null`
  + `&counterparty=eq.${encodeURIComponent('Rafael (cartão pessoal)')}&order=competence_date`);
const cents = linhas.reduce((s, t) => s + Math.round(Number(t.amount) * 100), 0);
console.table(linhas.map(t => ({ comp: t.competence_date, valor: Number(t.amount), desc: t.description.slice(0, 55) })));
console.log(`${linhas.length} lançamentos, R$ ${(cents / 100).toFixed(2)}`);
if (linhas.length !== ESPERADO.n || cents !== ESPERADO.cents) throw new Error('não bate com o combinado: nada gravado');

if (!GO) { console.log('simulação: nada gravado (use --go)'); process.exit(0); }

const copia = join(homedir(), 'Documents', 'backup-despesas-fixas-julho-2026-10-22.json');
writeFileSync(copia, JSON.stringify(linhas, null, 2));
console.log('cópia:', copia);

// Valor, datas e conta ficam; muda só a natureza. Contraparte "Rafael", como
// as outras retiradas (o marcador "Rafael Alves de Souza" é da distribuição por venda).
let feitos = 0;
for (const t of linhas) {
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
if (feitos !== ESPERADO.n) throw new Error(`converteu ${feitos}, esperava ${ESPERADO.n}: restaurar da cópia`);
