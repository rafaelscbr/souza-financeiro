-- ===========================================================================
-- 027 — O SIMPLES VIRA UMA GUIA POR MÊS
-- ===========================================================================
-- Decidido com o Rafael em 21/09/2026: "junta tudo do mês numa guia só".
--
-- Até aqui cada parcela recebida gerava a sua própria linha de imposto. Na
-- vida real o Simples é UMA guia (DAS) por mês, que soma tudo o que entrou no
-- mês e vence no dia 20 do mês seguinte. Ter oito linhas de R$ 990,58 onde
-- existe um boleto só faz o sistema mentir sobre o que ele precisa pagar.
--
-- A partir daqui:
--
--   · Parcela AINDA NÃO RECEBIDA continua com a linha de imposto dela: é
--     previsão, presa à venda que a gerou, e some se a venda for cancelada.
--   · Quando o dinheiro entra, essa linha SAI e o valor passa a compor a
--     GUIA DO MÊS do recebimento — um lançamento só, sem venda, com o
--     vencimento do DAS.
--   · Desfazer o recebimento devolve o imposto para a previsão da parcela e
--     refaz a guia.
--
-- Nenhum valor muda: 6% sobre a comissão menos o ISS continua sendo 6%. O que
-- muda é quantas linhas isso ocupa e em que dia elas vencem.
-- ===========================================================================

-- O DAS vence dia 20 do mês seguinte; caindo no fim de semana, no dia útil
-- seguinte (é o que o banco aceita). 20/09/2026, por exemplo, é domingo.
create or replace function public.venc_das(p_data date)
returns date
language sql
immutable
as $function$
  select case extract(isodow from d) when 6 then d + 2 when 7 then d + 1 else d end
    from (select (date_trunc('month', p_data) + interval '1 month' + interval '19 days')::date as d) x;
$function$;

comment on function public.venc_das(date) is
  'Vencimento do DAS do mês da data: dia 20 do mês seguinte, adiado para segunda quando cai no fim de semana.';

-- ---------------------------------------------------------------- a guia do mês
/*
 * Refaz a guia pendente da competência (o mês do recebimento). A conta é
 * sempre a mesma: soma do imposto das parcelas recebidas naquele mês, menos o
 * que já foi pago em guia daquele mês. Se sobra zero, a guia pendente some.
 *
 * Guia já paga não é tocada — se depois disso entrar mais dinheiro naquele
 * mês, a diferença vira uma guia de complemento.
 */
create or replace function public.sincroniza_das(p_company uuid, p_data date)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_comp   date := date_trunc('month', p_data)::date;
  v_total  numeric(14,2);
  v_pago   numeric(14,2);
  v_falta  numeric(14,2);
  v_id     uuid;
  v_nome   text;
begin
  select coalesce(sum(i.simples_amount), 0) into v_total
    from public.sale_installments i
    join public.sales s on s.id = i.sale_id
   where s.company_id = p_company
     and not s.is_personal
     and i.status = 'recebida'
     and date_trunc('month', i.received_date)::date = v_comp
     -- Parcela antiga cujo imposto já foi pago na linha dela não entra na guia.
     and not exists (
       select 1 from public.transactions t
        where t.id = i.simples_tx_id and t.status = 'settled'
     );

  select coalesce(sum(amount), 0) into v_pago
    from public.transactions
   where company_id = p_company and category = 'Impostos e Taxas'
     and sale_id is null and competence_date = v_comp
     and description like 'DAS Simples%' and status = 'settled';

  v_falta := round(v_total - v_pago, 2);

  select id into v_id
    from public.transactions
   where company_id = p_company and category = 'Impostos e Taxas'
     and sale_id is null and competence_date = v_comp
     and description like 'DAS Simples%' and status = 'pending'
   limit 1;

  if v_falta <= 0 then
    if v_id is not null then delete from public.transactions where id = v_id; end if;
    return;
  end if;

  -- O nome do mês em português, escrito aqui: o locale do servidor não é
  -- garantia nenhuma e o nome da guia é o que o Rafael lê na tela.
  v_nome := format('DAS Simples — %s/%s%s',
    (array['janeiro','fevereiro','março','abril','maio','junho',
           'julho','agosto','setembro','outubro','novembro','dezembro'])[extract(month from v_comp)::int],
    to_char(v_comp, 'YYYY'),
    case when v_pago > 0 then ' (complemento)' else '' end);

  if v_id is null then
    insert into public.transactions (
      company_id, kind, category, dre_group, description, amount,
      competence_date, status, due_date
    ) values (
      p_company, 'expense', 'Impostos e Taxas', 'variable_expense',
      v_nome, v_falta, v_comp, 'pending', public.venc_das(v_comp)
    );
  else
    update public.transactions
       set amount = v_falta, description = v_nome, due_date = public.venc_das(v_comp)
     where id = v_id;
  end if;
