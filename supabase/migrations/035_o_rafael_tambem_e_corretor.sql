-- ===========================================================================
-- 035 — O RAFAEL TAMBÉM É CORRETOR, NO MESMO LOGIN
-- ===========================================================================
-- Pedido dele em 22/09/2026: "o que acha de fazer um usuário meu também como
-- corretor? e colocar essas vendas da PF vinculado a essa conta de corretor?"
-- Escolha dele: MESMO login, duas visões — não um segundo usuário.
--
-- Duas coisas, e nenhuma delas mexe em um real:
--
-- 1. O perfil de administrador dele passa a apontar para o contato de corretor
--    "Rafael Alves de Souza". É esse campo que `current_contact_id()` lê, e é
--    por ele que as funções broker_* decidem o que devolver. O papel continua
--    'admin': ele não perde nada do administrador, só passa a existir também
--    como corretor. O índice `profiles_contact_unico` garante que só um login
--    carregue esse contato — por isso não existe um segundo usuário.
--
-- 2. As funções do corretor passam a dizer QUAIS vendas são de pessoa física.
--    Sem isso, a tela dele soma R$ 26 mil que nunca passaram pelo caixa da
--    imobiliária com R$ 7,8 mil que passaram, e os dois viram "minha
--    comissão" sem distinção. A coluna é só informativa: as contas (033)
--    continuam exatamente as mesmas.
--
-- Trocar o tipo de retorno exige derrubar a função antes; por isso o drop.
-- ===========================================================================

update public.profiles
   set contact_id = 'b90684e2-c267-44c2-a99e-211f098ae35a'
 where id = 'dfb372d6-977a-4a76-a454-fc2d260d54b6'
   and contact_id is null;

drop function if exists public.broker_sale(uuid);
drop function if exists public.broker_home(integer);
drop function if exists public.broker_sales();
drop function if exists public.broker_installments(date, date);

create function public.broker_installments(p_from date default null, p_to date default null)
returns table(id uuid, sale_id uuid, sale_title text, development text, idx integer, count integer,
              expected_date date, received_date date, installment_amount numeric, iss_amount numeric,
              simples_amount numeric, broker_pct numeric, broker_amount numeric, broker_adjustment numeric,
              status text, paid_date date, notes text, is_personal boolean)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select i.id, s.id as sale_id, s.title as sale_title, cc.name as development,
         i.idx, i.count, i.expected_date, i.received_date,
         i.amount as installment_amount, i.iss_amount, i.simples_amount,
         case when s.is_personal then 100 else s.broker_pct end as broker_pct,
         -- Venda de pessoa física: a parcela inteira é dele.
         case when s.is_personal then i.amount else i.broker_amount end as broker_amount,
         case when s.is_personal then 0 else i.broker_adjustment end as broker_adjustment,
         -- E ela não espera repasse: entrou, está paga.
         case when s.is_personal
              then (case when i.status = 'recebida' then 'recebida' else 'prevista' end)
              else public.broker_status(i.status, i.broker_tx_id) end as status,
         case when s.is_personal then i.received_date
              else (select t.settled_date from public.transactions t
                     where t.id = i.broker_tx_id and t.status = 'settled') end as paid_date,
         i.notes,
         s.is_personal
    from public.sale_installments i
    join public.sales s on s.id = i.sale_id
    left join public.cost_centers cc on cc.id = s.cost_center_id
   where s.broker_id = public.current_contact_id()
     and public.current_contact_id() is not null
     and s.status <> 'cancelada'
     and i.status <> 'cancelada'
     and (i.broker_amount > 0 or s.is_personal)
     and (p_from is null or i.expected_date >= p_from)
     and (p_to   is null or i.expected_date <= p_to)
   order by i.expected_date, s.title, i.idx;
$function$;

