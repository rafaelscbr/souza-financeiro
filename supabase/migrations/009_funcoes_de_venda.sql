-- =============================================================================
-- 009 · As operações da venda, como funções do banco
--
-- COMO APLICAR: Supabase → SQL Editor → cole tudo → Run. Seguro repetir.
-- PROJETO CORRETO: souza-financeiro (iejmrzcgoeoxhhcnqodn). NUNCA o icrm.
--
-- POR QUE FUNÇÃO E NÃO CÓDIGO NO APP:
--
-- 1. Registrar uma venda cria de 4 a 20 linhas no razão. O supabase-js não faz
--    transação entre tabelas: se a rede cair no meio, sobra meia venda gravada.
--    Aqui é tudo ou nada.
-- 2. A regra do dinheiro passa a existir em UM lugar. O formulário antigo
--    calculava a comissão do corretor sobre o valor bruto, enquanto a regra
--    real (e os dados) usam a parcela líquida de imposto — divergência que já
--    custou R$ 1.327,59 numa única venda. Com a conta no banco, app, script e
--    agente não podem discordar.
--
-- A ORDEM DO CÁLCULO, que é o que importa:
--    parcela
--    − ISS retido na fonte (quando a construtora retém)
--    − Simples sobre a parcela LÍQUIDA de ISS (quando há nota)
--    = base
--    − comissão do corretor = % × base
--    − fatia do sócio (quando houver)
--    = líquido da imobiliária
-- =============================================================================

-- Vencimento da guia do DAS: dia 20 do mês seguinte ao recebimento.
create or replace function public.venc_das(p_data date)
returns date
language sql
immutable
as $$
  select (date_trunc('month', p_data) + interval '1 month' + interval '19 days')::date;
$$;

-- -----------------------------------------------------------------------------
-- register_sale — cria a venda, as parcelas e as linhas do razão
-- -----------------------------------------------------------------------------
create or replace function public.register_sale(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

  v_parcelas := coalesce(p->'installments', '[]'::jsonb);
  v_n := jsonb_array_length(v_parcelas);
  if v_n < 1 then
    raise exception 'A venda precisa de pelo menos uma parcela.';
  end if;

  v_total := round((p->>'commission_total')::numeric, 2);

  -- A soma das parcelas TEM de fechar com a comissão. Sem esta guarda, uma
  -- parcela digitada errado viraria diferença permanente entre a ficha da
  -- venda e o razão.
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
    broker_id, broker_pct, owner_profit_pct, notes, legacy_group_id
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
    coalesce((p->>'issues_invoice')::boolean, true),
    coalesce(nullif(p->>'simples_pct', '')::numeric, 6),
    coalesce((p->>'retains_iss')::boolean, false),
    coalesce(nullif(p->>'iss_pct', '')::numeric, 0),
    nullif(p->>'broker_id', '')::uuid,
    nullif(p->>'broker_pct', '')::numeric,
    nullif(p->>'owner_profit_pct', '')::numeric,
    nullif(p->>'notes', ''),
    nullif(p->>'legacy_group_id', '')::uuid
  ) returning id into v_sale;

  select name into v_broker_nome from public.contacts
   where id = nullif(p->>'broker_id', '')::uuid;

  v_titulo := p->>'title';

  for v_item in select * from jsonb_array_elements(v_parcelas) loop
    v_idx := coalesce((v_item->>'idx')::integer, 1);
    v_amount := round((v_item->>'amount')::numeric, 2);
    v_venc := (v_item->>'expected_date')::date;
    v_sufixo := case when v_n > 1 then format(' — Pc %s/%s', v_idx, v_n) else '' end;

    -- A cascata, na ordem que importa.
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

    insert into public.sale_installments (
      sale_id, idx, count, expected_date, amount,
      iss_amount, simples_amount, broker_amount, owner_amount, net_amount, status
    ) values (
      v_sale, v_idx, v_n, v_venc, v_amount,
      v_iss, v_simples, v_broker, v_owner,
      v_amount - v_iss - v_simples - v_broker - v_owner, 'prevista'
    ) returning id into v_inst;

    -- Receita: a comissão que a imobiliária tem a receber.
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

    -- ISS retido: nasce previsto e é confirmado no recebimento, porque quem
    -- retém é o pagador — o valor certo só se conhece quando o dinheiro cai.
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

    -- Simples: a guia sai por parcela recebida, porque a nota sai por parcela.
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

    -- Comissão do corretor: custo da venda, pendente até a imobiliária receber.
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

    -- Fatia do sócio: sai do lucro já apurado, não é custo da venda.
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
end $$;

