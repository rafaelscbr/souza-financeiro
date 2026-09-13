-- ===========================================================================
-- 017 — FECHA O CFO: a checagem de acesso deixava todo mundo passar
-- ===========================================================================
-- O DEFEITO. A 013 escreveu `cfo_pode()` assim:
--
--     is_admin() or claim role = 'service_role' or current_user = 'postgres'
--
-- `cfo_pode()` é SECURITY DEFINER. Dentro de uma função assim, `current_user`
-- vira o DONO da função, que é `postgres`. Então a terceira condição era
-- sempre verdadeira, para qualquer chamador: o corretor, e qualquer pessoa com
-- a chave pública do site, sem login.
--
-- Como foi descoberto: em 12/09/2026, revisando a 015 antes de aplicar.
-- Provado de fora com a chave anon, sem login: `cfo_posicao()` e `cfo_lacunas()`
-- devolveram a posição financeira inteira. A exposição durou do momento da
-- aplicação da 013 até esta 017, cerca de 3h25. Os logs de borda do Supabase
-- nesse intervalo mostram só chamadas com user agent `node`, nos horários dos
-- testes feitos durante o desenvolvimento; nenhuma de navegador ou outro
-- cliente.
--
-- A CORREÇÃO tem duas camadas independentes, porque uma camada só já falhou:
--
-- 1. A checagem deixa de olhar para `current_user`. Passa quem é admin pelo
--    app, ou quem chega com a chave de serviço (o CLI do CFO). Nada mais.
--
-- 2. Permissão de execução. Toda função `cfo_*` perde o EXECUTE que o Postgres
--    concede a PUBLIC por padrão, e também o de `anon` e `authenticated`. Só a
--    chave de serviço executa. Nenhuma tela do app usa estas funções; quando
--    uma área do CFO existir dentro do app, o grant volta para
--    `authenticated`, com a checagem acima fazendo o resto.
--
-- VERIFICADO depois de aplicar, com uma sonda que não grava nada:
--   checagem: corretor=falso admin=verdadeiro servico=verdadeiro anon=falso
--             sem_identidade=falso
--   permissão: corretor e anon recebem 42501 ao chamar cfo_posicao()
--   de fora, com a chave pública: as cinco funções testadas devolvem 42501
--   CLI com a chave de serviço: continua funcionando
--
-- ATENÇÃO para toda migração futura que criar função `cfo_*`: função nova
-- nasce com EXECUTE para PUBLIC. Cada uma precisa do seu próprio
-- `revoke all ... from public, anon, authenticated` e `grant ... to
-- service_role`. A 015 e a 018 já fazem isso.
-- ===========================================================================

create or replace function public.cfo_pode()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.is_admin(), false)
      or coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$$;

do $$
declare
  r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'cfo\_%'
  loop
    execute format('revoke all on function public.%I(%s) from public, anon, authenticated', r.proname, r.args);
    execute format('grant execute on function public.%I(%s) to service_role', r.proname, r.args);
  end loop;
end $$;
