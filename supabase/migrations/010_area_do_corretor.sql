-- =============================================================================
-- 010 · A área do corretor
--
-- COMO APLICAR: Supabase → SQL Editor → cole tudo → Run. Seguro repetir.
-- PROJETO CORRETO: souza-financeiro (iejmrzcgoeoxhhcnqodn). NUNCA o icrm.
--
-- POR QUE FUNÇÃO E NÃO RLS: política de linha resolve "quais linhas", não
-- "quais colunas". O corretor pode ver a parcela da venda dele e a própria
-- comissão, mas não o líquido da imobiliária, nem as despesas da empresa, nem
-- nada de outro corretor. Essas funções devolvem exatamente as colunas
-- permitidas — o corretor não recebe SELECT em nenhuma tabela.
--
-- O VOCABULÁRIO que o corretor vê (e que a tela usa):
--   prevista  → a imobiliária ainda não recebeu essa parcela
--   liberada  → a imobiliária recebeu; a comissão está a pagar
--   recebida  → já foi paga a ele
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Situação da comissão de uma parcela, do ponto de vista do corretor.
-- -----------------------------------------------------------------------------
create or replace function public.broker_status(
  p_inst_status text,
  p_broker_tx   uuid
) returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when p_inst_status = 'cancelada' then 'cancelada'
    when p_inst_status = 'prevista'  then 'prevista'
    when exists (select 1 from public.transactions
                  where id = p_broker_tx and status = 'settled') then 'recebida'
    else 'liberada'
  end;
$$;

