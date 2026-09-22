-- O valor do imóvel da primeira venda Rogga (Itajaí Urban Club T1 1204),
-- informado pelo Rafael em 22/09/2026: R$ 530.947,00.
--
-- A venda foi lançada sem o VGV porque ele não estava no contrato em mãos.
-- Sem VGV a venda ficava de fora do VGV/VGL e aparecia como "sem valor
-- informado" — nenhum real muda aqui: comissão, parcelas e imposto já estavam
-- gravados e não são recalculados.
--
-- A fatia da parceria (50%, como diz o título da venda) passa a ficar gravada
-- em partner_share_pct porque o VGL agora divide o VGV das vendas em parceria.
-- Confere com a comissão gravada: 6.636,84 = 1,25% de 530.947,00, metade dos
-- 2,5% cheios.
update public.sales
   set property_value    = 530947.00,
       partner_share_pct = 50,
       partner_name      = coalesce(partner_name, 'Rogga (parceria 50%)'),
       updated_at        = now()
 where id = '0a994df6-9b64-4172-8787-aa260341d6af';
