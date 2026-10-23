-- ===========================================================================
-- 041 — PLANO DE CARREIRA: CONFIGURAÇÃO, METAS, TIMES E GESTÃO DO GESTOR
-- ===========================================================================
-- PROJETO CORRETO: souza-financeiro (iejmrzcgoeoxhhcnqodn). NUNCA o icrm.
-- Seguro repetir. Só ADICIONA: nenhuma venda de hoje tem gestor, então nenhum
-- valor gravado muda.
--
-- Decidido com o Rafael em 22-23/10/2026 (docs/plano-reconstrucao-2026-10.md,
-- seção 3.1) e nos PDFs de plano de carreira de outubro/2026:
--
--   · TODO percentual é editável e tem vigência: comissão padrão (5% em
--     lançamento, 6% em imóvel de terceiros), ISS 3% (só quando retido), DAS
--     6%, gestão do gestor (3% fixo, 8% quando a imobiliária bate a meta
--     geral), níveis 40/45/50% e os VGVs que mudam de nível.
--   · Metas de VGV da imobiliária e de cada corretor, com vigência (o corretor
--     novo é cadastrado em duas linhas: R$ 420 mil nos 2 primeiros meses e
--     R$ 750 mil depois).
--   · Perfil do corretor: quem é o gestor do time, nível por decisão da
--     diretoria (o Dionata é Sênior), % próprio e se conta para a meta (as
--     vendas do Rafael não contam).
--   · A gestão vira uma linha por parcela, como a do corretor: nasce com a
--     venda, segue o recebimento e sai com o cancelamento. Base = comissão −
--     ISS retido − DAS. Não há gestão sobre as vendas do próprio gestor.
--   · A venda guarda se é lançamento ou imóvel de terceiros.
-- ===========================================================================

-- ---------------------------------------------------------------- configuração
create table if not exists public.commission_settings (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references public.companies(id) on delete cascade,
  -- Vale desta data em diante, até a próxima linha. Venda já lançada guarda o
  -- que foi usado nela: mudar um % aqui não reescreve o passado.
  valid_from             date not null,
  launch_commission_pct  numeric(6,3) not null default 5,
  resale_commission_pct  numeric(6,3) not null default 6,
  iss_pct                numeric(6,3) not null default 3,
  das_pct                numeric(6,3) not null default 6,
  manager_base_pct       numeric(6,3) not null default 3,
  manager_bonus_pct      numeric(6,3) not null default 8,
  level1_pct             numeric(6,3) not null default 40,
  level2_pct             numeric(6,3) not null default 45,
  level3_pct             numeric(6,3) not null default 50,
  level2_from_vgv        numeric(16,2) not null default 5000000,
  level3_from_vgv        numeric(16,2) not null default 10000000,
  maintenance_vgv_12m    numeric(16,2) not null default 2500000,
  notes                  text,
  created_at             timestamptz not null default now(),
  unique (company_id, valid_from)
);
comment on table public.commission_settings is
  'Percentuais do negócio com vigência: comissão, impostos, gestão do gestor e níveis do plano de carreira.';

-- ---------------------------------------------------------------- metas
create table if not exists public.sales_goals (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  -- Nulo = a meta geral da imobiliária. Preenchido = a meta do corretor.
  contact_id   uuid references public.contacts(id) on delete cascade,
  monthly_vgv  numeric(16,2) not null check (monthly_vgv > 0),
  start_month  date not null check (extract(day from start_month) = 1),
  end_month    date check (end_month is null or (extract(day from end_month) = 1 and end_month >= start_month)),
  notes        text,
  created_at   timestamptz not null default now()
);
comment on table public.sales_goals is
  'Metas de VGV por mês, com vigência: da imobiliária (contact_id nulo) e de cada corretor.';
create index if not exists sales_goals_company_idx on public.sales_goals (company_id);

