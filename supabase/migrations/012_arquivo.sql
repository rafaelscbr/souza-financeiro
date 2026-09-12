-- =============================================================================
-- 012 · Arquivamento do que sai do escopo
--
-- COMO APLICAR: Supabase → SQL Editor → cole tudo → Run (só CRIA as funções).
-- Depois, quando o sistema novo já estiver validado em uso:
--
--     select public.archive_out_of_scope(false);  -- relatório, sem copiar
--     select public.archive_out_of_scope(true);   -- copia para o schema arquivo
--
-- PROJETO CORRETO: souza-financeiro (iejmrzcgoeoxhhcnqodn). NUNCA o icrm.
--
-- O QUE SAI DO USO: o razão pessoal do Rafael (660 lançamentos, 4 contas, 33
-- transferências, orçamento e patrimônio), a Souza Assessoria (8 lançamentos),
-- a Escola de Corretor (nenhum) e as metas antigas.
--
-- O QUE ESTE ARQUIVO NÃO FAZ: apagar. A cópia vai para o schema `arquivo`, que
-- o PostgREST não expõe, e os dados continuam em `public` até alguém decidir o
-- contrário. A exclusão tem função própria (`purge_archived`) que exige uma
-- frase de confirmação digitada, e não deve ser executada antes de a conferência
-- fechar e o Rafael aprovar. Ver a seção 6 do plano de reestruturação.
-- =============================================================================

create schema if not exists arquivo;
revoke all on schema arquivo from public;
comment on schema arquivo is
  'Dados fora do escopo da imobiliária, preservados. Não exposto pela API.';

