-- ===========================================================================
-- 040 — O TETO DE GASTOS DO MÊS
-- ===========================================================================
-- COMO APLICAR: Supabase → SQL Editor → cole tudo → Run. Seguro repetir.
-- PROJETO CORRETO: souza-financeiro (iejmrzcgoeoxhhcnqodn). NUNCA o icrm.
--
-- Decidido com o Rafael em 22/10/2026: "definir um orçamento X e o sistema
-- girar em torno disso". O X é o teto de gastos da imobiliária por mês, o
-- mesmo em todos os meses, com base nos custos fixos: R$ 4.915, o maior mês do
-- orçamento (coworking a R$ 3.000 + tráfego R$ 1.500 + contabilidade R$ 415).
--
-- Os gastos de budget_lines (039) mostram onde o teto vai: o que está orçado
-- e ainda não foi lançado no mês fica "reservado", e o resto é livre.
-- O Início, o lançamento de despesa, o sino e o relatório Orçamento leem
-- este valor. Nulo = sem teto definido.
-- ===========================================================================

alter table public.companies
  add column if not exists monthly_budget numeric(14,2) check (monthly_budget is null or monthly_budget > 0);

comment on column public.companies.monthly_budget is
  'Teto de gastos da estrutura por mês (comercial, administrativa, pessoal). Nulo = sem teto.';

update public.companies
   set monthly_budget = 4915.00
 where slug = 'imobiliaria'
   and monthly_budget is null;
