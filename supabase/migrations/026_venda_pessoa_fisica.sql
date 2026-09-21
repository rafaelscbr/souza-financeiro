-- ===========================================================================
-- 026 — VENDA DE PESSOA FÍSICA
-- ===========================================================================
-- Decidido com o Rafael em 21/09/2026.
--
-- Duas vendas do PortoVelas (513-B / Daniela e 714-B / Andreia) foram feitas
-- quando ele ainda estava em outra imobiliária: a comissão entra para ELE como
-- pessoa física, não para a Souza. Estavam lançadas como se fossem da empresa —
-- a Souza recebia, pagava 6% de Simples e repassava 100% a ele como corretor.
--
-- A partir daqui a venda pode ser marcada como PESSOA FÍSICA. Quando é:
--
--   · não cria lançamento nenhum no razão da imobiliária (nem receita, nem
--     imposto, nem comissão, nem distribuição): o dinheiro não passa pelo
--     caixa dela, então não pode aparecer em A receber, A pagar nem no DRE;
--   · a parcela fica gravada com o valor cheio (imposto e comissão zerados),
--     só para a previsão do que entra para ele.
--
-- O que já foi RECEBIDO não é tocado: a 1ª parcela do 513-B entrou em 15/06 e
-- fica no histórico como entrou. Some só o que ainda estava pendente.
-- ===========================================================================

alter table public.sales
  add column if not exists is_personal boolean not null default false;

comment on column public.sales.is_personal is
  'true = a comissão é do Rafael como pessoa física, não da imobiliária: não gera lançamento no razão da empresa.';

