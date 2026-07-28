-- ============================================================================
-- 005 · Módulo Pessoal: cartão de crédito, categorias com identidade visual
--       e orçamento por mês.
--
-- ⚠️  Rodar APENAS no projeto souza-financeiro (iejmrzcgoeoxhhcnqodn).
--     NUNCA no projeto icrm.
--
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================================

-- 1) Ciclo do cartão de crédito, na própria conta (accounts.type = 'credit_card').
--    Fatura não vira tabela: cada compra recebe o carimbo do ciclo (abaixo) e a
--    fatura é a agregação das compras carimbadas.
alter table public.accounts
  add column if not exists card_closing_day smallint
    check (card_closing_day between 1 and 31);

alter table public.accounts
  add column if not exists card_due_day smallint
    check (card_due_day between 1 and 31);

alter table public.accounts
  add column if not exists card_limit numeric(14, 2)
    check (card_limit is null or card_limit >= 0);

comment on column public.accounts.card_closing_day is
  'Dia de fechamento da fatura (só para type = credit_card). Compra após o fechamento cai na fatura seguinte.';
comment on column public.accounts.card_due_day is
  'Dia de vencimento da fatura: primeira ocorrência APÓS o fechamento (pode cair no mesmo mês).';

-- 2) Carimbo do ciclo da fatura na transação (1º dia do mês da fatura).
--    Gravado no momento do lançamento — mudar o dia de fechamento do cartão
--    depois NÃO reescreve faturas passadas.
alter table public.transactions
  add column if not exists card_cycle_month date;

comment on column public.transactions.card_cycle_month is
  'Mês da fatura em que a compra de cartão pesa (1º dia do mês). NULL = lançamento fora de cartão.';

-- 3) Identidade visual das categorias (grade de 1 toque no lançamento rápido).
alter table public.categories add column if not exists icon text;
alter table public.categories add column if not exists color text;

-- 4) Orçamento pessoal com escopo de mês.
--    NULL = limite padrão que vale todo mês; linha com mês = ajuste pontual
--    (ex.: dezembro com 13º). Os limites já existentes viram o padrão.
alter table public.personal_budgets add column if not exists month date;

-- Unicidade tratando NULL como valor (Postgres trata NULLs como distintos
-- em UNIQUE constraint; o índice com coalesce fecha essa brecha).
create unique index if not exists personal_budgets_category_month_idx
  on public.personal_budgets (category, coalesce(month, '1900-01-01'::date));

-- 5) Índices de performance para o uso diário do módulo pessoal.
create index if not exists tx_company_competence_idx
  on public.transactions (company_id, competence_date desc);

create index if not exists tx_card_cycle_idx
  on public.transactions (account_id, card_cycle_month)
  where card_cycle_month is not null;
