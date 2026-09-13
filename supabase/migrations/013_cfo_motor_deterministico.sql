-- ===========================================================================
-- 013 — O MOTOR DETERMINÍSTICO DO CFO: acesso, empresa, classificação e posição
-- ===========================================================================
-- O CFO roda no Claude Code com a chave de serviço. Para o conselho dele valer,
-- o número que ele cita tem de ser o mesmo que o Rafael vê na tela. Por isso a
-- conta é feita aqui, em SQL, e o modelo só interpreta o resultado.
--
-- cfo_grupo_dre e cfo_data_regime replicam linha por linha dreGroupOf e
-- regimeDate de src/lib/finance.ts. Se uma mudar, a outra muda junto.
--
-- cfo_posicao separa as quatro coisas que se confundem: saldo em conta, a
-- receber, devido agora e previsto. Previsto NÃO é dívida.
--
-- O código abaixo foi exportado de produção com pg_get_functiondef em
-- 12/09/2026, então é idêntico ao que está no banco.
--
-- ATENÇÃO: cfo_pode já aparece na forma corrigida pela 017. A versão original
-- desta migração usava current_user, que dentro de SECURITY DEFINER é sempre o
-- dono da função, e deixava qualquer chamador passar. Nunca restaure aquela.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.cfo_pode()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(public.is_admin(), false)
      or coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$function$
;