end $function$;

revoke all on function public.sincroniza_das(uuid, date) from public;
grant execute on function public.sincroniza_das(uuid, date) to authenticated;

-- ------------------------------------- o recebimento e o desfazer, remendados
do $mig$
declare
  d text;
  velho text;
  novo text;
begin
  -- 1. receive_installment: a previsão da parcela sai e a guia do mês é refeita.
  d := pg_get_functiondef('public.receive_installment(uuid,date,uuid,numeric,numeric,numeric,text)'::regprocedure);

  velho := '  if v_simples > 0 then
    if i.simples_tx_id is null then
      insert into public.transactions (
        company_id, kind, category, dre_group, description, amount,
        competence_date, status, due_date,
        group_id, installment_index, installment_count, cost_center_id, sale_id, sale_installment_id
      ) values (
        s.company_id, ''expense'', ''Impostos e Taxas'', ''variable_expense'',
        format(''Simples %s%% — %s%s'', s.simples_pct, s.title, v_sufixo), v_simples,
        s.sale_date, ''pending'', public.venc_das(p_date),
        s.id, case when i.count > 1 then i.idx end, case when i.count > 1 then i.count end,
        s.cost_center_id, s.id, i.id
      ) returning id into v_tx;
      update public.sale_installments set simples_tx_id = v_tx where id = i.id;
    else
      update public.transactions
         set amount = v_simples, due_date = public.venc_das(p_date)
       where id = i.simples_tx_id and status = ''pending'';
    end if;
  elsif i.simples_tx_id is not null then
    delete from public.transactions where id = i.simples_tx_id and status = ''pending'';
    update public.sale_installments set simples_tx_id = null where id = i.id;
  end if;';
  novo := '  -- O Simples deixou de ser linha de parcela (027): com o dinheiro dentro,
  -- a previsão desta parcela sai e o valor passa a compor a guia do mês.
  if i.simples_tx_id is not null then
    delete from public.transactions where id = i.simples_tx_id and status = ''pending'';
    update public.sale_installments set simples_tx_id = null where id = i.id;
  end if;';
  if position(velho in d) = 0 then
    raise exception 'receive_installment: não achei o bloco do Simples';
  end if;
  d := replace(d, velho, novo);

  velho := '  if not exists (
    select 1 from public.sale_installments
     where sale_id = s.id and status = ''prevista''
  ) then';
  novo := '  perform public.sincroniza_das(s.company_id, p_date);

  if not exists (
    select 1 from public.sale_installments
     where sale_id = s.id and status = ''prevista''
  ) then';
  if position(velho in d) = 0 then
    raise exception 'receive_installment: não achei o fecho da venda';
  end if;
  execute replace(d, velho, novo);

  -- 2. undo_receive_installment: o imposto volta a ser previsão da parcela.
  d := pg_get_functiondef('public.undo_receive_installment(uuid)'::regprocedure);

  velho := '  v_owner   numeric(14,2);
begin';
  novo := '  v_owner   numeric(14,2);
  v_tx      uuid;
  v_mes     date;
