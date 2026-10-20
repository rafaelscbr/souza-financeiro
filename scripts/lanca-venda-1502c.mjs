// Lança a venda PortoVelas 1502-C gravando as mesmas linhas que register_sale grava
// (molde: 1114-D Pc 2/2). Simulação por padrão; --go grava; falha no meio desfaz.
const U = process.env.VITE_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const GO = process.argv.includes('--go');
const api = async (method, path, body) => {
  const r = await fetch(`${U}/rest/v1/${path}`, { method, headers: H, body: body && JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
};
const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;

const COMPANY = '28b91773-6db9-4f1b-9ba3-1cb33e873a09', CC = '31237db0-1fdf-41c3-ab0c-3d94562365bb';
const DIONATA = '116f89db-990f-4547-9a8b-41ff43b9f4dc';
const sale = {
  company_id: COMPANY, title: 'Comissão PortoVelas 1502-C — Rennan Pelaes Caldas dos Reis',
  cost_center_id: CC, unit: '1502-C',
  client_name: 'Rennan Pelaes Caldas dos Reis / Cleyce Caroline Lira dos Reis Pelaes',
  sale_date: '2026-10-13', property_value: 908290.56, commission_pct: 5, commission_total: 45414.53,
  partner_name: null, partner_share_pct: null, issues_invoice: true, simples_pct: 6, retains_iss: true, iss_pct: 3,
  broker_id: DIONATA, broker_pct: 50, owner_profit_pct: null, status: 'ativa', is_personal: false,
  notes: 'Quadro resumo de 13/10/2026. Apto 1502-C + vagas 71 e 163. Comissão de 5% paga pela LOTISA. Dionata com 50%. Datas previstas calculadas do cronograma de pagamento do comprador, com a nota emitida um dia depois do gatilho.',
};
const parcelas = [
  { idx: 1, amount: 22707.27, venc: '2027-07-30', das: '2027-08-20',
    trigger_note: '50% da comissão quando o comprador atingir 5% do valor do contrato (R$ 45.414,53). Pelo cronograma, cai na mensal de 15/07/2027 (acumulado R$ 45.852,27). Nota em 16/07; a LOTISA paga 10 dias úteis depois.' },
  { idx: 2, amount: 22707.26, venc: '2027-12-30', das: '2028-01-20',
    trigger_note: 'Os outros 50% ao atingir 8% do valor do contrato (R$ 72.663,24). Pelo cronograma, cai em 15/12/2027, com a mensal e a intermediária de R$ 30.000 (acumulado R$ 86.187,57). Nota em 16/12; a LOTISA paga 10 dias úteis depois.' },
];
if (r2(parcelas.reduce((s, p) => s + p.amount, 0)) !== sale.commission_total) throw new Error('parcelas não fecham com a comissão');

const ja = await api('GET', `sales?unit=eq.1502-C&cost_center_id=eq.${CC}&select=id`);
if (ja.length) { console.log('1502-C já lançada:', ja[0].id); process.exit(0); }
const [dio] = await api('GET', `contacts?id=eq.${DIONATA}&select=name`);

const plano = parcelas.map(p => {
  const iss = r2(p.amount * sale.iss_pct / 100);
  const simples = r2((p.amount - iss) * sale.simples_pct / 100);
  const base = r2(p.amount - iss - simples);
  const broker = r2(base * sale.broker_pct / 100);
  return { ...p, iss, simples, broker, net: r2(p.amount - iss - simples - broker), suf: ` — Pc ${p.idx}/${parcelas.length}` };
});
console.table(plano.map(({ idx, venc, das, amount, iss, simples, broker, net }) => ({ idx, venc, das, amount, iss, simples, dionata: broker, souza: net })));
if (!GO) { console.log('simulação: nada gravado (use --go)'); process.exit(0); }

let saleId;
try {
  [{ id: saleId }] = await api('POST', 'sales', sale);
  for (const p of plano) {
    const [inst] = await api('POST', 'sale_installments', {
      sale_id: saleId, idx: p.idx, count: plano.length, expected_date: p.venc, amount: p.amount,
      iss_amount: p.iss, simples_amount: p.simples, broker_amount: p.broker, owner_amount: 0, net_amount: p.net,
      status: 'prevista', trigger_note: p.trigger_note,
    });
    const comum = { company_id: COMPANY, competence_date: sale.sale_date, status: 'pending', group_id: saleId,
      installment_index: p.idx, installment_count: plano.length, cost_center_id: CC, sale_id: saleId, sale_installment_id: inst.id };
    const [rev] = await api('POST', 'transactions', { ...comum, kind: 'income', category: 'Comissões de Venda', dre_group: 'revenue',
      description: sale.title + p.suf, amount: p.amount, due_date: p.venc, counterparty: sale.client_name,
      property_value: sale.property_value, commission_pct: sale.commission_pct, broker_pct: sale.broker_pct });
    const [iss] = await api('POST', 'transactions', { ...comum, kind: 'expense', category: 'Impostos e Taxas', dre_group: 'variable_expense',
      description: `ISS retido na fonte 3% — ${sale.title}${p.suf}`, amount: p.iss, due_date: p.venc, counterparty: null });
    const [sim] = await api('POST', 'transactions', { ...comum, kind: 'expense', category: 'Impostos e Taxas', dre_group: 'variable_expense',
      description: `Simples 6% — ${sale.title}${p.suf}`, amount: p.simples, due_date: p.das });
    const [bro] = await api('POST', 'transactions', { ...comum, kind: 'expense', category: 'Comissões de Corretores', dre_group: 'cost_of_sale',
      description: `Comissão ${dio.name} 50% — ${sale.title}${p.suf}`, amount: p.broker, due_date: p.venc, contact_id: DIONATA, broker_pct: 50 });
    await api('PATCH', `sale_installments?id=eq.${inst.id}`, { revenue_tx_id: rev.id, iss_tx_id: iss.id, simples_tx_id: sim.id, broker_tx_id: bro.id });
  }
  console.log('venda lançada:', saleId);
} catch (e) {
  console.error('FALHOU:', e.message);
  if (saleId) {
    await api('PATCH', `sale_installments?sale_id=eq.${saleId}`, { revenue_tx_id: null, iss_tx_id: null, simples_tx_id: null, broker_tx_id: null }).catch(() => {});
    await api('DELETE', `transactions?sale_id=eq.${saleId}`).catch(() => {});
    await api('DELETE', `sale_installments?sale_id=eq.${saleId}`).catch(() => {});
    await api('DELETE', `sales?id=eq.${saleId}`).catch(() => {});
    console.error('desfeito: nada da 1502-C ficou no banco');
  }
  process.exit(1);
}
