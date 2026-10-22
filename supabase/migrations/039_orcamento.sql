-- ===========================================================================
-- 039 — O ORÇAMENTO DA IMOBILIÁRIA
-- ===========================================================================
-- COMO APLICAR: Supabase → SQL Editor → cole tudo → Run. Seguro repetir.
-- PROJETO CORRETO: souza-financeiro (iejmrzcgoeoxhhcnqodn). NUNCA o icrm.
--
-- Decidido com o Rafael em 22/10/2026: o orçamento parte dos CUSTOS que ele
-- enxerga pela frente, e o sistema diz quanto as vendas precisam deixar para
-- cobri-los. Cada linha é um gasto com valor por mês e vigência (de/até), e
-- pode ser CONFIRMADO (vai acontecer) ou POSSÍVEL (ele está pensando). O
-- relatório mostra os dois cenários: só o confirmado e com os possíveis.
--
-- Um gasto que muda de valor vira duas linhas (o coworking: R$ 2.500 por seis
-- meses, depois R$ 3.000). Orçamento é plano, não lançamento: nada aqui entra
-- no DRE nem no caixa.
-- ===========================================================================

create table if not exists public.budget_lines (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  description  text not null,
  -- O nome da categoria de despesa, o mesmo de transactions.category: é por
  -- ele que o relatório compara o orçado com o gasto de verdade.
  category     text not null,
  amount       numeric(14,2) not null check (amount > 0),
  -- Primeiro dia do primeiro e do último mês de vigência, os dois inclusos.
  -- Sem fim = vale até alguém encerrar.
  start_month  date not null check (extract(day from start_month) = 1),
  end_month    date check (end_month is null or (extract(day from end_month) = 1 and end_month >= start_month)),
  status       text not null default 'confirmado' check (status in ('confirmado', 'possivel')),
  notes        text,
  created_at   timestamptz not null default now()
);

comment on table public.budget_lines is
  'Orçamento de custos da imobiliária: um gasto por linha, com valor mensal, vigência e se é confirmado ou possível.';

create index if not exists budget_lines_company_idx on public.budget_lines (company_id);

alter table public.budget_lines enable row level security;
drop policy if exists admin_tudo on public.budget_lines;
create policy admin_tudo on public.budget_lines for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- o orçamento de nov/2026 a dez/2027
do $$
declare
  v_imob uuid;
begin
  select id into v_imob from public.companies where slug = 'imobiliaria';
  if v_imob is null then
    raise exception 'não achei a imobiliária: nada gravado';
  end if;
  if exists (select 1 from public.budget_lines where company_id = v_imob) then
    raise notice 'orçamento já cadastrado: nada a fazer';
    return;
  end if;

  insert into public.budget_lines (company_id, description, category, amount, start_month, end_month, status, notes) values
    (v_imob, 'Coworking', 'Aluguel', 2500.00, '2026-11-01', '2027-04-01', 'confirmado',
     'Sala para 5 pessoas com wifi, energia, água, café, limpeza e sala de reunião. Valor dos seis primeiros meses.'),
    (v_imob, 'Coworking', 'Aluguel', 3000.00, '2027-05-01', '2027-12-01', 'confirmado',
     'Mesmo coworking, valor a partir do sétimo mês.'),
    (v_imob, 'Tráfego pago', 'Marketing/Tráfego Pago', 1500.00, '2026-11-01', '2027-12-01', 'confirmado', null),
    (v_imob, 'Contabilidade', 'Contabilidade', 415.00, '2026-11-01', '2027-12-01', 'confirmado',
     'Vence todo dia 12. Já lançada como despesa fixa desde outubro/2026.');
end $$;
