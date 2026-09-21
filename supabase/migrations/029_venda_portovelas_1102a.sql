-- ===========================================================================
-- 029 — VENDA PortoVelas 1102-A (Paulo Roberto Teofilo)
-- ===========================================================================
-- Primeiro contrato lançado a partir do PDF, em 21/09/2026, com os números
-- conferidos pelo Rafael.
--
-- Do contrato (Docusign concluído em 17/09/2026):
--   · LOTISA PortoVelas SPE Ltda · Apto 1102-A + vagas 0080 e 0147
--   · imóvel R$ 964.494,25 · comissão 5% = R$ 48.224,72
--   · gatilho: 50% quando o pago atingir 5% do total; 50% ao atingir 8%
--   · a intermediação é da Souza Imobiliária (CRECI 61766)
--
-- As datas saem do cronograma de pagamento do comprador, somado parcela a
-- parcela (entrada em 4 boletos + 53 mensais de R$ 3.799,02 desde 10/10/2026
-- + reforços anuais), assumindo que ele paga tudo em dia:
--   5% (R$ 48.224,71) → 10/03/2027, acumulado R$ 51.728,96
--   8% (R$ 77.159,54) → 10/10/2027, acumulado R$ 78.322,10
--
-- Regra do Rafael: a nota sai UM DIA depois do gatilho, e a LOTISA paga em
-- 10 dias úteis contados da nota. Daí as previsões: 25/03/2027 e 25/10/2027.
--
-- Corretor: Dionata, 50% sobre a base (comissão menos ISS e Simples).
--
-- O registro passa por register_sale, a mesma função que a tela usa — nada
-- de insert à mão. Como ela exige administrador e a migração roda sem sessão,
-- o bloco assume a identidade do administrador só dentro desta transação.
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

  if exists (select 1 from public.sales where unit = '1102-A' and cost_center_id = '31237db0-1fdf-41c3-ab0c-3d94562365bb') then
    raise notice 'venda 1102-A já lançada: nada a fazer';
    return;
  end if;

  v_venda := public.register_sale(jsonb_build_object(
    'title', 'Comissão PortoVelas 1102-A — Paulo Roberto Teofilo',
    'cost_center_id', '31237db0-1fdf-41c3-ab0c-3d94562365bb',
    'unit', '1102-A',
    'client_name', 'Paulo Roberto Teofilo',
    'sale_date', '2026-09-17',
    'property_value', 964494.25,
    'commission_pct', 5,
    'commission_total', 48224.72,
    'issues_invoice', true,
    'simples_pct', 6,
    'retains_iss', true,
    'iss_pct', 3,
    'broker_id', '116f89db-990f-4547-9a8b-41ff43b9f4dc',
    'broker_pct', 50,
    'notes', 'Contrato assinado em 17/09/2026 (Docusign 23914831-CDFA-8A60-8244-C85638FC8579). Apto 1102-A + vagas 0080 e 0147. Comissão de 5% paga pela LOTISA. Datas previstas calculadas do cronograma de pagamento do comprador, com a nota emitida um dia depois do gatilho.',
    'installments', jsonb_build_array(
      jsonb_build_object(
        'idx', 1,
        'amount', 24112.36,
        'expected_date', '2027-03-25',
        'trigger_note', '50% da comissão quando o comprador atingir 5% do valor do contrato (R$ 48.224,71). Pelo cronograma, cai na mensal de 10/03/2027 (acumulado R$ 51.728,96). Nota no dia seguinte; a LOTISA paga 10 dias úteis depois.'
      ),
      jsonb_build_object(
        'idx', 2,
        'amount', 24112.36,
        'expected_date', '2027-10-25',
        'trigger_note', 'Os outros 50% ao atingir 8% do valor do contrato (R$ 77.159,54). Pelo cronograma, cai na mensal de 10/10/2027 (acumulado R$ 78.322,10). Nota no dia seguinte; a LOTISA paga 10 dias úteis depois.'
      )
    )
  ));

  raise notice 'venda lançada: %', v_venda;
end $$;
