-- Funções de produção em 23/10/2026 (pg_get_functiondef, só leitura), usadas
-- pelo teste-plano-de-carreira.mjs: o esquema reconstruído do backup não traz
-- funções, e as migrações antigas não rodam fora de ordem com dados reais.

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role = 'admin' and is_active
  );
$function$;

CREATE OR REPLACE FUNCTION public.venc_das(p_data date)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case extract(isodow from d) when 6 then d + 2 when 7 then d + 1 else d end
    from (select (date_trunc('month', p_data) + interval '1 month' + interval '19 days')::date as d) x;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_sale(p_sale uuid, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_qtd integer;
begin
  if not public.is_admin() then
    raise exception 'Só o administrador pode cancelar uma venda.';
  end if;

  delete from public.transactions
   where sale_installment_id in (
     select id from public.sale_installments where sale_id = p_sale and status = 'prevista'
   ) and status = 'pending';

  update public.sale_installments
     set status = 'cancelada'
   where sale_id = p_sale and status = 'prevista';
  get diagnostics v_qtd = row_count;

  update public.sales
     set status = 'cancelada',
         notes = trim(coalesce(notes || ' | ', '') ||
                 format('cancelada em %s (%s parcela(s) prevista(s))%s',
                        to_char(current_date, 'DD/MM/YYYY'), v_qtd,
                        case when p_note is null then '' else ': ' || p_note end))
   where id = p_sale;
end $function$;

CREATE OR REPLACE FUNCTION public.sincroniza_das(p_company uuid, p_data date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
