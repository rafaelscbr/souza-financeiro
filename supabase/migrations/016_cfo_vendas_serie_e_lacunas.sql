-- ===========================================================================
-- 016 — VENDAS, SÉRIE MENSAL, CONCENTRAÇÃO E LACUNAS
-- ===========================================================================
-- cfo_vendas separa VGV, comissão contratada, recebido e o que fica para a
-- imobiliária depois de ISS, Simples e corretor. VGV não é receita.
--
-- cfo_concentracao mostra de quem o caixa depende. Concentração alta é risco
-- mesmo quando o número total é bonito.
--
-- cfo_lacunas declara o que o sistema NÃO sabe (orçamento, dívida,
-- conciliação, pagamento parcial, reserva-alvo) e a qualidade do dado. Existe
-- para o CFO dizer "não sei" em vez de estimar: dado ausente aparece como
-- indisponível, nunca como zero.
--
-- Exportado de produção com pg_get_functiondef em 12/09/2026.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.cfo_vendas(p_de date DEFAULT NULL::date, p_ate date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_empresa uuid := public.cfo_empresa();
begin
  perform public.cfo_exige_admin();
  return jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_vendas', 'consultado_em', now(), 'de', p_de, 'ate', p_ate,
      'premissas', jsonb_build_array(
        'VGV é o valor dos imóveis vendidos. NÃO é receita da imobiliária.',
        'A receita é a comissão CONTRATADA da imobiliária (só a parte dela, em parceria).',
        'Do bruto da comissão saem ISS retido, Simples e a comissão do corretor.',
        'Parcela cancelada não entra em nenhum total.'
      )
    ),
    'resumo', (
      select jsonb_build_object(
        'vendas', count(*),
        'vgv_informado', coalesce(round(sum(s.property_value), 2), 0),
        'vendas_sem_vgv', count(*) filter (where s.property_value is null),
        'comissao_contratada', coalesce(round(sum(s.commission_total), 2), 0)
      )
      from sales s where s.company_id = v_empresa and s.status <> 'cancelada'
        and (p_de is null or s.sale_date >= p_de) and (p_ate is null or s.sale_date <= p_ate)
    ),
    'vendas', (
      select coalesce(jsonb_agg(x order by x->>'data' desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'id', s.id, 'titulo', s.title, 'data', s.sale_date, 'situacao', s.status,
          'empreendimento', cc.name, 'cliente', s.client_name,
          'vgv', case when s.property_value is null then null else round(s.property_value, 2) end,
          'pct_comissao', s.commission_pct,
          'comissao_contratada', round(s.commission_total, 2),
          'corretor', ct.name, 'pct_corretor', s.broker_pct,
          'retem_iss', s.retains_iss, 'pct_iss', s.iss_pct,
          'emite_nota', s.issues_invoice, 'pct_simples', s.simples_pct,
          'parcelas', (select count(*) from sale_installments i where i.sale_id = s.id and i.status <> 'cancelada'),
          'recebido', (select coalesce(round(sum(i.amount), 2), 0) from sale_installments i where i.sale_id = s.id and i.status = 'recebida'),
          'a_receber', (select coalesce(round(sum(i.amount), 2), 0) from sale_installments i where i.sale_id = s.id and i.status = 'prevista'),
          'iss_total', (select coalesce(round(sum(i.iss_amount), 2), 0) from sale_installments i where i.sale_id = s.id and i.status <> 'cancelada'),
          'simples_total', (select coalesce(round(sum(i.simples_amount), 2), 0) from sale_installments i where i.sale_id = s.id and i.status <> 'cancelada'),
          'comissao_do_corretor', (select coalesce(round(sum(i.broker_amount - i.broker_adjustment), 2), 0) from sale_installments i where i.sale_id = s.id and i.status <> 'cancelada'),
          'fica_para_a_imobiliaria', (select coalesce(round(sum(i.amount - i.iss_amount - i.simples_amount - (i.broker_amount - i.broker_adjustment) - i.owner_amount), 2), 0) from sale_installments i where i.sale_id = s.id and i.status <> 'cancelada')
        ) as x
        from sales s
        left join cost_centers cc on cc.id = s.cost_center_id
        left join contacts ct on ct.id = s.broker_id
        where s.company_id = v_empresa
          and (p_de is null or s.sale_date >= p_de) and (p_ate is null or s.sale_date <= p_ate)
        limit 500
      ) y
    )
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.cfo_serie_mensal(p_meses integer DEFAULT 12, p_regime text DEFAULT 'accrual'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_empresa uuid := public.cfo_empresa();
  v_n integer := least(greatest(coalesce(p_meses, 12), 1), 60);
  v_regime text := case when p_regime in ('cash','accrual') then p_regime else 'accrual' end;
begin
  perform public.cfo_exige_admin();
  return jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_serie_mensal', 'consultado_em', now(), 'meses', v_n, 'regime', v_regime,
      'premissas', jsonb_build_array(
        'Receita de comissão é irregular por natureza: entra grande e espaçada.',
        'Média de mês bom não serve para planejar.'
      )
    ),
    'meses', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'mes', to_char(m, 'YYYY-MM'),
        'receita', round(receita, 2), 'custo', round(custo, 2), 'imposto', round(imposto, 2),
        'estrutura', round(estrutura, 2), 'resultado', round(receita - imposto - custo - estrutura, 2),
        'linhas', linhas
      ) order by m), '[]'::jsonb)
      from (
        select date_trunc('month', d)::date as m,
          coalesce(sum(t.amount) filter (where g = 'revenue'), 0) as receita,
          coalesce(sum(t.amount) filter (where g = 'cost_of_sale'), 0) as custo,
          coalesce(sum(t.amount) filter (where g = 'tax'), 0) as imposto,
          coalesce(sum(t.amount) filter (where g in ('operating_expense','variable_expense')), 0) as estrutura,
          count(t.id) as linhas
        from generate_series(date_trunc('month', current_date) - ((v_n - 1) || ' months')::interval,
                             date_trunc('month', current_date), '1 month') d
        left join (
          select t.*, public.cfo_grupo_dre(t.category, t.dre_group, t.kind) as g,
                 public.cfo_data_regime(t.card_cycle_month, t.competence_date, t.settled_date, t.status, v_regime) as dr
          from transactions t where t.company_id = v_empresa
        ) t on date_trunc('month', t.dr) = d
        group by 1
      ) s
    )
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.cfo_concentracao()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_empresa uuid := public.cfo_empresa();
  v_total numeric;
