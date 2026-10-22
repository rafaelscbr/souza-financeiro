// Lança a contabilidade como despesa FIXA da Souza Imobiliária: R$ 415,00 por
// mês, a partir de outubro/2026, ainda em aberto (pedido do Rafael em
// 22/10/2026: "ela ainda não foi paga... deixa ela em aberta").
//
// `is_recurring = true` é o que faz o "Gerar fixas" da tela Despesas repetir o
// lançamento nos meses seguintes (lib/recurring.ts usa o mais recente como
// modelo). Vence todo dia 12 (dito por ele no mesmo dia); o modelo leva esse
// dia adiante.
// Simulação por padrão; --go grava.
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
const lancamento = {
  company_id: COMPANY,
  kind: 'expense',
  category: 'Contabilidade',
  dre_group: 'operating_expense',
  description: 'Contabilidade — mensalidade',
  amount: 415.0,
  competence_date: '2026-10-01',
  due_date: '2026-10-12',
  status: 'pending',
  settled_date: null,
  is_recurring: true,
  account_id: null,
}

const ja = await api('GET', `transactions?company_id=eq.${COMPANY}&category=eq.Contabilidade&competence_date=gte.2026-10-01&competence_date=lt.2026-11-01&select=id,amount,status`);
if (ja.length) { console.log('outubro já lançado:', ja); process.exit(0); }
console.log('vai lançar:', lancamento);
if (!GO) { console.log('simulação: nada gravado (use --go)'); process.exit(0); }
const [r] = await api('POST', 'transactions', lancamento);
console.log('lançado:', r.id, r.description, r.amount, r.status, 'vence', r.due_date);
