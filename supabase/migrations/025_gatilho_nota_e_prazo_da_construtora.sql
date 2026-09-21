-- ===========================================================================
-- 025 — GATILHO, NOTA FISCAL E PRAZO DA CONSTRUTORA
-- ===========================================================================
-- Decidido com o Rafael em 21/09/2026. O dinheiro de uma parcela de comissão
-- passa por três marcos, e até hoje o sistema só guardava uma data:
--
--   1. GATILHO — o contrato do empreendimento diz quando a comissão é
--      liberada (ex.: LOTISA no PortoVelas: 50% quando o cliente paga 5% do
--      valor do imóvel, 50% ao atingir 8%). O gatilho é do EMPREENDIMENTO:
--      a mesma construtora pode ter outro gatilho em outro produto.
--   2. NOTA FISCAL — a imobiliária emite a nota para a construtora, uma por
--      parcela.
--   3. PAGAMENTO — a construtora paga um prazo depois da nota. O prazo é da
--      CONSTRUTORA (LOTISA: 10 dias úteis).
--
-- Por isso: construtora vira cadastro próprio (com o prazo), o empreendimento
-- guarda o gatilho em texto e aponta para a construtora, e a parcela ganha as
-- datas dos três marcos. Quando a nota é marcada como emitida, a previsão de
-- pagamento é recalculada pelo prazo da construtora.
--
-- Nada de dinheiro muda: nenhum valor, soma, imposto ou repasse é tocado aqui.
-- ===========================================================================

create table if not exists public.developers (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies(id) on delete cascade,
  name                  text not null,
  -- Prazo de pagamento depois da nota emitida. Nulo = ainda não sei.
  payment_days          integer,
  payment_days_business boolean not null default true,
  notes                 text,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  unique (company_id, name)
);

comment on table public.developers is
  'Construtora ou incorporadora. Guarda o prazo de pagamento depois da nota fiscal emitida.';
comment on column public.developers.payment_days is
  'Dias até o pagamento, contados da emissão da nota. Nulo = prazo desconhecido.';
comment on column public.developers.payment_days_business is
  'true = dias úteis (segunda a sexta, sem feriados); false = dias corridos.';

alter table public.developers enable row level security;
drop policy if exists admin_tudo on public.developers;
create policy admin_tudo on public.developers for all using (public.is_admin()) with check (public.is_admin());

alter table public.cost_centers
  add column if not exists developer_id uuid references public.developers(id) on delete set null,
  add column if not exists trigger_note text;

comment on column public.cost_centers.trigger_note is
  'O gatilho de liberação da comissão neste empreendimento, em texto, como está no contrato.';

alter table public.sale_installments
  add column if not exists trigger_note        text,
  add column if not exists trigger_met_date    date,
  add column if not exists invoice_issued_date date,
  add column if not exists invoice_number      text;

comment on column public.sale_installments.trigger_note is
  'O gatilho desta parcela, copiado do empreendimento no registro da venda e ajustável.';
comment on column public.sale_installments.trigger_met_date is
  'Quando o gatilho foi atingido (a comissão ficou liberada). Nulo = ainda esperando.';
comment on column public.sale_installments.invoice_issued_date is
  'Quando a nota fiscal desta parcela foi emitida para a construtora.';

-- ------------------------------------------------------------------ dias úteis
create or replace function public.add_business_days(p_data date, p_dias integer)
returns date
language plpgsql
immutable
as $$
declare
  d date := p_data;
  n integer := 0;
begin
  if p_data is null or p_dias is null then return null; end if;
  if p_dias <= 0 then return p_data; end if;
  while n < p_dias loop
    d := d + 1;
    -- 6 = sábado, 7 = domingo. Feriado não entra: a data se corrige na mão.
    if extract(isodow from d) < 6 then n := n + 1; end if;
  end loop;
  return d;
end $$;

-- --------------------------------------------------------- marco 1: o gatilho
create or replace function public.set_installment_trigger(
  p_installment uuid,
  p_date        date,
  p_note        text default null
) returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  i public.sale_installments;
begin
  if not public.is_admin() then
    raise exception 'Só o administrador pode marcar o gatilho.';
  end if;
  select * into i from public.sale_installments where id = p_installment for update;
  if not found then raise exception 'Parcela não encontrada.'; end if;
  if i.status = 'cancelada' then raise exception 'Parcela cancelada.'; end if;

  update public.sale_installments
     set trigger_met_date = p_date,
         trigger_note = coalesce(nullif(p_note, ''), trigger_note)
   where id = i.id;