begin';
  if position(velho in d) = 0 then raise exception 'undo: não achei as declarações'; end if;
  d := replace(d, velho, novo);

  velho := '  select * into s from public.sales where id = i.sale_id;

  if i.broker_tx_id is not null';
  novo := '  select * into s from public.sales where id = i.sale_id;
  v_mes := i.received_date;

  if i.broker_tx_id is not null';
  if position(velho in d) = 0 then raise exception 'undo: não achei o select da venda'; end if;
  d := replace(d, velho, novo);

  velho := '  if i.simples_tx_id is not null then
    update public.transactions
       set amount = v_simples, due_date = i.expected_date
     where id = i.simples_tx_id and status = ''pending'';
  end if;';
  novo := '  -- Sem o recebimento, o imposto volta a ser previsão desta parcela (027).
  if v_simples > 0 then
    if i.simples_tx_id is null then
      insert into public.transactions (
        company_id, kind, category, dre_group, description, amount,
        competence_date, status, due_date,
        group_id, installment_index, installment_count, cost_center_id, sale_id, sale_installment_id
      ) values (
        s.company_id, ''expense'', ''Impostos e Taxas'', ''variable_expense'',
        format(''Simples %s%% — %s%s'', s.simples_pct, s.title,
               case when i.count > 1 then format('' — Pc %s/%s'', i.idx, i.count) else '''' end),
        v_simples, s.sale_date, ''pending'', public.venc_das(i.expected_date),
        s.id, case when i.count > 1 then i.idx end, case when i.count > 1 then i.count end,
        s.cost_center_id, s.id, i.id
      ) returning id into v_tx;
      update public.sale_installments set simples_tx_id = v_tx where id = i.id;
    else
      update public.transactions
         set amount = v_simples, due_date = public.venc_das(i.expected_date)
       where id = i.simples_tx_id and status = ''pending'';
    end if;
  end if;';
  if position(velho in d) = 0 then raise exception 'undo: não achei o bloco do Simples'; end if;
  d := replace(d, velho, novo);

  velho := '  update public.sales set status = ''ativa'' where id = s.id and status = ''concluida'';';
  novo := '  perform public.sincroniza_das(s.company_id, v_mes);

  update public.sales set status = ''ativa'' where id = s.id and status = ''concluida'';';
  if position(velho in d) = 0 then raise exception 'undo: não achei o reabrir da venda'; end if;
  execute replace(d, velho, novo);
end $mig$;

-- --------------------------------------------- o que já estava lançado no banco
do $$
declare
  n_prev int; n_saiu int; n_guia int := 0;
  r record;
begin
  -- Previsão de parcela que ainda não entrou: o vencimento passa a ser o do
  -- DAS do mês em que o dinheiro deve entrar, e não datas soltas do histórico.
  update public.transactions t
     set due_date = public.venc_das(i.expected_date)
    from public.sale_installments i
   where t.id = i.simples_tx_id and t.status = 'pending' and i.status = 'prevista';
  get diagnostics n_prev = row_count;

  -- Parcela já recebida: a linha individual sai; o valor vira guia do mês.
  delete from public.transactions t
   using public.sale_installments i
   where t.id = i.simples_tx_id and t.status = 'pending' and i.status = 'recebida';
  get diagnostics n_saiu = row_count;

  update public.sale_installments i
     set simples_tx_id = null
   where i.status = 'recebida' and i.simples_tx_id is not null
     and not exists (select 1 from public.transactions t where t.id = i.simples_tx_id);

  for r in
    select distinct s.company_id, date_trunc('month', i.received_date)::date as mes
      from public.sale_installments i
      join public.sales s on s.id = i.sale_id
     where i.status = 'recebida' and not s.is_personal and i.simples_amount > 0
  loop
    perform public.sincroniza_das(r.company_id, r.mes);
    n_guia := n_guia + 1;
  end loop;

  raise notice 'guia mensal: % previsões com vencimento do DAS, % linhas de parcela recebida removidas, % competências refeitas',
    n_prev, n_saiu, n_guia;
end $$;
