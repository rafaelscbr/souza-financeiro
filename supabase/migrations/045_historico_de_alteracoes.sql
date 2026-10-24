-- 045 — Fase 9 (23/10/2026): histórico de alterações (seção 20 do prompt master).
--
-- ADITIVA: uma tabela nova, uma função de gatilho e gatilhos AFTER. Nenhum
-- dado existente muda.
--
-- "Para alterações financeiras relevantes, manter: usuário responsável, data
-- e hora, operação realizada, valores anteriores e novos, identificação do
-- registro." O banco grava sozinho, em toda escrita nas tabelas de dinheiro —
-- pelo app, pelo editor SQL ou por script. Exclusão também fica registrada,
-- com a linha inteira: nada some sem rastro.
--
-- Só o administrador lê. Ninguém escreve pelo app: não há política de
-- inserção, alteração ou exclusão — quem grava é o gatilho, como dono.
-- A auditoria nunca impede a operação: se falhar, a escrita segue.

create table if not exists public.audit_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  user_id     uuid,
  user_name   text,
  table_name  text not null,
  record_id   text,
  operation   text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  old_data    jsonb,
  new_data    jsonb,
  changed     text[]
);

create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_registro_idx on public.audit_log (table_name, record_id);

alter table public.audit_log enable row level security;
drop policy if exists audit_admin_le on public.audit_log;
create policy audit_admin_le on public.audit_log for select to authenticated using (public.is_admin());

create or replace function public.registrar_auditoria()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old     jsonb;
  v_new     jsonb;
  v_changed text[];
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;

  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_changed
      from jsonb_object_keys(v_new) k
     where (v_new -> k) is distinct from (v_old -> k)
       and k not in ('updated_at');
    -- Gravar sem mudar nada não é alteração.
    if v_changed is null then return new; end if;
  end if;

  begin
    insert into public.audit_log (user_id, user_name, table_name, record_id, operation, old_data, new_data, changed)
    values (
      auth.uid(),
      (select name from public.profiles where id = auth.uid()),
      tg_table_name,
      coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'contact_id', v_old ->> 'contact_id'),
      tg_op,
      v_old,
      v_new,
      v_changed
    );
  exception when others then
    null; -- a auditoria nunca impede a operação de dinheiro
  end;

  return coalesce(new, old);
end $function$;

revoke all on function public.registrar_auditoria() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'sales', 'sale_installments', 'transactions', 'transfers', 'accounts', 'contacts',
    'companies', 'commission_settings', 'sales_goals', 'broker_profiles', 'budget_lines'
  ] loop
    execute format('drop trigger if exists auditoria on public.%I', t);
    execute format(
      'create trigger auditoria after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()',
      t
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