begin
  perform public.cfo_exige_admin();
  select coalesce(sum(t.amount), 0) into v_total from transactions t
  where t.company_id = v_empresa and t.kind = 'income' and t.status = 'pending';

  return jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_concentracao', 'consultado_em', now(),
      'base', 'comissão a receber (lançamentos de receita pendentes)',
      'total_a_receber', round(v_total, 2),
      'premissas', jsonb_build_array('Concentração alta significa que o caixa depende de poucas fontes.')
    ),
    'por_empreendimento', (
      select coalesce(jsonb_agg(jsonb_build_object('empreendimento', coalesce(nome, 'sem empreendimento'),
        'valor', round(v, 2), 'fatia', case when v_total > 0 then round(v / v_total, 4) else null end
      ) order by v desc), '[]'::jsonb)
      from (
        select cc.name as nome, sum(t.amount) as v
        from transactions t
        left join sale_installments i on i.id = t.sale_installment_id
        left join sales s on s.id = coalesce(t.sale_id, i.sale_id)
        left join cost_centers cc on cc.id = coalesce(t.cost_center_id, s.cost_center_id)
        where t.company_id = v_empresa and t.kind = 'income' and t.status = 'pending'
        group by 1
      ) a
    ),
    'por_venda', (
      select coalesce(jsonb_agg(jsonb_build_object('venda', coalesce(titulo, 'sem venda'),
        'valor', round(v, 2), 'fatia', case when v_total > 0 then round(v / v_total, 4) else null end
      ) order by v desc), '[]'::jsonb)
      from (
        select s.title as titulo, sum(t.amount) as v
        from transactions t
        left join sale_installments i on i.id = t.sale_installment_id
        left join sales s on s.id = coalesce(t.sale_id, i.sale_id)
        where t.company_id = v_empresa and t.kind = 'income' and t.status = 'pending'
        group by 1
      ) b
    )
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.cfo_lacunas()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_empresa uuid := public.cfo_empresa();
  v_receita_razao numeric;
  v_comissao_vendas numeric;
  v_aliquota numeric;
