-- =============================================================================
-- 008 · A venda como entidade
--
-- COMO APLICAR: Supabase → SQL Editor → cole tudo → Run. Seguro repetir.
-- PROJETO CORRETO: souza-financeiro (iejmrzcgoeoxhhcnqodn). NUNCA o icrm.
--
-- POR QUE ISTO EXISTE: até aqui "venda" não existia no banco. Ela era
-- reconstruída na tela a partir de lançamentos que compartilhavam `group_id`,
-- com o cliente no `counterparty`, o corretor no `contact_id` da linha de
-- repasse e o percentual escrito na descrição. Funcionava, mas dependia de
-- texto: renomear uma descrição já fez um lançamento sumir de um relatório sem
-- erro nenhum. E não havia como responder "esta parcela já foi liberada para o
-- corretor?" — pergunta central da área do corretor.
--
-- O razão (`transactions`) continua sendo a verdade contábil: DRE, caixa,
-- extrato e previsão seguem lendo de lá. A venda passa a ser a verdade
-- operacional, ligada ao razão por chave, nunca por texto.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Cadastros que a venda usa
-- -----------------------------------------------------------------------------

-- Percentual padrão do corretor: preenche o formulário sozinho.
-- `is_owner` substitui a constante 'Rafael Alves de Souza' que estava fixa no
-- código (lib/commissions.ts) e impedia generalizar para qualquer corretor.
alter table public.contacts
  add column if not exists default_broker_pct numeric(6,3)
    check (default_broker_pct is null or (default_broker_pct >= 0 and default_broker_pct <= 100)),
  add column if not exists is_owner boolean not null default false;

comment on column public.contacts.is_owner is
  'true = este contato é o próprio dono (Rafael). Recebe comissão como corretor, mas não é terceiro.';

-- Empresa arquivada sai da experiência sem ser apagada: outras tabelas a
-- referenciam por chave, então deletar quebraria o histórico.
alter table public.companies
  add column if not exists is_archived boolean not null default false;

-- Regras tributárias por empreendimento. O ISS retido na fonte apareceu só na
-- venda 414-D (a Lotisa retém 3% no ato do pagamento) e não estava em lugar
-- nenhum do sistema; sem isto, cada recebimento dependeria de alguém lembrar.
alter table public.cost_centers
  add column if not exists retains_iss boolean not null default false,
  add column if not exists iss_pct numeric(6,3) default 3
    check (iss_pct is null or (iss_pct >= 0 and iss_pct <= 100)),
  add column if not exists default_commission_pct numeric(6,3)
    check (default_commission_pct is null or (default_commission_pct >= 0 and default_commission_pct <= 100));

comment on column public.cost_centers.retains_iss is
  'A construtora retém ISS na fonte? Quando sim, o Simples incide sobre a parcela líquida de ISS.';

