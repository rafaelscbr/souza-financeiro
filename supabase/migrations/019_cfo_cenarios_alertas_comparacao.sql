-- ===========================================================================
-- 019 — CFO: fluxo que não esconde vencido, cenários, alertas e comparação
-- ===========================================================================
-- 1. cfo_fluxo_semanal (substitui a da 014). A primeira versão só somava o que
--    vencia de hoje em diante e descartava EM SILÊNCIO tudo que já tinha
--    vencido: R$ 2.076,98 de contas vencidas não apareciam na semana 1. Agora:
--    saída vencida que não depende de recebimento é obrigação de agora e entra
--    na semana 1; entrada vencida (a construtora atrasou) fica fora do fluxo e
--    aparece declarada no _meta; e a saída atrelada a parcela ainda prevista
--    anda junto com a parcela, porque só vira dívida quando o dinheiro entrar.
--
-- 2. cfo_simular. Cenários conservador, base e otimista com as premissas
--    VISÍVEIS e editáveis. Nenhum cenário tem probabilidade: os nomes são
--    rótulos de premissas. A regra que importa: o que depende de recebimento
--    anda junto com ele. Se a parcela da construtora atrasa 30 dias, a
--    comissão do corretor e o imposto daquela parcela atrasam 30 dias também.
--
-- 3. cfo_alertas. Caixa abaixo da reserva, vencimentos sem cobertura, contas
--    vencidas, recebimentos atrasados, comissão liberada esperando, possíveis
--    duplicidades e lançamentos sem conta. Orçamento não existe no sistema,
--    então o alerta de estouro aparece como indisponível, nunca como zero.
--    Cada alerta traz o filtro de cfo_lancamentos que abre o que o sustenta.
--
-- 4. cfo_comparar_periodos. O período pedido contra o equivalente anterior (o
--    mês civil anterior, se o recorte é um mês inteiro; senão o mesmo número
--    de dias logo antes), linha a linha do DRE e categoria por categoria.
--
-- Todas: SECURITY DEFINER, search_path travado, cfo_exige_admin() primeiro, e
-- EXECUTE só para service_role (ver 017).
--
-- Este arquivo já traz as duas correções da 020 (lógica de três valores e
-- dinheiro em formato brasileiro). Em produção elas entraram pela 020.
-- ===========================================================================

create or replace function public.cfo_fluxo_semanal(
  p_semanas integer default 13,
  p_reserva numeric default 0
) returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_empresa uuid := public.cfo_empresa();
  v_hoje date := current_date;
  v_n integer := least(greatest(coalesce(p_semanas, 13), 1), 52);
  v_saldo numeric := ((public.cfo_posicao() -> 'caixa') ->> 'disponivel')::numeric;
  v_semanas jsonb;
  v_venc_receber numeric;
  v_venc_receber_linhas integer;
  v_venc_pagar numeric;
  v_venc_pagar_linhas integer;