-- ---------------------------------------------------------------- perfil do corretor
create table if not exists public.broker_profiles (
  contact_id        uuid primary key references public.contacts(id) on delete cascade,
  company_id        uuid not null references public.companies(id) on delete cascade,
  -- O gestor do time deste corretor. Ele ganha gestão sobre as vendas deste corretor.
  manager_id        uuid references public.contacts(id) on delete set null,
  is_manager        boolean not null default false,
  -- Nível por decisão da diretoria. Nulo = o nível sai do VGV acumulado.
  level_override    text check (level_override is null or level_override in ('corretor', 'pleno', 'senior')),
  -- % próprio, acima do nível. Nulo = o % do nível.
  pct_override      numeric(6,3),
  -- As vendas do Rafael não contam para a meta (decisão de 23/10/2026).
  counts_for_goals  boolean not null default true,
  started_at        date,
  notes             text,
  created_at        timestamptz not null default now(),
  check (manager_id is null or manager_id <> contact_id)
);
comment on table public.broker_profiles is
  'Plano de carreira de cada corretor: gestor do time, nível, % próprio e se conta para a meta.';

-- ---------------------------------------------------------------- a venda e a parcela
alter table public.sales
  add column if not exists product_type text check (product_type is null or product_type in ('lancamento', 'terceiros')),
  add column if not exists manager_id  uuid references public.contacts(id) on delete set null,
  add column if not exists manager_pct numeric(6,3);
comment on column public.sales.product_type is 'lancamento (comissão padrão 5%) ou terceiros (6%).';
comment on column public.sales.manager_pct is 'Gestão do gestor sobre a base desta venda: 3% na venda, 8% se o mês bater a meta geral.';

alter table public.sale_installments
  add column if not exists manager_amount numeric(14,2) not null default 0,
  add column if not exists manager_tx_id  uuid references public.transactions(id) on delete set null;

-- ---------------------------------------------------------------- segurança
alter table public.commission_settings enable row level security;
drop policy if exists admin_tudo on public.commission_settings;
create policy admin_tudo on public.commission_settings for all using (public.is_admin()) with check (public.is_admin());

alter table public.sales_goals enable row level security;
drop policy if exists admin_tudo on public.sales_goals;
create policy admin_tudo on public.sales_goals for all using (public.is_admin()) with check (public.is_admin());

alter table public.broker_profiles enable row level security;
drop policy if exists admin_tudo on public.broker_profiles;
create policy admin_tudo on public.broker_profiles for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- dados iniciais
do $$
declare
  v_imob    uuid;
  v_dionata uuid := '116f89db-990f-4547-9a8b-41ff43b9f4dc';
  v_rafael  uuid := 'b90684e2-c267-44c2-a99e-211f098ae35a';
begin
  select id into v_imob from public.companies where slug = 'imobiliaria';
  if v_imob is null then raise exception 'não achei a imobiliária: nada gravado'; end if;

  -- Todas as vendas de hoje são de lançamento (PortoVelas, Lago, Urban Club).
  update public.sales set product_type = 'lancamento' where product_type is null;

  insert into public.commission_settings (company_id, valid_from, notes)
  values (v_imob, '2026-10-01', 'Plano de carreira de outubro/2026, com as decisões de 22-23/10/2026.')
  on conflict (company_id, valid_from) do nothing;

  if not exists (select 1 from public.sales_goals where company_id = v_imob) then
    insert into public.sales_goals (company_id, contact_id, monthly_vgv, start_month, notes) values
      (v_imob, null, 1000000, '2026-10-01', 'Meta geral. Conta o VGV dos corretores, não o do Rafael.'),
      (v_imob, v_dionata, 750000, '2026-10-01', null);
  end if;

  if exists (select 1 from public.contacts where id = v_dionata) then
    insert into public.broker_profiles (contact_id, company_id, is_manager, level_override, notes)
    values (v_dionata, v_imob, true, 'senior', 'Sênior por decisão da diretoria (23/10/2026). Gestor do time.')
    on conflict (contact_id) do nothing;
  end if;
  if exists (select 1 from public.contacts where id = v_rafael) then
    insert into public.broker_profiles (contact_id, company_id, counts_for_goals, notes)
    values (v_rafael, v_imob, false, 'As vendas do Rafael não contam para as metas.')
    on conflict (contact_id) do nothing;
  end if;
end $$;

