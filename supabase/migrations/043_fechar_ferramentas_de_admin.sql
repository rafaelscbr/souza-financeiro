-- 043 — Fase 7 (23/10/2026): o que o advisor de segurança ainda apontou depois da 042.
--
-- SÓ PERMISSÃO E search_path. Nenhuma tabela, nenhuma linha.
--
-- 1. Ferramentas de manutenção (arquivar fora do escopo, migrar vendas
--    antigas, apagar arquivados) conferem is_admin() por dentro, mas o app
--    não chama nenhuma: só se usam pelo editor SQL. Logado nenhum chama.
-- 2. Três funções auxiliares sem search_path fixo (lint 0011).

revoke execute on function public.archive_out_of_scope(boolean) from authenticated;
revoke execute on function public.migrate_legacy_sales(boolean) from authenticated;
revoke execute on function public.purge_archived(text) from authenticated;

alter function public.venc_das(date) set search_path to 'public', 'pg_temp';
alter function public.add_business_days(date, integer) set search_path to 'public', 'pg_temp';
alter function public.tocar_updated_at() set search_path to 'public', 'pg_temp';

notify pgrst, 'reload schema';
