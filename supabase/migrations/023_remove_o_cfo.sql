-- ===========================================================================
-- 023 — REMOVE O CFO DO BANCO
-- ===========================================================================
-- Pedido do Rafael em 21/09/2026: "eu quero tirar tudo que é CFO do sistema...
-- não quero implementar no formato que foi implementado".
--
-- Sai tudo que começa com cfo_: as 30 funções de leitura (posição, DRE, fluxo,
-- alertas, simulação, comparação, drill-down) e as 4 tabelas do próprio agente
-- (memória, propostas, decisões e registro de consultas). Nada disso era usado
-- pelo aplicativo: o CFO só lia, pelo script scripts/cfo.mjs, que também sai.
--
-- Nenhuma tabela do financeiro é tocada: transactions, sales, sale_installments,
-- accounts, contacts, cost_centers e companies ficam intactas.
--
-- Cópia do conteúdo das tabelas antes de apagar:
--   ~/Documents/backup-cfo-antes-de-remover-2026-09-21.json
--   (cfo_memoria 2 linhas, cfo_propostas 1, cfo_decisoes 0, cfo_execucoes 16)
--
-- As migrações 013 a 022 continuam no repositório como histórico do que existiu.
-- ===========================================================================

do $$
declare
  r record;
  n_func int := 0;
  n_tab int := 0;
begin
  for r in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname like 'cfo\_%'
  loop
    execute format('drop function if exists %s cascade', r.assinatura);
    n_func := n_func + 1;
  end loop;

  for r in
    select c.relname
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relkind = 'r' and c.relname like 'cfo\_%'
  loop
    execute format('drop table if exists public.%I cascade', r.relname);
    n_tab := n_tab + 1;
  end loop;

  raise notice 'CFO removido: % funções, % tabelas', n_func, n_tab;

  if exists (
    select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname like 'cfo\_%'
  ) or exists (
    select 1 from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relname like 'cfo\_%'
  ) then
    raise exception 'sobrou objeto cfo_ no schema public';
  end if;
end $$;
