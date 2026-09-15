-- ===========================================================================
-- 022 — DESFAZ A 021 ("devido agora só até hoje")
-- ===========================================================================
-- A 021 mudou a regra de "devido agora" durante o redesenho, sem o Rafael ter
-- decidido. Em 14/09/2026 ele disse que não mandou fazer isso: as regras
-- financeiras ficam como eram até ele decidir. Esta migração devolve
-- cfo_posicao, cfo_pagaveis, cfo_lancamentos e cfo_alertas à forma anterior
-- (devido agora = comissão e imposto de parcela recebida + despesa lançada),
-- tirando a_vencer, retirada_do_socio_pendente e os conjuntos a_vencer, a_pagar
-- e retirada_pendente. Conferido depois: devido agora R$ 5.676,88, como antes.
-- Se as funções já estiverem na forma anterior, nada é feito.
-- ===========================================================================

create or replace function pg_temp.ocorrencias(t text, a text) returns int
language sql immutable as $$ select (length(t) - length(replace(t, a, ''))) / greatest(length(a), 1) $$;

do $mig$
declare
  d text; p1 int; p2 int;
  velho_t constant text := '(t.sale_installment_id is null or i.status = ''recebida'')';
  novo_t constant text := '(t.kind = ''expense'' and ((t.sale_installment_id is not null and i.status = ''recebida'') or (t.sale_installment_id is null and coalesce(t.due_date, t.competence_date) <= v_hoje)))';
  a_pagar_t constant text := '(t.kind = ''expense'' and (t.sale_installment_id is null or i.status = ''recebida''))';
  velho_b constant text := '(b.sale_installment_id is null or b.status_parcela = ''recebida'')';
  novo_b constant text := '(b.kind = ''expense'' and ((b.sale_installment_id is not null and b.status_parcela = ''recebida'') or (b.sale_installment_id is null and coalesce(b.due_date, b.competence_date) <= v_hoje)))';
  pos_nova constant text := 'Devido agora = comissão e imposto de parcela JÁ RECEBIDA + despesa vencida ou que vence hoje. Despesa com vencimento futuro fica em a_vencer; retirada do sócio fica fora (decisão do Rafael, 13/09/2026).';
  pos_velha constant text := 'Devido agora = comissão de parcela JÁ RECEBIDA + imposto de parcela JÁ RECEBIDA + despesa lançada.';
  pag_nova constant text := 'DEVIDO é comissão e imposto de parcela já recebida mais despesa vencida ou que vence hoje. A_VENCER é despesa com vencimento futuro. Retirada do sócio não é devido (decisão do Rafael, 13/09/2026).';
  pag_velha constant text := 'DEVIDO é o que não depende de parcela, ou cuja parcela já foi recebida.';
  lista_nova constant text := '(''devido_agora'',''a_vencer'',''a_pagar'',''retirada_pendente'',''previsto_nao_e_divida'',''a_receber'',''a_receber_vencido'',''sem_conta'',''sem_empreendimento'')';
  lista_velha constant text := '(''devido_agora'',''previsto_nao_e_divida'',''a_receber'',''a_receber_vencido'',''sem_conta'',''sem_empreendimento'')';
  msg_nova constant text := 'Aceitos: devido_agora, a_vencer, a_pagar, retirada_pendente, previsto_nao_e_divida, a_receber, a_receber_vencido, sem_conta, sem_empreendimento.';
  msg_velha constant text := 'Aceitos: devido_agora, previsto_nao_e_divida, a_receber, a_receber_vencido, sem_conta, sem_empreendimento.';