begin
  perform public.cfo_exige_admin();

  select coalesce(sum(t.amount), 0), count(*) into v_venc_receber, v_venc_receber_linhas
  from transactions t
  where t.company_id = v_empresa and t.status = 'pending' and t.kind = 'income'
    and coalesce(t.due_date, t.competence_date) < v_hoje;

  select coalesce(sum(t.amount), 0), count(*) into v_venc_pagar, v_venc_pagar_linhas
  from transactions t
  left join sale_installments i on i.id = t.sale_installment_id
  where t.company_id = v_empresa and t.status = 'pending' and t.kind <> 'income'
    and coalesce(t.due_date, t.competence_date) < v_hoje
    and (i.status is distinct from 'prevista');

  with semanas as (
    select gs as n, (v_hoje + (gs - 1) * 7)::date as inicio, (v_hoje + gs * 7 - 1)::date as fim
    from generate_series(1, v_n) gs
  ),
  mov as (
    select greatest(coalesce(t.due_date, t.competence_date), v_hoje) as data,
           t.id, t.amount,
           public.cfo_grupo_dre(t.category, t.dre_group, t.kind) as g
    from transactions t
    left join sale_installments i on i.id = t.sale_installment_id
    where t.company_id = v_empresa and t.status = 'pending'
      and not (coalesce(t.due_date, t.competence_date) < v_hoje
               and (t.kind = 'income' or coalesce(i.status = 'prevista', false)))
  ),
  agg as (
    select s.n, s.inicio, s.fim,
      coalesce(sum(m.amount) filter (where m.g = 'revenue'), 0) as entra,
      coalesce(sum(m.amount) filter (where m.g <> 'revenue'), 0) as sai,
      count(m.id) as linhas
    from semanas s
    left join mov m on m.data between s.inicio and s.fim
    group by s.n, s.inicio, s.fim
  ),
  acum as (
    select agg.*, v_saldo + sum(entra - sai) over (order by n rows between unbounded preceding and current row) as saldo
    from agg
  )
  select jsonb_agg(jsonb_build_object(
           'semana', n, 'inicio', inicio, 'fim', fim,
           'entra', round(entra, 2), 'sai', round(sai, 2), 'liquido', round(entra - sai, 2),
           'saldo_projetado', round(saldo, 2), 'linhas', linhas
         ) order by n)
    into v_semanas from acum;

  return jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_fluxo_semanal', 'consultado_em', now(),
      'de', v_hoje, 'ate', v_hoje + v_n * 7 - 1, 'semanas', v_n,
      'saldo_inicial', round(v_saldo, 2), 'reserva_alvo', round(coalesce(p_reserva, 0), 2),
      'vencido_a_pagar_na_semana_1', jsonb_build_object('total', round(v_venc_pagar, 2), 'linhas', v_venc_pagar_linhas),
      'vencido_a_receber_fora_do_fluxo', jsonb_build_object('total', round(v_venc_receber, 2), 'linhas', v_venc_receber_linhas),
      'premissas', jsonb_build_array(
        'Só entra o que está CONTRATADO e lançado como pendente. Nenhuma estimativa comercial.',
        'Saída já vencida que não depende de recebimento é obrigação de agora e entra na semana 1.',
        'Entrada já vencida (a construtora atrasou) fica FORA do fluxo: não há data em que se possa contar com ela. O total está em vencido_a_receber_fora_do_fluxo.',
        'Saída atrelada a parcela ainda prevista só vira dívida quando o dinheiro entrar; se a parcela venceu sem ser paga, a saída fica fora junto com ela.',
        'Transferência entre contas próprias não aparece: não é entrada nem saída.',
        'Para simular atraso, nova despesa ou retirada, use cfo_simular.'
      )
    ),
    'semanas', coalesce(v_semanas, '[]'::jsonb),
    'alerta', (
      select case when count(*) = 0 then null else jsonb_build_object(
        'primeira_semana_abaixo', min((e->>'semana')::int),
        'quantas_semanas_abaixo_da_reserva', count(*),
        'menor_saldo', min((e->>'saldo_projetado')::numeric)
      ) end
      from jsonb_array_elements(coalesce(v_semanas, '[]'::jsonb)) e
      where (e->>'saldo_projetado')::numeric < coalesce(p_reserva, 0)
    )
  );
end $$;

