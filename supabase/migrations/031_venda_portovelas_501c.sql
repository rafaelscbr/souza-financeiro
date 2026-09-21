-- ===========================================================================
-- 031 — VENDA PortoVelas 501-C (Antoni Arsenio Ricardo)
-- ===========================================================================
-- Segundo contrato lançado do PDF, em 21/09/2026, conferido pelo Rafael.
--
--   · LOTISA PortoVelas SPE Ltda · Apto 501-C + vaga 0074
--   · assinado em 11/09/2026 · imóvel R$ 825.298,89
--   · comissão 5% = R$ 41.264,94, em duas metades de R$ 20.632,47
--   · gatilho: 50% aos 5% pagos, 50% aos 8%
--
-- Cronograma do comprador (entrada de R$ 24.758,97 em 14/09/2026, 53 mensais
-- de R$ 3.501,69 desde 10/10/2026, reforços anuais de R$ 15.500,00):
--   5% (R$ 41.264,94) → 10/02/2027, acumulado R$ 42.267,42
--   8% (R$ 66.023,91) → 10/09/2027, acumulado R$ 66.779,25
--
-- A nota sai um dia depois do gatilho. O segundo gatilho cai numa SEXTA, e
-- "um dia depois" seria sábado: a nota foi considerada na segunda, 13/09, e
-- os 10 dias úteis da LOTISA contam de lá. O Rafael confirmou as duas datas.
--
-- Corretor: Dionata, 50% sobre a base.
-- ===========================================================================

do $$
declare
  v_venda uuid;
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub":"dfb372d6-977a-4a76-a454-fc2d260d54b6","role":"authenticated"}',
    true
  );
  if not public.is_admin() then
    raise exception 'não assumi a identidade do administrador: abortando';
  end if;
  if exists (select 1 from public.sales where unit = '501-C' and cost_center_id = '31237db0-1fdf-41c3-ab0c-3d94562365bb') then
    raise notice 'venda 501-C já lançada: nada a fazer';
    return;
  end if;

  v_venda := public.register_sale(jsonb_build_object(
    'title', 'Comissão PortoVelas 501-C — Antoni Arsenio Ricardo',
    'cost_center_id', '31237db0-1fdf-41c3-ab0c-3d94562365bb',
    'unit', '501-C',
    'client_name', 'Antoni Arsenio Ricardo',
    'sale_date', '2026-09-11',
    'property_value', 825298.89,
    'commission_pct', 5,
    'commission_total', 41264.94,
    'issues_invoice', true,
    'simples_pct', 6,
    'retains_iss', true,
    'iss_pct', 3,
    'broker_id', '116f89db-990f-4547-9a8b-41ff43b9f4dc',
    'broker_pct', 50,
    'notes', 'Contrato assinado em 11/09/2026 (Docusign). Apto 501-C + vaga 0074. Comissão de 5% paga pela LOTISA. Datas previstas calculadas do cronograma de pagamento do comprador, com a nota um dia depois do gatilho — no 2º gatilho, que cai numa sexta, a nota foi considerada na segunda seguinte.',
    'installments', jsonb_build_array(
      jsonb_build_object(
        'idx', 1,
        'amount', 20632.47,
        'expected_date', '2027-02-25',
        'trigger_note', '50% da comissão quando o comprador atingir 5% do valor do contrato (R$ 41.264,94). Pelo cronograma, cai na mensal de 10/02/2027 (acumulado R$ 42.267,42). Nota em 11/02; a LOTISA paga 10 dias úteis depois.'
      ),
      jsonb_build_object(
        'idx', 2,
        'amount', 20632.47,
        'expected_date', '2027-09-27',
        'trigger_note', 'Os outros 50% ao atingir 8% do valor do contrato (R$ 66.023,91). Pelo cronograma, cai na mensal de 10/09/2027, uma sexta (acumulado R$ 66.779,25). Nota na segunda, 13/09; a LOTISA paga 10 dias úteis depois.'
      )
    )
  ));

  raise notice 'venda lançada: %', v_venda;
end $$;
