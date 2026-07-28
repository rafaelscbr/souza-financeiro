-- ============================================================================
-- 006 · Patrimônio pessoal: bens e dívidas cadastrados à mão.
--
-- ⚠️  Rodar APENAS no projeto souza-financeiro (iejmrzcgoeoxhhcnqodn).
--     NUNCA no projeto icrm.
--
-- Contas, investimentos e faturas de cartão o sistema já conhece — esta tabela
-- guarda só o que ele não tem como saber: imóveis, veículos, participações nas
-- empresas (lado ativo) e financiamentos/empréstimos (lado passivo).
--
-- Idempotente.
-- ============================================================================

create table if not exists public.personal_assets (
  id uuid primary key default gen_random_uuid(),
  -- asset = soma no patrimônio · liability = subtrai
  kind text not null check (kind in ('asset', 'liability')),
  -- imovel | veiculo | participacao | investimento | financiamento | emprestimo | outro
  category text not null,
  name text not null,
  value numeric(14, 2) not null check (value >= 0),
  /** Data da última avaliação — patrimônio envelhece; a tela avisa quando ficar velho. */
  valued_at date not null default current_date,
  notes text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.personal_assets is
  'Bens e dívidas pessoais informados manualmente. Contas, investimentos e faturas vêm das outras tabelas.';

create index if not exists personal_assets_kind_idx on public.personal_assets (kind, is_active);

alter table public.personal_assets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'personal_assets' and policyname = 'authenticated_all'
  ) then
    create policy authenticated_all on public.personal_assets
      for all to authenticated using (true) with check (true);
  end if;
end $$;