begin
  -- cfo_posicao
  d := pg_get_functiondef('public.cfo_posicao()'::regprocedure);
  if position(novo_t in d) > 0 then
    if pg_temp.ocorrencias(d, novo_t) <> 1
       or pg_temp.ocorrencias(d, '''a_vencer'', (') <> 1
       or pg_temp.ocorrencias(d, '''previsto_nao_e_divida'', (') <> 1
       or pg_temp.ocorrencias(d, pos_nova) <> 1 then
      raise exception 'cfo_posicao: forma inesperada, nada desfeito';
    end if;
    p1 := position('''a_vencer'', (' in d);
    p2 := position('''previsto_nao_e_divida'', (' in d);
    if p2 <= p1 then raise exception 'cfo_posicao: ordem inesperada'; end if;
    d := substr(d, 1, p1 - 1) || substr(d, p2);
    d := replace(replace(d, novo_t, velho_t), pos_nova, pos_velha);
    if position('retirada_do_socio_pendente' in d) > 0 or position('a_vencer' in d) > 0 then
      raise exception 'cfo_posicao: sobrou trecho da 021';
    end if;
    execute d;
  end if;

  -- cfo_pagaveis
  d := pg_get_functiondef('public.cfo_pagaveis(date,date)'::regprocedure);
  if position(novo_t in d) > 0 then
    if pg_temp.ocorrencias(d, novo_t) <> 2
       or pg_temp.ocorrencias(d, '''a_vencer'', (select') <> 1
       or pg_temp.ocorrencias(d, '''previsto'', (select') <> 1
       or pg_temp.ocorrencias(d, pag_nova) <> 1 then
      raise exception 'cfo_pagaveis: forma inesperada, nada desfeito';
    end if;
    p1 := position('''a_vencer'', (select' in d);
    p2 := position('''previsto'', (select' in d);
    if p2 <= p1 then raise exception 'cfo_pagaveis: ordem inesperada'; end if;
    d := substr(d, 1, p1 - 1) || substr(d, p2);
    d := replace(replace(d, novo_t, velho_t), pag_nova, pag_velha);
    if position('a_vencer' in d) > 0 then raise exception 'cfo_pagaveis: sobrou trecho da 021'; end if;
    execute d;
  end if;

  -- cfo_lancamentos
  d := pg_get_functiondef('public.cfo_lancamentos(jsonb)'::regprocedure);
  if position(novo_b in d) > 0 then
    if pg_temp.ocorrencias(d, novo_b) <> 1
       or pg_temp.ocorrencias(d, 'or (v_conjunto = ''a_vencer'' and') <> 1
       or pg_temp.ocorrencias(d, 'or (v_conjunto = ''a_receber'' and') <> 1
       or pg_temp.ocorrencias(d, lista_nova) <> 1
       or pg_temp.ocorrencias(d, msg_nova) <> 1 then
      raise exception 'cfo_lancamentos: forma inesperada, nada desfeito';
    end if;
    p1 := position('or (v_conjunto = ''a_vencer'' and' in d);
    p2 := position('or (v_conjunto = ''a_receber'' and' in d);
    if p2 <= p1 then raise exception 'cfo_lancamentos: ordem inesperada'; end if;
    d := substr(d, 1, p1 - 1) || substr(d, p2);
    d := replace(replace(replace(d, novo_b, velho_b), lista_nova, lista_velha), msg_nova, msg_velha);
    if position('a_vencer' in d) > 0 or position('retirada_pendente' in d) > 0 or position('a_pagar' in d) > 0 then
      raise exception 'cfo_lancamentos: sobrou trecho da 021';
    end if;
    execute d;
  end if;

  -- cfo_alertas
  d := pg_get_functiondef('public.cfo_alertas(jsonb)'::regprocedure);
  if position(a_pagar_t in d) > 0 then
    if pg_temp.ocorrencias(d, a_pagar_t) <> 2
       or pg_temp.ocorrencias(d, 'jsonb_build_object(''conjunto'', ''a_pagar'', ''data'', ''vencimento'', ''ate'', v_hoje + v_dias)') <> 1
       or pg_temp.ocorrencias(d, 'jsonb_build_object(''conjunto'', ''a_pagar'', ''data'', ''vencimento'', ''ate'', v_hoje - 1)') <> 1 then
      raise exception 'cfo_alertas: forma inesperada, nada desfeito';
    end if;
    d := replace(d, a_pagar_t, velho_t);
    d := replace(d, 'jsonb_build_object(''conjunto'', ''a_pagar'', ''data'', ''vencimento'', ''ate'', v_hoje + v_dias)',
                    'jsonb_build_object(''conjunto'', ''devido_agora'', ''data'', ''vencimento'', ''ate'', v_hoje + v_dias)');
    d := replace(d, 'jsonb_build_object(''conjunto'', ''a_pagar'', ''data'', ''vencimento'', ''ate'', v_hoje - 1)',
                    'jsonb_build_object(''conjunto'', ''devido_agora'', ''data'', ''vencimento'', ''ate'', v_hoje - 1)');
    if position('''a_pagar''' in d) > 0 then raise exception 'cfo_alertas: sobrou trecho da 021'; end if;
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
