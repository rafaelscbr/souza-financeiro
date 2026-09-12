-- =============================================================================
-- 007 · Perfis e acesso: administrador e corretor
--
-- COMO APLICAR: Supabase → SQL Editor → cole tudo → Run. Seguro repetir.
-- PROJETO CORRETO: souza-financeiro (iejmrzcgoeoxhhcnqodn). NUNCA o icrm.
--
-- POR QUE ISTO EXISTE: até aqui toda política era
-- `for all to authenticated using (true)`, ou seja, qualquer pessoa que
-- conseguisse entrar veria o financeiro inteiro — inclusive o razão pessoal do
-- Rafael. Dar login a um corretor nessas condições seria vazar tudo. A partir
-- desta migração: só o administrador toca nas tabelas, e o corretor não
-- alcança nenhuma delas diretamente (ele lê pelas funções da migração 010).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Perfil de cada usuário do Auth
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'corretor' check (role in ('admin', 'corretor')),
  -- Corretor: qual contato do cadastro é esta pessoa. É o que amarra o login
  -- às vendas dele. Administrador não precisa.
  contact_id uuid references public.contacts(id) on delete set null,
  name       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Papel de cada usuário. `corretor` só enxerga as próprias vendas, pelas funções broker_*.';
comment on column public.profiles.contact_id is
  'Contato (type=broker) que representa este corretor. NULL para administrador.';

create index if not exists profiles_contact_idx on public.profiles (contact_id);
create unique index if not exists profiles_contact_unico
  on public.profiles (contact_id) where contact_id is not null;

alter table public.profiles enable row level security;

-- -----------------------------------------------------------------------------
-- 2. Quem sou eu
--
-- `security definer` + `search_path` travado: sem o search_path fixo, um
-- usuário poderia criar um schema próprio e sequestrar o nome `profiles`.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role = 'admin' and is_active
  );
$$;

create or replace function public.current_contact_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select contact_id from public.profiles
   where id = auth.uid() and is_active;
$$;

create or replace function public.my_profile()
returns table (id uuid, role text, contact_id uuid, name text, is_active boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.role, p.contact_id, coalesce(p.name, u.email) as name, p.is_active
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.id = auth.uid();
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.current_contact_id() from public;
revoke all on function public.my_profile() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_contact_id() to authenticated;
grant execute on function public.my_profile() to authenticated;

-- -----------------------------------------------------------------------------
-- 3. O administrador de hoje
--
-- Encontrado pelo e-mail, não por UUID fixo: assim a migração funciona em
-- qualquer cópia do banco (inclusive num projeto restaurado do backup).
-- Roda ANTES de fechar as políticas, senão o próprio Rafael perderia acesso.
-- -----------------------------------------------------------------------------
insert into public.profiles (id, role, name, is_active)
select u.id, 'admin', 'Rafael Alves de Souza', true
  from auth.users u
 where u.email = 'rafael.info.souza@gmail.com'
on conflict (id) do update set role = 'admin', is_active = true;

-- -----------------------------------------------------------------------------
-- 4. Políticas: só administrador toca nas tabelas
--
-- Apaga TODAS as políticas antigas das tabelas de negócio (os nomes variavam:
-- `*_authenticated_all`, `authenticated_all`, e o schema base tinha outros) e
-- cria uma única, uniforme, por tabela.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  p text;
  tabelas text[] := array[
    'companies', 'categories', 'contacts', 'transactions', 'goals',
    'personal_budgets', 'accounts', 'transfers', 'cost_centers',
    'period_closings', 'transaction_templates', 'objectives', 'personal_assets'
  ];
begin
  foreach t in array tabelas loop
    if not exists (select 1 from information_schema.tables
                    where table_schema = 'public' and table_name = t) then
      continue;
    end if;

    for p in select policyname from pg_policies
              where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', p, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy admin_tudo on public.%I for all to authenticated
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Perfis: cada um lê o seu; o administrador lê e escreve todos.
drop policy if exists profiles_proprio on public.profiles;
create policy profiles_proprio on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_admin on public.profiles;
create policy profiles_admin on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- REVERSÃO (cole só se precisar voltar atrás)
--
-- do $$ declare t text; p text; tabelas text[] := array['companies','categories',
--   'contacts','transactions','goals','personal_budgets','accounts','transfers',
--   'cost_centers','period_closings','transaction_templates','objectives',
--   'personal_assets'];
-- begin
--   foreach t in array tabelas loop
--     for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
--       execute format('drop policy if exists %I on public.%I', p, t);
--     end loop;
--     execute format('create policy %I on public.%I for all to authenticated
--        using (true) with check (true)', t || '_authenticated_all', t);
--   end loop;
-- end $$;
-- drop function if exists public.my_profile();
-- drop function if exists public.current_contact_id();
-- drop function if exists public.is_admin();
-- drop table if exists public.profiles;
-- =============================================================================
