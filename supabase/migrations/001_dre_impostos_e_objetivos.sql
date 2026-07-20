-- =============================================================================
-- Souza Group Finance — DRE profissional + objetivos com custo
--
-- COMO APLICAR: Supabase → SQL Editor → cole tudo → Run.
-- É seguro rodar mais de uma vez (tudo usa IF NOT EXISTS).
--
-- PROJETO CORRETO: souza-financeiro (iejmrzcgoeoxhhcnqodn).
-- NUNCA rodar no projeto icrm.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enquadramento tributário por empresa
--
-- Sem isso o DRE pulava de Receita Bruta direto para Lucro, ignorando o
-- Simples Nacional — que no seu caso incide sobre a comissão CHEIA, antes
-- do pagamento ao corretor. O lucro aparecia maior do que é.
-- -----------------------------------------------------------------------------
alter table public.companies
  add column if not exists tax_regime text
    check (tax_regime in ('simples', 'presumido', 'real', 'none')),
  add column if not exists tax_rate numeric(5,2)
    check (tax_rate >= 0 and tax_rate <= 100);

comment on column public.companies.tax_rate is
  'Alíquota EFETIVA sobre a receita bruta, em %. No Simples é a do extrato do DAS (Receita Federal → Simples Nacional → PGDAS-D), não a nominal da tabela.';

-- Marca as empresas como Simples; a alíquota fica NULL de propósito, para o
-- app pedir a configuração em vez de assumir um número inventado.
update public.companies
   set tax_regime = 'simples'
 where tax_regime is null
   and is_personal = false;

-- A empresa Pessoal não é contribuinte.
update public.companies
   set tax_regime = 'none', tax_rate = 0
 where is_personal = true;

-- -----------------------------------------------------------------------------
-- 2. Nomenclatura profissional do CSP
--
-- "Repasse" não existe em DRE. A comissão paga ao corretor é Custo dos
-- Serviços Prestados: o gasto direto para entregar o serviço vendido.
-- -----------------------------------------------------------------------------
update public.transactions
   set category = 'Comissões de Corretores'
 where category in ('Repasse a Corretores', 'Repasse de Comissão');

update public.categories
   set name = 'Comissões de Corretores'
 where name in ('Repasse a Corretores', 'Repasse de Comissão');

-- -----------------------------------------------------------------------------
-- 3. Pró-labore deixa de ser "retirada"
--
-- Pró-labore remunera o TRABALHO do sócio: é despesa operacional e entra
-- antes do lucro. Distribuição de lucro remunera o CAPITAL e sai depois.
-- Somados no mesmo balde, escondiam o custo real da operação.
-- -----------------------------------------------------------------------------
update public.transactions
   set dre_group = 'operating_expense'
 where category in ('Pró-labore', 'Pro-labore')
   and dre_group is distinct from 'operating_expense';

update public.categories
   set dre_group = 'operating_expense'
 where name in ('Pró-labore', 'Pro-labore');

-- -----------------------------------------------------------------------------
-- 4. Objetivos com custo
--
-- "Quero alugar uma sala comercial": custo de entrada + custo mensal.
-- O app cruza com o resultado real e responde se dá, quanto falta faturar
-- e em quantos meses o movimento fica seguro.
-- -----------------------------------------------------------------------------
create table if not exists public.objectives (
  id            uuid primary key default gen_random_uuid(),
  scope         text not null check (scope in ('business', 'personal')),
  company_id    uuid references public.companies(id) on delete cascade,
  name          text not null,
  one_time_cost numeric(14,2) not null default 0 check (one_time_cost >= 0),
  monthly_cost  numeric(14,2) not null default 0 check (monthly_cost >= 0),
  target_date   date,
  notes         text,
  status        text not null default 'planned'
                check (status in ('planned', 'achieved', 'cancelled')),
  created_at    timestamptz not null default now(),

  -- Objetivo de empresa precisa de empresa; objetivo pessoal não.
  constraint objectives_scope_company_ck check (
    (scope = 'business' and company_id is not null) or
    (scope = 'personal' and company_id is null)
  )
);

create index if not exists objectives_scope_idx   on public.objectives (scope, status);
create index if not exists objectives_company_idx on public.objectives (company_id);

alter table public.objectives enable row level security;

-- Mesma política das demais tabelas: usuário autenticado acessa tudo
-- (sistema de dono único).
drop policy if exists "objectives_authenticated_all" on public.objectives;
create policy "objectives_authenticated_all"
  on public.objectives
  for all
  to authenticated
  using (true)
  with check (true);
