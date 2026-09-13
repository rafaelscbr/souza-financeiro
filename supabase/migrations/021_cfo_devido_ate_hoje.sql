-- ===========================================================================
-- 021 — "DEVIDO AGORA" É SÓ O QUE VENCE ATÉ HOJE
-- ===========================================================================
-- Decisão do Rafael em 13/09/2026. Antes, devido agora somava toda despesa
-- lançada, qualquer que fosse o vencimento, e a retirada do sócio. Agora:
--
--   devido agora = comissão e imposto de parcela que a construtora JÁ pagou
--                  + despesa vencida ou que vence hoje
--   a vencer     = despesa (sem parcela) com vencimento depois de hoje
--   retirada do sócio pendente = fora do devido, em número próprio
--   previsto     = continua igual (depende de a construtora pagar)
--
-- Conjuntos novos em cfo_lancamentos: a_vencer, a_pagar (devido + a vencer,
-- usado pelos alertas de vencimento) e retirada_pendente.
--
-- O app aplica a mesma regra em src/lib/sales.ts (MoneyItem.grupo). Na mesma
-- revisão a auditoria achou o app com R$ 9.363,69 de devido contra R$ 5.676,88
-- do motor: o app contava imposto de parcela futura como liberado.
--
-- As funções são reescritas a partir da definição que está no banco, com
-- conferência de cada trecho; se já estiverem na forma nova, nada é feito.
-- ===========================================================================

create or replace function pg_temp.ocorrencias(t text, a text) returns int
language sql immutable as $$ select (length(t) - length(replace(t, a, ''))) / greatest(length(a), 1) $$;

do $mig$
declare
  d text;
  velho_t constant text := '(t.sale_installment_id is null or i.status = ''recebida'')';
  novo_t constant text := '(t.kind = ''expense'' and ((t.sale_installment_id is not null and i.status = ''recebida'') or (t.sale_installment_id is null and coalesce(t.due_date, t.competence_date) <= v_hoje)))';
  a_pagar_t constant text := '(t.kind = ''expense'' and (t.sale_installment_id is null or i.status = ''recebida''))';
  velho_b constant text := '(b.sale_installment_id is null or b.status_parcela = ''recebida'')';
  novo_b constant text := '(b.kind = ''expense'' and ((b.sale_installment_id is not null and b.status_parcela = ''recebida'') or (b.sale_installment_id is null and coalesce(b.due_date, b.competence_date) <= v_hoje)))';
