-- =============================================================================
-- 011 · Migração das vendas antigas para a entidade venda
--
-- COMO APLICAR: Supabase → SQL Editor → cole tudo → Run (isso só CRIA a
-- função, não move nada). Depois:
--
--     select public.migrate_legacy_sales(false);   -- relatório, sem gravar
--     select public.migrate_legacy_sales(true);    -- grava
--
-- PROJETO CORRETO: souza-financeiro (iejmrzcgoeoxhhcnqodn). NUNCA o icrm.
--
-- REGRA DE OURO: os valores são COPIADOS do razão, nunca recalculados. A regra
-- de imposto mudou entre a venda de janeiro (6% sobre o bruto) e a de agosto
-- (ISS retido 3% + 6% sobre o líquido), e a comissão da 414-D Pc 1 foi paga
-- com um desconto combinado. Recalcular reescreveria o que aconteceu.
--
-- A função devolve um relatório com uma linha por venda e aponta divergências
-- entre o valor gravado e o que a regra de hoje calcularia — para conferência
-- humana, não para correção automática.
--
-- Idempotente: venda já migrada (por `legacy_group_id`) é pulada.
-- =============================================================================

create or replace function public.migrate_legacy_sales(p_commit boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company     uuid;
  v_owner       uuid;
  g             record;
  r             record;
  v_sale        uuid;
  v_titulo      text;
  v_n           integer;
  v_iss_pct     numeric(6,3);
  v_simples_pct numeric(6,3);
  v_retains     boolean;
  v_invoice     boolean;
  v_broker      uuid;
  v_broker_pct  numeric(6,3);
  v_owner_pct   numeric(6,3);
  v_inst        uuid;
  v_iss         numeric(14,2);
  v_simples     numeric(14,2);
  v_bro         numeric(14,2);
  v_own         numeric(14,2);
  v_calc        numeric(14,2);
  v_base        numeric(14,2);
  v_status      text;
  v_relatorio   jsonb := '[]'::jsonb;
  v_avisos      jsonb := '[]'::jsonb;
  v_parcelas    jsonb;
  v_migradas    integer := 0;
  v_puladas     integer := 0;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Só o administrador pode migrar vendas.';
  end if;

  select id into v_company from public.companies where slug = 'imobiliaria';
  if v_company is null then raise exception 'Souza Imobiliária não encontrada.'; end if;

  -- O dono como corretor: substitui a constante 'Rafael Alves de Souza' que
  -- vivia fixa no código. Criado uma única vez, se ainda não existir.
  select id into v_owner from public.contacts where is_owner limit 1;
  if v_owner is null then
    select id into v_owner from public.contacts where name = 'Rafael Alves de Souza' limit 1;
  end if;
  if v_owner is null and p_commit then
    insert into public.contacts (type, name, is_active, is_owner)
    values ('broker', 'Rafael Alves de Souza', true, true)
    returning id into v_owner;
  end if;

  for g in
    select t.group_id,
           min(t.competence_date)                                   as sale_date,
           count(*) filter (where t.category = 'Comissões de Venda') as parcelas,
           sum(t.amount) filter (where t.category = 'Comissões de Venda') as comissao
      from public.transactions t
     where t.company_id = v_company
       and t.group_id is not null
       and t.sale_id is null
     group by t.group_id
    having count(*) filter (where t.kind = 'income' and t.category = 'Comissões de Venda') > 0
     order by min(t.competence_date)
  loop
    if exists (select 1 from public.sales where legacy_group_id = g.group_id) then
      v_puladas := v_puladas + 1;
      continue;
    end if;

    -- Título: a descrição sem o sufixo de parcela.
    select regexp_replace(
             regexp_replace(t.description, '\s*[—–-]\s*Pc\.?\s*[0-9]+\s*/\s*[0-9]+.*$', ''),
             '\s*—\s*[0-9]+/[0-9]+.*$', '')
      into v_titulo
      from public.transactions t
     where t.group_id = g.group_id and t.category = 'Comissões de Venda'
     order by coalesce(t.installment_index, 1) limit 1;

    v_n := g.parcelas;

    -- Houve nota? Houve retenção? Os percentuais saem dos próprios valores.
    v_retains := exists (
      select 1 from public.transactions t
       where t.group_id = g.group_id and t.category = 'Impostos e Taxas'
         and t.description ~* '^ISS');
    v_invoice := exists (
      select 1 from public.transactions t
       where t.group_id = g.group_id and t.category = 'Impostos e Taxas'
         and t.description !~* '^ISS');

    select round(100 * sum(t.amount) / nullif(max(r2.amount), 0), 3)
      into v_iss_pct
      from public.transactions t
      join public.transactions r2
        on r2.group_id = t.group_id
       and r2.category = 'Comissões de Venda'
       and coalesce(r2.installment_index, 1) = coalesce(t.installment_index, 1)
     where t.group_id = g.group_id and t.category = 'Impostos e Taxas'
       and t.description ~* '^ISS'
     group by coalesce(t.installment_index, 1) limit 1;

    select round(100 * sum(t.amount) / nullif(max(r2.amount) - coalesce(max(iss.soma), 0), 0), 3)
      into v_simples_pct
      from public.transactions t
      join public.transactions r2
        on r2.group_id = t.group_id
       and r2.category = 'Comissões de Venda'
       and coalesce(r2.installment_index, 1) = coalesce(t.installment_index, 1)
      left join (
        select coalesce(installment_index, 1) as ix, sum(amount) as soma
          from public.transactions
         where group_id = g.group_id and category = 'Impostos e Taxas'
           and description ~* '^ISS'
         group by coalesce(installment_index, 1)
      ) iss on iss.ix = coalesce(t.installment_index, 1)
     where t.group_id = g.group_id and t.category = 'Impostos e Taxas'
       and t.description !~* '^ISS'
     group by coalesce(t.installment_index, 1) limit 1;

    -- Corretor: o contato da linha de repasse; quando a linha aponta para o
    -- dono por texto, o corretor é o próprio dono.
    select t.contact_id into v_broker
      from public.transactions t
     where t.group_id = g.group_id and t.category = 'Comissões de Corretores'
       and t.contact_id is not null limit 1;
    if v_broker is null and exists (
      select 1 from public.transactions t
       where t.group_id = g.group_id and t.category = 'Comissões de Corretores'
         and t.counterparty = 'Rafael Alves de Souza') then
      v_broker := v_owner;
    end if;

    -- Percentual do corretor: o gravado manda; sem ele, deriva dos valores.
    select max(t.broker_pct) into v_broker_pct
      from public.transactions t where t.group_id = g.group_id and t.broker_pct is not null;
    -- Deriva mesmo sem contato resolvido: na simulação o contato do dono ainda
    -- não existe, e o relatório precisa mostrar o percentual de qualquer forma.
    if v_broker_pct is null and exists (
      select 1 from public.transactions t
       where t.group_id = g.group_id and t.category = 'Comissões de Corretores') then
      select round(100 * sum(b.amount) / nullif(sum(rev.amount) - coalesce(sum(tax.amount), 0), 0), 0)
        into v_broker_pct
        from public.transactions rev
        left join public.transactions b
          on b.group_id = rev.group_id and b.category = 'Comissões de Corretores'
         and coalesce(b.installment_index, 1) = coalesce(rev.installment_index, 1)
        left join public.transactions tax
          on tax.group_id = rev.group_id and tax.category = 'Impostos e Taxas'
         and coalesce(tax.installment_index, 1) = coalesce(rev.installment_index, 1)
       where rev.group_id = g.group_id and rev.category = 'Comissões de Venda';
    end if;

    select round(100 * sum(t.amount) / nullif(g.comissao, 0), 0) into v_owner_pct
      from public.transactions t
     where t.group_id = g.group_id and t.kind = 'withdrawal';

    if not p_commit then
      v_relatorio := v_relatorio || jsonb_build_object(
        'titulo', v_titulo, 'parcelas', v_n, 'comissao', g.comissao,
        -- Na simulação o contato do dono ainda não existe (nada é gravado),
        -- então o relatório diz que ele será criado em vez de "sem corretor".
        'corretor', coalesce(
          (select name from public.contacts where id = v_broker),
          case when exists (
            select 1 from public.transactions t
             where t.group_id = g.group_id and t.category = 'Comissões de Corretores'
               and t.counterparty = 'Rafael Alves de Souza')
          then 'Rafael Alves de Souza (contato será criado)' end),
        'corretor_pct', v_broker_pct, 'nf', v_invoice,
        'iss', v_retains, 'iss_pct', v_iss_pct, 'simples_pct', v_simples_pct,
        'socio_pct', v_owner_pct, 'acao', 'migraria');
      v_migradas := v_migradas + 1;
      continue;
    end if;

    insert into public.sales (
      company_id, title, cost_center_id, unit, client_name, sale_date,
      property_value, commission_pct, commission_total,
      issues_invoice, simples_pct, retains_iss, iss_pct,
      broker_id, broker_pct, owner_profit_pct, status, legacy_group_id
    )
    select v_company, v_titulo,
           max(t.cost_center_id::text)::uuid,
           null,
           max(t.counterparty),
           g.sale_date,
           max(t.property_value),
           max(t.commission_pct),
           round(g.comissao, 2),
           v_invoice, coalesce(v_simples_pct, 6), v_retains, coalesce(v_iss_pct, 0),
           v_broker, v_broker_pct, v_owner_pct,
           case when bool_and(t.status = 'settled') then 'concluida' else 'ativa' end,
           g.group_id
      from public.transactions t
     where t.group_id = g.group_id and t.category = 'Comissões de Venda'
    returning id into v_sale;

    v_parcelas := '[]'::jsonb;

    for r in
      select t.*, coalesce(t.installment_index, 1) as ix
        from public.transactions t
       where t.group_id = g.group_id and t.category = 'Comissões de Venda'
       order by coalesce(t.installment_index, 1)
    loop
      select coalesce(sum(amount), 0) into v_iss from public.transactions
       where group_id = g.group_id and category = 'Impostos e Taxas'
         and description ~* '^ISS' and coalesce(installment_index, 1) = r.ix;
      select coalesce(sum(amount), 0) into v_simples from public.transactions
       where group_id = g.group_id and category = 'Impostos e Taxas'
         and description !~* '^ISS' and coalesce(installment_index, 1) = r.ix;
      select coalesce(sum(amount), 0) into v_bro from public.transactions
       where group_id = g.group_id and category = 'Comissões de Corretores'
         and coalesce(installment_index, 1) = r.ix;
      select coalesce(sum(amount), 0) into v_own from public.transactions
       where group_id = g.group_id and kind = 'withdrawal'
         and coalesce(installment_index, 1) = r.ix;

      v_status := case when r.status = 'settled' then 'recebida' else 'prevista' end;

      insert into public.sale_installments (
        sale_id, idx, count, expected_date, amount,
        iss_amount, simples_amount, broker_amount, owner_amount, net_amount,
        status, received_date, received_amount, account_id,
        revenue_tx_id,
        iss_tx_id,
        simples_tx_id,
        broker_tx_id,
        owner_tx_id
      ) values (
        v_sale, r.ix, v_n,
        coalesce(r.due_date, r.settled_date, r.competence_date),
        r.amount, v_iss, v_simples, v_bro, v_own,
        r.amount - v_iss - v_simples - v_bro - v_own,
        v_status,
        case when v_status = 'recebida' then r.settled_date end,
        case when v_status = 'recebida' then r.amount - v_iss end,
        r.account_id,
        r.id,
        (select id from public.transactions where group_id = g.group_id
          and category = 'Impostos e Taxas' and description ~* '^ISS'
          and coalesce(installment_index, 1) = r.ix limit 1),
        (select id from public.transactions where group_id = g.group_id
          and category = 'Impostos e Taxas' and description !~* '^ISS'
          and coalesce(installment_index, 1) = r.ix limit 1),
        (select id from public.transactions where group_id = g.group_id
          and category = 'Comissões de Corretores'
          and coalesce(installment_index, 1) = r.ix limit 1),
        (select id from public.transactions where group_id = g.group_id
          and kind = 'withdrawal'
          and coalesce(installment_index, 1) = r.ix limit 1)
      ) returning id into v_inst;

      -- Todo lançamento do grupo com este índice passa a apontar para a venda.
      update public.transactions
         set sale_id = v_sale, sale_installment_id = v_inst
       where group_id = g.group_id and coalesce(installment_index, 1) = r.ix;

      -- Divergência entre o gravado e o que a regra de hoje calcularia. Não
      -- corrige nada: só avisa, porque o gravado é o que aconteceu.
      if v_broker_pct is not null and v_bro > 0 then
        v_base := r.amount - v_iss - v_simples;
        v_calc := round(v_base * v_broker_pct / 100, 2);
        if abs(v_calc - v_bro) > 0.01 then
          v_avisos := v_avisos || jsonb_build_object(
            'venda', v_titulo, 'parcela', r.ix,
            'corretor_gravado', v_bro, 'corretor_calculado', v_calc,
            'diferenca', round(v_calc - v_bro, 2),
            'obs', 'valor gravado preservado; confira a descrição original');
        end if;
      end if;

      v_parcelas := v_parcelas || jsonb_build_object(
        'idx', r.ix, 'valor', r.amount, 'iss', v_iss, 'simples', v_simples,
        'corretor', v_bro, 'situacao', v_status);
    end loop;

    v_relatorio := v_relatorio || jsonb_build_object(
      'titulo', v_titulo, 'venda_id', v_sale, 'comissao', g.comissao,
      'corretor', (select name from public.contacts where id = v_broker),
      'corretor_pct', v_broker_pct, 'nf', v_invoice, 'iss', v_retains,
      'parcelas', v_parcelas, 'acao', 'migrada');
    v_migradas := v_migradas + 1;
  end loop;

  return jsonb_build_object(
    'gravou', p_commit,
    'vendas', v_migradas,
    'puladas_ja_migradas', v_puladas,
    'relatorio', v_relatorio,
    'divergencias', v_avisos,
    'conferencia', (
      select jsonb_build_object(
        'comissao_no_razao', coalesce(sum(t.amount) filter (
          where t.category = 'Comissões de Venda'), 0),
        'comissao_nas_vendas', (select coalesce(sum(commission_total), 0) from public.sales),
        'linhas_de_venda_sem_vinculo', coalesce(count(*) filter (
          where t.category = 'Comissões de Venda' and t.sale_id is null), 0))
        from public.transactions t where t.company_id = v_company)
  );
end $$;

revoke all on function public.migrate_legacy_sales(boolean) from public;
grant execute on function public.migrate_legacy_sales(boolean) to authenticated;

-- =============================================================================
-- REVERSÃO (desfaz a migração de dados, mantendo o razão intacto)
--
-- update public.transactions set sale_id = null, sale_installment_id = null;
-- delete from public.sale_installments;
-- delete from public.sales where legacy_group_id is not null;
-- drop function if exists public.migrate_legacy_sales(boolean);
-- =============================================================================