-- -----------------------------------------------------------------------------
-- As vendas do corretor logado
-- -----------------------------------------------------------------------------
create or replace function public.broker_sales()
returns table (
  id uuid,
  title text,
  unit text,
  client_name text,
  development text,
  sale_date date,
  property_value numeric,
  broker_pct numeric,
  status text,
  commission_total numeric,
  commission_received numeric,
  commission_released numeric,
  commission_expected numeric,
  installments integer,
  next_date date
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with minhas as (
    select s.*, cc.name as development
      from public.sales s
      left join public.cost_centers cc on cc.id = s.cost_center_id
     where s.broker_id = public.current_contact_id()
       and public.current_contact_id() is not null
       and s.status <> 'cancelada'
  ), parcelas as (
    select i.*, public.broker_status(i.status, i.broker_tx_id) as bstatus
      from public.sale_installments i
     where i.sale_id in (select id from minhas) and i.status <> 'cancelada'
  )
  select m.id, m.title, m.unit, m.client_name, m.development, m.sale_date,
         m.property_value, m.broker_pct, m.status,
         coalesce(sum(p.broker_amount - p.broker_adjustment), 0)                                    as commission_total,
         coalesce(sum(case when p.bstatus = 'recebida' then p.broker_amount - p.broker_adjustment end), 0) as commission_received,
         coalesce(sum(case when p.bstatus = 'liberada' then p.broker_amount end), 0)                as commission_released,
         coalesce(sum(case when p.bstatus = 'prevista' then p.broker_amount end), 0)                as commission_expected,
         count(p.id)::integer                                                                        as installments,
         min(case when p.bstatus <> 'recebida' then p.expected_date end)                            as next_date
    from minhas m
    left join parcelas p on p.sale_id = m.id
   group by m.id, m.title, m.unit, m.client_name, m.development, m.sale_date,
            m.property_value, m.broker_pct, m.status
   order by m.sale_date desc;
$$;

-- -----------------------------------------------------------------------------
-- Os recebimentos do corretor, parcela a parcela
--
-- Devolve a base do cálculo (parcela, ISS, Simples) para ele conferir o próprio
-- número — é como o Rafael já explica hoje, e o percentual sozinho não permite
-- recalcular. Não devolve o líquido da imobiliária.
-- -----------------------------------------------------------------------------
create or replace function public.broker_installments(
  p_from date default null,
  p_to   date default null
) returns table (
  id uuid,
  sale_id uuid,
  sale_title text,
  development text,
  idx integer,
  count integer,
  expected_date date,
  received_date date,
  /** Parcela da comissão da imobiliária: a base antes dos impostos. */
  installment_amount numeric,
  iss_amount numeric,
  simples_amount numeric,
  broker_pct numeric,
  broker_amount numeric,
  broker_adjustment numeric,
  status text,
  paid_date date,
  notes text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.id, s.id as sale_id, s.title as sale_title, cc.name as development,
         i.idx, i.count, i.expected_date, i.received_date,
         i.amount as installment_amount, i.iss_amount, i.simples_amount,
         s.broker_pct, i.broker_amount, i.broker_adjustment,
         public.broker_status(i.status, i.broker_tx_id) as status,
         (select t.settled_date from public.transactions t
           where t.id = i.broker_tx_id and t.status = 'settled') as paid_date,
         i.notes
    from public.sale_installments i
    join public.sales s on s.id = i.sale_id
    left join public.cost_centers cc on cc.id = s.cost_center_id
   where s.broker_id = public.current_contact_id()
     and public.current_contact_id() is not null
     and s.status <> 'cancelada'
     and i.status <> 'cancelada'
     and i.broker_amount > 0
     and (p_from is null or i.expected_date >= p_from)
     and (p_to   is null or i.expected_date <= p_to)
   order by i.expected_date, s.title, i.idx;
$$;

-- -----------------------------------------------------------------------------
-- O painel do corretor num ano
-- -----------------------------------------------------------------------------
create or replace function public.broker_home(p_year integer default null)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with ano as (
    select coalesce(p_year, extract(year from current_date)::integer) as y
  ), vendas as (
    select * from public.broker_sales()
     where extract(year from sale_date)::integer = (select y from ano)
  ), parcelas as (
    select * from public.broker_installments()
  ), doano as (
    select * from parcelas
     where extract(year from expected_date)::integer = (select y from ano)
  )
  select jsonb_build_object(
    'year', (select y from ano),
    'sales_count', (select count(*) from vendas),
    'vgv', (select coalesce(sum(property_value), 0) from vendas),
    'sales_without_vgv', (select count(*) from vendas where property_value is null),
    'commission_total',    (select coalesce(sum(broker_amount - broker_adjustment), 0) from doano),
    'commission_received', (select coalesce(sum(broker_amount - broker_adjustment), 0) from doano where status = 'recebida'),
    'commission_released', (select coalesce(sum(broker_amount), 0) from doano where status = 'liberada'),
    'commission_expected', (select coalesce(sum(broker_amount), 0) from doano where status = 'prevista'),
    -- Atrasado: liberado (a imobiliária já recebeu) e ainda não pago.
    'overdue_amount', (select coalesce(sum(broker_amount), 0) from parcelas
                        where status = 'liberada' and expected_date < current_date),
    'overdue_count',  (select count(*) from parcelas
                        where status = 'liberada' and expected_date < current_date),
    'next', (select jsonb_build_object(
               'sale_title', sale_title, 'idx', idx, 'count', count,
               'amount', broker_amount, 'date', expected_date, 'status', status)
               from parcelas
              where status <> 'recebida' and expected_date >= current_date
              order by expected_date limit 1),
    'by_month', (select coalesce(jsonb_agg(m order by m->>'month'), '[]'::jsonb) from (
        select jsonb_build_object(
                 'month', to_char(date_trunc('month', expected_date), 'YYYY-MM'),
                 'amount', sum(broker_amount - broker_adjustment),
                 'received', sum(case when status = 'recebida' then broker_amount - broker_adjustment else 0 end)
               ) as m
          from doano group by date_trunc('month', expected_date)) t)
  );
$$;

-- -----------------------------------------------------------------------------
-- Uma venda do corretor, com as parcelas
-- -----------------------------------------------------------------------------
create or replace function public.broker_sale(p_sale uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when v.id is null then null else jsonb_build_object(
    'id', v.id, 'title', v.title, 'unit', v.unit, 'client_name', v.client_name,
    'development', v.development, 'sale_date', v.sale_date,
    'property_value', v.property_value, 'broker_pct', v.broker_pct,
    'status', v.status, 'commission_total', v.commission_total,
    'commission_received', v.commission_received,
    'commission_released', v.commission_released,
    'commission_expected', v.commission_expected,
    'installments', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', i.id, 'idx', i.idx, 'count', i.count,
               'expected_date', i.expected_date, 'received_date', i.received_date,
               'installment_amount', i.installment_amount,
               'iss_amount', i.iss_amount, 'simples_amount', i.simples_amount,
               'broker_amount', i.broker_amount, 'broker_adjustment', i.broker_adjustment,
               'status', i.status, 'paid_date', i.paid_date, 'notes', i.notes
             ) order by i.idx), '[]'::jsonb)
        from public.broker_installments() i where i.sale_id = v.id)
  ) end
    from (select * from public.broker_sales() where id = p_sale) v;
$$;

-- -----------------------------------------------------------------------------
-- Permissões: o corretor executa; ninguém lê tabela direto.
-- -----------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'broker_status(text,uuid)',
    'broker_sales()',
    'broker_installments(date,date)',
    'broker_home(integer)',
    'broker_sale(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- =============================================================================
-- REVERSÃO
-- drop function if exists public.broker_sale(uuid);
-- drop function if exists public.broker_home(integer);
-- drop function if exists public.broker_installments(date,date);
-- drop function if exists public.broker_sales();
-- drop function if exists public.broker_status(text,uuid);
-- =============================================================================