begin
  -- ------------------------------------------------------------- cfo_posicao
  d := pg_get_functiondef('public.cfo_posicao()'::regprocedure);
  if position(novo_t in d) = 0 then
    if pg_temp.ocorrencias(d, velho_t) <> 1 then
      raise exception 'cfo_posicao: esperava 1 critério de devido, achei %', pg_temp.ocorrencias(d, velho_t);
    end if;
    d := replace(d, velho_t, novo_t);
    if pg_temp.ocorrencias(d, '''previsto_nao_e_divida'', (') <> 1 then
      raise exception 'cfo_posicao: âncora do previsto não encontrada';
    end if;
    d := replace(d, '''previsto_nao_e_divida'', (', $blk$'a_vencer', (
      select jsonb_build_object(
        'total', coalesce(round(sum(t.amount), 2), 0),
        'linhas', count(*),
        'proxima_data', min(coalesce(t.due_date, t.competence_date)),
        'proximos_7_dias', coalesce(round(sum(t.amount) filter (where coalesce(t.due_date, t.competence_date) <= v_hoje + 7), 2), 0),
        'proximos_30_dias', coalesce(round(sum(t.amount) filter (where coalesce(t.due_date, t.competence_date) <= v_hoje + 30), 2), 0),
        'explicacao', 'Despesa lançada com vencimento depois de hoje. Não é devido agora: entra no devido no dia em que vencer.'
      )
      from transactions t
      where t.company_id = v_empresa and t.kind = 'expense' and t.status = 'pending'
        and t.sale_installment_id is null
        and coalesce(t.due_date, t.competence_date) > v_hoje
    ),

    'retirada_do_socio_pendente', (
      select jsonb_build_object(
        'total', coalesce(round(sum(t.amount), 2), 0),
        'linhas', count(*),
        'explicacao', 'Retirada do sócio lançada e ainda não paga. Não é obrigação da operação e não entra no devido agora.'
      )
      from transactions t
      where t.company_id = v_empresa and t.kind = 'withdrawal' and t.status = 'pending'
    ),

    'previsto_nao_e_divida', ($blk$);
    if pg_temp.ocorrencias(d, 'Devido agora = comissão de parcela JÁ RECEBIDA + imposto de parcela JÁ RECEBIDA + despesa lançada.') <> 1 then
      raise exception 'cfo_posicao: premissa do devido não encontrada';
    end if;
    d := replace(d, 'Devido agora = comissão de parcela JÁ RECEBIDA + imposto de parcela JÁ RECEBIDA + despesa lançada.',
      'Devido agora = comissão e imposto de parcela JÁ RECEBIDA + despesa vencida ou que vence hoje. Despesa com vencimento futuro fica em a_vencer; retirada do sócio fica fora (decisão do Rafael, 13/09/2026).');
    execute d;
  end if;

  -- ------------------------------------------------------------ cfo_pagaveis
  d := pg_get_functiondef('public.cfo_pagaveis(date,date)'::regprocedure);
  if position(novo_t in d) = 0 then
    if pg_temp.ocorrencias(d, velho_t) <> 2 then
      raise exception 'cfo_pagaveis: esperava 2 critérios de devido, achei %', pg_temp.ocorrencias(d, velho_t);
    end if;
    d := replace(d, velho_t, novo_t);
    if pg_temp.ocorrencias(d, '''previsto'', (select') <> 1 then
      raise exception 'cfo_pagaveis: âncora do previsto não encontrada';
    end if;
    d := replace(d, '''previsto'', (select', $blk$'a_vencer', (select coalesce(round(sum(t.amount), 2), 0)
      from transactions t
      where t.company_id = v_empresa and t.kind = 'expense' and t.status = 'pending'
        and t.sale_installment_id is null and coalesce(t.due_date, t.competence_date) > v_hoje),
    'previsto', (select$blk$);
    if pg_temp.ocorrencias(d, 'DEVIDO é o que não depende de parcela, ou cuja parcela já foi recebida.') <> 1 then
      raise exception 'cfo_pagaveis: premissa do devido não encontrada';
    end if;
    d := replace(d, 'DEVIDO é o que não depende de parcela, ou cuja parcela já foi recebida.',
      'DEVIDO é comissão e imposto de parcela já recebida mais despesa vencida ou que vence hoje. A_VENCER é despesa com vencimento futuro. Retirada do sócio não é devido (decisão do Rafael, 13/09/2026).');
    execute d;
  end if;

  -- --------------------------------------------------------- cfo_lancamentos
  d := pg_get_functiondef('public.cfo_lancamentos(jsonb)'::regprocedure);
  if position(novo_b in d) = 0 then
    if pg_temp.ocorrencias(d, velho_b) <> 1 then
      raise exception 'cfo_lancamentos: esperava 1 critério de devido, achei %', pg_temp.ocorrencias(d, velho_b);
    end if;
    d := replace(d, velho_b, novo_b);
    if pg_temp.ocorrencias(d, 'or (v_conjunto = ''a_receber'' and') <> 1 then
      raise exception 'cfo_lancamentos: âncora do conjunto a_receber não encontrada';
    end if;
    d := replace(d, 'or (v_conjunto = ''a_receber'' and', $blk$or (v_conjunto = 'a_vencer' and b.kind = 'expense' and b.status = 'pending'
            and b.sale_installment_id is null and coalesce(b.due_date, b.competence_date) > v_hoje)
        or (v_conjunto = 'a_pagar' and b.kind = 'expense' and b.status = 'pending'
            and (b.sale_installment_id is null or b.status_parcela = 'recebida'))
        or (v_conjunto = 'retirada_pendente' and b.kind = 'withdrawal' and b.status = 'pending')
        or (v_conjunto = 'a_receber' and$blk$);
    if pg_temp.ocorrencias(d, '(''devido_agora'',''previsto_nao_e_divida'',''a_receber'',''a_receber_vencido'',''sem_conta'',''sem_empreendimento'')') <> 1 then
      raise exception 'cfo_lancamentos: lista de conjuntos não encontrada';
    end if;
    d := replace(d, '(''devido_agora'',''previsto_nao_e_divida'',''a_receber'',''a_receber_vencido'',''sem_conta'',''sem_empreendimento'')',
      '(''devido_agora'',''a_vencer'',''a_pagar'',''retirada_pendente'',''previsto_nao_e_divida'',''a_receber'',''a_receber_vencido'',''sem_conta'',''sem_empreendimento'')');
    if pg_temp.ocorrencias(d, 'Aceitos: devido_agora, previsto_nao_e_divida, a_receber, a_receber_vencido, sem_conta, sem_empreendimento.') <> 1 then
      raise exception 'cfo_lancamentos: mensagem de conjuntos não encontrada';
    end if;
    d := replace(d, 'Aceitos: devido_agora, previsto_nao_e_divida, a_receber, a_receber_vencido, sem_conta, sem_empreendimento.',
      'Aceitos: devido_agora, a_vencer, a_pagar, retirada_pendente, previsto_nao_e_divida, a_receber, a_receber_vencido, sem_conta, sem_empreendimento.');
    execute d;
  end if;

  -- ------------------------------------------------------------- cfo_alertas
  d := pg_get_functiondef('public.cfo_alertas(jsonb)'::regprocedure);
  if position(a_pagar_t in d) = 0 then
    if pg_temp.ocorrencias(d, velho_t) <> 2 then
      raise exception 'cfo_alertas: esperava 2 critérios de obrigação, achei %', pg_temp.ocorrencias(d, velho_t);
    end if;
    d := replace(d, velho_t, a_pagar_t);
    if pg_temp.ocorrencias(d, 'jsonb_build_object(''conjunto'', ''devido_agora'', ''data'', ''vencimento'', ''ate'', v_hoje + v_dias)') <> 1
       or pg_temp.ocorrencias(d, 'jsonb_build_object(''conjunto'', ''devido_agora'', ''data'', ''vencimento'', ''ate'', v_hoje - 1)') <> 1 then
      raise exception 'cfo_alertas: filtros de abrir não encontrados';
    end if;
    d := replace(d, 'jsonb_build_object(''conjunto'', ''devido_agora'', ''data'', ''vencimento'', ''ate'', v_hoje + v_dias)',
                    'jsonb_build_object(''conjunto'', ''a_pagar'', ''data'', ''vencimento'', ''ate'', v_hoje + v_dias)');
    d := replace(d, 'jsonb_build_object(''conjunto'', ''devido_agora'', ''data'', ''vencimento'', ''ate'', v_hoje - 1)',
                    'jsonb_build_object(''conjunto'', ''a_pagar'', ''data'', ''vencimento'', ''ate'', v_hoje - 1)');
    execute d;
  end if;
end $mig$;

do $$
declare r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array['cfo_posicao', 'cfo_pagaveis', 'cfo_lancamentos', 'cfo_alertas'])
  loop
    execute format('revoke all on function public.%I(%s) from public, anon, authenticated', r.proname, r.args);
    execute format('grant execute on function public.%I(%s) to service_role', r.proname, r.args);
  end loop;
end $$;
