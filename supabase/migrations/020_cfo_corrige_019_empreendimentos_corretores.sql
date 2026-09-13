-- ===========================================================================
-- 020 — CORRIGE A 019 E ACRESCENTA EMPREENDIMENTOS E CORRETORES
-- ===========================================================================
-- 1. LÓGICA DE TRÊS VALORES. A 019 escreveu (t.kind = 'income' or i.status =
--    'prevista') para saber se um lançamento depende de recebimento. Em
--    lançamento sem parcela, i.status é nulo, e false or null dá null. Na
--    prática: no fluxo, conta vencida sem parcela ficava fora da semana 1 (a
--    semana 1 mostrava R$ 1.154,58 de saída quando havia R$ 2.076,98 vencidos);
--    e na simulação, despesa comum atrasava junto com o recebimento da
--    construtora no cenário conservador. Achado testando a 019 contra os
--    dados, antes de ligar no CLI. Correção: coalesce(i.status = 'prevista', false).
--
-- 2. DINHEIRO EM PORTUGUÊS NOS ALERTAS. to_char com G e D segue o locale do
--    servidor, que é americano: saía "R$ 4,064.66". cfo_brl_numero formata
--    sempre "4.064,66".
--
-- 3. cfo_empreendimentos e cfo_corretores: o CLI já anunciava os dois
--    comandos e as funções não existiam.
--
-- As correções 1 e 2 reescrevem a definição que está no banco e confirmam que
-- o trecho foi encontrado. Se a função já estiver corrigida (restauração a
-- partir dos arquivos, onde a 019 já vem certa), nada é feito.
-- ===========================================================================

create or replace function public.cfo_brl_numero(v numeric) returns text
language sql immutable set search_path = public, pg_temp as $$
  select case when v < 0 then '-' else '' end
      || translate(to_char(abs(round(v, 2)), 'FM999,999,999,990.00'), ',.', '.,');
$$;

do $$
declare
  d text;
  fn text;
  antigo constant text := '(t.kind = ''income'' or i.status = ''prevista'')';
  novo constant text := '(t.kind = ''income'' or coalesce(i.status = ''prevista'', false))';
  mascara constant text := '''FM999G999G990D00''';
begin
  foreach fn in array array['public.cfo_fluxo_semanal(integer,numeric)', 'public.cfo_simular(jsonb)'] loop
    d := pg_get_functiondef(fn::regprocedure);
    if position(antigo in d) = 0 then
      if position(novo in d) = 0 then
        raise exception '%: o trecho a corrigir não foi encontrado', fn;
      end if;
      continue;
    end if;
    execute replace(d, antigo, novo);
  end loop;

  d := pg_get_functiondef('public.cfo_alertas(jsonb)'::regprocedure);
  if position(mascara in d) > 0 then
    d := replace(d, 'to_char(v_caixa, ''FM999G999G990D00'')', 'public.cfo_brl_numero(v_caixa)');
    d := replace(d, 'to_char(v_reserva, ''FM999G999G990D00'')', 'public.cfo_brl_numero(v_reserva)');
    d := replace(d, 'to_char((v_fluxo->''alerta''->>''menor_saldo'')::numeric, ''FM999G999G990D00'')',
                    'public.cfo_brl_numero((v_fluxo->''alerta''->>''menor_saldo'')::numeric)');
    d := replace(d, 'to_char(v_total, ''FM999G999G990D00'')', 'public.cfo_brl_numero(v_total)');
    if position(mascara in d) > 0 then
      raise exception 'cfo_alertas: sobrou número no formato americano';
    end if;
    execute d;
  end if;
end $$;

