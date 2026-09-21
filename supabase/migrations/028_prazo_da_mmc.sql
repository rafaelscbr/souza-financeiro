-- ===========================================================================
-- 028 — O PRAZO DA MMC, E A PARCELA DO LAGO DI SAN PELLEGRINO
-- ===========================================================================
-- O Rafael viu a parcela do Lago di San Pellegrino aparecendo em atraso e
-- disse: "não é comum atrasar do San Pellegrino, o sistema está contabilizando
-- como dias corridos quando na verdade é dias úteis". E deu o prazo:
--
--   MMC paga em 10 DIAS ÚTEIS depois da emissão da nota fiscal.
--
-- A nota dessa parcela já estava marcada no sistema (nº 2, emitida em
-- 14/09/2026), mas a MMC ainda não tinha prazo cadastrado — então
-- set_installment_invoice manteve a data antiga em vez de recalcular.
--
-- Aqui o prazo entra no cadastro e a parcela é recalculada uma vez:
--   14/09/2026 + 10 dias úteis = 28/09/2026 (segunda-feira).
--
-- A parcela deixa de estar atrasada, porque nunca esteve: a data é que estava
-- errada. Nenhum valor muda — só a data que o sistema promete.
-- ===========================================================================

update public.developers
   set payment_days = 10, payment_days_business = true
 where name = 'MMC' and payment_days is null;

do $$
declare
  i public.sale_installments;
  v_nova date;
begin
  select si.* into i
    from public.sale_installments si
    join public.sales s on s.id = si.sale_id
   where s.title like '%Pellegrino%' and si.status = 'prevista'
   limit 1;

  if not found then
    raise notice 'parcela do Lago di San Pellegrino não está prevista: nada a recalcular';
    return;
  end if;
  if i.invoice_issued_date is null then
    raise exception 'a parcela não tem nota emitida: não dá para calcular o prazo';
  end if;

  v_nova := public.add_business_days(i.invoice_issued_date, 10);

  update public.transactions set due_date = v_nova
   where sale_installment_id = i.id and status = 'pending';

  update public.sale_installments
     set expected_date = v_nova,
         notes = trim(coalesce(notes || ' | ', '') ||
                 format('data corrigida de %s para %s: MMC paga em 10 dias úteis depois da nota (emitida em %s)',
                        to_char(i.expected_date, 'DD/MM/YYYY'),
                        to_char(v_nova, 'DD/MM/YYYY'),
                        to_char(i.invoice_issued_date, 'DD/MM/YYYY')))
   where id = i.id;

  raise notice 'Lago di San Pellegrino: % vira %', i.expected_date, v_nova;
end $$;
