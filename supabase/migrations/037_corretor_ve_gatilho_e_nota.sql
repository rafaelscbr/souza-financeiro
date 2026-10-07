-- ===========================================================================
-- 037 — O CORRETOR VÊ EM QUE PÉ ESTÁ CADA PARCELA
-- ===========================================================================
-- Pedido do Rafael em 07/10/2026: "deixar mais nítida a situação de cada
-- parcela para recebimento… o que está aguardando pagamento do cliente, o que
-- já foi emitido a NF… para o corretor".
--
-- O administrador já via as etapas (025: gatilho → nota → pagamento). O
-- corretor via só "Prevista", porque broker_installments não devolvia os dois
-- marcos. Esta migração acrescenta as duas datas NO FIM do retorno — as
-- funções que leem broker_installments() por nome de coluna (broker_sale,
-- broker_home) continuam iguais.
--
-- Nenhum valor muda. São duas datas que o corretor já podia deduzir pela
-- conversa; nada de imposto, líquido da imobiliária ou outro corretor.
--
-- Trocar o tipo de retorno exige derrubar a função antes; por isso o drop.
-- ===========================================================================

drop function if exists public.broker_installments(date, date);

create function public.broker_installments(p_from date default null, p_to date default null)
returns table(id uuid, sale_id uuid, sale_title text, development text, idx integer, count integer,
              expected_date date, received_date date, installment_amount numeric, iss_amount numeric,
              simples_amount numeric, broker_pct numeric, broker_amount numeric, broker_adjustment numeric,
              status text, paid_date date, notes text, is_personal boolean,
              trigger_met_date date, invoice_issued_date date)
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
         s.is_personal,
         -- Os dois marcos do caminho do dinheiro (025).
         i.trigger_met_date,
         i.invoice_issued_date
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

-- Só quem entrou no app. Sem sessão, current_contact_id() já devolveria nada;
-- mesmo assim, anon não tem o que fazer aqui.
revoke all on function public.broker_installments(date, date) from public, anon;
grant execute on function public.broker_installments(date, date) to authenticated;
