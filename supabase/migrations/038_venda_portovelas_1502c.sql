-- ===========================================================================
-- 038 — VENDA PortoVelas 1502-C (Rennan Pelaes Caldas dos Reis)
-- ===========================================================================
-- Lançada do PDF (quadro resumo) em 19/10/2026, a pedido do Rafael.
-- Gravada pelo scripts/lanca-venda-1502c.mjs (o conector do Supabase tinha
-- perdido o acesso ao projeto); este arquivo fica como registro e não
-- duplica se for aplicado: sai sem fazer nada quando a 1502-C já existe.
--
--   · LOTISA PortoVelas SPE Ltda · Apto 1502-C + vagas 71 e 163
--   · quadro resumo de 13/10/2026
--   · imóvel R$ 908.290,56
--   · comissão 5% = R$ 45.414,53, em duas metades (22.707,27 + 22.707,26)
--   · gatilho: 50% aos 5% pagos, 50% aos 8%
--
-- Cronograma do comprador: entrada de R$ 27.248,73 em três boletos de
-- R$ 9.082,91 (assinatura, 15/11/2026 e 15/12/2026), 52 mensais de
-- R$ 2.067,06 desde 15/11/2026, intermediárias de 30 mil (15/12/2027),
-- 35 mil (2028), 50 mil (2029) e 50 mil (2030), saldo na entrega.
--   5% (R$ 45.414,53) → 9ª mensal, 15/07/2027, acumulado R$ 45.852,27
--   8% (R$ 72.663,24) → 14ª mensal + intermediária, 15/12/2027,
--                        acumulado R$ 86.187,57
-- Nota no dia seguinte ao gatilho; a LOTISA paga 10 dias úteis depois
-- (add_business_days, que não pula feriado).
--
-- Corretor: Dionata, 50% sobre a base (a regra padrão).
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
  if exists (select 1 from public.sales where unit = '1502-C' and cost_center_id = '31237db0-1fdf-41c3-ab0c-3d94562365bb') then
    raise notice 'venda 1502-C já lançada: nada a fazer';
    return;
  end if;

  v_venda := public.register_sale(jsonb_build_object(
    'title', 'Comissão PortoVelas 1502-C — Rennan Pelaes Caldas dos Reis',
    'cost_center_id', '31237db0-1fdf-41c3-ab0c-3d94562365bb',
    'unit', '1502-C',
    'client_name', 'Rennan Pelaes Caldas dos Reis / Cleyce Caroline Lira dos Reis Pelaes',
    'sale_date', '2026-10-13',
    'property_value', 908290.56,
    'commission_pct', 5,
    'commission_total', 45414.53,
    'issues_invoice', true,
    'simples_pct', 6,
    'retains_iss', true,
    'iss_pct', 3,
    'broker_id', '116f89db-990f-4547-9a8b-41ff43b9f4dc',
    'broker_pct', 50,
    'notes', 'Quadro resumo de 13/10/2026. Apto 1502-C + vagas 71 e 163. Comissão de 5% paga pela LOTISA. Dionata com 50%. Datas previstas calculadas do cronograma de pagamento do comprador, com a nota emitida um dia depois do gatilho.',
    'installments', jsonb_build_array(
      jsonb_build_object(
        'idx', 1,
        'amount', 22707.27,
        'expected_date', (public.add_business_days('2027-07-16'::date, 10))::text,
        'trigger_note', '50% da comissão quando o comprador atingir 5% do valor do contrato (R$ 45.414,53). Pelo cronograma, cai na mensal de 15/07/2027 (acumulado R$ 45.852,27). Nota em 16/07; a LOTISA paga 10 dias úteis depois.'
      ),
      jsonb_build_object(
        'idx', 2,
        'amount', 22707.26,
        'expected_date', (public.add_business_days('2027-12-16'::date, 10))::text,
        'trigger_note', 'Os outros 50% ao atingir 8% do valor do contrato (R$ 72.663,24). Pelo cronograma, cai em 15/12/2027, com a mensal e a intermediária de R$ 30.000 (acumulado R$ 86.187,57). Nota em 16/12; a LOTISA paga 10 dias úteis depois.'
      )
    )
  ));

  raise notice 'venda lançada: %', v_venda;
end $$;