-- ------------------------------------------------- o registro passa a conhecer
create or replace function public.register_sale(p jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company      uuid;
  v_sale         uuid;
  v_broker_nome  text;
  v_parcelas     jsonb;
  v_n            integer;
  v_item         jsonb;
  v_idx          integer;
  v_inst         uuid;
  v_amount       numeric(14,2);
  v_iss          numeric(14,2);
  v_simples      numeric(14,2);
  v_base         numeric(14,2);
  v_broker       numeric(14,2);
  v_owner        numeric(14,2);
  v_venc         date;
  v_titulo       text;
  v_sufixo       text;
  v_tx           uuid;
  v_soma         numeric(14,2) := 0;
  v_total        numeric(14,2);
  v_pf           boolean;
begin
  if not public.is_admin() then
    raise exception 'Só o administrador pode registrar vendas.';
  end if;

  v_company := coalesce(
    (p->>'company_id')::uuid,
    (select id from public.companies where slug = 'imobiliaria' and not is_archived)
  );
  if v_company is null then
    raise exception 'Empresa não encontrada.';
  end if;

  -- Venda de pessoa física: nada dela entra no razão da imobiliária.
  v_pf := coalesce((p->>'is_personal')::boolean, false);

  v_parcelas := coalesce(p->'installments', '[]'::jsonb);
  v_n := jsonb_array_length(v_parcelas);
  if v_n < 1 then
    raise exception 'A venda precisa de pelo menos uma parcela.';
  end if;

  v_total := round((p->>'commission_total')::numeric, 2);

  for v_item in select * from jsonb_array_elements(v_parcelas) loop
    v_soma := v_soma + round((v_item->>'amount')::numeric, 2);
  end loop;
  if abs(v_soma - v_total) > 0.01 then
    raise exception 'As parcelas somam % e a comissão é % — precisa fechar.', v_soma, v_total;
  end if;

  insert into public.sales (
    company_id, title, cost_center_id, unit, client_name, sale_date,
    property_value, commission_pct, commission_total,
    partner_name, partner_share_pct,
    issues_invoice, simples_pct, retains_iss, iss_pct,
    broker_id, broker_pct, owner_profit_pct, notes, legacy_group_id,
    is_personal
  ) values (
    v_company,
    p->>'title',
    nullif(p->>'cost_center_id', '')::uuid,
    nullif(p->>'unit', ''),
    nullif(p->>'client_name', ''),
    (p->>'sale_date')::date,
    nullif(p->>'property_value', '')::numeric,
    nullif(p->>'commission_pct', '')::numeric,
    v_total,
    nullif(p->>'partner_name', ''),
    nullif(p->>'partner_share_pct', '')::numeric,
    case when v_pf then false else coalesce((p->>'issues_invoice')::boolean, true) end,
    case when v_pf then 0 else coalesce(nullif(p->>'simples_pct', '')::numeric, 6) end,
    case when v_pf then false else coalesce((p->>'retains_iss')::boolean, false) end,
    case when v_pf then 0 else coalesce(nullif(p->>'iss_pct', '')::numeric, 0) end,
    case when v_pf then null else nullif(p->>'broker_id', '')::uuid end,
    case when v_pf then null else nullif(p->>'broker_pct', '')::numeric end,
    case when v_pf then null else nullif(p->>'owner_profit_pct', '')::numeric end,
    nullif(p->>'notes', ''),
    nullif(p->>'legacy_group_id', '')::uuid,
    v_pf
  ) returning id into v_sale;

  select name into v_broker_nome from public.contacts
   where id = nullif(p->>'broker_id', '')::uuid;

  v_titulo := p->>'title';

  for v_item in select * from jsonb_array_elements(v_parcelas) loop
    v_idx := coalesce((v_item->>'idx')::integer, 1);
    v_amount := round((v_item->>'amount')::numeric, 2);
    v_venc := (v_item->>'expected_date')::date;
    v_sufixo := case when v_n > 1 then format(' — Pc %s/%s', v_idx, v_n) else '' end;

    if v_pf then
      -- Pessoa física: a parcela inteira é dele, sem imposto e sem repasse.
      v_iss := 0; v_simples := 0; v_broker := 0; v_owner := 0;
    else
      v_iss := case
        when coalesce((p->>'retains_iss')::boolean, false)
        then round(v_amount * coalesce(nullif(p->>'iss_pct', '')::numeric, 0) / 100, 2)
        else 0 end;
      v_simples := case
        when coalesce((p->>'issues_invoice')::boolean, true)
        then round((v_amount - v_iss) * coalesce(nullif(p->>'simples_pct', '')::numeric, 6) / 100, 2)
        else 0 end;
      v_base := v_amount - v_iss - v_simples;
      v_broker := case
        when nullif(p->>'broker_id', '') is not null and nullif(p->>'broker_pct', '') is not null
        then round(v_base * (p->>'broker_pct')::numeric / 100, 2)
        else 0 end;
      v_owner := case
        when nullif(p->>'owner_profit_pct', '') is not null
        then round((v_base - v_broker) * (p->>'owner_profit_pct')::numeric / 100, 2)
        else 0 end;
    end if;

    insert into public.sale_installments (
      sale_id, idx, count, expected_date, amount,
      iss_amount, simples_amount, broker_amount, owner_amount, net_amount, status,
      trigger_note
    ) values (
      v_sale, v_idx, v_n, v_venc, v_amount,
      v_iss, v_simples, v_broker, v_owner,
      v_amount - v_iss - v_simples - v_broker - v_owner, 'prevista',
      coalesce(nullif(v_item->>'trigger_note', ''),
               (select cc.trigger_note from public.cost_centers cc
                 where cc.id = nullif(p->>'cost_center_id', '')::uuid))
    ) returning id into v_inst;

    -- Daqui para baixo é o razão da imobiliária. Venda de pessoa física não
    -- escreve nada aqui: não é dinheiro dela.
    if v_pf then
      continue;
    end if;

    insert into public.transactions (
      company_id, kind, category, dre_group, description, amount,
      competence_date, status, due_date, counterparty,
      property_value, commission_pct, broker_pct,
      group_id, installment_index, installment_count,
      cost_center_id, sale_id, sale_installment_id
    ) values (
      v_company, 'income', 'Comissões de Venda', 'revenue',
      v_titulo || v_sufixo, v_amount,
      (p->>'sale_date')::date, 'pending', v_venc, nullif(p->>'client_name', ''),
      nullif(p->>'property_value', '')::numeric,
      nullif(p->>'commission_pct', '')::numeric,
      nullif(p->>'broker_pct', '')::numeric,
      v_sale, case when v_n > 1 then v_idx end, case when v_n > 1 then v_n end,
      nullif(p->>'cost_center_id', '')::uuid, v_sale, v_inst
    ) returning id into v_tx;
    update public.sale_installments set revenue_tx_id = v_tx where id = v_inst;

    if v_iss > 0 then
      insert into public.transactions (
        company_id, kind, category, dre_group, description, amount,
        competence_date, status, due_date, counterparty,
        group_id, installment_index, installment_count,
        cost_center_id, sale_id, sale_installment_id
      ) values (
        v_company, 'expense', 'Impostos e Taxas', 'variable_expense',
        format('ISS retido na fonte %s%% — %s%s', coalesce(nullif(p->>'iss_pct',''),'0'), v_titulo, v_sufixo),
        v_iss, (p->>'sale_date')::date, 'pending', v_venc, nullif(p->>'partner_name', ''),
        v_sale, case when v_n > 1 then v_idx end, case when v_n > 1 then v_n end,
        nullif(p->>'cost_center_id', '')::uuid, v_sale, v_inst
      ) returning id into v_tx;
      update public.sale_installments set iss_tx_id = v_tx where id = v_inst;
    end if;

    if v_simples > 0 then
      insert into public.transactions (
        company_id, kind, category, dre_group, description, amount,
        competence_date, status, due_date,
        group_id, installment_index, installment_count,
        cost_center_id, sale_id, sale_installment_id
      ) values (
        v_company, 'expense', 'Impostos e Taxas', 'variable_expense',
        format('Simples %s%% — %s%s', coalesce(nullif(p->>'simples_pct',''),'6'), v_titulo, v_sufixo),
        v_simples, (p->>'sale_date')::date, 'pending', v_venc,
        v_sale, case when v_n > 1 then v_idx end, case when v_n > 1 then v_n end,
        nullif(p->>'cost_center_id', '')::uuid, v_sale, v_inst
      ) returning id into v_tx;
      update public.sale_installments set simples_tx_id = v_tx where id = v_inst;
    end if;

    if v_broker > 0 then
      insert into public.transactions (
        company_id, kind, category, dre_group, description, amount,
        competence_date, status, due_date, contact_id, broker_pct,
        group_id, installment_index, installment_count,
        cost_center_id, sale_id, sale_installment_id
      ) values (
        v_company, 'expense', 'Comissões de Corretores', 'cost_of_sale',
        format('Comissão %s %s%% — %s%s', coalesce(v_broker_nome, 'corretor'), p->>'broker_pct', v_titulo, v_sufixo),
        v_broker, (p->>'sale_date')::date, 'pending', v_venc,
        (p->>'broker_id')::uuid, (p->>'broker_pct')::numeric,
        v_sale, case when v_n > 1 then v_idx end, case when v_n > 1 then v_n end,
        nullif(p->>'cost_center_id', '')::uuid, v_sale, v_inst
      ) returning id into v_tx;
      update public.sale_installments set broker_tx_id = v_tx where id = v_inst;
    end if;

    if v_owner > 0 then
      insert into public.transactions (
        company_id, kind, category, dre_group, description, amount,
        competence_date, status, due_date, counterparty,
        group_id, installment_index, installment_count,
        cost_center_id, sale_id, sale_installment_id
      ) values (
        v_company, 'withdrawal', 'Distribuição de Lucro', 'withdrawal',
        format('Distribuição %s%% — %s%s', p->>'owner_profit_pct', v_titulo, v_sufixo),
        v_owner, (p->>'sale_date')::date, 'pending', v_venc, 'Rafael Alves de Souza',
        v_sale, case when v_n > 1 then v_idx end, case when v_n > 1 then v_n end,
        nullif(p->>'cost_center_id', '')::uuid, v_sale, v_inst
      ) returning id into v_tx;
      update public.sale_installments set owner_tx_id = v_tx where id = v_inst;
    end if;
  end loop;

  return v_sale;
end $function$;

-- ------------------------------------- as duas vendas que já estavam no banco
do $$
declare
  v_ids uuid[];
  n_tx int; n_parc int;
  v_pend numeric(14,2);
begin
  select array_agg(id) into v_ids
    from public.sales
   where title like '%513-B%' or title like '%714-B%';

  if v_ids is null or array_length(v_ids, 1) <> 2 then
    raise exception 'esperava achar as 2 vendas (513-B e 714-B) e achei %',
      coalesce(array_length(v_ids, 1), 0);
  end if;

  select coalesce(sum(amount), 0) into v_pend
    from public.transactions
   where sale_id = any(v_ids) and status = 'pending';

  update public.sales
     set is_personal = true,
         issues_invoice = false,
         simples_pct = 0,
         retains_iss = false,
         iss_pct = 0,
         broker_id = null,
         broker_pct = null,
         owner_profit_pct = null,
         notes = concat_ws(E'\n', nullif(notes, ''),
           'Venda feita quando o Rafael ainda estava em outra imobiliária: a comissão entra para ele como pessoa física, não para a Souza (decidido em 21/09/2026).')
   where id = any(v_ids);

  -- A parcela deixa de apontar para lançamento que vai sair.
  update public.sale_installments i
     set revenue_tx_id = case when exists (select 1 from public.transactions t where t.id = i.revenue_tx_id and t.status = 'pending') then null else i.revenue_tx_id end,
         iss_tx_id     = case when exists (select 1 from public.transactions t where t.id = i.iss_tx_id     and t.status = 'pending') then null else i.iss_tx_id end,
         simples_tx_id = case when exists (select 1 from public.transactions t where t.id = i.simples_tx_id and t.status = 'pending') then null else i.simples_tx_id end,
         broker_tx_id  = case when exists (select 1 from public.transactions t where t.id = i.broker_tx_id  and t.status = 'pending') then null else i.broker_tx_id end,
         owner_tx_id   = case when exists (select 1 from public.transactions t where t.id = i.owner_tx_id   and t.status = 'pending') then null else i.owner_tx_id end
   where i.sale_id = any(v_ids);

  delete from public.transactions
   where sale_id = any(v_ids) and status = 'pending';
  get diagnostics n_tx = row_count;

  -- Só o que ainda não entrou: o recebido fica como está, no histórico.
  update public.sale_installments
     set iss_amount = 0, simples_amount = 0, broker_amount = 0, owner_amount = 0,
         net_amount = amount
   where sale_id = any(v_ids) and status = 'prevista';
  get diagnostics n_parc = row_count;

  raise notice 'pessoa física: 2 vendas marcadas, % lançamentos pendentes apagados (R$ %), % parcelas com o valor cheio',
    n_tx, v_pend, n_parc;
end $$;
