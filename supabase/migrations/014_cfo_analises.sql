-- ===========================================================================
-- 014 — AS ANÁLISES DO CFO: DRE, fluxo de 13 semanas, recebíveis, pagáveis e despesas
-- ===========================================================================
-- O RAZÃO É A FONTE ÚNICA DO FLUXO. Toda parcela de venda tem um lançamento
-- espelho em transactions; conferido em 12/09/2026: 12 parcelas previstas =
-- 12 lançamentos de receita pendentes = R$ 59.560,05 nos dois lados. Somar
-- parcela e lançamento contaria duas vezes.
--
-- O DRE REPLICA computeKpis de src/lib/finance.ts: imposto é dedução da
-- receita e não despesa; pró-labore é despesa operacional e entra antes do
-- lucro; distribuição de lucro sai depois do lucro líquido; e o imposto
-- LANÇADO manda sobre a alíquota configurada, para os dois não se somarem.
--
-- Exportado de produção com pg_get_functiondef em 12/09/2026. Este arquivo
-- substitui a primeira versão escrita à mão, que tinha ficado diferente do
-- banco depois de dois ajustes aplicados direto.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.cfo_dre(p_de date DEFAULT NULL::date, p_ate date DEFAULT NULL::date, p_regime text DEFAULT 'accrual'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_empresa uuid := public.cfo_empresa();
  v_de date := coalesce(p_de, date_trunc('month', current_date)::date);
  v_ate date := coalesce(p_ate, (date_trunc('month', current_date) + interval '1 month - 1 day')::date);
  v_regime text := case when p_regime in ('cash','accrual') then p_regime else 'accrual' end;
  v_aliquota numeric;
  k record;
  v_imposto numeric;
  v_receita_liq numeric;
  v_lucro_bruto numeric;
  v_estrutura numeric;
  v_ebitda numeric;
begin
  perform public.cfo_exige_admin();
  select tax_rate into v_aliquota from companies where id = v_empresa;

  select
    coalesce(sum(t.amount) filter (where g = 'revenue'), 0) as receita,
    coalesce(sum(t.amount) filter (where g = 'tax'), 0) as imposto_lancado,
    coalesce(sum(t.amount) filter (where g = 'cost_of_sale'), 0) as custo,
    coalesce(sum(t.amount) filter (where g = 'operating_expense'), 0) as operacional,
    coalesce(sum(t.amount) filter (where g = 'variable_expense'), 0) as variavel,
    coalesce(sum(t.amount) filter (where g = 'withdrawal'), 0) as distribuicao,
    coalesce(sum(t.amount) filter (where g = 'revenue' and t.status = 'settled'), 0) as recebido,
    coalesce(sum(t.amount) filter (where g = 'revenue' and t.status <> 'settled'), 0) as a_receber,
    coalesce(sum(t.amount) filter (where g <> 'revenue' and g <> 'withdrawal' and t.status = 'settled'), 0) as pago,
    coalesce(sum(t.amount) filter (where g <> 'revenue' and g <> 'withdrawal' and t.status <> 'settled'), 0) as a_pagar,
    count(*) as linhas
  into k
  from (
    select t.*, public.cfo_grupo_dre(t.category, t.dre_group, t.kind) as g
    from transactions t where t.company_id = v_empresa
  ) t
  where public.cfo_data_regime(t.card_cycle_month, t.competence_date, t.settled_date, t.status, v_regime)
        between v_de and v_ate;

  v_imposto := case when k.imposto_lancado > 0 then round(k.imposto_lancado, 2)
                    when v_aliquota is not null then round(k.receita * v_aliquota / 100, 2)
                    else 0 end;
  v_receita_liq := k.receita - v_imposto;
  v_lucro_bruto := v_receita_liq - k.custo;
  v_estrutura   := k.operacional + k.variavel;
  v_ebitda      := v_lucro_bruto - v_estrutura;

  return jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_dre', 'consultado_em', now(),
      'de', v_de, 'ate', v_ate, 'regime', v_regime,
      'regime_explicado', case when v_regime = 'accrual'
        then 'Competência: o lançamento conta no mês do fato gerador, pago ou não.'
        else 'Caixa: só conta o que efetivamente entrou ou saiu. Pendente não aparece.' end,
      'linhas_consideradas', k.linhas,
      'imposto_configurado', (k.imposto_lancado > 0 or v_aliquota is not null),
      'premissas', jsonb_build_array(
        'Imposto é DEDUÇÃO da receita, não despesa.',
        'Pró-labore é despesa operacional e entra antes do lucro.',
        'Distribuição de lucro sai DEPOIS do lucro líquido e não é despesa.',
        'Sem empréstimo modelado, o resultado operacional é o próprio lucro líquido.'
      )
    ),
    'receita_bruta', round(k.receita, 2),
    'imposto', round(v_imposto, 2),
    'receita_liquida', round(v_receita_liq, 2),
    'custo_dos_servicos', round(k.custo, 2),
    'lucro_bruto', round(v_lucro_bruto, 2),
    'margem_bruta', case when v_receita_liq > 0 then round(v_lucro_bruto / v_receita_liq, 4) else null end,
    'despesa_operacional', round(k.operacional, 2),
    'despesa_variavel', round(k.variavel, 2),
    'estrutura_total', round(v_estrutura, 2),
    'ebitda', round(v_ebitda, 2),
    'margem_ebitda', case when k.receita > 0 then round(v_ebitda / k.receita, 4) else null end,
    'lucro_liquido', round(v_ebitda, 2),
    'margem_liquida', case when k.receita > 0 then round(v_ebitda / k.receita, 4) else null end,
    'distribuicao_de_lucro', round(k.distribuicao, 2),
    'lucro_retido', round(v_ebitda - k.distribuicao, 2),
    'caixa_do_periodo', jsonb_build_object(
      'recebido', round(k.recebido, 2), 'a_receber', round(k.a_receber, 2),
      'pago', round(k.pago, 2), 'a_pagar', round(k.a_pagar, 2)
    )
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.cfo_fluxo_semanal(p_semanas integer DEFAULT 13, p_reserva numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_empresa uuid := public.cfo_empresa();
  v_hoje date := current_date;
  v_n integer := least(greatest(coalesce(p_semanas, 13), 1), 52);
  v_saldo numeric := ((public.cfo_posicao() -> 'caixa') ->> 'disponivel')::numeric;
  v_semanas jsonb;
begin
  perform public.cfo_exige_admin();

  with semanas as (
    select gs as n,
           (v_hoje + (gs - 1) * 7)::date as inicio,
           (v_hoje + gs * 7 - 1)::date as fim
    from generate_series(1, v_n) gs
  ),
  mov as (
    select s.n, s.inicio, s.fim,
      coalesce(sum(t.amount) filter (where public.cfo_grupo_dre(t.category, t.dre_group, t.kind) = 'revenue'), 0) as entra,
      coalesce(sum(t.amount) filter (where public.cfo_grupo_dre(t.category, t.dre_group, t.kind) <> 'revenue'), 0) as sai,
      count(t.id) as linhas
    from semanas s
    left join transactions t
      on t.company_id = v_empresa and t.status = 'pending'
     and coalesce(t.due_date, t.competence_date) between s.inicio and s.fim
    group by s.n, s.inicio, s.fim
  ),
  acum as (
    select n, inicio, fim, entra, sai, linhas,
           v_saldo + sum(entra - sai) over (order by n rows between unbounded preceding and current row) as saldo
    from mov
  )
  select jsonb_agg(jsonb_build_object(
           'semana', n, 'inicio', inicio, 'fim', fim,
           'entra', round(entra, 2), 'sai', round(sai, 2),
           'liquido', round(entra - sai, 2),
           'saldo_projetado', round(saldo, 2),
           'linhas', linhas
         ) order by n)
    into v_semanas from acum;

  return jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_fluxo_semanal', 'consultado_em', now(),
      'de', v_hoje, 'ate', v_hoje + v_n * 7 - 1, 'semanas', v_n,
      'saldo_inicial', round(v_saldo, 2), 'reserva_alvo', round(coalesce(p_reserva, 0), 2),
      'premissas', jsonb_build_array(
        'Só entra o que está CONTRATADO e lançado como pendente. Nenhuma estimativa comercial.',
        'A data usada é o vencimento previsto (due_date), com competência como reserva.',
        'Previsão de recebimento não é garantia: a construtora pode atrasar, e já atrasou.',
        'Transferência entre contas próprias não aparece: não é entrada nem saída.'
      )
    ),
    'semanas', coalesce(v_semanas, '[]'::jsonb),
    'alerta', (
      select case when count(*) = 0 then null else jsonb_build_object(
        'primeira_semana_abaixo', min((e->>'semana')::int),
        'quantas_semanas_abaixo_da_reserva', count(*),
        'menor_saldo', min((e->>'saldo_projetado')::numeric)
      ) end
      from jsonb_array_elements(coalesce(v_semanas, '[]'::jsonb)) e
      where (e->>'saldo_projetado')::numeric < coalesce(p_reserva, 0)
    )
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.cfo_recebiveis(p_de date DEFAULT NULL::date, p_ate date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_empresa uuid := public.cfo_empresa();
  v_hoje date := current_date;
begin
  perform public.cfo_exige_admin();
  return jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_recebiveis', 'consultado_em', now(),
      'de', p_de, 'ate', p_ate, 'referencia', v_hoje,
      'premissas', jsonb_build_array(
        'Valor BRUTO da parcela da comissão. Dele ainda saem ISS, Simples e a comissão do corretor.',
        'Vencido aqui significa que a CONSTRUTORA atrasou, não que o cliente deve.',
        'Lista limitada a 500 linhas.'
      )
    ),
    'total', (select coalesce(round(sum(t.amount), 2), 0) from transactions t
              where t.company_id = v_empresa and t.kind = 'income' and t.status = 'pending'
                and (p_de is null or coalesce(t.due_date, t.competence_date) >= p_de)
                and (p_ate is null or coalesce(t.due_date, t.competence_date) <= p_ate)),
    'vencido', (select coalesce(round(sum(t.amount), 2), 0) from transactions t
                where t.company_id = v_empresa and t.kind = 'income' and t.status = 'pending'
                  and coalesce(t.due_date, t.competence_date) < v_hoje),
    'itens', (
      select coalesce(jsonb_agg(x order by x->>'vence'), '[]'::jsonb) from (
        select jsonb_build_object(
          'id', t.id, 'descricao', t.description, 'valor', round(t.amount, 2),
          'vence', coalesce(t.due_date, t.competence_date),
          'dias_de_atraso', greatest(0, v_hoje - coalesce(t.due_date, t.competence_date)),
          'venda', s.title, 'venda_id', s.id,
          'empreendimento', cc.name,
          'parcela', case when i.count > 1 then i.idx || '/' || i.count else null end,
          'situacao_da_parcela', i.status
        ) as x
        from transactions t
        left join sale_installments i on i.id = t.sale_installment_id
        left join sales s on s.id = coalesce(t.sale_id, i.sale_id)
        left join cost_centers cc on cc.id = coalesce(t.cost_center_id, s.cost_center_id)
        where t.company_id = v_empresa and t.kind = 'income' and t.status = 'pending'
          and (p_de is null or coalesce(t.due_date, t.competence_date) >= p_de)
          and (p_ate is null or coalesce(t.due_date, t.competence_date) <= p_ate)
        limit 500
      ) y
    )
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.cfo_pagaveis(p_de date DEFAULT NULL::date, p_ate date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_empresa uuid := public.cfo_empresa();
  v_hoje date := current_date;
begin
  perform public.cfo_exige_admin();
  return jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_pagaveis', 'consultado_em', now(),
      'de', p_de, 'ate', p_ate, 'referencia', v_hoje,
      'premissas', jsonb_build_array(
        'DEVIDO é o que não depende de parcela, ou cuja parcela já foi recebida.',
        'PREVISTO só vira obrigação quando a construtora pagar a parcela. Não somar os dois.',
        'ISS retido na fonte é descontado pela construtora no ato: nunca sai do caixa da imobiliária.',
        'Lista limitada a 500 linhas.'
      )
    ),
    'devido_agora', (select coalesce(round(sum(t.amount), 2), 0)
      from transactions t left join sale_installments i on i.id = t.sale_installment_id
      where t.company_id = v_empresa and t.kind <> 'income' and t.status = 'pending'
        and (t.sale_installment_id is null or i.status = 'recebida')),
    'previsto', (select coalesce(round(sum(t.amount), 2), 0)
      from transactions t join sale_installments i on i.id = t.sale_installment_id
      where t.company_id = v_empresa and t.kind <> 'income' and t.status = 'pending'
        and i.status = 'prevista'),
    'itens', (
      select coalesce(jsonb_agg(x order by x->>'vence'), '[]'::jsonb) from (
        select jsonb_build_object(
          'id', t.id, 'descricao', t.description, 'categoria', t.category,
          'grupo_dre', public.cfo_grupo_dre(t.category, t.dre_group, t.kind),
          'valor', round(t.amount, 2),
          'vence', coalesce(t.due_date, t.competence_date),
          'dias_de_atraso', greatest(0, v_hoje - coalesce(t.due_date, t.competence_date)),
          'e_obrigacao_hoje', (t.sale_installment_id is null or i.status = 'recebida'),
          'iss_retido_na_fonte', (t.description ~* '^ISS'),
          'venda', s.title, 'venda_id', s.id,
          'contraparte', coalesce(ct.name, t.counterparty)
        ) as x
        from transactions t
        left join sale_installments i on i.id = t.sale_installment_id
        left join sales s on s.id = coalesce(t.sale_id, i.sale_id)
        left join contacts ct on ct.id = t.contact_id
        where t.company_id = v_empresa and t.kind <> 'income' and t.status = 'pending'
          and (p_de is null or coalesce(t.due_date, t.competence_date) >= p_de)
          and (p_ate is null or coalesce(t.due_date, t.competence_date) <= p_ate)
        limit 500
      ) y
    )
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.cfo_despesas(p_de date DEFAULT NULL::date, p_ate date DEFAULT NULL::date, p_regime text DEFAULT 'accrual'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_empresa uuid := public.cfo_empresa();
  v_de date := coalesce(p_de, (date_trunc('month', current_date) - interval '5 months')::date);
  v_ate date := coalesce(p_ate, (date_trunc('month', current_date) + interval '1 month - 1 day')::date);
  v_regime text := case when p_regime in ('cash','accrual') then p_regime else 'accrual' end;
  v_meses numeric;
begin
  perform public.cfo_exige_admin();
  v_meses := greatest(1, (extract(year from age(v_ate, v_de)) * 12 + extract(month from age(v_ate, v_de)) + 1));

  return jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_despesas', 'consultado_em', now(),
      'de', v_de, 'ate', v_ate, 'regime', v_regime, 'meses_no_periodo', v_meses,
      'premissas', jsonb_build_array(
        'FIXA (operating_expense) é o que se repete independentemente de venda: aluguel, salário, pró-labore, contabilidade, ferramentas, internet.',
        'CUSTO DOS SERVIÇOS (cost_of_sale) é a comissão do corretor: só existe porque houve venda.',
        'Imposto não entra como despesa: é dedução da receita.',
        'Média mensal = total do período dividido pelos meses do período.'
      )
    ),
    'por_grupo', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'grupo', g, 'total', round(total, 2), 'media_mensal', round(total / v_meses, 2), 'linhas', linhas
      ) order by total desc), '[]'::jsonb)
      from (
        select public.cfo_grupo_dre(t.category, t.dre_group, t.kind) as g,
               sum(t.amount) as total, count(*) as linhas
        from transactions t
        where t.company_id = v_empresa and t.kind <> 'income'
          and public.cfo_data_regime(t.card_cycle_month, t.competence_date, t.settled_date, t.status, v_regime)
              between v_de and v_ate
        group by 1
      ) a
    ),
    'por_categoria', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'categoria', categoria, 'grupo', g, 'total', round(total, 2),
        'media_mensal', round(total / v_meses, 2), 'linhas', linhas, 'recorrente', recorrente
      ) order by total desc), '[]'::jsonb)
      from (
        select t.category as categoria,
               public.cfo_grupo_dre(t.category, t.dre_group, t.kind) as g,
               sum(t.amount) as total, count(*) as linhas,
               bool_or(t.is_recurring) as recorrente
        from transactions t
        where t.company_id = v_empresa and t.kind <> 'income'
          and public.cfo_data_regime(t.card_cycle_month, t.competence_date, t.settled_date, t.status, v_regime)
              between v_de and v_ate
        group by 1, 2
        limit 100
      ) b
    ),
    'custo_fixo_mensal_estimado', (
      select coalesce(round(sum(t.amount) / v_meses, 2), 0)
      from transactions t
      where t.company_id = v_empresa and t.kind <> 'income'
        and public.cfo_grupo_dre(t.category, t.dre_group, t.kind) = 'operating_expense'
        and public.cfo_data_regime(t.card_cycle_month, t.competence_date, t.settled_date, t.status, v_regime)
            between v_de and v_ate
    )
  );
end $function$
;

-- ---------------------------------------------------------------------------
-- Permissão: só a chave de serviço executa (ver 017). Função nova nasce com
-- EXECUTE para PUBLIC, então cada migração que cria função precisa disto.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array['cfo_dre', 'cfo_fluxo_semanal', 'cfo_recebiveis', 'cfo_pagaveis', 'cfo_despesas'])
  loop
    execute format('revoke all on function public.%I(%s) from public, anon, authenticated', r.proname, r.args);
    execute format('grant execute on function public.%I(%s) to service_role', r.proname, r.args);
  end loop;
end $$;