end $$;

-- ----------------------------------------------------- marco 2: a nota fiscal
-- Marca a nota e recalcula a previsão de pagamento pelo prazo da construtora.
-- Devolve a nova data prevista (ou a antiga, se a construtora não tem prazo).
create or replace function public.set_installment_invoice(
  p_installment uuid,
  p_date        date,
  p_number      text default null
) returns date
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  i        public.sale_installments;
  v_dias   integer;
  v_uteis  boolean;
  v_nova   date;
begin
  if not public.is_admin() then
    raise exception 'Só o administrador pode marcar a nota fiscal.';
  end if;
  select * into i from public.sale_installments where id = p_installment for update;
  if not found then raise exception 'Parcela não encontrada.'; end if;
  if i.status <> 'prevista' then
    raise exception 'Só parcela que ainda não entrou tem nota a emitir.';
  end if;

  if p_date is null then
    update public.sale_installments
       set invoice_issued_date = null, invoice_number = null
     where id = i.id;
    return i.expected_date;
  end if;

  select d.payment_days, d.payment_days_business
    into v_dias, v_uteis
    from public.sales s
    join public.cost_centers cc on cc.id = s.cost_center_id
    join public.developers d on d.id = cc.developer_id
   where s.id = i.sale_id;

  v_nova := case
    when v_dias is null then i.expected_date
    when coalesce(v_uteis, true) then public.add_business_days(p_date, v_dias)
    else p_date + v_dias
  end;

  update public.transactions set due_date = v_nova
   where sale_installment_id = i.id and status = 'pending';

  update public.sale_installments
     set invoice_issued_date = p_date,
         invoice_number = nullif(p_number, ''),
         trigger_met_date = coalesce(trigger_met_date, p_date),
         expected_date = v_nova
   where id = i.id;

  return v_nova;
end $$;

-- ------------------------------------------ construtoras a partir do que existe
insert into public.developers (company_id, name, payment_days, payment_days_business)
select cc.company_id, cc.developer,
       case when cc.developer ilike '%lotisa%' then 10 end,
       true
  from public.cost_centers cc
 where cc.developer is not null and btrim(cc.developer) <> ''
 group by cc.company_id, cc.developer
on conflict (company_id, name) do nothing;

update public.cost_centers cc
   set developer_id = d.id
  from public.developers d
 where d.company_id = cc.company_id and d.name = cc.developer and cc.developer_id is null;

-- O gatilho que o Rafael descreveu para o PortoVelas, para ele conferir e ajustar.
update public.cost_centers
   set trigger_note = '50% da comissão quando o cliente paga 5% do valor do imóvel; os outros 50% ao atingir 8%.'
 where name = 'PortoVelas' and trigger_note is null;

-- ------------------------- o registro da venda passa a gravar o gatilho da parcela
do $mig$
declare
  d text;
  velho constant text := 'sale_id, idx, count, expected_date, amount,
      iss_amount, simples_amount, broker_amount, owner_amount, net_amount, status
    ) values (
      v_sale, v_idx, v_n, v_venc, v_amount,
      v_iss, v_simples, v_broker, v_owner,
      v_amount - v_iss - v_simples - v_broker - v_owner, ''prevista''';
  novo constant text := 'sale_id, idx, count, expected_date, amount,
      iss_amount, simples_amount, broker_amount, owner_amount, net_amount, status,
      trigger_note
    ) values (
      v_sale, v_idx, v_n, v_venc, v_amount,
      v_iss, v_simples, v_broker, v_owner,
      v_amount - v_iss - v_simples - v_broker - v_owner, ''prevista'',
      coalesce(nullif(v_item->>''trigger_note'', ''''),
               (select cc.trigger_note from public.cost_centers cc
                 where cc.id = nullif(p->>''cost_center_id'', '''')::uuid))';
begin
  d := pg_get_functiondef('public.register_sale(jsonb)'::regprocedure);
  if position(novo in d) > 0 then
    raise notice 'register_sale já grava o gatilho';
  elsif position(velho in d) = 0 then
    raise exception 'register_sale: não achei o insert da parcela para acrescentar o gatilho';
  else
    execute replace(d, velho, novo);
  end if;
end $mig$;
