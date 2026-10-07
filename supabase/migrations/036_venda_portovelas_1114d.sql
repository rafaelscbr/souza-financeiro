-- ===========================================================================
-- 036 — VENDA PortoVelas 1114-D (Caroline Gomes Pierim)
-- ===========================================================================
-- Lançada do PDF em 06/10/2026, conferida pelo Rafael.
--
--   · LOTISA PortoVelas SPE Ltda · Apto 1114-D + vaga 0014
--   · quadro resumo de 30/09/2026, assinado por todos em 02/10/2026
--   · imóvel R$ 721.094,48
--   · comissão 5% = R$ 36.054,72, em duas metades de R$ 18.027,36
--   · gatilho: 50% aos 5% pagos, 50% aos 8%
--
-- Cronograma da compradora (entrada de R$ 40.381,29 até 06/10/2026, 52
-- mensais de R$ 1.463,77 desde 10/11/2026, reforços anuais a partir de
-- 10/12/2027):
--   5% (R$ 36.054,72) → a própria entrada, paga em 06/10/2026
--   8% (R$ 57.687,56) → 12ª mensal, 10/10/2027, acumulado R$ 57.946,53
--
-- O primeiro gatilho já bateu: a entrada foi paga em 06/10/2026 e o Rafael
-- emite a nota em 07/10. O segundo cai num domingo; a nota foi considerada
-- na segunda, 11/10. Os 10 dias úteis seguem add_business_days, que não pula
-- feriado — o de 12/10 pode empurrar o pagamento real em um dia.
--
-- Corretor: Dionata, 65% sobre a base (decisão do Rafael para esta venda).
-- ===========================================================================

do $$
declare
  v_venda uuid;
  v_pc1   uuid;
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub":"dfb372d6-977a-4a76-a454-fc2d260d54b6","role":"authenticated"}',
    true
  );
  if not public.is_admin() then
    raise exception 'não assumi a identidade do administrador: abortando';
  end if;
  if exists (select 1 from public.sales where unit = '1114-D' and cost_center_id = '31237db0-1fdf-41c3-ab0c-3d94562365bb') then
    raise notice 'venda 1114-D já lançada: nada a fazer';
    return;
  end if;

  v_venda := public.register_sale(jsonb_build_object(
    'title', 'Comissão PortoVelas 1114-D — Caroline Gomes Pierim',
    'cost_center_id', '31237db0-1fdf-41c3-ab0c-3d94562365bb',
    'unit', '1114-D',
    'client_name', 'Caroline Gomes Pierim',
    'sale_date', '2026-10-02',
    'property_value', 721094.48,
    'commission_pct', 5,
    'commission_total', 36054.72,
    'issues_invoice', true,
    'simples_pct', 6,
    'retains_iss', true,
    'iss_pct', 3,
    'broker_id', '116f89db-990f-4547-9a8b-41ff43b9f4dc',
    'broker_pct', 65,
    'notes', 'Contrato assinado em 02/10/2026 (Docusign BD7D565F-6C2F-8AE7-80DF-2DDD0C78376F; quadro resumo de 30/09/2026). Apto 1114-D + vaga 0014. Comissão de 5% paga pela LOTISA. Dionata com 65% nesta venda. Datas previstas calculadas do cronograma de pagamento da compradora, com a nota um dia depois do gatilho.',
    'installments', jsonb_build_array(
      jsonb_build_object(
        'idx', 1,
        'amount', 18027.36,
        'expected_date', '2026-10-21',
        'trigger_note', '50% da comissão quando a compradora atingir 5% do valor do contrato (R$ 36.054,72). A entrada de R$ 40.381,29, paga em 06/10/2026, já passa dos 5%. Nota em 07/10; a LOTISA paga 10 dias úteis depois.'
      ),
      jsonb_build_object(
        'idx', 2,
        'amount', 18027.36,
        'expected_date', '2027-10-25',
        'trigger_note', 'Os outros 50% ao atingir 8% do valor do contrato (R$ 57.687,56). Pelo cronograma, cai na mensal de 10/10/2027, um domingo (acumulado R$ 57.946,53). Nota na segunda, 11/10; a LOTISA paga 10 dias úteis depois.'
      )
    )
  ));

  select id into v_pc1 from public.sale_installments where sale_id = v_venda and idx = 1;
  perform public.set_installment_trigger(v_pc1, '2026-10-06');

  raise notice 'venda lançada: %', v_venda;
end $$;