begin
  perform public.cfo_exige_admin();

  select coalesce(sum(t.amount), 0) into v_receita_razao from transactions t
  where t.company_id = v_empresa and public.cfo_grupo_dre(t.category, t.dre_group, t.kind) = 'revenue';
  select coalesce(sum(s.commission_total), 0) into v_comissao_vendas from sales s
  where s.company_id = v_empresa and s.status <> 'cancelada';
  select tax_rate into v_aliquota from companies where id = v_empresa;

  return jsonb_build_object(
    '_meta', jsonb_build_object('funcao', 'cfo_lacunas', 'consultado_em', now(),
      'para_que_serve', 'Declarar o que o sistema não sabe, para o CFO não estimar no lugar.'),

    'estruturais', jsonb_build_array(
      jsonb_build_object('lacuna', 'orcamento', 'disponivel', false,
        'impacto', 'Não é possível comparar orçado contra realizado nem explicar desvio de orçamento.',
        'como_resolver', 'Criar tabela de orçamento por categoria e mês para a empresa.'),
      jsonb_build_object('lacuna', 'divida_e_emprestimo', 'disponivel', false,
        'impacto', 'Não é possível calcular endividamento, custo da dívida nem capacidade de pagamento.',
        'como_resolver', 'Criar estrutura de contratos de dívida com saldo, taxa e cronograma.'),
      jsonb_build_object('lacuna', 'conciliacao_bancaria', 'disponivel', false,
        'impacto', 'O saldo é calculado a partir dos lançamentos, não conferido contra o extrato do banco.',
        'como_resolver', 'Importar extrato e marcar cada lançamento como conciliado.'),
      jsonb_build_object('lacuna', 'pagamento_parcial', 'disponivel', false,
        'impacto', 'Um lançamento só pode estar quitado ou pendente. Recebimento parcial não tem como ser representado, embora received_amount já exista na parcela.',
        'como_resolver', 'Acrescentar estado parcial e valor já recebido no lançamento.'),
      jsonb_build_object('lacuna', 'reserva_de_caixa_alvo', 'disponivel', false,
        'impacto', 'Sem saber quanto a empresa precisa manter disponível, não há como alertar caixa abaixo da reserva.',
        'como_resolver', 'Perguntar ao Rafael e gravar em cfo_memoria com a chave reserva-minima-de-caixa.')
    ),

    'qualidade_do_dado', jsonb_build_array(
      jsonb_build_object('item', 'divergencia_receita_x_vendas',
        'receita_no_razao', round(v_receita_razao, 2),
        'comissao_nas_vendas', round(v_comissao_vendas, 2),
        'diferenca', round(v_receita_razao - v_comissao_vendas, 2),
        'ok', (abs(v_receita_razao - v_comissao_vendas) < 0.01)),
      jsonb_build_object('item', 'aliquota_de_imposto_configurada', 'valor', v_aliquota,
        'ok', (v_aliquota is not null)),
      jsonb_build_object('item', 'vendas_sem_vgv',
        'quantas', (select count(*) from sales s where s.company_id = v_empresa and s.status <> 'cancelada' and s.property_value is null),
        'impacto', 'Sem VGV não dá para calcular a comissão como percentual do vendido.'),
      jsonb_build_object('item', 'vendas_sem_percentual_de_comissao',
        'quantas', (select count(*) from sales s where s.company_id = v_empresa and s.status <> 'cancelada' and s.commission_pct is null)),
      jsonb_build_object('item', 'lancamentos_sem_conta',
        'quantos', (select count(*) from transactions t where t.company_id = v_empresa and t.status = 'settled' and t.account_id is null),
        'impacto', 'Lançamento liquidado sem conta não entra no saldo de nenhuma conta.'),
      jsonb_build_object('item', 'lancamentos_sem_empreendimento',
        'quantos', (select count(*) from transactions t where t.company_id = v_empresa and t.cost_center_id is null),
        'impacto', 'Sem centro de custo não dá para apurar rentabilidade por empreendimento.')
    )
  );
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
    where n.nspname = 'public' and p.proname = any (array['cfo_vendas', 'cfo_serie_mensal', 'cfo_concentracao', 'cfo_lacunas'])
  loop
    execute format('revoke all on function public.%I(%s) from public, anon, authenticated', r.proname, r.args);
    execute format('grant execute on function public.%I(%s) to service_role', r.proname, r.args);
  end loop;
end $$;