-- ===========================================================================
-- AS FUNÇÕES DA VENDA, AGORA COM A GESTÃO
-- ===========================================================================
-- Mesmo corpo de antes; o que muda está marcado com "gestão". A parte do sócio
-- (owner) passa a sair do que sobra depois do corretor E da gestão.

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
  v_gestor_nome  text;
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
  v_manager      numeric(14,2);
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

  -- gestão: o gestor não ganha gestão sobre a própria venda.
  if nullif(p->>'manager_id', '') is not null
     and nullif(p->>'manager_id', '') = nullif(p->>'broker_id', '') then
    raise exception 'O gestor não ganha gestão sobre a própria venda.';
  end if;

  insert into public.sales (
    company_id, title, cost_center_id, unit, client_name, sale_date,
    property_value, commission_pct, commission_total,
    partner_name, partner_share_pct,
    issues_invoice, simples_pct, retains_iss, iss_pct,
    broker_id, broker_pct, owner_profit_pct, notes, legacy_group_id,
    is_personal, product_type, manager_id, manager_pct
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
    v_pf,
    nullif(p->>'product_type', ''),
    case when v_pf then null else nullif(p->>'manager_id', '')::uuid end,
    case when v_pf then null else nullif(p->>'manager_pct', '')::numeric end
  ) returning id into v_sale;

  select name into v_broker_nome from public.contacts
   where id = nullif(p->>'broker_id', '')::uuid;
  select name into v_gestor_nome from public.contacts
   where id = nullif(p->>'manager_id', '')::uuid;

  v_titulo := p->>'title';

  for v_item in select * from jsonb_array_elements(v_parcelas) loop
    v_idx := coalesce((v_item->>'idx')::integer, 1);
    v_amount := round((v_item->>'amount')::numeric, 2);
    v_venc := (v_item->>'expected_date')::date;
    v_sufixo := case when v_n > 1 then format(' — Pc %s/%s', v_idx, v_n) else '' end;

    if v_pf then
      v_iss := 0; v_simples := 0; v_broker := 0; v_manager := 0; v_owner := 0;
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
      -- gestão
      v_manager := case
        when nullif(p->>'manager_id', '') is not null and nullif(p->>'manager_pct', '') is not null
        then round(v_base * (p->>'manager_pct')::numeric / 100, 2)
        else 0 end;
      v_owner := case
        when nullif(p->>'owner_profit_pct', '') is not null
        then round((v_base - v_broker - v_manager) * (p->>'owner_profit_pct')::numeric / 100, 2)
        else 0 end;
    end if;

    insert into public.sale_installments (
      sale_id, idx, count, expected_date, amount,
      iss_amount, simples_amount, broker_amount, manager_amount, owner_amount, net_amount, status,
      trigger_note
    ) values (
      v_sale, v_idx, v_n, v_venc, v_amount,
      v_iss, v_simples, v_broker, v_manager, v_owner,
      v_amount - v_iss - v_simples - v_broker - v_manager - v_owner, 'prevista',
      coalesce(nullif(v_item->>'trigger_note', ''),
               (select cc.trigger_note from public.cost_centers cc
                 where cc.id = nullif(p->>'cost_center_id', '')::uuid))
    ) returning id into v_inst;

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
        v_simples, (p->>'sale_date')::date, 'pending', public.venc_das(v_venc),
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

    -- gestão: uma linha por parcela, custo direto da venda.
    if v_manager > 0 then
      insert into public.transactions (
        company_id, kind, category, dre_group, description, amount,
        competence_date, status, due_date, contact_id,
        group_id, installment_index, installment_count,
        cost_center_id, sale_id, sale_installment_id
      ) values (
        v_company, 'expense', 'Gestão de Equipe', 'cost_of_sale',
        format('Gestão %s %s%% — %s%s', coalesce(v_gestor_nome, 'gestor'), p->>'manager_pct', v_titulo, v_sufixo),
        v_manager, (p->>'sale_date')::date, 'pending', v_venc,
        (p->>'manager_id')::uuid,
        v_sale, case when v_n > 1 then v_idx end, case when v_n > 1 then v_n end,
        nullif(p->>'cost_center_id', '')::uuid, v_sale, v_inst
      ) returning id into v_tx;
      update public.sale_installments set manager_tx_id = v_tx where id = v_inst;
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