CREATE OR REPLACE FUNCTION public.cfo_exige_admin()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.cfo_pode() then
    raise exception 'Só o administrador pode consultar o CFO.' using errcode = '42501';
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.cfo_empresa()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select id from companies where slug = 'imobiliaria' limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.cfo_grupo_dre(p_category text, p_dre_group text, p_kind text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case
    when p_category in ('Pró-labore', 'Pro-labore') then 'operating_expense'
    when p_category in ('Impostos e Taxas', 'Imposto', 'Impostos', 'DAS', 'Simples Nacional') then 'tax'
    when p_dre_group is not null then p_dre_group
    when p_kind = 'income' then 'revenue'
    when p_kind = 'withdrawal' then 'withdrawal'
    when p_category in ('Comissões de Corretores', 'Repasse a Corretores', 'Repasse de Comissão') then 'cost_of_sale'
    when p_category in ('Aluguel', 'Salários', 'Ferramentas/Assinaturas', 'Pró-labore',
                        'Internet/Telefonia', 'Contabilidade') then 'operating_expense'
    else 'variable_expense'
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.cfo_data_regime(p_card_cycle_month date, p_competence date, p_settled date, p_status text, p_regime text)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case
    when p_card_cycle_month is not null then p_card_cycle_month
    when p_regime = 'accrual' then p_competence
    when p_status <> 'settled' then null
    else coalesce(p_settled, p_competence)
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.cfo_posicao()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_empresa uuid := public.cfo_empresa();
  v_hoje date := current_date;
  v_saldo numeric;
  v_saldo_cartao numeric;
  r jsonb;
begin
  perform public.cfo_exige_admin();

  select coalesce(sum(x.saldo), 0), coalesce(sum(x.saldo_cartao), 0)
    into v_saldo, v_saldo_cartao
  from (
    select
      case when a.type = 'credit_card' then 0 else
        a.opening_balance
        + coalesce((select sum(case when public.cfo_grupo_dre(t.category, t.dre_group, t.kind) = 'revenue'
                                    then t.amount else -t.amount end)
                    from transactions t
                    where t.account_id = a.id and t.status = 'settled'
                      and coalesce(t.settled_date, t.competence_date) between a.opening_date and v_hoje), 0)
        + coalesce((select sum(tr.amount) from transfers tr where tr.to_account_id = a.id and tr.date <= v_hoje), 0)
        - coalesce((select sum(tr.amount) from transfers tr where tr.from_account_id = a.id and tr.date <= v_hoje), 0)
      end as saldo,
      case when a.type = 'credit_card' then
        coalesce((select sum(t.amount) from transactions t
                  where t.account_id = a.id and t.status = 'settled'
                    and public.cfo_grupo_dre(t.category, t.dre_group, t.kind) <> 'revenue'), 0)
      else 0 end as saldo_cartao
    from accounts a
    where a.company_id = v_empresa and a.is_active
  ) x;

  select jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_posicao',
      'consultado_em', now(),
      'data_de_referencia', v_hoje,
      'empresa', 'Souza Imobiliária',
      'premissas', jsonb_build_array(
        'Saldo exclui cartão de crédito: fatura é dívida, não caixa.',
        'Transferência entre contas próprias não é receita nem despesa e não é contada duas vezes.',
        'Devido agora = comissão de parcela JÁ RECEBIDA + imposto de parcela JÁ RECEBIDA + despesa lançada.',
        'Previsto NÃO é dívida: só vira obrigação quando a construtora pagar a parcela.'
      )
    ),

    'caixa', jsonb_build_object(
      'disponivel', round(v_saldo, 2),
      'fatura_cartao_em_aberto', round(v_saldo_cartao, 2),
      'liquido', round(v_saldo - v_saldo_cartao, 2)
    ),

    'a_receber', (
      select jsonb_build_object(
        'total', coalesce(round(sum(i.amount), 2), 0),
        'parcelas', count(*),
        'vencido_construtora', coalesce(round(sum(case when i.expected_date < v_hoje then i.amount end), 2), 0),
        'vencido_parcelas', count(*) filter (where i.expected_date < v_hoje),
        'proximos_30_dias', coalesce(round(sum(case when i.expected_date between v_hoje and v_hoje + 30 then i.amount end), 2), 0),
        'proxima_data', min(i.expected_date) filter (where i.expected_date >= v_hoje)
      )
      from sale_installments i join sales s on s.id = i.sale_id
      where s.company_id = v_empresa and i.status = 'prevista' and s.status <> 'cancelada'
    ),

    'devido_agora', (
      select jsonb_build_object(
        'total', coalesce(round(sum(t.amount), 2), 0),
        'linhas', count(*),
        'comissao', coalesce(round(sum(t.amount) filter (where t.category = 'Comissões de Corretores'), 2), 0),
        'imposto', coalesce(round(sum(t.amount) filter (where public.cfo_grupo_dre(t.category, t.dre_group, t.kind) = 'tax'), 2), 0),
        'despesa', coalesce(round(sum(t.amount) filter (
            where t.category <> 'Comissões de Corretores'
              and public.cfo_grupo_dre(t.category, t.dre_group, t.kind) <> 'tax'), 2), 0),
        'vencido', coalesce(round(sum(t.amount) filter (where coalesce(t.due_date, t.competence_date) < v_hoje), 2), 0)
      )
      from transactions t
      left join sale_installments i on i.id = t.sale_installment_id
      where t.company_id = v_empresa and t.kind <> 'income' and t.status = 'pending'
        and (t.sale_installment_id is null or i.status = 'recebida')
    ),

    'previsto_nao_e_divida', (
      select jsonb_build_object(
        'total', coalesce(round(sum(t.amount), 2), 0),
        'linhas', count(*),
        'comissao_do_corretor', coalesce(round(sum(t.amount) filter (where t.category = 'Comissões de Corretores'), 2), 0),
        'imposto', coalesce(round(sum(t.amount) filter (where public.cfo_grupo_dre(t.category, t.dre_group, t.kind) = 'tax'), 2), 0),
        'explicacao', 'Sai do caixa só depois que a construtora pagar a parcela correspondente.'
      )
      from transactions t
      join sale_installments i on i.id = t.sale_installment_id
      where t.company_id = v_empresa and t.kind <> 'income' and t.status = 'pending'
        and i.status = 'prevista'
    ),

    'carteira', (
      select jsonb_build_object(
        'vendas_ativas', count(*) filter (where s.status = 'ativa'),
        'vendas_concluidas', count(*) filter (where s.status = 'concluida'),
        'comissao_contratada', coalesce(round(sum(s.commission_total) filter (where s.status <> 'cancelada'), 2), 0),
        'vgv_informado', coalesce(round(sum(s.property_value) filter (where s.status <> 'cancelada'), 2), 0),
        'vendas_sem_vgv', count(*) filter (where s.property_value is null and s.status <> 'cancelada'),
        'aviso_vgv', 'VGV é o valor dos imóveis vendidos. NÃO é receita da imobiliária: a receita é a comissão.'
      )
      from sales s where s.company_id = v_empresa
    )
  ) into r;

  return r;
end $function$
;

-- ---------------------------------------------------------------------------
-- Permissão: só a chave de serviço executa (ver 017). Função nova nasce com
-- EXECUTE para PUBLIC, então cada migração que cria função precisa disto.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array['cfo_pode', 'cfo_exige_admin', 'cfo_empresa', 'cfo_grupo_dre', 'cfo_data_regime', 'cfo_posicao'])
  loop
    execute format('revoke all on function public.%I(%s) from public, anon, authenticated', r.proname, r.args);
    execute format('grant execute on function public.%I(%s) to service_role', r.proname, r.args);
  end loop;
end $$;
