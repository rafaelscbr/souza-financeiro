-- 044 — Fase 8 (23/10/2026): de onde veio cada venda e para onde foi cada real de marketing.
--
-- ADITIVA: duas colunas novas, vazias. Nada existente muda.
--
-- Decisão do Rafael em 23/10/2026: quatro origens — tráfego pago, indicação,
-- portais, carteira e relacionamento — perguntadas ao registrar a venda; e a
-- despesa de marketing diz o canal. O retorno sai por canal: o que se
-- investiu nele contra as vendas que ele trouxe. Vazio = não informado.

alter table public.sales
  add column if not exists origin text
  check (origin in ('trafego_pago', 'indicacao', 'portais', 'carteira'));

alter table public.transactions
  add column if not exists marketing_channel text
  check (marketing_channel in ('trafego_pago', 'indicacao', 'portais', 'carteira'));

comment on column public.sales.origin is 'De onde veio o cliente (Fase 8). Nulo = não informado.';
comment on column public.transactions.marketing_channel is 'Canal da despesa de marketing (Fase 8). Nulo = sem canal.';

notify pgrst, 'reload schema';