-- -----------------------------------------------------------------------------
-- receive_installment — o dinheiro caiu
--
-- Pede o valor que REALMENTE caiu. Quando cai menos que a parcela, a diferença
-- é classificada (ISS retido, desconto, outro) em vez de virar um furo sem
-- nome. Foi o que aconteceu de verdade na 414-D: a Lotisa retém 3%.
-- -----------------------------------------------------------------------------
create or replace function public.receive_installment(
  p_installment uuid,
  p_date        date,
  p_account     uuid default null,
  p_received    numeric default null,
  p_iss         numeric default null,
  p_other       numeric default 0,
  p_note        text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  i          public.sale_installments;
  s          public.sales;
  v_iss      numeric(14,2);
  v_simples  numeric(14,2);
  v_base     numeric(14,2);
  v_broker   numeric(14,2);
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
  v_owner := case when s.owner_profit_pct is not null
    then round((v_base - v_broker) * s.owner_profit_pct / 100, 2) else 0 end;
  v_sufixo := case when i.count > 1 then format(' — Pc %s/%s', i.idx, i.count) else '' end;

  -- Receita entra pelo valor CHEIO e o ISS sai como saída no mesmo dia e na
  -- mesma conta: o efeito no saldo é o líquido que caiu de verdade, e a
  -- receita bruta (base do Simples) continua visível no DRE.
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
    -- Previa retenção e não houve: a linha nunca aconteceu.
    delete from public.transactions where id = i.iss_tx_id;
    update public.sale_installments set iss_tx_id = null where id = i.id;
  end if;

  -- Simples recalculado sobre a parcela líquida de ISS, com a guia vencendo
  -- dia 20 do mês seguinte.
  if v_simples > 0 then
    if i.simples_tx_id is null then
      insert into public.transactions (
        company_id, kind, category, dre_group, description, amount,
        competence_date, status, due_date,
        group_id, installment_index, installment_count, cost_center_id, sale_id, sale_installment_id
      ) values (
        s.company_id, 'expense', 'Impostos e Taxas', 'variable_expense',
        format('Simples %s%% — %s%s', s.simples_pct, s.title, v_sufixo), v_simples,
        s.sale_date, 'pending', public.venc_das(p_date),
        s.id, case when i.count > 1 then i.idx end, case when i.count > 1 then i.count end,
        s.cost_center_id, s.id, i.id
      ) returning id into v_tx;
      update public.sale_installments set simples_tx_id = v_tx where id = i.id;
    else
      update public.transactions
         set amount = v_simples, due_date = public.venc_das(p_date)
       where id = i.simples_tx_id and status = 'pending';
    end if;
  elsif i.simples_tx_id is not null then
    delete from public.transactions where id = i.simples_tx_id and status = 'pending';
    update public.sale_installments set simples_tx_id = null where id = i.id;
  end if;

  -- Comissão do corretor: liberada hoje. O corretor só recebe quando a
  -- imobiliária recebe, então o vencimento é a data do recebimento.
  if v_broker > 0 and i.broker_tx_id is not null then
    update public.transactions
       set amount = v_broker, due_date = p_date
     where id = i.broker_tx_id and status = 'pending';
  end if;

  if v_owner > 0 and i.owner_tx_id is not null then
    update public.transactions
       set amount = v_owner, due_date = p_date
     where id = i.owner_tx_id and status = 'pending';
  end if;

  -- Outras deduções do pagador (desconto, taxa): saída no mesmo dia, com nota.
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
         owner_amount = v_owner,
         net_amount = i.amount - v_iss - v_simples - v_broker - v_owner - v_other,
         notes = case when p_note is null then notes
                      else trim(coalesce(notes || ' | ', '') || p_note) end
   where id = i.id;

  -- Venda concluída quando não sobra parcela prevista.
  if not exists (
    select 1 from public.sale_installments
     where sale_id = s.id and status = 'prevista'
  ) then
    update public.sales set status = 'concluida' where id = s.id and status = 'ativa';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- undo_receive_installment — desfaz a baixa
-- -----------------------------------------------------------------------------
create or replace function public.undo_receive_installment(p_installment uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  i         public.sale_installments;
  s         public.sales;
  v_iss     numeric(14,2);
  v_simples numeric(14,2);
  v_base    numeric(14,2);
  v_broker  numeric(14,2);
  v_owner   numeric(14,2);
begin
  if not public.is_admin() then
    raise exception 'Só o administrador pode desfazer uma baixa.';
  end if;

  select * into i from public.sale_installments where id = p_installment for update;
  if not found then raise exception 'Parcela não encontrada.'; end if;
  if i.status <> 'recebida' then raise exception 'Esta parcela não está recebida.'; end if;
  select * into s from public.sales where id = i.sale_id;

  -- Comissão já paga ao corretor trava o desfazer: desfazer aqui deixaria o
  -- corretor pago por uma parcela que a imobiliária não recebeu.
  if i.broker_tx_id is not null
     and exists (select 1 from public.transactions where id = i.broker_tx_id and status = 'settled') then
    raise exception 'A comissão do corretor desta parcela já foi paga. Estorne o pagamento primeiro.';
  end if;

  v_iss := case when s.retains_iss then round(i.amount * s.iss_pct / 100, 2) else 0 end;
  v_simples := case when s.issues_invoice
    then round((i.amount - v_iss) * s.simples_pct / 100, 2) else 0 end;
  v_base := i.amount - v_iss - v_simples;
  v_broker := case when s.broker_id is not null and s.broker_pct is not null
    then round(v_base * s.broker_pct / 100, 2) else 0 end;
  v_owner := case when s.owner_profit_pct is not null
    then round((v_base - v_broker) * s.owner_profit_pct / 100, 2) else 0 end;

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

  if i.simples_tx_id is not null then
    update public.transactions
       set amount = v_simples, due_date = i.expected_date
     where id = i.simples_tx_id and status = 'pending';
  end if;
  if i.broker_tx_id is not null then
    update public.transactions
       set amount = v_broker, due_date = i.expected_date
     where id = i.broker_tx_id and status = 'pending';
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
         broker_amount = v_broker, owner_amount = v_owner,
         broker_adjustment = 0,
         net_amount = i.amount - v_iss - v_simples - v_broker - v_owner
   where id = i.id;

  update public.sales set status = 'ativa' where id = s.id and status = 'concluida';
end $$;

-- -----------------------------------------------------------------------------
-- pay_broker_installments — paga a comissão liberada
-- -----------------------------------------------------------------------------
create or replace function public.pay_broker_installments(
  p_ids        uuid[],
  p_date       date,
  p_account    uuid default null,
  p_adjustment numeric default 0,
  p_note       text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  i        public.sale_installments;
  v_id     uuid;
  v_ajuste numeric(14,2) := coalesce(round(p_adjustment, 2), 0);
  v_final  numeric(14,2);
begin
  if not public.is_admin() then
    raise exception 'Só o administrador pode pagar comissão.';
  end if;
  if v_ajuste <> 0 and coalesce(array_length(p_ids, 1), 0) > 1 then
    raise exception 'Desconto só em pagamento de uma parcela por vez.';
  end if;

  foreach v_id in array p_ids loop
    select * into i from public.sale_installments where id = v_id for update;
    if not found then raise exception 'Parcela não encontrada.'; end if;
    if i.status <> 'recebida' then
      raise exception 'A parcela ainda não foi recebida — a comissão não está liberada.';
    end if;
    if i.broker_tx_id is null then
      raise exception 'Esta parcela não tem comissão de corretor.';
    end if;

    v_final := i.broker_amount - v_ajuste;
    if v_final < 0 then
      raise exception 'O desconto (%) é maior que a comissão (%).', v_ajuste, i.broker_amount;
    end if;

    update public.transactions
       set amount = v_final, status = 'settled', settled_date = p_date,
           due_date = null, account_id = p_account,
           description = description ||
             case when v_ajuste <> 0
               then format(' (desconto de %s%s)', v_ajuste,
                           case when p_note is null then '' else ': ' || p_note end)
               else '' end
     where id = i.broker_tx_id and status = 'pending';

    update public.sale_installments
       set broker_adjustment = v_ajuste,
           notes = case when p_note is null then notes
                        else trim(coalesce(notes || ' | ', '') || p_note) end
     where id = i.id;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- reschedule_installment — a construtora empurrou a data
-- -----------------------------------------------------------------------------
create or replace function public.reschedule_installment(
  p_installment uuid,
  p_new_date    date,
  p_note        text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  i public.sale_installments;
begin
  if not public.is_admin() then
    raise exception 'Só o administrador pode reagendar.';
  end if;
  select * into i from public.sale_installments where id = p_installment for update;
  if not found then raise exception 'Parcela não encontrada.'; end if;
  if i.status <> 'prevista' then
    raise exception 'Só parcela prevista pode ser reagendada.';
  end if;

  update public.transactions set due_date = p_new_date
   where sale_installment_id = i.id and status = 'pending';

  update public.sale_installments
     set expected_date = p_new_date,
         notes = trim(coalesce(notes || ' | ', '') ||
                 format('reagendada de %s para %s%s',
                        to_char(i.expected_date, 'DD/MM/YYYY'),
                        to_char(p_new_date, 'DD/MM/YYYY'),
                        case when p_note is null then '' else ': ' || p_note end))
   where id = i.id;
end $$;

-- -----------------------------------------------------------------------------
-- cancel_sale — distrato
--
-- Cancela só o que ainda não aconteceu. Parcela recebida e comissão paga ficam
-- como estão: aconteceram de verdade e apagá-las reescreveria o passado. Se
-- houver devolução, ela é lançada à mão como despesa, com nota.
-- -----------------------------------------------------------------------------
create or replace function public.cancel_sale(p_sale uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
end $$;

-- -----------------------------------------------------------------------------
-- Permissões: nenhuma destas funções é para o corretor.
-- -----------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'register_sale(jsonb)',
    'receive_installment(uuid,date,uuid,numeric,numeric,numeric,text)',
    'undo_receive_installment(uuid)',
    'pay_broker_installments(uuid[],date,uuid,numeric,text)',
    'reschedule_installment(uuid,date,text)',
    'cancel_sale(uuid,text)',
    'venc_das(date)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- =============================================================================
-- REVERSÃO
-- drop function if exists public.cancel_sale(uuid,text);
-- drop function if exists public.reschedule_installment(uuid,date,text);
-- drop function if exists public.pay_broker_installments(uuid[],date,uuid,numeric,text);
-- drop function if exists public.undo_receive_installment(uuid);
-- drop function if exists public.receive_installment(uuid,date,uuid,numeric,numeric,numeric,text);
-- drop function if exists public.register_sale(jsonb);
-- drop function if exists public.venc_das(date);
-- =============================================================================
