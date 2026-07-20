-- =============================================================================
-- Souza Group Finance — Tesouraria: contas, saldo e transferências
--
-- COMO APLICAR: Supabase → SQL Editor → cole tudo → Run.
-- Seguro rodar mais de uma vez.
--
-- PROJETO CORRETO: souza-financeiro (iejmrzcgoeoxhhcnqodn). NUNCA o icrm.
--
-- POR QUE ISTO EXISTE: até agora o "caixa" do sistema era a soma de tudo que
-- foi liquidado desde o início dos tempos. Sem saldo inicial e sem conta, esse
-- número nunca bate com o extrato do banco. Aqui nasce o saldo de verdade.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Contas (banco, dinheiro, investimento, cartão)
-- -----------------------------------------------------------------------------
create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  name            text not null,
  type            text not null default 'checking'
                  check (type in ('checking', 'savings', 'cash', 'investment', 'credit_card')),
  bank            text,
  -- Saldo do dia em que a conta passou a ser controlada aqui. Sem isto o
  -- sistema só conhece o movimento, não o patrimônio.
  opening_balance numeric(14,2) not null default 0,
  opening_date    date not null default current_date,
  color           text not null default '#0F766E',
  is_active       boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists accounts_company_idx on public.accounts (company_id, is_active);

alter table public.accounts enable row level security;
drop policy if exists "accounts_authenticated_all" on public.accounts;
create policy "accounts_authenticated_all"
  on public.accounts for all to authenticated using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 2. Vínculo do lançamento com a conta
--
-- Fica NULL de propósito no histórico: o Rafael optou por classificar depois,
-- um a um. O app mostra os sem-conta separados em vez de escondê-los, para o
-- saldo nunca mentir por omissão.
-- -----------------------------------------------------------------------------
alter table public.transactions
  add column if not exists account_id uuid references public.accounts(id) on delete set null;

create index if not exists transactions_account_idx on public.transactions (account_id);

comment on column public.transactions.account_id is
  'Conta onde o dinheiro entrou/saiu. NULL = ainda não classificado; entra no bucket "sem conta" do saldo.';

-- -----------------------------------------------------------------------------
-- 3. Transferências entre contas
--
-- Tabela separada de propósito: mover dinheiro da conta corrente para a
-- poupança não é receita nem despesa e não pode encostar no DRE.
-- -----------------------------------------------------------------------------
create table if not exists public.transfers (
  id              uuid primary key default gen_random_uuid(),
  from_account_id uuid not null references public.accounts(id) on delete cascade,
  to_account_id   uuid not null references public.accounts(id) on delete cascade,
  amount          numeric(14,2) not null check (amount > 0),
  date            date not null default current_date,
  description     text,
  created_at      timestamptz not null default now(),

  constraint transfers_distinct_accounts_ck check (from_account_id <> to_account_id)
);

create index if not exists transfers_date_idx on public.transfers (date desc);
create index if not exists transfers_from_idx on public.transfers (from_account_id);
create index if not exists transfers_to_idx   on public.transfers (to_account_id);

alter table public.transfers enable row level security;
drop policy if exists "transfers_authenticated_all" on public.transfers;
create policy "transfers_authenticated_all"
  on public.transfers for all to authenticated using (true) with check (true);
