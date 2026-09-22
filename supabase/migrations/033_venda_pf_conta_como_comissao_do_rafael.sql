-- ===========================================================================
-- 033 — A VENDA DE PESSOA FÍSICA CONTA COMO COMISSÃO DO RAFAEL
-- ===========================================================================
-- Pedido dele em 21/09/2026: "as vendas da PF sejam 100% para pagamento meu
-- como corretor também".
--
-- O que NÃO muda: a decisão da 026 continua de pé. Venda de pessoa física não
-- tem lançamento no razão da imobiliária, não gera imposto dela e não entra
-- em nenhum total da empresa. O dinheiro vai direto para ele.
--
-- O que muda: na visão de CORRETOR, essas vendas passam a aparecer como dele,
-- com 100% da parcela — porque é exatamente isso que elas são. E já nascem
-- como PAGAS quando a parcela entra: não existe repasse a fazer, a
-- imobiliária nunca segurou esse dinheiro.
--
-- O SQL aplicado está em 033 no banco; o arquivo aqui é a cópia dele.
-- ===========================================================================

update public.sales
   set broker_id = 'b90684e2-c267-44c2-a99e-211f098ae35a',
       broker_pct = 100
 where is_personal and broker_id is null;

create or replace function public.broker_installments(p_from date default null, p_to date default null)
returns table(id uuid, sale_id uuid, sale_title text, development text, idx integer, count integer,
              expected_date date, received_date date, installment_amount numeric, iss_amount numeric,
              simples_amount numeric, broker_pct numeric, broker_amount numeric, broker_adjustment numeric,
              status text, paid_date date, notes text)
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
         i.notes
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

create or replace function public.broker_sales()
returns table(id uuid, title text, unit text, client_name text, development text, sale_date date,
              property_value numeric, broker_pct numeric, status text, commission_total numeric,
              commission_received numeric, commission_released numeric, commission_expected numeric,
              installments integer, next_date date)
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
         min(case when p.bstatus <> 'recebida' then p.expected_date end)                      as next_date
    from minhas m
    left join parcelas p on p.sale_id = m.id
   group by m.id, m.title, m.unit, m.client_name, m.development, m.sale_date,
            m.property_value, m.broker_pct, m.status, m.is_personal
   order by m.sale_date desc;
$function$;