create or replace function public.cfo_simular(p_premissas jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_empresa uuid := public.cfo_empresa();
  v_hoje date := current_date;
  f jsonb := coalesce(p_premissas, '{}'::jsonb);
  v_permitidas constant text[] := array['semanas', 'reserva', 'cenarios'];
  v_cen_permitidas constant text[] := array[
    'atraso_recebimentos_dias', 'vencidos_a_receber', 'nova_despesa_mensal', 'inicio_despesa',
    'saida_unica', 'data_saida_unica', 'entrada_unica', 'data_entrada_unica'];
  v_desconhecidas text[];
  v_n integer;
  v_reserva numeric;
  v_saldo numeric;
  v_cenarios jsonb;
  v_padrao boolean;
  v_nome text;
  v_c jsonb;
  v_atraso integer;
  v_vencidos text;
  v_desp numeric;
  v_ini date;
  v_saida numeric;
  v_dsaida date;
  v_ent numeric;
  v_dent date;
  v_semanas jsonb;
  v_res jsonb := '[]'::jsonb;
begin
  perform public.cfo_exige_admin();

  if jsonb_typeof(f) <> 'object' then
    raise exception 'As premissas precisam ser um objeto JSON.' using errcode = '22023';
  end if;
  select array_agg(k order by k) into v_desconhecidas
  from jsonb_object_keys(f) k where not (k = any (v_permitidas));
  if v_desconhecidas is not null then
    raise exception 'Premissa desconhecida: %. Aceitas: semanas, reserva, cenarios.',
      array_to_string(v_desconhecidas, ', ') using errcode = '22023';
  end if;

  begin
    v_n := least(greatest(coalesce(nullif(f->>'semanas', '')::integer, 13), 1), 52);
    v_reserva := coalesce(nullif(f->>'reserva', '')::numeric, 0);
  exception when others then
    raise exception '"semanas" precisa ser inteiro e "reserva" precisa ser número.' using errcode = '22023';
  end;

  v_saldo := ((public.cfo_posicao() -> 'caixa') ->> 'disponivel')::numeric;

  v_padrao := (f->'cenarios') is null;
  v_cenarios := coalesce(f->'cenarios', jsonb_build_object(
    'conservador', jsonb_build_object('atraso_recebimentos_dias', 30, 'vencidos_a_receber', 'fora'),
    'base',        jsonb_build_object('atraso_recebimentos_dias', 0,  'vencidos_a_receber', 'em_30_dias'),
    'otimista',    jsonb_build_object('atraso_recebimentos_dias', 0,  'vencidos_a_receber', 'semana_1')
  ));
  if jsonb_typeof(v_cenarios) <> 'object' then
    raise exception '"cenarios" precisa ser um objeto, por exemplo {"base": {...}}.' using errcode = '22023';
  end if;

  for v_nome, v_c in select key, value from jsonb_each(v_cenarios) loop
    if jsonb_typeof(v_c) <> 'object' then
      raise exception 'O cenário "%" precisa ser um objeto de premissas.', v_nome using errcode = '22023';
    end if;
    select array_agg(k order by k) into v_desconhecidas
    from jsonb_object_keys(v_c) k where not (k = any (v_cen_permitidas));
    if v_desconhecidas is not null then
      raise exception 'Premissa desconhecida no cenário "%": %. Aceitas: %.',
        v_nome, array_to_string(v_desconhecidas, ', '), array_to_string(v_cen_permitidas, ', ')
        using errcode = '22023';
    end if;

    begin
      v_atraso   := coalesce(nullif(v_c->>'atraso_recebimentos_dias', '')::integer, 0);
      v_vencidos := coalesce(nullif(v_c->>'vencidos_a_receber', ''), 'fora');
      v_desp     := coalesce(nullif(v_c->>'nova_despesa_mensal', '')::numeric, 0);
      v_ini      := coalesce(nullif(v_c->>'inicio_despesa', '')::date, v_hoje);
      v_saida    := coalesce(nullif(v_c->>'saida_unica', '')::numeric, 0);
      v_dsaida   := coalesce(nullif(v_c->>'data_saida_unica', '')::date, v_hoje);
      v_ent      := coalesce(nullif(v_c->>'entrada_unica', '')::numeric, 0);
      v_dent     := coalesce(nullif(v_c->>'data_entrada_unica', '')::date, v_hoje);
    exception when others then
      raise exception 'Premissa com formato inválido no cenário "%": %.', v_nome, sqlerrm using errcode = '22023';
    end;
    if v_vencidos not in ('fora', 'semana_1', 'em_30_dias') then
      raise exception '"vencidos_a_receber" aceita fora, semana_1 ou em_30_dias. Recebido no cenário "%": %.', v_nome, v_vencidos
        using errcode = '22023';
    end if;
    if v_atraso < 0 or v_atraso > 365 then
      raise exception '"atraso_recebimentos_dias" precisa estar entre 0 e 365. Recebido no cenário "%": %.', v_nome, v_atraso
        using errcode = '22023';
    end if;
    if v_desp < 0 or v_saida < 0 or v_ent < 0 then
      raise exception 'Valores de despesa, saída e entrada são positivos; o lado já diz o sinal. Cenário "%".', v_nome
        using errcode = '22023';
    end if;

    with semanas as (
      select gs as n, (v_hoje + (gs - 1) * 7)::date as inicio, (v_hoje + gs * 7 - 1)::date as fim
      from generate_series(1, v_n) gs
    ),
    base as (
      select t.id, t.amount, coalesce(t.due_date, t.competence_date) as data_original,
             public.cfo_grupo_dre(t.category, t.dre_group, t.kind) as g,
             (t.kind = 'income' or coalesce(i.status = 'prevista', false)) as depende_de_recebimento
      from transactions t
      left join sale_installments i on i.id = t.sale_installment_id
      where t.company_id = v_empresa and t.status = 'pending'
    ),
    datada as (
      select b.*,
        case
          when not b.depende_de_recebimento then greatest(b.data_original, v_hoje)
          when b.data_original < v_hoje then
            case v_vencidos when 'semana_1' then v_hoje
                            when 'em_30_dias' then v_hoje + 30
                            else null end
          else b.data_original + v_atraso
        end as data_sim
      from base b
    ),
    extras as (
      select gs::date as data_sim, v_desp as amount, 'saida'::text as lado
      from generate_series(v_ini::timestamp, (v_hoje + v_n * 7 - 1)::timestamp, interval '1 month') gs
      where v_desp > 0
      union all
      select v_dsaida, v_saida, 'saida' where v_saida > 0
      union all
      select v_dent, v_ent, 'entrada' where v_ent > 0
    ),
    movs as (
      select data_sim, case when g = 'revenue' then amount else -amount end as valor
      from datada where data_sim is not null
      union all
      select data_sim, case when lado = 'entrada' then amount else -amount end from extras
    ),
    agg as (
      select s.n, s.inicio, s.fim,
        coalesce(sum(m.valor) filter (where m.valor > 0), 0) as entra,
        coalesce(-sum(m.valor) filter (where m.valor < 0), 0) as sai
      from semanas s
      left join movs m on m.data_sim between s.inicio and s.fim
      group by s.n, s.inicio, s.fim
    ),
    acum as (
      select agg.*, v_saldo + sum(entra - sai) over (order by n rows between unbounded preceding and current row) as saldo
      from agg
    )
    select jsonb_agg(jsonb_build_object(
             'semana', n, 'inicio', inicio, 'fim', fim,
             'entra', round(entra, 2), 'sai', round(sai, 2), 'saldo_projetado', round(saldo, 2)
           ) order by n)
      into v_semanas from acum;

    v_res := v_res || jsonb_build_array(jsonb_build_object(
      'cenario', v_nome,
      'premissas', jsonb_build_object(
        'atraso_recebimentos_dias', v_atraso, 'vencidos_a_receber', v_vencidos,
        'nova_despesa_mensal', v_desp, 'inicio_despesa', v_ini,
        'saida_unica', v_saida, 'data_saida_unica', v_dsaida,
        'entrada_unica', v_ent, 'data_entrada_unica', v_dent),
      'saldo_inicial', round(v_saldo, 2),
      'saldo_final', (select (e->>'saldo_projetado')::numeric from jsonb_array_elements(v_semanas) e
                      order by (e->>'semana')::int desc limit 1),
      'menor_saldo', (select min((e->>'saldo_projetado')::numeric) from jsonb_array_elements(v_semanas) e),
      'semana_do_menor_saldo', (select (e->>'semana')::int from jsonb_array_elements(v_semanas) e
                                order by (e->>'saldo_projetado')::numeric, (e->>'semana')::int limit 1),
      'primeira_semana_abaixo_da_reserva', (select min((e->>'semana')::int) from jsonb_array_elements(v_semanas) e
                                            where (e->>'saldo_projetado')::numeric < v_reserva),
      'semanas_abaixo_da_reserva', (select count(*) from jsonb_array_elements(v_semanas) e
                                    where (e->>'saldo_projetado')::numeric < v_reserva),
      'semanas', v_semanas
    ));
  end loop;

  return jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_simular', 'consultado_em', now(),
      'de', v_hoje, 'ate', v_hoje + v_n * 7 - 1, 'semanas', v_n,
      'saldo_inicial', round(v_saldo, 2), 'reserva', round(v_reserva, 2),
      'premissas_padrao_usadas', v_padrao,
      'regras', jsonb_build_array(
        'Parte do saldo disponível de hoje (cfo_posicao).',
        'Só entra o que está lançado. Nova despesa, saída ou entrada única só existem se vierem nas premissas.',
        'O que depende de recebimento anda junto: se a parcela da construtora atrasa, a comissão do corretor e o imposto dela atrasam com ela.',
        'Saída vencida que não depende de recebimento é obrigação de agora e entra na semana 1.',
        'vencidos_a_receber: fora = não entram no horizonte; em_30_dias = entram 30 dias a partir de hoje; semana_1 = entram já.',
        'nova_despesa_mensal repete no mesmo dia de cada mês, a partir de inicio_despesa.',
        'Nenhum cenário tem probabilidade atribuída. Os nomes são rótulos de premissas, não previsões.'
      )
    ),
    'cenarios', (
      select jsonb_agg(x order by case x->>'cenario' when 'conservador' then 1 when 'base' then 2 when 'otimista' then 3 else 4 end,
                                  x->>'cenario')
      from jsonb_array_elements(v_res) x
    )
  );
