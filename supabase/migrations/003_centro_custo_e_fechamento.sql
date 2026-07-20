-- =============================================================================
-- Souza Group Finance — Centro de custo (empreendimento) e fechamento de mês
--
-- COMO APLICAR: Supabase → SQL Editor → cole tudo → Run.
-- Seguro rodar mais de uma vez.
--
-- PROJETO CORRETO: souza-financeiro (iejmrzcgoeoxhhcnqodn). NUNCA o icrm.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Empreendimentos (centro de custo)
--
-- Sem isto não há como responder qual produto dá lucro. Numa imobiliária
-- que trabalha vários empreendimentos ao mesmo tempo, essa é a decisão
-- comercial mais cara que existe — e hoje é tomada por intuição.
-- -----------------------------------------------------------------------------
create table if not exists public.cost_centers (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name       text not null,
  -- Construtora, incorporadora ou parceiro responsável.
  developer  text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists cost_centers_company_idx on public.cost_centers (company_id, is_active);

alter table public.cost_centers enable row level security;
drop policy if exists "cost_centers_authenticated_all" on public.cost_centers;
create policy "cost_centers_authenticated_all"
  on public.cost_centers for all to authenticated using (true) with check (true);

alter table public.transactions
  add column if not exists cost_center_id uuid references public.cost_centers(id) on delete set null;

create index if not exists transactions_cost_center_idx on public.transactions (cost_center_id);

comment on column public.transactions.cost_center_id is
  'Empreendimento a que a receita ou despesa pertence. Permite apurar resultado por produto.';

-- -----------------------------------------------------------------------------
-- 2. Fechamento de período
--
-- Hoje qualquer mês pode ser editado a qualquer momento, sem registro. Isso
-- significa que um relatório emitido hoje pode não bater com o mesmo relatório
-- emitido amanhã. Fechar o mês trava a edição e deixa rastro.
-- -----------------------------------------------------------------------------
create table if not exists public.period_closings (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  -- Primeiro dia do mês fechado.
  month      date not null,
  closed_at  timestamptz not null default now(),
  closed_by  text,
  notes      text,

  -- Um fechamento por empresa por mês. company_id NULL = fechamento do grupo.
  constraint period_closings_unique unique (company_id, month)
);

create index if not exists period_closings_month_idx on public.period_closings (month desc);

alter table public.period_closings enable row level security;
drop policy if exists "period_closings_authenticated_all" on public.period_closings;
create policy "period_closings_authenticated_all"
  on public.period_closings for all to authenticated using (true) with check (true);
