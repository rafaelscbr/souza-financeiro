-- ============================================================
-- SOUZA FINANCEIRO — Schema Supabase
-- Execute este SQL no SQL Editor do seu projeto Supabase
-- ============================================================

-- Enable UUID extension (já habilitado por padrão no Supabase)
-- create extension if not exists "uuid-ossp";

-- ============================================================
-- EMPREENDIMENTOS (Developments)
-- ============================================================
create table if not exists developments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  developer_name text,
  location    text,
  city        text,
  state       text,
  total_units integer,
  delivery_date date,
  status      text not null default 'active'
                  check (status in ('active', 'delivered', 'cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- CORRETORES (Brokers)
-- ============================================================
create table if not exists brokers (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  creci                 text,
  email                 text,
  phone                 text,
  pix_key               text,
  bank_name             text,
  bank_agency           text,
  bank_account          text,
  commission_default_pct numeric(5,2) not null default 6.00,
  active                boolean not null default true,
  created_at            timestamptz not null default now()
);

-- ============================================================
-- VENDAS (Sales)
-- ============================================================
create table if not exists sales (
  id                uuid primary key default gen_random_uuid(),
  development_id    uuid references developments(id) on delete set null,
  unit_number       text,
  unit_type         text,
  floor_number      integer,
  area_m2           numeric(10,2),

  -- Comprador
  buyer_name        text not null,
  buyer_cpf         text,
  buyer_phone       text,
  buyer_email       text,

  -- Valores
  total_price       numeric(15,2) not null,
  vgl               numeric(15,2),                -- Valor Geral Líquido

  -- Datas
  sale_date         date not null,
  contract_date     date,
  deed_date         date,

  -- Status
  status            text not null default 'contracted'
                       check (status in ('contracted', 'completed', 'cancelled')),

  -- Comissão
  commission_pct    numeric(5,2),
  commission_total  numeric(15,2),
  commission_rule   text not null default 'upfront'
                       check (commission_rule in ('upfront', 'installments', 'custom')),

  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================================
-- CORRETORES DA VENDA (Sale Brokers — split de comissão)
-- ============================================================
create table if not exists sale_brokers (
  id               uuid primary key default gen_random_uuid(),
  sale_id          uuid not null references sales(id) on delete cascade,
  broker_id        uuid not null references brokers(id) on delete restrict,
  role             text check (role in ('captador', 'vendedor', 'coordenador')),
  commission_pct   numeric(5,2),
  commission_value numeric(15,2),
  created_at       timestamptz not null default now()
);

-- ============================================================
-- PARCELAS DE COMISSÃO (Commission Installments — comissão parcelada)
-- ============================================================
create table if not exists commission_installments (
  id                 uuid primary key default gen_random_uuid(),
  sale_id            uuid not null references sales(id) on delete cascade,
  broker_id          uuid not null references brokers(id) on delete restrict,
  installment_number integer not null,
  due_date           date not null,
  amount             numeric(15,2) not null,
  paid               boolean not null default false,
  paid_date          date,
  notes              text,
  created_at         timestamptz not null default now()
);

-- ============================================================
-- CONTAS A RECEBER (Receivables)
-- ============================================================
create table if not exists receivables (
  id            uuid primary key default gen_random_uuid(),
  sale_id       uuid references sales(id) on delete cascade,
  description   text not null,
  due_date      date not null,
  amount        numeric(15,2) not null,
  received      boolean not null default false,
  received_date date,
  category      text not null default 'commission'
                    check (category in ('commission', 'fee', 'other')),
  notes         text,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- DESPESAS / CONTAS A PAGAR (Expenses)
-- ============================================================
create table if not exists expenses (
  id             uuid primary key default gen_random_uuid(),
  description    text not null,
  category       text not null,               -- rent, marketing, salary, etc.
  subcategory    text,                         -- Meta Ads, Google Ads, etc.
  development_id uuid references developments(id) on delete set null,
  amount         numeric(15,2) not null,
  due_date       date not null,
  paid           boolean not null default false,
  paid_date      date,
  recurring      boolean not null default false,
  recurring_day  integer,                      -- dia do mês para repetir
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ============================================================
-- ORÇAMENTOS (Budgets)
-- ============================================================
create table if not exists budgets (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  period_start     date not null,
  period_end       date not null,
  category         text,                       -- null = todos
  budgeted_amount  numeric(15,2) not null,
  notes            text,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
create index if not exists idx_sales_sale_date       on sales(sale_date);
create index if not exists idx_sales_status          on sales(status);
create index if not exists idx_sales_development_id  on sales(development_id);
create index if not exists idx_receivables_due_date  on receivables(due_date);
create index if not exists idx_receivables_received  on receivables(received);
create index if not exists idx_receivables_sale_id   on receivables(sale_id);
create index if not exists idx_expenses_due_date     on expenses(due_date);
create index if not exists idx_expenses_paid         on expenses(paid);
create index if not exists idx_expenses_category     on expenses(category);
create index if not exists idx_commission_sale_id    on commission_installments(sale_id);
create index if not exists idx_commission_broker_id  on commission_installments(broker_id);
create index if not exists idx_sale_brokers_sale_id  on sale_brokers(sale_id);

-- ============================================================
-- RLS (Row Level Security) — habilitar para segurança
-- Para sistema single-user, pode desabilitar ou usar authenticated role
-- ============================================================

alter table developments          enable row level security;
alter table brokers               enable row level security;
alter table sales                 enable row level security;
alter table sale_brokers          enable row level security;
alter table commission_installments enable row level security;
alter table receivables           enable row level security;
alter table expenses              enable row level security;
alter table budgets               enable row level security;

-- Políticas: usuários autenticados têm acesso total (sistema single-tenant)
create policy "authenticated_all" on developments          for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_all" on brokers               for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_all" on sales                 for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_all" on sale_brokers          for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_all" on commission_installments for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_all" on receivables           for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_all" on expenses              for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_all" on budgets               for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_sales_updated_at
  before update on sales
  for each row execute function update_updated_at();

create trigger trg_developments_updated_at
  before update on developments
  for each row execute function update_updated_at();

create trigger trg_expenses_updated_at
  before update on expenses
  for each row execute function update_updated_at();

-- ============================================================
-- DADOS DE EXEMPLO (opcional — descomente para testar)
-- ============================================================

-- insert into developments (name, developer_name, city, state, total_units, status)
-- values
--   ('Residencial Jardins', 'MRV Engenharia', 'São Paulo', 'SP', 120, 'active'),
--   ('Towers Premium', 'Cyrela', 'Campinas', 'SP', 80, 'active'),
--   ('Parque das Flores', 'Even Construtora', 'São Paulo', 'SP', 200, 'active');

-- insert into brokers (name, creci, phone, commission_default_pct)
-- values
--   ('João Silva', '123456-F', '(11) 99999-1111', 6.0),
--   ('Maria Santos', '654321-F', '(11) 99999-2222', 6.0),
--   ('Carlos Oliveira', '111111-F', '(11) 99999-3333', 5.5);