end $$;

create or replace function public.cfo_alertas(p_config jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_empresa uuid := public.cfo_empresa();
  v_hoje date := current_date;
  f jsonb := coalesce(p_config, '{}'::jsonb);
  v_permitidas constant text[] := array['reserva', 'dias_aviso', 'janela_duplicidade_dias'];
  v_desconhecidas text[];
  v_reserva numeric;
  v_origem_reserva text;
  v_mem text;
  v_dias integer;
  v_janela integer;
  v_caixa numeric;
  v_fluxo jsonb;
  v_alertas jsonb := '[]'::jsonb;
  v_qtd integer;
  v_total numeric;
  v_dias_max integer;
  v_pares jsonb;
begin
  perform public.cfo_exige_admin();

  if jsonb_typeof(f) <> 'object' then
    raise exception 'A configuração precisa ser um objeto JSON.' using errcode = '22023';
  end if;
  select array_agg(k order by k) into v_desconhecidas
  from jsonb_object_keys(f) k where not (k = any (v_permitidas));
  if v_desconhecidas is not null then
    raise exception 'Configuração desconhecida: %. Aceitas: reserva, dias_aviso, janela_duplicidade_dias.',
      array_to_string(v_desconhecidas, ', ') using errcode = '22023';
  end if;

  begin
    v_reserva := nullif(f->>'reserva', '')::numeric;
    v_dias    := coalesce(nullif(f->>'dias_aviso', '')::integer, 7);
    v_janela  := coalesce(nullif(f->>'janela_duplicidade_dias', '')::integer, 3);
  exception when others then
    raise exception '"reserva" precisa ser número; "dias_aviso" e "janela_duplicidade_dias", inteiros.' using errcode = '22023';
  end;
  v_dias := least(greatest(v_dias, 1), 90);
  v_janela := least(greatest(v_janela, 0), 31);

  if v_reserva is not null then
    v_origem_reserva := 'informada na consulta';
  else
    select m.valor into v_mem from public.cfo_memoria m
    where m.chave = 'reserva-minima-de-caixa' and m.ativo and m.status = 'confirmado';
    if v_mem is not null then
      begin
        v_reserva := replace(replace(substring(v_mem from 'R\$\s*([0-9][0-9.]*(,[0-9]{1,2})?)'), '.', ''), ',', '.')::numeric;
      exception when others then
        v_reserva := null;
      end;
      if v_reserva is not null then
        v_origem_reserva := 'memória confirmada reserva-minima-de-caixa';
      end if;
    end if;
  end if;

  v_caixa := ((public.cfo_posicao() -> 'caixa') ->> 'disponivel')::numeric;

  -- 1. reserva
  if v_reserva is null then
    v_alertas := v_alertas || jsonb_build_array(jsonb_build_object(
      'tipo', 'reserva_nao_definida', 'severidade', 'informativo',
      'titulo', 'Não há reserva mínima de caixa definida',
      'detalhe', 'Sem ela não dá para alertar caixa abaixo do mínimo. Pergunte ao Rafael quanto a empresa precisa manter disponível e grave como memória confirmada na chave reserva-minima-de-caixa, com o valor escrito em reais.'));
  else
    v_fluxo := public.cfo_fluxo_semanal(13, v_reserva);
    if v_caixa < v_reserva then
      v_alertas := v_alertas || jsonb_build_array(jsonb_build_object(
        'tipo', 'caixa_abaixo_da_reserva', 'severidade', 'critico',
        'titulo', 'O caixa disponível hoje está abaixo da reserva',
        'detalhe', format('Disponível R$ %s contra reserva de R$ %s.', public.cfo_brl_numero(v_caixa), public.cfo_brl_numero(v_reserva)),
        'valor', round(v_reserva - v_caixa, 2)));
    elsif jsonb_typeof(v_fluxo->'alerta') = 'object' then
      v_alertas := v_alertas || jsonb_build_array(jsonb_build_object(
        'tipo', 'caixa_projetado_abaixo_da_reserva', 'severidade', 'atencao',
        'titulo', 'O caixa projetado fica abaixo da reserva nas próximas 13 semanas',
        'detalhe', format('A partir da semana %s; menor saldo projetado R$ %s.',
                          v_fluxo->'alerta'->>'primeira_semana_abaixo',
                          public.cfo_brl_numero((v_fluxo->'alerta'->>'menor_saldo')::numeric)),
        'valor', round(v_reserva - (v_fluxo->'alerta'->>'menor_saldo')::numeric, 2)));
    end if;
  end if;

  -- 2. vencimentos sem cobertura: obrigações de verdade que vencem até hoje + N dias
  select count(*), coalesce(sum(t.amount), 0) into v_qtd, v_total
  from transactions t
  left join sale_installments i on i.id = t.sale_installment_id
  where t.company_id = v_empresa and t.kind <> 'income' and t.status = 'pending'
    and (t.sale_installment_id is null or i.status = 'recebida')
    and coalesce(t.due_date, t.competence_date) <= v_hoje + v_dias;
  if v_total > v_caixa then
    v_alertas := v_alertas || jsonb_build_array(jsonb_build_object(
      'tipo', 'vencimentos_sem_cobertura', 'severidade', 'critico',
      'titulo', format('As obrigações até %s passam do caixa disponível', to_char(v_hoje + v_dias, 'DD/MM')),
      'detalhe', format('%s lançamentos somando R$ %s contra R$ %s em conta.', v_qtd,
                        public.cfo_brl_numero(v_total), public.cfo_brl_numero(v_caixa)),
      'valor', round(v_total - v_caixa, 2), 'quantidade', v_qtd,
      'abrir', jsonb_build_object('conjunto', 'devido_agora', 'data', 'vencimento', 'ate', v_hoje + v_dias)));
  end if;

  -- 3. contas vencidas sem baixa
  select count(*), coalesce(sum(t.amount), 0), max(v_hoje - coalesce(t.due_date, t.competence_date))
    into v_qtd, v_total, v_dias_max
  from transactions t
  left join sale_installments i on i.id = t.sale_installment_id
  where t.company_id = v_empresa and t.kind <> 'income' and t.status = 'pending'
    and (t.sale_installment_id is null or i.status = 'recebida')
    and coalesce(t.due_date, t.competence_date) < v_hoje;
  if v_qtd > 0 then
    v_alertas := v_alertas || jsonb_build_array(jsonb_build_object(
      'tipo', 'contas_vencidas_sem_baixa', 'severidade', 'atencao',
      'titulo', format('%s contas vencidas sem baixa', v_qtd),
      'detalhe', format('Somam R$ %s; a mais antiga venceu há %s dias. Pode ser conta paga sem baixa ou conta de fato atrasada.',
                        public.cfo_brl_numero(v_total), v_dias_max),
      'valor', round(v_total, 2), 'quantidade', v_qtd,
      'abrir', jsonb_build_object('conjunto', 'devido_agora', 'data', 'vencimento', 'ate', v_hoje - 1)));
  end if;

  -- 4. recebimentos atrasados
  select count(*), coalesce(sum(t.amount), 0), max(v_hoje - coalesce(t.due_date, t.competence_date))
    into v_qtd, v_total, v_dias_max
  from transactions t
  where t.company_id = v_empresa and t.kind = 'income' and t.status = 'pending'
    and coalesce(t.due_date, t.competence_date) < v_hoje;
  if v_qtd > 0 then
    v_alertas := v_alertas || jsonb_build_array(jsonb_build_object(
      'tipo', 'recebimentos_atrasados', 'severidade', 'atencao',
      'titulo', format('%s parcelas de comissão passaram da data prevista', v_qtd),
      'detalhe', format('Somam R$ %s; a mais atrasada há %s dias. É a construtora atrasando, não o cliente: é espera e cobrança, não inadimplência.',
                        public.cfo_brl_numero(v_total), v_dias_max),
      'valor', round(v_total, 2), 'quantidade', v_qtd,
      'abrir', jsonb_build_object('conjunto', 'a_receber_vencido')));
  end if;

  -- 5. comissão liberada esperando repasse
  select count(*), coalesce(sum(t.amount), 0), max(v_hoje - i.received_date)
    into v_qtd, v_total, v_dias_max
  from transactions t
  join sale_installments i on i.id = t.sale_installment_id
  where t.company_id = v_empresa and t.status = 'pending'
    and t.category = 'Comissões de Corretores' and i.status = 'recebida';
  if v_qtd > 0 then
    v_alertas := v_alertas || jsonb_build_array(jsonb_build_object(
      'tipo', 'comissao_liberada_esperando', 'severidade', 'atencao',
      'titulo', format('%s comissões liberadas esperando repasse', v_qtd),
      'detalhe', format('Somam R$ %s; a imobiliária recebeu a mais antiga há %s dias.', public.cfo_brl_numero(v_total), v_dias_max),
      'valor', round(v_total, 2), 'quantidade', v_qtd,
      'abrir', jsonb_build_object('conjunto', 'devido_agora', 'categoria', 'Comissões de Corretores')));
  end if;

  -- 6. possíveis duplicidades: mesmo tipo, valor, categoria e descrição em até N dias
  select coalesce(jsonb_agg(par), '[]'::jsonb) into v_pares from (
    select jsonb_build_object(
      'ids', jsonb_build_array(a.id, b.id), 'descricao', a.description, 'categoria', a.category,
      'valor', round(a.amount, 2),
      'datas', jsonb_build_array(coalesce(a.due_date, a.settled_date, a.competence_date),
                                 coalesce(b.due_date, b.settled_date, b.competence_date))
    ) as par
    from transactions a
    join transactions b
      on b.company_id = a.company_id and a.id < b.id
     and b.kind = a.kind and b.amount = a.amount and b.category = a.category
     and lower(btrim(b.description)) = lower(btrim(a.description))
     and abs(coalesce(a.due_date, a.settled_date, a.competence_date)
             - coalesce(b.due_date, b.settled_date, b.competence_date)) <= v_janela
    where a.company_id = v_empresa
      and a.sale_installment_id is null and b.sale_installment_id is null
    limit 50
  ) d;
  if jsonb_array_length(v_pares) > 0 then
    v_alertas := v_alertas || jsonb_build_array(jsonb_build_object(
      'tipo', 'possiveis_duplicidades', 'severidade', 'atencao',
      'titulo', format('%s pares de lançamentos parecem duplicados', jsonb_array_length(v_pares)),
      'detalhe', format('Mesmo tipo, valor, categoria e descrição com até %s dias de distância. É suspeita: confirme abrindo os dois.', v_janela),
      'quantidade', jsonb_array_length(v_pares), 'pares', v_pares,
      'abrir', jsonb_build_object('ids', (select jsonb_agg(x) from jsonb_array_elements(v_pares) p, jsonb_array_elements(p->'ids') x))));
  end if;

  -- 7. qualidade do dado que afeta o saldo
  select count(*) into v_qtd from transactions t
  where t.company_id = v_empresa and t.status = 'settled' and t.account_id is null;
  if v_qtd > 0 then
    v_alertas := v_alertas || jsonb_build_array(jsonb_build_object(
      'tipo', 'lancamentos_sem_conta', 'severidade', 'informativo',
      'titulo', format('%s lançamentos liquidados sem conta', v_qtd),
      'detalhe', 'Não entram no saldo de nenhuma conta, então o caixa disponível calculado pode divergir do extrato.',
      'quantidade', v_qtd,
      'abrir', jsonb_build_object('conjunto', 'sem_conta')));
  end if;

  -- 8. orçamento: não existe
  v_alertas := v_alertas || jsonb_build_array(jsonb_build_object(
    'tipo', 'despesas_acima_do_orcamento', 'severidade', 'informativo', 'disponivel', false,
    'titulo', 'Alerta de despesa acima do orçamento indisponível',
    'detalhe', 'O sistema não tem orçamento cadastrado para a empresa (ver cfo_lacunas).'));

  return jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_alertas', 'consultado_em', now(), 'referencia', v_hoje,
      'config', jsonb_build_object('reserva', v_reserva, 'origem_da_reserva', v_origem_reserva,
                                   'dias_aviso', v_dias, 'janela_duplicidade_dias', v_janela),
      'premissas', jsonb_build_array(
        'Recebimento atrasado de construtora é espera, não inadimplência do cliente.',
        'Obrigação atrelada a parcela ainda não recebida não entra em cobertura: só vira dívida quando o dinheiro entrar.',
        'Duplicidade é suspeita, não fato. Confirme abrindo os lançamentos.',
        'Cada alerta com "abrir" traz o filtro de cfo_lancamentos que mostra os lançamentos por trás dele.'
      )
    ),
    'total', jsonb_array_length(v_alertas),
    'alertas', (
      select jsonb_agg(a order by case a->>'severidade' when 'critico' then 1 when 'atencao' then 2 else 3 end)
      from jsonb_array_elements(v_alertas) a
    )
  );
