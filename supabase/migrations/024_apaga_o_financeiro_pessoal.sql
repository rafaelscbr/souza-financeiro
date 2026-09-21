-- ===========================================================================
-- 024 — APAGA O FINANCEIRO PESSOAL
-- ===========================================================================
-- Pedido do Rafael em 21/09/2026: "pode excluir as minhas contas pessoais...
-- hoje a imobiliária só possui conta corrente e cartão de crédito".
--
-- Sai a empresa "Pessoal" (arquivada desde o corte para o sistema só da
-- imobiliária) com tudo que pendurava nela: 4 contas (Bradesco, Nubank,
-- Caixinha Nubank RDB e o cartão Mastercard Black), 660 lançamentos de
-- dez/2025 a ago/2028 e 24 categorias próprias.
--
-- Cópia gravada antes de apagar:
--   ~/Documents/backup-financeiro-pessoal-2026-09-21.json
--
-- A Souza Imobiliária não é tocada: Bradesco PJ, Cartão PJ, 5 vendas,
-- 16 parcelas e 167 lançamentos ficam como estão. A conferência no fim
-- desfaz tudo se a contagem da imobiliária mudar.
-- ===========================================================================

do $$
declare
  v_pessoal uuid;
  v_imob uuid;
  n_tx int; n_cat int; n_conta int;
  n_tx_imob_antes int; n_tx_imob_depois int;
begin
  select id into v_pessoal from companies where slug = 'pessoal';
  select id into v_imob from companies where slug = 'imobiliaria';
  if v_pessoal is null then
    raise notice 'empresa pessoal já não existe: nada a fazer';
    return;
  end if;
  if v_imob is null then
    raise exception 'não achei a empresa da imobiliária: abortando por segurança';
  end if;

  select count(*) into n_tx_imob_antes from transactions where company_id = v_imob;

  -- Lançamento do pessoal que aponte para outro lançamento do pessoal
  -- (transferência, fatura) perde a referência antes de sair.
  update transactions set group_id = null
   where company_id = v_pessoal and group_id is not null;

  delete from transactions where company_id = v_pessoal;
  get diagnostics n_tx = row_count;
  delete from categories where company_id = v_pessoal;
  get diagnostics n_cat = row_count;
  delete from accounts where company_id = v_pessoal;
  get diagnostics n_conta = row_count;
  delete from cost_centers where company_id = v_pessoal;
  delete from companies where id = v_pessoal;

  select count(*) into n_tx_imob_depois from transactions where company_id = v_imob;
  if n_tx_imob_depois <> n_tx_imob_antes then
    raise exception 'a imobiliária perdeu lançamentos (% antes, % depois): desfazendo',
      n_tx_imob_antes, n_tx_imob_depois;
  end if;

  raise notice 'pessoal apagado: % lançamentos, % categorias, % contas; imobiliária intacta com % lançamentos',
    n_tx, n_cat, n_conta, n_tx_imob_depois;
end $$;