create or replace function public.archive_out_of_scope(p_commit boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, arquivo, pg_temp
as $$
declare
  v_imob      uuid;
  v_fora      uuid[];
  v_relatorio jsonb := '{}'::jsonb;
  v_confere   jsonb;
  v_n         bigint;
  t           text;
  -- Tabelas cujo recorte é por empresa.
  por_empresa text[] := array['transactions', 'accounts', 'categories', 'cost_centers',
                              'goals', 'objectives', 'period_closings', 'transaction_templates'];
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Só o administrador pode arquivar.';
  end if;

  select id into v_imob from public.companies where slug = 'imobiliaria';
  select array_agg(id) into v_fora from public.companies where id <> v_imob;

  if p_commit then
    -- Espelhos com a mesma estrutura, mais a data do arquivamento.
    foreach t in array por_empresa loop
      execute format(
        'create table if not exists arquivo.%I as select *, now() as arquivado_em
           from public.%I where false', t, t);
    end loop;
    create table if not exists arquivo.transfers as
      select *, now() as arquivado_em from public.transfers where false;
    create table if not exists arquivo.personal_budgets as
      select *, now() as arquivado_em from public.personal_budgets where false;
    create table if not exists arquivo.personal_assets as
      select *, now() as arquivado_em from public.personal_assets where false;
    create table if not exists arquivo.companies as
      select *, now() as arquivado_em from public.companies where false;
  end if;

  -- Lançamentos e cadastros das empresas fora do escopo.
  foreach t in array por_empresa loop
    execute format('select count(*) from public.%I where company_id = any($1)', t)
      into v_n using v_fora;
    if p_commit and v_n > 0 then
      execute format(
        'insert into arquivo.%I select *, now() from public.%I where company_id = any($1)', t, t)
        using v_fora;
    end if;
    v_relatorio := v_relatorio || jsonb_build_object(t, v_n);
  end loop;

  -- Transferências entre contas das empresas fora do escopo. A inspeção de
  -- 12/09 mostrou que todas as 33 são entre contas pessoais; nenhuma cruza
  -- para a imobiliária, o que torna o recorte limpo.
  select count(*) into v_n from public.transfers tr
   where exists (select 1 from public.accounts a
                  where a.id in (tr.from_account_id, tr.to_account_id)
                    and a.company_id = any(v_fora));
  if p_commit and v_n > 0 then
    insert into arquivo.transfers
    select tr.*, now() from public.transfers tr
     where exists (select 1 from public.accounts a
                    where a.id in (tr.from_account_id, tr.to_account_id)
                      and a.company_id = any(v_fora));
  end if;
  v_relatorio := v_relatorio || jsonb_build_object('transfers', v_n);

  -- Orçamento e patrimônio pessoais não têm company_id: são do dono por
  -- natureza, e saem inteiros.
  select count(*) into v_n from public.personal_budgets;
  if p_commit and v_n > 0 then
    insert into arquivo.personal_budgets select p.*, now() from public.personal_budgets p;
  end if;
  v_relatorio := v_relatorio || jsonb_build_object('personal_budgets', v_n);

  select count(*) into v_n from public.personal_assets;
  if p_commit and v_n > 0 then
    insert into arquivo.personal_assets select p.*, now() from public.personal_assets p;
  end if;
  v_relatorio := v_relatorio || jsonb_build_object('personal_assets', v_n);

  -- As empresas ficam em public (outras tabelas as referenciam por chave),
  -- marcadas como arquivadas. Uma cópia vai para o arquivo como registro.
  if p_commit then
    insert into arquivo.companies select c.*, now() from public.companies c
     where c.id = any(v_fora)
       and not exists (select 1 from arquivo.companies a where a.id = c.id);
    update public.companies set is_archived = true where id = any(v_fora);
  end if;

  -- A conferência é montada com SQL dinâmico de propósito: um `case` comum
  -- referenciando arquivo.transactions faria o Postgres resolver a tabela
  -- mesmo no ramo não usado, e a SIMULAÇÃO quebraria antes de o arquivo
  -- existir — que é justamente quando ela precisa funcionar.
  if p_commit then
    execute $q$
      select jsonb_build_object(
        'transactions_no_arquivo', (select count(*) from arquivo.transactions),
        'transactions_fora_em_public', (
          select count(*) from public.transactions where company_id = any($1)))
    $q$ into v_confere using v_fora;
  end if;

  return jsonb_build_object(
    'copiou', p_commit,
    'empresas_fora_do_escopo', (
      select coalesce(jsonb_agg(jsonb_build_object('nome', name, 'slug', slug)), '[]'::jsonb)
        from public.companies where id = any(v_fora)),
    'linhas', v_relatorio,
    'conferencia', v_confere,
    'proximo_passo', case when p_commit
      then 'Confira as contagens, exporte o schema arquivo e só então decida sobre purge_archived.'
      else 'Rode com true para copiar. Nada é apagado em nenhum dos dois casos.' end
  );
end $$;

-- -----------------------------------------------------------------------------
-- Exclusão: só com frase digitada, e só depois da cópia conferida.
--
-- Existe para que apagar seja uma decisão explícita e rastreável, não um efeito
-- colateral de rodar um script. Não execute antes de exportar o schema arquivo
-- para fora do banco.
-- -----------------------------------------------------------------------------
create or replace function public.purge_archived(p_confirmacao text)
returns jsonb
language plpgsql
security definer
set search_path = public, arquivo, pg_temp
as $$
declare
  v_imob uuid;
  v_fora uuid[];
  v_apagadas jsonb := '{}'::jsonb;
  v_n bigint;
  t text;
  tabelas text[] := array['transactions', 'goals', 'objectives', 'period_closings',
                          'transaction_templates', 'categories', 'cost_centers', 'accounts'];
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Só o administrador pode apagar.';
  end if;
  if p_confirmacao <> 'apagar dados fora do escopo' then
    raise exception 'Confirmação necessária: passe exatamente ''apagar dados fora do escopo''.';
  end if;
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'arquivo' and table_name = 'transactions') then
    raise exception 'O arquivo não existe. Rode archive_out_of_scope(true) primeiro.';
  end if;

  select id into v_imob from public.companies where slug = 'imobiliaria';
  select array_agg(id) into v_fora from public.companies where id <> v_imob;

  -- A cópia tem de estar completa antes de qualquer delete.
  if (select count(*) from arquivo.transactions) <
     (select count(*) from public.transactions where company_id = any(v_fora)) then
    raise exception 'O arquivo tem menos lançamentos que o público. Refaça a cópia.';
  end if;

  delete from public.transfers tr
   where exists (select 1 from public.accounts a
                  where a.id in (tr.from_account_id, tr.to_account_id)
                    and a.company_id = any(v_fora));
  get diagnostics v_n = row_count;
  v_apagadas := v_apagadas || jsonb_build_object('transfers', v_n);

  delete from public.personal_budgets;
  get diagnostics v_n = row_count;
  v_apagadas := v_apagadas || jsonb_build_object('personal_budgets', v_n);

  delete from public.personal_assets;
  get diagnostics v_n = row_count;
  v_apagadas := v_apagadas || jsonb_build_object('personal_assets', v_n);

  foreach t in array tabelas loop
    execute format('delete from public.%I where company_id = any($1)', t) using v_fora;
    get diagnostics v_n = row_count;
    v_apagadas := v_apagadas || jsonb_build_object(t, v_n);
  end loop;

  return jsonb_build_object(
    'apagadas', v_apagadas,
    'aviso', 'As empresas seguem em public marcadas como arquivadas, e o schema arquivo guarda as cópias.'
  );
end $$;

revoke all on function public.archive_out_of_scope(boolean) from public;
revoke all on function public.purge_archived(text) from public;
grant execute on function public.archive_out_of_scope(boolean) to authenticated;
grant execute on function public.purge_archived(text) to authenticated;

-- =============================================================================
-- REVERSÃO (traz o arquivo de volta para public)
--
-- insert into public.transactions select (a.*)::public.transactions.* from arquivo.transactions a
--   on conflict (id) do nothing;   -- repetir por tabela conforme necessário
-- update public.companies set is_archived = false;
-- drop function if exists public.purge_archived(text);
-- drop function if exists public.archive_out_of_scope(boolean);
-- drop schema if exists arquivo cascade;   -- só depois de exportar
-- =============================================================================