create function public.broker_sales()
returns table(id uuid, title text, unit text, client_name text, development text, sale_date date,
              property_value numeric, broker_pct numeric, status text, commission_total numeric,
              commission_received numeric, commission_released numeric, commission_expected numeric,
              installments integer, next_date date, is_personal boolean)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with minhas as (
    select s.*, cc.name as development
      from public.sales s
      left join public.cost_centers cc on cc.id = s.cost_center_id
     where s.broker_id = public.current_contact_id()
       and public.current_contact_id() is not null
       and s.status <> 'cancelada'
  ), parcelas as (
    select i.*,
           m.is_personal,
           case when m.is_personal then i.amount else i.broker_amount end as valor_dele,
           case when m.is_personal then 0 else i.broker_adjustment end as desconto,
           case when m.is_personal
                then (case when i.status = 'recebida' then 'recebida' else 'prevista' end)
                else public.broker_status(i.status, i.broker_tx_id) end as bstatus
      from public.sale_installments i
      join minhas m on m.id = i.sale_id
     where i.status <> 'cancelada'
  )
  select m.id, m.title, m.unit, m.client_name, m.development, m.sale_date,
         m.property_value,
         case when m.is_personal then 100 else m.broker_pct end as broker_pct,
         m.status,
         coalesce(sum(p.valor_dele - p.desconto), 0)                                          as commission_total,
         coalesce(sum(case when p.bstatus = 'recebida' then p.valor_dele - p.desconto end), 0) as commission_received,
         coalesce(sum(case when p.bstatus = 'liberada' then p.valor_dele end), 0)              as commission_released,
         coalesce(sum(case when p.bstatus = 'prevista' then p.valor_dele end), 0)              as commission_expected,
         count(p.id)::integer                                                                  as installments,
         min(case when p.bstatus <> 'recebida' then p.expected_date end)                      as next_date,
         m.is_personal
    from minhas m
    left join parcelas p on p.sale_id = m.id
   group by m.id, m.title, m.unit, m.client_name, m.development, m.sale_date,
            m.property_value, m.broker_pct, m.status, m.is_personal
   order by m.sale_date desc;
$function$;

-- Igual à 010, com `personal_*` a mais: quanto do ano é dele por fora da
-- imobiliária. O resto da conta é o mesmo, número por número.
create function public.broker_home(p_year integer default null)
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
    -- Quanto do ano vem de venda de pessoa física: dinheiro dele que nunca
    -- passou pelo caixa da imobiliária.
    'personal_total', (select coalesce(sum(broker_amount - broker_adjustment), 0) from doano where is_personal),
    'personal_count', (select count(*) from vendas where is_personal),
    -- Atrasado: liberado (a imobiliária já recebeu) e ainda não pago.
    'overdue_amount', (select coalesce(sum(broker_amount), 0) from parcelas
                        where status = 'liberada' and expected_date < current_date),
    'overdue_count',  (select count(*) from parcelas
                        where status = 'liberada' and expected_date < current_date),
    'next', (select jsonb_build_object(
               'sale_title', p.sale_title, 'idx', p.idx, 'count', p.count,
               'amount', p.broker_amount - p.broker_adjustment,
               'date', p.expected_date, 'status', p.status)
               from parcelas p
              where p.status <> 'recebida'
              order by p.expected_date
              limit 1),
    'by_month', (select coalesce(jsonb_agg(jsonb_build_object(
                          'month', to_char(m.mes, 'YYYY-MM'),
                          'amount', m.total,
                          'received', m.recebido) order by m.mes), '[]'::jsonb)
                   from (select date_trunc('month', expected_date)::date as mes,
                                sum(broker_amount - broker_adjustment) as total,
                                sum(case when status = 'recebida' then broker_amount - broker_adjustment else 0 end) as recebido
                           from doano
                          group by 1) m)
  );
$$;

create function public.broker_sale(p_sale uuid)
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
    'is_personal', v.is_personal,
    'installments', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', i.id, 'idx', i.idx, 'count', i.count,
               'expected_date', i.expected_date, 'received_date', i.received_date,
               'installment_amount', i.installment_amount,
               'iss_amount', i.iss_amount, 'simples_amount', i.simples_amount,
               'broker_amount', i.broker_amount, 'broker_adjustment', i.broker_adjustment,
               'status', i.status, 'paid_date', i.paid_date, 'notes', i.notes,
               'is_personal', i.is_personal
             ) order by i.idx), '[]'::jsonb)
        from public.broker_installments() i where i.sale_id = v.id)
  ) end
    from (select * from public.broker_sales() where id = p_sale) v;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'broker_sales()',
    'broker_installments(date,date)',
    'broker_home(integer)',
    'broker_sale(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
