// Lança a venda Lago di San Pellegrino 1306B gravando as mesmas linhas que
// register_sale grava (molde: as vendas LOTISA com ISS e Simples).
// Simulação por padrão; --go grava; falha no meio desfaz.
const U = process.env.VITE_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const GO = process.argv.includes('--go');
const api = async (method, path, body) => {
  const r = await fetch(`${U}/rest/v1/${path}`, { method, headers: H, body: body && JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
};
// Arredonda em centavos inteiros, meio para cima — igual ao round() do Postgres.
const pct = (cents, p) => Math.round(cents * p / 100 + 1e-9);
const brl = c => c / 100;

const COMPANY = '28b91773-6db9-4f1b-9ba3-1cb33e873a09', CC = '0d0763ad-011e-429b-88cb-53d4047a7676';
const DIONATA = '116f89db-990f-4547-9a8b-41ff43b9f4dc';
const sale = {
  company_id: COMPANY, title: 'Comissão Lago di San Pellegrino 1306B — Francisca Tamires de Vasconcelos Borges',
  cost_center_id: CC, unit: '1306B',
  client_name: 'Francisca Tamires de Vasconcelos Borges',
  sale_date: '2026-10-14', property_value: 729000.00, commission_pct: 5, commission_total: 36450.00,
  partner_name: null, partner_share_pct: null, issues_invoice: true, simples_pct: 6, retains_iss: true, iss_pct: 3,
  broker_id: DIONATA, broker_pct: 50, owner_profit_pct: null, status: 'ativa', is_personal: false,
  notes: 'Contrato de 14/10/2026 (MMC). Apto 1306B + vaga G194. Comissão de 5% paga pela MMC em parcela única, quando a compradora atingir 10% do valor do imóvel; o contrato manda depositar no PIX do CPF do Rafael, mas a comissão é da Souza, com nota e ISS descontado (decisão do Rafael em 19/10/2026). Dionata com 50%. Data prevista calculada do cronograma de pagamento da compradora.',
};
const parcelas = [
  { idx: 1, amount: 3645000, venc: '2027-05-05', das: '2027-06-21',
    trigger_note: '100% da comissão quando a compradora atingir 10% do valor do imóvel (R$ 72.900,00). Pelo cronograma, cai na parcela de R$ 20.000 de 20/04/2027 (acumulado R$ 86.400,00). Nota em 21/04 (feriado de Tiradentes: pode sair só no dia 22); a MMC paga 10 dias úteis depois.' },
];
if (parcelas.reduce((s, p) => s + p.amount, 0) !== Math.round(sale.commission_total * 100)) throw new Error('parcelas não fecham com a comissão');

const ja = await api('GET', `sales?unit=eq.1306B&cost_center_id=eq.${CC}&select=id`);
if (ja.length) { console.log('1306B já lançada:', ja[0].id); process.exit(0); }
const [dio] = await api('GET', `contacts?id=eq.${DIONATA}&select=name`);

const n = parcelas.length;
const plano = parcelas.map(p => {
  const iss = pct(p.amount, sale.iss_pct);
  const simples = pct(p.amount - iss, sale.simples_pct);
  const base = p.amount - iss - simples;
  const broker = pct(base, sale.broker_pct);
  return { ...p, iss, simples, broker, net: base - broker, suf: n > 1 ? ` — Pc ${p.idx}/${n}` : '' };
});
console.table(plano.map(p => ({ idx: p.idx, venc: p.venc, das: p.das, bruto: brl(p.amount), iss: brl(p.iss), simples: brl(p.simples), dionata: brl(p.broker), souza: brl(p.net) })));
if (!GO) { console.log('simulação: nada gravado (use --go)'); process.exit(0); }

let saleId;
try {
  [{ id: saleId }] = await api('POST', 'sales', sale);
  for (const p of plano) {
    const [inst] = await api('POST', 'sale_installments', {
      sale_id: saleId, idx: p.idx, count: n, expected_date: p.venc, amount: brl(p.amount),
      iss_amount: brl(p.iss), simples_amount: brl(p.simples), broker_amount: brl(p.broker), owner_amount: 0, net_amount: brl(p.net),
      status: 'prevista', trigger_note: p.trigger_note,
    });
    const comum = { company_id: COMPANY, competence_date: sale.sale_date, status: 'pending', group_id: saleId,
      installment_index: n > 1 ? p.idx : null, installment_count: n > 1 ? n : null,
      cost_center_id: CC, sale_id: saleId, sale_installment_id: inst.id };
    const [rev] = await api('POST', 'transactions', { ...comum, kind: 'income', category: 'Comissões de Venda', dre_group: 'revenue',
      description: sale.title + p.suf, amount: brl(p.amount), due_date: p.venc, counterparty: sale.client_name,
      property_value: sale.property_value, commission_pct: sale.commission_pct, broker_pct: sale.broker_pct });
    const [iss] = await api('POST', 'transactions', { ...comum, kind: 'expense', category: 'Impostos e Taxas', dre_group: 'variable_expense',
      description: `ISS retido na fonte 3% — ${sale.title}${p.suf}`, amount: brl(p.iss), due_date: p.venc, counterparty: null });
    const [sim] = await api('POST', 'transactions', { ...comum, kind: 'expense', category: 'Impostos e Taxas', dre_group: 'variable_expense',
      description: `Simples 6% — ${sale.title}${p.suf}`, amount: brl(p.simples), due_date: p.das });
    const [bro] = await api('POST', 'transactions', { ...comum, kind: 'expense', category: 'Comissões de Corretores', dre_group: 'cost_of_sale',
      description: `Comissão ${dio.name} 50% — ${sale.title}${p.suf}`, amount: brl(p.broker), due_date: p.venc, contact_id: DIONATA, broker_pct: 50 });
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
    console.error('desfeito: nada da 1306B ficou no banco');
  }
  process.exit(1);
}
