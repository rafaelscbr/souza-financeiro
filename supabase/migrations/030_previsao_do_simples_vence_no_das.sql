-- ===========================================================================
-- 030 — A PREVISÃO DO SIMPLES VENCE NO DIA DO DAS
-- ===========================================================================
-- Sobra da 027. Lá a guia mensal passou a ser a forma do imposto devido, e as
-- previsões que já existiam ganharam o vencimento do DAS. Mas register_sale
-- continuou nascendo com o vencimento IGUAL ao da parcela — quem lançasse uma
-- venda nova teria a previsão do imposto vencendo no dia em que o dinheiro
-- entra, e não no dia 20 do mês seguinte.
--
-- Apareceu no primeiro contrato lançado (PortoVelas 1102-A).
-- ===========================================================================

do $mig$
declare
  d text;
  velho constant text := 'format(''Simples %s%% — %s%s'', coalesce(nullif(p->>''simples_pct'',''''),''6''), v_titulo, v_sufixo),
        v_simples, (p->>''sale_date'')::date, ''pending'', v_venc,';
  novo constant text := 'format(''Simples %s%% — %s%s'', coalesce(nullif(p->>''simples_pct'',''''),''6''), v_titulo, v_sufixo),
        v_simples, (p->>''sale_date'')::date, ''pending'', public.venc_das(v_venc),';
begin
  d := pg_get_functiondef('public.register_sale(jsonb)'::regprocedure);
  if position(novo in d) > 0 then
    raise notice 'register_sale já usa venc_das';
  elsif position(velho in d) = 0 then
    raise exception 'register_sale: não achei o lançamento do Simples';
  else
    execute replace(d, velho, novo);
  end if;
end $mig$;

-- E as duas previsões que a venda 1102-A acabou de criar.
update public.transactions t
   set due_date = public.venc_das(i.expected_date)
  from public.sale_installments i
 where t.id = i.simples_tx_id and t.status = 'pending' and i.status = 'prevista'
   and t.due_date <> public.venc_das(i.expected_date);