create or replace function public.cfo_empreendimentos(p_de date default null, p_ate date default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_empresa uuid := public.cfo_empresa();
begin
  perform public.cfo_exige_admin();
  return jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_empreendimentos', 'consultado_em', now(), 'de', p_de, 'ate', p_ate,
      'premissas', jsonb_build_array(
        'Vendas entram pela data da venda dentro do período; sem período, todas.',
        'Fica para a imobiliária = parcelas não canceladas menos ISS, Simples, comissão do corretor (já com desconto) e fatia do sócio.',
        'Despesa direta = saída com o centro de custo do empreendimento, por competência no período. Imposto e comissão ficam de fora porque já saíram no "fica para a imobiliária".',
        'Despesa sem centro de custo não é rateada entre empreendimentos: aparece à parte.',
        'VGV não é receita.'
      )
    ),
    'despesa_sem_empreendimento', jsonb_build_object(
      'total', (
        select coalesce(round(sum(t.amount), 2), 0) from transactions t
        where t.company_id = v_empresa and t.kind <> 'income' and t.cost_center_id is null
          and public.cfo_grupo_dre(t.category, t.dre_group, t.kind) not in ('tax', 'cost_of_sale', 'withdrawal')
          and (p_de is null or t.competence_date >= p_de) and (p_ate is null or t.competence_date <= p_ate)
      ),
      'aviso', 'Esta despesa não entra no resultado de nenhum empreendimento.'
    ),
    'empreendimentos', (
      select coalesce(jsonb_agg(y.x order by (y.x->>'fica_para_a_imobiliaria')::numeric desc nulls last), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', cc.id, 'empreendimento', cc.name, 'construtora', cc.developer, 'ativo', cc.is_active,
          'vendas', v.vendas, 'vgv_informado', v.vgv, 'vendas_sem_vgv', v.sem_vgv,
          'comissao_contratada', v.comissao,
          'recebido', p.recebido, 'a_receber', p.a_receber,
          'impostos', p.impostos, 'comissao_do_corretor', p.corretor,
          'fica_para_a_imobiliaria', p.fica,
          'despesa_direta', d.despesa,
          'resultado_direto', round(p.fica - d.despesa, 2)
        ) as x
        from cost_centers cc
        cross join lateral (
          select count(*) as vendas,
                 coalesce(round(sum(s.property_value), 2), 0) as vgv,
                 count(*) filter (where s.property_value is null) as sem_vgv,
                 coalesce(round(sum(s.commission_total), 2), 0) as comissao
          from sales s
          where s.cost_center_id = cc.id and s.company_id = v_empresa and s.status <> 'cancelada'
            and (p_de is null or s.sale_date >= p_de) and (p_ate is null or s.sale_date <= p_ate)
        ) v
        cross join lateral (
          select coalesce(round(sum(i.amount) filter (where i.status = 'recebida'), 2), 0) as recebido,
                 coalesce(round(sum(i.amount) filter (where i.status = 'prevista'), 2), 0) as a_receber,
                 coalesce(round(sum(i.iss_amount + i.simples_amount), 2), 0) as impostos,
                 coalesce(round(sum(i.broker_amount - i.broker_adjustment), 2), 0) as corretor,
                 coalesce(round(sum(i.amount - i.iss_amount - i.simples_amount
                                    - (i.broker_amount - i.broker_adjustment) - i.owner_amount), 2), 0) as fica
          from sales s
          join sale_installments i on i.sale_id = s.id
          where s.cost_center_id = cc.id and s.company_id = v_empresa
            and s.status <> 'cancelada' and i.status <> 'cancelada'
            and (p_de is null or s.sale_date >= p_de) and (p_ate is null or s.sale_date <= p_ate)
        ) p
        cross join lateral (
          select coalesce(round(sum(t.amount), 2), 0) as despesa
          from transactions t
          where t.company_id = v_empresa and t.cost_center_id = cc.id and t.kind <> 'income'
            and public.cfo_grupo_dre(t.category, t.dre_group, t.kind) not in ('tax', 'cost_of_sale', 'withdrawal')
            and (p_de is null or t.competence_date >= p_de) and (p_ate is null or t.competence_date <= p_ate)
        ) d
        where cc.company_id = v_empresa
      ) y
    )
  );
end $$;

create or replace function public.cfo_corretores(p_de date default null, p_ate date default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_empresa uuid := public.cfo_empresa();
begin
  perform public.cfo_exige_admin();
  return jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_corretores', 'consultado_em', now(), 'de', p_de, 'ate', p_ate,
      'premissas', jsonb_build_array(
        'Comissão do corretor já com o desconto combinado.',
        'Paga = a imobiliária recebeu a parcela e o repasse foi liquidado.',
        'Liberada a pagar = a imobiliária recebeu a parcela e o repasse está pendente.',
        'Prevista = a construtora ainda não pagou a parcela. Não é dívida.',
        'Vendas pela data da venda dentro do período; sem período, todas.'
      )
    ),
    'corretores', (
      select coalesce(jsonb_agg(y.x order by (y.x->>'comissao_total')::numeric desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', ct.id, 'corretor', ct.name, 'ativo', ct.is_active, 'percentual_padrao', ct.default_broker_pct,
          'vendas', v.vendas, 'vgv_informado', v.vgv,
          'comissao_total', p.total, 'paga', p.paga, 'liberada_a_pagar', p.liberada, 'prevista', p.prevista,
          'dias_da_liberada_mais_antiga', p.dias_lib
        ) as x
        from contacts ct
        cross join lateral (
          select count(*) as vendas, coalesce(round(sum(s.property_value), 2), 0) as vgv
          from sales s
          where s.broker_id = ct.id and s.company_id = v_empresa and s.status <> 'cancelada'
            and (p_de is null or s.sale_date >= p_de) and (p_ate is null or s.sale_date <= p_ate)
        ) v
        cross join lateral (
          select coalesce(round(sum(i.broker_amount - i.broker_adjustment), 2), 0) as total,
                 coalesce(round(sum(i.broker_amount - i.broker_adjustment)
                                filter (where i.status = 'recebida' and bt.status = 'settled'), 2), 0) as paga,
                 coalesce(round(sum(i.broker_amount - i.broker_adjustment)
                                filter (where i.status = 'recebida' and coalesce(bt.status, 'pending') <> 'settled'), 2), 0) as liberada,
                 coalesce(round(sum(i.broker_amount - i.broker_adjustment)
                                filter (where i.status = 'prevista'), 2), 0) as prevista,
                 max(current_date - i.received_date)
                   filter (where i.status = 'recebida' and coalesce(bt.status, 'pending') <> 'settled'
                                 and i.broker_amount - i.broker_adjustment > 0) as dias_lib
          from sales s
          join sale_installments i on i.sale_id = s.id
          left join transactions bt on bt.id = i.broker_tx_id
          where s.broker_id = ct.id and s.company_id = v_empresa
            and s.status <> 'cancelada' and i.status <> 'cancelada'
            and (p_de is null or s.sale_date >= p_de) and (p_ate is null or s.sale_date <= p_ate)
        ) p
        where ct.type = 'broker'
           or exists (select 1 from sales s where s.broker_id = ct.id and s.company_id = v_empresa)
      ) y
    )
  );
end $$;

do $$
declare r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array['cfo_brl_numero', 'cfo_empreendimentos', 'cfo_corretores'])
  loop
    execute format('revoke all on function public.%I(%s) from public, anon, authenticated', r.proname, r.args);
    execute format('grant execute on function public.%I(%s) to service_role', r.proname, r.args);
  end loop;
end $$;
