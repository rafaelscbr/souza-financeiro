-- =============================================================================
-- Souza Group Finance — Modelos de lançamento
--
-- COMO APLICAR: Supabase → SQL Editor → cole tudo → Run. Seguro repetir.
-- PROJETO CORRETO: souza-financeiro (iejmrzcgoeoxhhcnqodn). NUNCA o icrm.
--
-- Modelos são atalhos para o que se lança sempre igual (Contador, Meta Ads,
-- Aluguel). Guardam tipo, categoria, valor sugerido e contato para preencher
-- o lançamento em um toque.
-- =============================================================================

create table if not exists public.transaction_templates (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references public.companies(id) on delete cascade,
  name        text not null,
  kind        text not null check (kind in ('income', 'expense', 'withdrawal')),
  category    text not null,
  dre_group   text,
  amount      numeric(14,2),
  contact_id  uuid references public.contacts(id) on delete set null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists tx_templates_company_idx on public.transaction_templates (company_id);

alter table public.transaction_templates enable row level security;
drop policy if exists "tx_templates_authenticated_all" on public.transaction_templates;
create policy "tx_templates_authenticated_all"
  on public.transaction_templates for all to authenticated using (true) with check (true);