create or replace function public.receive_installment(p_installment uuid, p_date date, p_account uuid default null::uuid, p_received numeric default null::numeric, p_iss numeric default null::numeric, p_other numeric default 0, p_note text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  i          public.sale_installments;
  s          public.sales;
  v_iss      numeric(14,2);
  v_simples  numeric(14,2);
  v_base     numeric(14,2);
  v_broker   numeric(14,2);
  v_manager  numeric(14,2);
  v_owner    numeric(14,2);
  v_other    numeric(14,2);
  v_recebido numeric(14,2);
  v_tx       uuid;
  v_sufixo   text;
begin
  if not public.is_admin() then
    raise exception 'Só o administrador pode dar baixa.';
  end if;

  select * into i from public.sale_installments where id = p_installment for update;
  if not found then raise exception 'Parcela não encontrada.'; end if;
  if i.status <> 'prevista' then
    raise exception 'Esta parcela já está %.', i.status;
  end if;
  select * into s from public.sales where id = i.sale_id;

  v_iss := coalesce(
    round(p_iss, 2),
    case when s.retains_iss then round(i.amount * s.iss_pct / 100, 2) else 0 end
  );
  v_other := coalesce(round(p_other, 2), 0);
  v_recebido := coalesce(round(p_received, 2), i.amount - v_iss - v_other);

  if abs(v_recebido + v_iss + v_other - i.amount) > 0.01 then
    raise exception
      'A conta não fecha: recebido % + ISS % + outros % deveria dar % (valor da parcela).',
      v_recebido, v_iss, v_other, i.amount;
  end if;

  v_simples := case when s.issues_invoice
    then round((i.amount - v_iss) * s.simples_pct / 100, 2) else 0 end;
  v_base := i.amount - v_iss - v_simples;
  v_broker := case when s.broker_id is not null and s.broker_pct is not null
    then round(v_base * s.broker_pct / 100, 2) else 0 end;
  -- gestão
  v_manager := case when s.manager_id is not null and s.manager_pct is not null
    then round(v_base * s.manager_pct / 100, 2) else 0 end;
  v_owner := case when s.owner_profit_pct is not null
    then round((v_base - v_broker - v_manager) * s.owner_profit_pct / 100, 2) else 0 end;
  v_sufixo := case when i.count > 1 then format(' — Pc %s/%s', i.idx, i.count) else '' end;

  update public.transactions
     set status = 'settled', settled_date = p_date, due_date = null, account_id = p_account
   where id = i.revenue_tx_id;

  if v_iss > 0 then
    if i.iss_tx_id is null then
      insert into public.transactions (
        company_id, kind, category, dre_group, description, amount,
        competence_date, status, settled_date, account_id, counterparty,
        group_id, installment_index, installment_count, cost_center_id, sale_id, sale_installment_id
      ) values (
        s.company_id, 'expense', 'Impostos e Taxas', 'variable_expense',
        format('ISS retido na fonte — %s%s', s.title, v_sufixo), v_iss,
        s.sale_date, 'settled', p_date, p_account, s.partner_name,
        s.id, case when i.count > 1 then i.idx end, case when i.count > 1 then i.count end,
        s.cost_center_id, s.id, i.id
      ) returning id into v_tx;
      update public.sale_installments set iss_tx_id = v_tx where id = i.id;
    else
      update public.transactions
         set amount = v_iss, status = 'settled', settled_date = p_date,
             due_date = null, account_id = p_account
       where id = i.iss_tx_id;
    end if;
  elsif i.iss_tx_id is not null then
    delete from public.transactions where id = i.iss_tx_id;
    update public.sale_installments set iss_tx_id = null where id = i.id;
  end if;

  if i.simples_tx_id is not null then
    delete from public.transactions where id = i.simples_tx_id and status = 'pending';
    update public.sale_installments set simples_tx_id = null where id = i.id;
  end if;

  if v_broker > 0 and i.broker_tx_id is not null then
    update public.transactions
       set amount = v_broker, due_date = p_date
     where id = i.broker_tx_id and status = 'pending';
  end if;

  -- gestão: liberada junto com a do corretor.
  if v_manager > 0 and i.manager_tx_id is not null then
    update public.transactions
       set amount = v_manager, due_date = p_date
     where id = i.manager_tx_id and status = 'pending';
  end if;

  if v_owner > 0 and i.owner_tx_id is not null then
    update public.transactions
       set amount = v_owner, due_date = p_date
     where id = i.owner_tx_id and status = 'pending';
  end if;

  if v_other > 0 then
    insert into public.transactions (
      company_id, kind, category, dre_group, description, amount,
      competence_date, status, settled_date, account_id,
      group_id, installment_index, installment_count, cost_center_id, sale_id, sale_installment_id
    ) values (
      s.company_id, 'expense', 'Outras Variáveis', 'variable_expense',
      format('Dedução no recebimento — %s%s%s', s.title, v_sufixo,
             case when p_note is null then '' else ' (' || p_note || ')' end),
      v_other, s.sale_date, 'settled', p_date, p_account,
      s.id, case when i.count > 1 then i.idx end, case when i.count > 1 then i.count end,
      s.cost_center_id, s.id, i.id
    ) returning id into v_tx;
    update public.sale_installments set other_tx_id = v_tx where id = i.id;
  end if;

  update public.sale_installments
     set status = 'recebida',
         received_date = p_date,
         received_amount = v_recebido,
         account_id = p_account,
         iss_amount = v_iss,
         simples_amount = v_simples,
         broker_amount = v_broker,
         manager_amount = v_manager,
         owner_amount = v_owner,
         net_amount = i.amount - v_iss - v_simples - v_broker - v_manager - v_owner - v_other,
         notes = case when p_note is null then notes
                      else trim(coalesce(notes || ' | ', '') || p_note) end
   where id = i.id;

  perform public.sincroniza_das(s.company_id, p_date);

  if not exists (
    select 1 from public.sale_installments
     where sale_id = s.id and status = 'prevista'
  ) then
    update public.sales set status = 'concluida' where id = s.id and status = 'ativa';
  end if;
end $function$;

create or replace function public.undo_receive_installment(p_installment uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  i         public.sale_installments;
  s         public.sales;
  v_iss     numeric(14,2);
  v_simples numeric(14,2);
  v_base    numeric(14,2);
  v_broker  numeric(14,2);
  v_manager numeric(14,2);
  v_owner   numeric(14,2);
  v_tx      uuid;
  v_mes     date;
begin
  if not public.is_admin() then
    raise exception 'Só o administrador pode desfazer uma baixa.';
  end if;

  select * into i from public.sale_installments where id = p_installment for update;
  if not found then raise exception 'Parcela não encontrada.'; end if;
  if i.status <> 'recebida' then raise exception 'Esta parcela não está recebida.'; end if;
  select * into s from public.sales where id = i.sale_id;
  v_mes := i.received_date;

  if i.broker_tx_id is not null
     and exists (select 1 from public.transactions where id = i.broker_tx_id and status = 'settled') then
    raise exception 'A comissão do corretor desta parcela já foi paga. Estorne o pagamento primeiro.';
  end if;
  -- gestão
  if i.manager_tx_id is not null
     and exists (select 1 from public.transactions where id = i.manager_tx_id and status = 'settled') then
    raise exception 'A gestão desta parcela já foi paga. Estorne o pagamento primeiro.';
  end if;

  v_iss := case when s.retains_iss then round(i.amount * s.iss_pct / 100, 2) else 0 end;
  v_simples := case when s.issues_invoice
    then round((i.amount - v_iss) * s.simples_pct / 100, 2) else 0 end;
  v_base := i.amount - v_iss - v_simples;
  v_broker := case when s.broker_id is not null and s.broker_pct is not null
    then round(v_base * s.broker_pct / 100, 2) else 0 end;
  v_manager := case when s.manager_id is not null and s.manager_pct is not null
    then round(v_base * s.manager_pct / 100, 2) else 0 end;
  v_owner := case when s.owner_profit_pct is not null
    then round((v_base - v_broker - v_manager) * s.owner_profit_pct / 100, 2) else 0 end;

  update public.transactions
     set status = 'pending', settled_date = null, due_date = i.expected_date, account_id = null
   where id = i.revenue_tx_id;

  if i.iss_tx_id is not null then
    if v_iss > 0 then
      update public.transactions
         set amount = v_iss, status = 'pending', settled_date = null,
             due_date = i.expected_date, account_id = null
       where id = i.iss_tx_id;
    else
      delete from public.transactions where id = i.iss_tx_id;
      update public.sale_installments set iss_tx_id = null where id = i.id;
    end if;
  end if;

  if v_simples > 0 then
    if i.simples_tx_id is null then
      insert into public.transactions (
        company_id, kind, category, dre_group, description, amount,
        competence_date, status, due_date,
        group_id, installment_index, installment_count, cost_center_id, sale_id, sale_installment_id
      ) values (
        s.company_id, 'expense', 'Impostos e Taxas', 'variable_expense',
        format('Simples %s%% — %s%s', s.simples_pct, s.title,
               case when i.count > 1 then format(' — Pc %s/%s', i.idx, i.count) else '' end),
        v_simples, s.sale_date, 'pending', public.venc_das(i.expected_date),
        s.id, case when i.count > 1 then i.idx end, case when i.count > 1 then i.count end,
        s.cost_center_id, s.id, i.id
      ) returning id into v_tx;
      update public.sale_installments set simples_tx_id = v_tx where id = i.id;
    else
      update public.transactions
         set amount = v_simples, due_date = public.venc_das(i.expected_date)
       where id = i.simples_tx_id and status = 'pending';
    end if;
  end if;
  if i.broker_tx_id is not null then
    update public.transactions
       set amount = v_broker, due_date = i.expected_date
     where id = i.broker_tx_id and status = 'pending';
  end if;
  if i.manager_tx_id is not null then
    update public.transactions
       set amount = v_manager, due_date = i.expected_date
     where id = i.manager_tx_id and status = 'pending';
  end if;
  if i.owner_tx_id is not null then
    update public.transactions
       set amount = v_owner, due_date = i.expected_date
     where id = i.owner_tx_id and status = 'pending';
  end if;
  if i.other_tx_id is not null then
    delete from public.transactions where id = i.other_tx_id;
  end if;

  update public.sale_installments
     set status = 'prevista', received_date = null, received_amount = null,
         account_id = null, other_tx_id = null,
         iss_amount = v_iss, simples_amount = v_simples,
         broker_amount = v_broker, manager_amount = v_manager, owner_amount = v_owner,
         broker_adjustment = 0,
         net_amount = i.amount - v_iss - v_simples - v_broker - v_manager - v_owner
   where id = i.id;

  perform public.sincroniza_das(s.company_id, v_mes);

  update public.sales set status = 'ativa' where id = s.id and status = 'concluida';
end $function$;

-- ---------------------------------------------------------------- o bônus do gestor
/*
 * Fechado o mês, se a imobiliária bateu a meta geral, o Rafael aplica o
 * bônus: a gestão das vendas daquele mês passa do % base para o % com meta.
 * Também desfaz (passando o % base). Só mexe em gestão ainda não paga; a já
 * paga é contada e devolvida, para a tela avisar.
 */
create or replace function public.apply_manager_bonus(p_month date, p_pct numeric)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  s          public.sales;
  i          public.sale_installments;
  v_base     numeric(14,2);
  v_novo     numeric(14,2);
  v_pagas    integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Só o administrador pode aplicar o bônus do gestor.';
  end if;
  if p_pct is null or p_pct < 0 or p_pct > 100 then
    raise exception 'Percentual inválido: %.', p_pct;
  end if;

  for s in
    select * from public.sales
     where manager_id is not null and status <> 'cancelada' and not is_personal
       and date_trunc('month', sale_date) = date_trunc('month', p_month)
  loop
    update public.sales set manager_pct = p_pct where id = s.id;
    for i in select * from public.sale_installments where sale_id = s.id and status <> 'cancelada' loop
      if i.manager_tx_id is not null
         and exists (select 1 from public.transactions where id = i.manager_tx_id and status = 'settled') then
        v_pagas := v_pagas + 1;
        continue;
      end if;
      v_base := i.amount - i.iss_amount - i.simples_amount;
      v_novo := round(v_base * p_pct / 100, 2);
      update public.sale_installments
         set manager_amount = v_novo,
             net_amount = net_amount + manager_amount - v_novo
       where id = i.id;
      if i.manager_tx_id is not null then
        update public.transactions
           set amount = v_novo,
               description = regexp_replace(description, ' [0-9.,]+% — ', format(' %s%% — ', p_pct))
         where id = i.manager_tx_id and status = 'pending';
      end if;
    end loop;
  end loop;
  return v_pagas;
end $function$;

-- Toda função nova fecha o PUBLIC (regra do projeto) e abre só para quem entra logado.
revoke all on function public.apply_manager_bonus(date, numeric) from public, anon;
grant execute on function public.apply_manager_bonus(date, numeric) to authenticated;

notify pgrst, 'reload schema';
