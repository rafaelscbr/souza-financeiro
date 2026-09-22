-- ===========================================================================
-- 032 — VENDA Itajaí Urban Club 2ª Fase, T02 1001 (Bruno J. R. Reis)
-- ===========================================================================
-- Terceiro contrato lançado em 21/09/2026. Este é diferente dos dois
-- PortoVelas, e a diferença é quem emite a nota.
--
-- COMO O DINHEIRO ANDA (planilha do Rafael + contrato Rôgga 34936):
--   · comissão cheia R$ 28.642,53 (5,3% de R$ 511.782,53)
--   · a cobrança é administrada pela Webro e o dinheiro cai no CNPJ da
--     ARAUJO INVESTIMENTOS, que emite a nota sobre o valor cheio e recolhe
--     15% (R$ 4.296,38) antes de repassar qualquer coisa
--   · do que sobra: 80% bloco Souza, 20% bloco Araujo; metade do bloco
--     Araujo volta para a Souza. No fim, 76,5% da comissão cheia entra na
--     conta da Souza, e os 23,5% restantes (nota + fatia da Araujo) nunca
--     passam por ela
--   · desse lado Souza, metade é do Dionata, que vendeu
--
-- POR ISSO, NO SISTEMA:
--   · a venda vale o que é da Souza: R$ 21.911,57 (a soma das 15 parcelas)
--   · SEM NOTA e SEM SIMPLES — quem emite é a Araujo, e o custo dela já saiu
--     antes de o dinheiro chegar aqui. Lançar imposto de novo seria cobrar
--     duas vezes a mesma coisa
--   · sem ISS retido: a Souza não é a prestadora na nota
--   · Dionata com 50%, como nas outras vendas dele
--
-- AS PARCELAS são as do comprador: as 14 primeiras vão INTEIRAS para a
-- comissão (entrada + 6 de R$ 1.515 + 7 de R$ 850) e a 15ª tira R$ 11.080
-- do balão de 25/11/2027. Cada linha aqui é 76,5% da parcela cheia.
--
-- A 1ª parcela já foi recebida e já foi repassada ao Dionata (o Rafael
-- confirmou). Ela é anterior ao saldo de abertura da conta (21/09/2026),
-- então entra como histórico e não mexe no saldo.
-- ===========================================================================

do $$
declare
  v_venda uuid;
  v_itens jsonb := '[]'::jsonb;
  v_primeira uuid;
  r record;
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub":"dfb372d6-977a-4a76-a454-fc2d260d54b6","role":"authenticated"}',
    true
  );
  if not public.is_admin() then
    raise exception 'não assumi a identidade do administrador: abortando';
  end if;
  if exists (select 1 from public.sales where unit = 'T02 1001') then
    raise notice 'venda T02 1001 já lançada: nada a fazer';
    return;
  end if;

  for r in
    select * from (values
      ( 1, '2026-09-01'::date, 1929.74),
      ( 2, '2026-10-25'::date, 1158.98),
      ( 3, '2026-11-25'::date, 1158.98),
      ( 4, '2026-12-25'::date, 1158.98),
      ( 5, '2027-01-25'::date, 1158.98),
      ( 6, '2027-02-25'::date, 1158.98),
      ( 7, '2027-03-25'::date, 1158.98),
      ( 8, '2027-04-25'::date,  650.25),
      ( 9, '2027-05-25'::date,  650.25),
      (10, '2027-06-25'::date,  650.25),
      (11, '2027-07-25'::date,  650.25),
      (12, '2027-08-25'::date,  650.25),
      (13, '2027-09-25'::date,  650.25),
      (14, '2027-10-25'::date,  650.25),
      (15, '2027-11-25'::date, 8476.20)
    ) t(idx, venc, valor)
  loop
    v_itens := v_itens || jsonb_build_object(
      'idx', r.idx,
      'expected_date', r.venc,
      'amount', r.valor,
      'trigger_note', 'Sem gatilho de percentual: a comissão é paga junto com a parcela do comprador na Rôgga. A Araujo recebe o valor cheio, emite a nota (15%) e repassa 76,5% para a Souza.'
    );
  end loop;

  v_venda := public.register_sale(jsonb_build_object(
    'title', 'Comissão Itajaí Urban Club 2ª Fase — T02 1001 (Bruno J. R. Reis)',
    'cost_center_id', 'dbe64f5a-534a-4d2e-bf93-25a36b5fbe2d',
    'unit', 'T02 1001',
    'client_name', 'Bruno José Rosa Reis',
    'sale_date', '2026-08-31',
    'property_value', 511782.53,
    'partner_name', 'Araujo Investimentos',
    'partner_share_pct', 76.5,
    'issues_invoice', false,
    'simples_pct', 0,
    'retains_iss', false,
    'iss_pct', 0,
    'broker_id', '116f89db-990f-4547-9a8b-41ff43b9f4dc',
    'broker_pct', 50,
    'commission_total', 21911.57,
    'notes', 'Contrato Rôgga 34936, assinado em 31/08/2026. Comissão cheia de R$ 28.642,53 (5,3%), cobrada pela Webro e recebida no CNPJ da Araujo Investimentos, que emite a nota sobre o valor cheio (15% = R$ 4.296,38) e repassa 76,5% para a Souza — R$ 21.911,57, que é o valor desta venda aqui. Os 23,5% restantes (nota e fatia da Araujo) nunca passam pela conta da Souza e por isso não estão no sistema. Sem nota e sem Simples para a Souza. Parcelas iguais às do comprador: as 14 primeiras inteiras, e R$ 11.080 do balão de 25/11/2027.',
    'installments', v_itens
  ));

  select id into v_primeira from public.sale_installments where sale_id = v_venda and idx = 1;

  -- Já recebida e já repassada: o Rafael confirmou as duas coisas.
  perform public.receive_installment(v_primeira, '2026-09-01'::date, '88e08e64-c0c4-4620-98e3-00ba8e79f93f'::uuid);
  perform public.pay_broker_installments(array[v_primeira], '2026-09-01'::date, '88e08e64-c0c4-4620-98e3-00ba8e79f93f'::uuid, 0, null);

  raise notice 'venda lançada: %', v_venda;
end $$;
