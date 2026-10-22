// Reabre o saldo do Bradesco PJ em 22/10/2026 com o saldo real do extrato,
// R$ 7.391,60. O sistema mostrava R$ 17.502,46; o Rafael pediu para não
// procurar a diferença e seguir certo daqui em diante.
//
// Por que reabrir e não lançar um ajuste: um lançamento de −R$ 10.110,86
// entraria no DRE como despesa (ou retirada) que ninguém sabe qual foi. Mudar
// a abertura da conta faz o saldo recomeçar hoje sem tocar no resultado: o que
// foi liquidado antes de 22/10 continua no DRE e sai do saldo controlado — o
// Fluxo de caixa mostra isso em "Fora das contas".
//
// Era: abertura 21/09/2026, R$ 1.857,77. Simulação por padrão; --go grava.
const U = process.env.VITE_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const GO = process.argv.includes('--go');
const api = async (method, path, body) => {
  const r = await fetch(`${U}/rest/v1/${path}`, { method, headers: H, body: body && JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
};

const CONTA = '88e08e64-c0c4-4620-98e3-00ba8e79f93f';
const NOVO = { opening_balance: 7391.6, opening_date: '2026-10-22' };

const [c] = await api('GET', `accounts?id=eq.${CONTA}&select=name,opening_balance,opening_date`);
console.log('antes:', c);
if (c.name !== 'Bradesco PJ') throw new Error('não é o Bradesco PJ: nada gravado');

// Nada liquidado nesta conta a partir de hoje pode ficar antes da nova abertura sem querer.
const depois = await api('GET', `transactions?account_id=eq.${CONTA}&status=eq.settled&settled_date=gte.${NOVO.opening_date}&select=id`);
if (depois.length) throw new Error(`${depois.length} movimento(s) já liquidados a partir de ${NOVO.opening_date}: conferir antes`);

if (!GO) { console.log('simulação: nada gravado (use --go)'); process.exit(0); }
const [r] = await api('PATCH', `accounts?id=eq.${CONTA}`, NOVO);
console.log('depois:', { name: r.name, opening_balance: r.opening_balance, opening_date: r.opening_date });
