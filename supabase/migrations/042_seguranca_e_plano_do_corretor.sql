-- 042 — Fase 7 (23/10/2026): revisão de acesso e o plano de carreira na área do corretor.
--
-- SÓ PERMISSÃO E UMA FUNÇÃO NOVA DE LEITURA. Nenhuma tabela, nenhuma linha.
--
-- 1. FECHAR AS FUNÇÕES PARA QUEM NÃO ENTROU.
--    O Supabase dá EXECUTE a `anon` em toda função nova. As que mexem em
--    dinheiro já conferiam is_admin() por dentro, mas a regra do projeto é
--    fechar a porta, não só checar o crachá. Três achados da revisão:
--      - sincroniza_das: recalculava o DAS de qualquer empresa e gravava o
--        lançamento pendente, chamada por qualquer um com a chave pública;
--      - broker_status: dizia se um lançamento está pago, para quem tivesse
--        o código dele;
--      - todas as demais: abertas a `anon`, protegidas só por dentro.
--    Funções chamadas por dentro de outras SECURITY DEFINER continuam
--    funcionando: quem executa a interna é o dono da externa.
--
-- 2. broker_my_plan(): o corretor lê o PRÓPRIO plano — perfil, percentuais
--    vigentes e as metas dele. Nunca a de outro, nunca a da empresa. As regras
--    (nível, %, meta do mês) são calculadas no app por lib/comissao.ts, a
--    mesma fonte que o administrador usa.

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prorettype <> 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon', f.assinatura);
  end loop;
end $$;

-- Internas: nem quem está logado chama direto. O app não usa nenhuma das duas.
revoke execute on function public.sincroniza_das(uuid, date) from authenticated;
revoke execute on function public.broker_status(text, uuid) from authenticated;

create or replace function public.broker_my_plan()
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select case when public.current_contact_id() is null then null else jsonb_build_object(
    'profile', (
      select to_jsonb(bp) - 'notes' - 'company_id'
        from public.broker_profiles bp
       where bp.contact_id = public.current_contact_id()
    ),
    'manager_name', (
      select c.name
        from public.broker_profiles bp
        join public.contacts c on c.id = bp.manager_id
       where bp.contact_id = public.current_contact_id()
    ),
    'settings', (
      select coalesce(jsonb_agg(to_jsonb(cs) - 'notes' - 'company_id' order by cs.valid_from), '[]'::jsonb)
        from public.commission_settings cs
    ),
    'goals', (
      select coalesce(jsonb_agg(to_jsonb(g) - 'notes' - 'company_id' order by g.start_month), '[]'::jsonb)
        from public.sales_goals g
       where g.contact_id = public.current_contact_id()
    )
  ) end;
$function$;

revoke all on function public.broker_my_plan() from public, anon;
grant execute on function public.broker_my_plan() to authenticated;

notify pgrst, 'reload schema';