-- -----------------------------------------------------------------------------
-- 2. A venda
-- -----------------------------------------------------------------------------
create table if not exists public.sales (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,

  title             text not null,
  cost_center_id    uuid references public.cost_centers(id) on delete set null,
  unit              text,
  client_name       text,
  sale_date         date not null,

  /** Valor do imóvel (VGV). NULL quando não informado — não inventar. */
  property_value    numeric(14,2) check (property_value is null or property_value >= 0),
  /** % da comissão sobre o VGV. Informativo: quem manda é commission_total. */
  commission_pct    numeric(6,3) check (commission_pct is null or commission_pct >= 0),
  /** Comissão que a Souza tem direito a receber. Em parceria, só a parte dela. */
  commission_total  numeric(14,2) not null check (commission_total >= 0),

  /** Parceria com outra imobiliária: o nome e a fatia da Souza, para relatório. */
  partner_name      text,
  partner_share_pct numeric(6,3) check (partner_share_pct is null or (partner_share_pct > 0 and partner_share_pct <= 100)),

  /** Emite nota? Sem NF não há Simples (caso Rogga/Urban Club). */
  issues_invoice    boolean not null default true,
  simples_pct       numeric(6,3) not null default 6 check (simples_pct >= 0 and simples_pct <= 100),
  retains_iss       boolean not null default false,
  iss_pct           numeric(6,3) not null default 0 check (iss_pct >= 0 and iss_pct <= 100),

  broker_id         uuid references public.contacts(id) on delete set null,
  broker_pct        numeric(6,3) check (broker_pct is null or (broker_pct >= 0 and broker_pct <= 100)),
  /** Fatia do sócio no que sobra. Hoje não usada (ver decisão D4); fica para não travar. */
  owner_profit_pct  numeric(6,3) check (owner_profit_pct is null or (owner_profit_pct >= 0 and owner_profit_pct <= 100)),

  status            text not null default 'ativa' check (status in ('ativa', 'concluida', 'cancelada')),
  notes             text,

  /** `group_id` de origem quando a venda veio da migração. Torna a migração idempotente. */
  legacy_group_id   uuid,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists sales_company_idx  on public.sales (company_id, sale_date desc);
create index if not exists sales_broker_idx   on public.sales (broker_id);
create index if not exists sales_cc_idx       on public.sales (cost_center_id);
create unique index if not exists sales_legacy_idx
  on public.sales (legacy_group_id) where legacy_group_id is not null;

-- -----------------------------------------------------------------------------
-- 3. As parcelas
--
-- Os valores são GRAVADOS, não derivados de percentual na leitura. A regra de
-- imposto mudou entre a venda de janeiro (só 6% sobre o bruto) e a de agosto
-- (ISS retido 3% + 6% sobre o líquido); recalcular na tela reescreveria o
-- passado a cada mudança de regra.
-- -----------------------------------------------------------------------------
create table if not exists public.sale_installments (
  id                 uuid primary key default gen_random_uuid(),
  sale_id            uuid not null references public.sales(id) on delete cascade,
  idx                integer not null check (idx >= 1),
  count              integer not null check (count >= 1),

  expected_date      date not null,
  /** Parcela bruta da comissão (parte da Souza). */
  amount             numeric(14,2) not null check (amount >= 0),

  iss_amount         numeric(14,2) not null default 0 check (iss_amount >= 0),
  simples_amount     numeric(14,2) not null default 0 check (simples_amount >= 0),
  broker_amount      numeric(14,2) not null default 0 check (broker_amount >= 0),
  /** Desconto combinado com o corretor (ex.: a cesta de R$ 399,44 na 414-D). */
  broker_adjustment  numeric(14,2) not null default 0,
  owner_amount       numeric(14,2) not null default 0 check (owner_amount >= 0),
  /** O que fica para a imobiliária nesta parcela. */
  net_amount         numeric(14,2) not null default 0,

  status             text not null default 'prevista'
                     check (status in ('prevista', 'recebida', 'cancelada')),
  received_date      date,
  /** Quanto caiu de fato na conta (parcela menos o que foi retido). */
  received_amount    numeric(14,2),
  account_id         uuid references public.accounts(id) on delete set null,
  notes              text,

  -- Ligação com o razão. Uma linha por natureza, todas opcionais: venda sem
  -- NF não tem Simples, venda sem parceiro não tem comissão de corretor.
  revenue_tx_id      uuid references public.transactions(id) on delete set null,
  iss_tx_id          uuid references public.transactions(id) on delete set null,
  simples_tx_id      uuid references public.transactions(id) on delete set null,
  broker_tx_id       uuid references public.transactions(id) on delete set null,
  owner_tx_id        uuid references public.transactions(id) on delete set null,
  other_tx_id        uuid references public.transactions(id) on delete set null,

  created_at         timestamptz not null default now(),

  constraint sale_installments_unicas unique (sale_id, idx),
  -- Recebida tem de ter data; prevista não pode ter.
  constraint sale_installments_data_ck check (
    (status = 'recebida' and received_date is not null) or
    (status <> 'recebida' and received_date is null)
  )
);

create index if not exists sale_inst_sale_idx     on public.sale_installments (sale_id, idx);
create index if not exists sale_inst_status_idx   on public.sale_installments (status, expected_date);
create index if not exists sale_inst_expected_idx on public.sale_installments (expected_date);

-- -----------------------------------------------------------------------------
-- 4. O razão aponta de volta para a venda
--
-- Sem isto, a única forma de saber que um lançamento pertence a uma venda
-- seria o `group_id` — que continua preenchido para compatibilidade, mas
-- deixa de ser o vínculo oficial.
-- -----------------------------------------------------------------------------
alter table public.transactions
  add column if not exists sale_id uuid references public.sales(id) on delete set null,
  add column if not exists sale_installment_id uuid references public.sale_installments(id) on delete set null;

create index if not exists tx_sale_idx      on public.transactions (sale_id);
create index if not exists tx_sale_inst_idx on public.transactions (sale_installment_id);

comment on column public.transactions.sale_id is
  'Venda que originou este lançamento. Substitui o vínculo por group_id/descrição.';

-- -----------------------------------------------------------------------------
-- 5. updated_at automático na venda
-- -----------------------------------------------------------------------------
create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists sales_updated_at on public.sales;
create trigger sales_updated_at before update on public.sales
  for each row execute function public.tocar_updated_at();

-- -----------------------------------------------------------------------------
-- 6. Acesso: só administrador. O corretor lê pelas funções da migração 010.
-- -----------------------------------------------------------------------------
alter table public.sales enable row level security;
alter table public.sale_installments enable row level security;

drop policy if exists admin_tudo on public.sales;
create policy admin_tudo on public.sales for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists admin_tudo on public.sale_installments;
create policy admin_tudo on public.sale_installments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- REVERSÃO
--
-- alter table public.transactions drop column if exists sale_installment_id;
-- alter table public.transactions drop column if exists sale_id;
-- drop table if exists public.sale_installments;
-- drop table if exists public.sales;
-- drop function if exists public.tocar_updated_at() cascade;
-- alter table public.cost_centers drop column if exists default_commission_pct,
--   drop column if exists iss_pct, drop column if exists retains_iss;
-- alter table public.companies drop column if exists is_archived;
-- alter table public.contacts drop column if exists is_owner,
--   drop column if exists default_broker_pct;
-- =============================================================================