end $$;

create or replace function public.cfo_comparar_periodos(
  p_de date default null, p_ate date default null, p_regime text default 'accrual'
) returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_empresa uuid := public.cfo_empresa();
  v_de date := coalesce(p_de, date_trunc('month', current_date)::date);
  v_ate date := coalesce(p_ate, (date_trunc('month', current_date) + interval '1 month - 1 day')::date);
  v_regime text := case when p_regime in ('cash', 'accrual') then p_regime else 'accrual' end;
  v_ant_de date;
  v_ant_ate date;
  v_regra text;
  a jsonb;
  b jsonb;
begin
  perform public.cfo_exige_admin();
  if v_ate < v_de then
    raise exception 'A data final precisa ser igual ou posterior à inicial.' using errcode = '22023';
  end if;

  if v_de = date_trunc('month', v_de)::date
     and v_ate = (date_trunc('month', v_de) + interval '1 month - 1 day')::date then
    v_ant_de  := (date_trunc('month', v_de) - interval '1 month')::date;
    v_ant_ate := (date_trunc('month', v_de) - interval '1 day')::date;
    v_regra := 'O recorte é um mês civil inteiro, então a comparação é com o mês civil anterior.';
  else
    v_ant_ate := v_de - 1;
    v_ant_de  := v_de - (v_ate - v_de + 1);
    v_regra := format('O recorte tem %s dias, então a comparação é com os %s dias imediatamente anteriores.',
                      v_ate - v_de + 1, v_ate - v_de + 1);
  end if;

  a := public.cfo_dre(v_de, v_ate, v_regime);
  b := public.cfo_dre(v_ant_de, v_ant_ate, v_regime);

  return jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_comparar_periodos', 'consultado_em', now(), 'regime', v_regime,
      'atual', jsonb_build_object('de', v_de, 'ate', v_ate),
      'anterior', jsonb_build_object('de', v_ant_de, 'ate', v_ant_ate),
      'regra_do_periodo_anterior', v_regra,
      'premissas', jsonb_build_array(
        'As linhas vêm de cfo_dre nos dois períodos, com o mesmo regime.',
        'variacao é a diferença sobre o valor absoluto do anterior; fica nula quando o anterior é zero.',
        'Mês de comissão é irregular por natureza: uma diferença grande entre dois meses não é tendência.'
      )
    ),
    'linhas', (
      select jsonb_agg(jsonb_build_object(
               'linha', k,
               'atual', (a->>k)::numeric,
               'anterior', (b->>k)::numeric,
               'diferenca', round((a->>k)::numeric - (b->>k)::numeric, 2),
               'variacao', case when (b->>k)::numeric <> 0
                                then round(((a->>k)::numeric - (b->>k)::numeric) / abs((b->>k)::numeric), 4) end
             ) order by ord)
      from unnest(array['receita_bruta', 'imposto', 'receita_liquida', 'custo_dos_servicos', 'lucro_bruto',
                        'despesa_operacional', 'despesa_variavel', 'ebitda', 'lucro_liquido',
                        'distribuicao_de_lucro']) with ordinality u(k, ord)
    ),
    'por_categoria', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'categoria', categoria, 'grupo', g,
               'atual', round(atual, 2), 'anterior', round(anterior, 2), 'diferenca', round(atual - anterior, 2)
             ) order by abs(atual - anterior) desc, categoria), '[]'::jsonb)
      from (
        select x.categoria, x.g, x.atual, x.anterior
        from (
          select t.category as categoria, t.g,
                 coalesce(sum(t.amount) filter (where t.dr between v_de and v_ate), 0) as atual,
                 coalesce(sum(t.amount) filter (where t.dr between v_ant_de and v_ant_ate), 0) as anterior
          from (
            select t.category, t.amount,
                   public.cfo_grupo_dre(t.category, t.dre_group, t.kind) as g,
                   public.cfo_data_regime(t.card_cycle_month, t.competence_date, t.settled_date, t.status, v_regime) as dr
            from transactions t where t.company_id = v_empresa
          ) t
          where t.dr between v_ant_de and v_ate
          group by t.category, t.g
        ) x
        where x.atual <> x.anterior
        order by abs(x.atual - x.anterior) desc
        limit 30
      ) y
    ),
    'dre_atual', a,
    'dre_anterior', b
  );
end $$;

do $$
declare r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array['cfo_fluxo_semanal', 'cfo_simular', 'cfo_alertas', 'cfo_comparar_periodos'])
  loop
    execute format('revoke all on function public.%I(%s) from public, anon, authenticated', r.proname, r.args);
    execute format('grant execute on function public.%I(%s) to service_role', r.proname, r.args);
  end loop;
end $$;
