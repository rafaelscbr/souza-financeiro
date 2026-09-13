-- =============================================================================
-- 015 · A memória do CFO: o que ele sabe, o que ele propõe, o que foi decidido
--
-- COMO APLICAR: Supabase → SQL Editor → cole tudo → Run. Seguro repetir.
-- PROJETO CORRETO: souza-financeiro (iejmrzcgoeoxhhcnqodn). NUNCA o icrm.
--
-- DEPENDE DA 013 (motor determinístico), que já está aplicada no banco:
--   public.cfo_pode()         → boolean (admin pelo app OU chave de serviço pelo CLI)
--   public.cfo_exige_admin()  → void (levanta exceção quando não pode)
-- Não recrie nenhuma das duas aqui: esta migração apenas as usa.
--
-- POR QUE ISTO EXISTE: o CFO roda no CLI e a sessão morre no fim da conversa.
-- Sem memória, toda vez ele começa do zero — repergunta o que já foi
-- respondido, reinventa premissa que o Rafael já corrigiu e, pior, apresenta
-- de novo como fato uma conta que ele mesmo tinha estimado. Quatro tabelas
-- resolvem isso:
--
--   cfo_memoria    o que ele sabe sobre o negócio (e quão certo está disso)
--   cfo_propostas  o que ele acha que deveria mudar no próprio sistema
--   cfo_decisoes   o que foi decidido, para depois comparar com o que deu
--   cfo_execucoes  o que foi consultado e quando
--
-- Tudo é lido e escrito por função, no mesmo padrão da 013: o retorno traz um
-- bloco `_meta` dizendo qual função respondeu, quando e com quais filtros.
-- Número (ou memória) sem origem não vale conselho.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. cfo_memoria — a memória empresarial
--
-- O CORAÇÃO DESTA TABELA É A COLUNA `status`. Ela separa três coisas que o CFO
-- não pode misturar, e que sem esta coluna ele misturaria sempre:
--
--   confirmado  o Rafael disse, por escrito, que é assim. É fato.
--               Só entra aqui por decisão HUMANA — o CFO nunca promove uma
--               memória sozinho.
--   inferido    o CFO deduziu dos dados do banco. É provavelmente verdade,
--               mas é leitura dele: "margem média de 34%, apurada em 9 meses"
--               continua sendo uma média, não uma promessa.
--   hipotese    ele chutou, ouviu de passagem, ou está testando uma ideia.
--               Serve para lembrar de perguntar — nunca para embasar conselho.
--
-- Na prática: uma inferência tratada como fato é como o CFO erra. Ele calcula
-- um custo fixo médio, guarda, e três meses depois recomenda uma compra com
-- base num número que nunca ninguém confirmou. Por isso `status` é not null,
-- o padrão é o mais fraco (`hipotese`), e `origem` é preenchida junto — quem
-- lê a memória precisa conseguir refazer o caminho até a fonte.
--
-- E por isso a tabela é legível por humano: `chave` é texto estável em
-- português ('reserva-minima-de-caixa'), não um id. O Rafael tem de conseguir
-- listar o que o CFO acha que sabe, discordar de uma linha e corrigi-la.
-- -----------------------------------------------------------------------------
create table if not exists public.cfo_memoria (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in (
                  'regra',       -- como o negócio funciona ("comissão com contrato paga 6%")
                  'indicador',   -- um número que ele acompanha
                  'meta',        -- onde o Rafael quer chegar
                  'preferencia', -- como ele gosta de decidir
                  'premissa',    -- o que o CFO assume ao calcular
                  'contexto',    -- fato do mundo que muda a leitura
                  'pendencia'    -- o que falta perguntar ou apurar
                )),
  -- Identificador estável e legível. É a chave do upsert: gravar duas vezes a
  -- mesma chave corrige a memória em vez de criar uma segunda versão dela.
  chave         text not null unique,
  valor         text not null,
  status        text not null default 'hipotese'
                  check (status in ('confirmado', 'inferido', 'hipotese')),
  -- De onde veio. Exemplos reais: 'Rafael confirmou em 12/09',
  -- 'inferido de 5 vendas', 'cfo_dre de jan a set'.
  origem        text,
  atualizado_em timestamptz not null default now(),
  -- Carimbado só enquanto o status é `confirmado`. Serve para o CFO saber que
  -- uma confirmação de 8 meses atrás talvez mereça ser revalidada.
  confirmado_em timestamptz,
  -- Memória não se apaga: desativa. O histórico do que o CFO já achou que
  -- sabia é parte do que impede o erro de voltar.
  ativo         boolean not null default true
);

comment on table public.cfo_memoria is
  'O que o CFO sabe sobre o negócio. `status` separa fato (confirmado) de leitura dele (inferido) de chute (hipotese).';
comment on column public.cfo_memoria.status is
  'confirmado = o Rafael confirmou; inferido = o CFO deduziu dos dados; hipotese = ainda não verificado. Nunca use hipotese para embasar conselho.';
comment on column public.cfo_memoria.chave is
  'Identificador estável e legível, em minúsculas com hifens. Regravar a mesma chave corrige a memória.';
comment on column public.cfo_memoria.origem is
  'Como o CFO chegou nisso. Memória sem origem não pode ser conferida e não deveria virar confirmado.';

create index if not exists cfo_memoria_tipo_idx
  on public.cfo_memoria (tipo, chave) where ativo;
create index if not exists cfo_memoria_status_idx
  on public.cfo_memoria (status) where ativo;

-- -----------------------------------------------------------------------------
-- 2. cfo_propostas — o backlog de melhorias do próprio sistema
--
-- O CFO enxerga os buracos do sistema antes de qualquer um: é ele que tenta
-- responder e descobre que falta dado. Sem um lugar para registrar isso, a
-- observação morre no fim da conversa e volta a aparecer daqui a um mês.
--
-- Os campos obrigam a proposta a ser argumentada, não opinada: `problema`
-- (o que dói), `evidencia` (o que no banco mostra que dói), `impacto` (o que
-- muda se resolver) e `mudanca` (o que fazer). `criterios_aceite` é como se
-- sabe que ficou pronto.
-- -----------------------------------------------------------------------------
create table if not exists public.cfo_propostas (
  id               uuid primary key default gen_random_uuid(),
  titulo           text not null,
  problema         text not null,
  evidencia        text,
  impacto          text,
  mudanca          text,
  prioridade       text not null default 'media'
                     check (prioridade in ('alta', 'media', 'baixa')),
  criterios_aceite text,
  status           text not null default 'aberta'
                     check (status in ('aberta', 'aceita', 'em_andamento', 'entregue', 'recusada')),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

comment on table public.cfo_propostas is
  'Backlog de melhorias no sistema financeiro, proposto pelo CFO. Proposta sem evidência é opinião: o campo existe para forçar o argumento.';

create index if not exists cfo_propostas_status_idx
  on public.cfo_propostas (status, prioridade, criado_em desc);

-- -----------------------------------------------------------------------------
-- 3. cfo_decisoes — o que foi decidido, e o que aconteceu depois
--
-- Conselho sem acompanhamento é palpite com data. Esta tabela guarda a
-- recomendação E os números que a sustentavam (`numeros` jsonb, tipicamente um
-- recorte do retorno de cfo_posicao/cfo_dre no dia), para que meses depois dê
-- para comparar `esperado` com `realizado` e descobrir onde o CFO erra.
--
-- `revisar_em` é o compromisso de voltar: sem data marcada, ninguém revisa.
-- -----------------------------------------------------------------------------
create table if not exists public.cfo_decisoes (
  id            uuid primary key default gen_random_uuid(),
  pergunta      text not null,
  recomendacao  text not null,
  -- Fotografia dos números do dia da recomendação. Guardar o número junto é o
  -- que permite dizer depois "errei na premissa" em vez de "errei no achismo".
  numeros       jsonb,
  alternativas  text,
  -- O que o Rafael de fato decidiu, que nem sempre é o que foi recomendado.
  decidido      text,
  decidido_em   timestamptz,
  esperado      text,
  revisar_em    date,
  realizado     text,
  revisado_em   timestamptz,
  criado_em     timestamptz not null default now()
);

comment on table public.cfo_decisoes is
  'Decisões financeiras com os números que as embasaram, para comparar esperado com realizado.';
comment on column public.cfo_decisoes.numeros is
  'Recorte do retorno das funções cfo_* no dia da recomendação. É a prova de qual era a foto.';

create index if not exists cfo_decisoes_pendentes_idx
  on public.cfo_decisoes (revisar_em) where realizado is null;

-- -----------------------------------------------------------------------------
-- 4. cfo_execucoes — auditoria rasa das consultas
--
-- Só o suficiente para responder "o que o CFO consultou, quando, e quebrou?".
-- Não guarda o resultado da consulta nem nada que identifique cliente: o dado
-- pessoal já vive nas tabelas do razão, com RLS própria. Duplicá-lo num log
-- só aumentaria a superfície de vazamento sem ajudar ninguém.
-- -----------------------------------------------------------------------------
create table if not exists public.cfo_execucoes (
  id          uuid primary key default gen_random_uuid(),
  comando     text not null,
  parametros  jsonb,
  duracao_ms  int,
  erro        text,
  criado_em   timestamptz not null default now()
);

comment on table public.cfo_execucoes is
  'Registro de cada consulta do CFO: comando, parâmetros, duração e erro. Não guarda resultado nem dado pessoal.';

create index if not exists cfo_execucoes_criado_idx
  on public.cfo_execucoes (criado_em desc);

-- -----------------------------------------------------------------------------
-- 5. RLS: nada disso é do corretor
--
-- Mesmo padrão da 007 — uma política por tabela, para todos os comandos — só
-- que a condição é `cfo_pode()` e não `is_admin()`, porque o CFO roda no CLI
-- com chave de serviço, sem sessão de usuário. O corretor é `authenticated` e
-- não é admin: `cfo_pode()` é falso para ele, então ele não alcança uma linha
-- sequer. As funções abaixo são `security definer` e pertencem ao dono das
-- tabelas, então continuam funcionando com a RLS ligada.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  p text;
  tabelas text[] := array[
    'cfo_memoria', 'cfo_propostas', 'cfo_decisoes', 'cfo_execucoes'
  ];
begin
  foreach t in array tabelas loop
    for p in select policyname from pg_policies
              where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', p, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy cfo_admin on public.%I for all to authenticated
         using (public.cfo_pode()) with check (public.cfo_pode())', t);
  end loop;
end $$;

-- O Supabase concede por padrão acesso às tabelas novas de `public` para
-- `anon` e `authenticated`. A RLS acima já nega as linhas, mas depois da 017
-- nenhuma camada sozinha basta: estas tabelas também perdem o privilégio de
-- tabela. Só a chave de serviço (que ignora RLS) chega nelas.
revoke all on table public.cfo_memoria, public.cfo_propostas,
                    public.cfo_decisoes, public.cfo_execucoes
  from anon, authenticated;

-- =============================================================================
-- FUNÇÕES
--
-- Todas `security definer` com `search_path` travado (sem isso, um usuário
-- poderia criar um schema próprio e sequestrar o nome `cfo_memoria`), todas
-- chamando `cfo_exige_admin()` na primeira linha, todas devolvendo `_meta` no
-- mesmo formato de `cfo_posicao()`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- cfo_memoria_listar — tudo que o CFO acha que sabe
--
-- O `_meta` carrega a legenda dos status de propósito: quem consome este JSON
-- é um agente, e ele precisa ser lembrado da regra junto com o dado, não num
-- documento à parte que ele pode não ter lido.
-- -----------------------------------------------------------------------------
create or replace function public.cfo_memoria_listar(p_tipo text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tipo  text := nullif(btrim(lower(p_tipo)), '');
  v_itens jsonb;
  v_total integer;
begin
  perform public.cfo_exige_admin();

  if v_tipo is not null and v_tipo not in
     ('regra','indicador','meta','preferencia','premissa','contexto','pendencia') then
    raise exception 'Tipo "%" não existe. Use regra, indicador, meta, preferencia, premissa, contexto ou pendencia.', v_tipo;
  end if;

  select coalesce(jsonb_agg(x.item order by x.tipo, x.chave), '[]'::jsonb), count(*)
    into v_itens, v_total
  from (
    select m.tipo, m.chave, jsonb_build_object(
             'chave', m.chave,
             'tipo', m.tipo,
             'valor', m.valor,
             'status', m.status,
             'origem', m.origem,
             'atualizado_em', m.atualizado_em,
             'confirmado_em', m.confirmado_em
           ) as item
      from public.cfo_memoria m
     where m.ativo
       and (v_tipo is null or m.tipo = v_tipo)
  ) x;

  return jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_memoria_listar',
      'consultado_em', now(),
      'filtro_tipo', coalesce(v_tipo, 'todos'),
      'somente_ativos', true,
      'total', v_total,
      'legenda_status', jsonb_build_object(
        'confirmado', 'O Rafael confirmou. Pode usar como fato.',
        'inferido', 'O CFO deduziu dos dados. Cite como leitura, com a origem, nunca como fato.',
        'hipotese', 'Não verificado. Serve para perguntar, não para embasar conselho.'
      )
    ),
    'itens', v_itens
  );
end $$;

-- -----------------------------------------------------------------------------
-- cfo_memoria_gravar — cria ou corrige uma memória
--
-- Upsert por `chave`: a mesma chave gravada de novo CORRIGE a memória. É o que
-- permite o Rafael discordar ("não é 6 meses, é 3") e o CFO simplesmente
-- regravar, sem acumular duas verdades contraditórias sobre o mesmo assunto.
--
-- `confirmado_em` acompanha o status: carimba na primeira vez que vira
-- `confirmado`, preserva a data original em regravações que continuam
-- confirmadas, e LIMPA se a memória voltar a ser inferência ou hipótese — data
-- de confirmação de coisa não confirmada seria mentira no `_meta` de amanhã.
-- -----------------------------------------------------------------------------
create or replace function public.cfo_memoria_gravar(
  p_tipo   text,
  p_chave  text,
  p_valor  text,
  p_status text default 'hipotese',
  p_origem text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tipo    text := nullif(btrim(lower(p_tipo)), '');
  -- Chave normalizada: sem isto, 'Reserva-Minima' e 'reserva-minima' virariam
  -- duas memórias sobre o mesmo assunto, e o upsert perderia a graça.
  v_chave   text := nullif(btrim(lower(p_chave)), '');
  v_status  text := coalesce(nullif(btrim(lower(p_status)), ''), 'hipotese');
  v_existia boolean;
  v_linha   public.cfo_memoria%rowtype;
begin
  perform public.cfo_exige_admin();

  if v_chave is null then
    raise exception 'A memória precisa de uma chave (por exemplo: reserva-minima-de-caixa).';
  end if;
  if nullif(btrim(p_valor), '') is null then
    raise exception 'A memória "%" precisa de um valor: o que exatamente se sabe.', v_chave;
  end if;
  if v_tipo is null or v_tipo not in
     ('regra','indicador','meta','preferencia','premissa','contexto','pendencia') then
    raise exception 'Tipo "%" não existe. Use regra, indicador, meta, preferencia, premissa, contexto ou pendencia.',
      coalesce(v_tipo, '(vazio)');
  end if;
  if v_status not in ('confirmado', 'inferido', 'hipotese') then
    raise exception 'Status "%" não existe. Use confirmado (o Rafael confirmou), inferido (o CFO deduziu dos dados) ou hipotese (ainda não verificado).',
      v_status;
  end if;

  select exists (select 1 from public.cfo_memoria where chave = v_chave) into v_existia;

  -- O apelido `m` é o que permite, no `do update`, distinguir a linha que já
  -- estava lá (`m`) da que se tentou inserir (`excluded`).
  insert into public.cfo_memoria as m
    (tipo, chave, valor, status, origem, atualizado_em, confirmado_em, ativo)
  values (
    v_tipo, v_chave, btrim(p_valor), v_status, nullif(btrim(p_origem), ''),
    now(),
    case when v_status = 'confirmado' then now() end,
    true
  )
  on conflict (chave) do update
     set tipo          = excluded.tipo,
         valor         = excluded.valor,
         status        = excluded.status,
         -- Origem nova sobrescreve; origem nula preserva a que já havia, senão
         -- uma correção apressada apagaria a rastreabilidade da memória.
         origem        = coalesce(excluded.origem, m.origem),
         atualizado_em = now(),
         confirmado_em = case
                           when excluded.status = 'confirmado'
                             then coalesce(m.confirmado_em, now())
                           else null
                         end,
         -- Regravar ressuscita uma memória desativada: o assunto voltou.
         ativo         = true
  returning * into v_linha;

  return jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_memoria_gravar',
      'consultado_em', now(),
      'chave', v_chave,
      'acao', case when v_existia then 'atualizada' else 'criada' end
    ),
    'item', jsonb_build_object(
      'chave', v_linha.chave,
      'tipo', v_linha.tipo,
      'valor', v_linha.valor,
      'status', v_linha.status,
      'origem', v_linha.origem,
      'atualizado_em', v_linha.atualizado_em,
      'confirmado_em', v_linha.confirmado_em
    )
  );
end $$;

-- -----------------------------------------------------------------------------
-- cfo_memoria_remover — desativa, nunca apaga
--
-- Saber que o CFO já acreditou em algo que se mostrou errado tem valor: é o
-- que impede a mesma hipótese de voltar como novidade daqui a três meses.
-- Por isso `delete` não existe aqui.
-- -----------------------------------------------------------------------------
create or replace function public.cfo_memoria_remover(p_chave text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chave text := nullif(btrim(lower(p_chave)), '');
  v_linha public.cfo_memoria%rowtype;
  v_ja_estava boolean := false;
begin
  perform public.cfo_exige_admin();

  if v_chave is null then
    raise exception 'Informe a chave da memória a desativar.';
  end if;

  update public.cfo_memoria
     set ativo = false, atualizado_em = now()
   where chave = v_chave and ativo
  returning * into v_linha;

  if not found then
    select * into v_linha from public.cfo_memoria where chave = v_chave;
    if not found then
      raise exception 'Não existe memória com a chave "%".', v_chave;
    end if;
    v_ja_estava := true;
  end if;

  return jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_memoria_remover',
      'consultado_em', now(),
      'chave', v_chave,
      'acao', case when v_ja_estava then 'ja_estava_desativada' else 'desativada' end,
      'observacao', 'A linha continua no banco, apenas fora das listagens. Regravar a mesma chave a reativa.'
    ),
    'desativado', jsonb_build_object(
      'chave', v_linha.chave,
      'tipo', v_linha.tipo,
      'valor', v_linha.valor,
      'status', v_linha.status,
      'origem', v_linha.origem,
      'atualizado_em', v_linha.atualizado_em,
      'confirmado_em', v_linha.confirmado_em
    )
  );
end $$;

-- -----------------------------------------------------------------------------
-- cfo_proposta_criar — registra uma melhoria do sistema
--
-- `titulo`, `problema` e `evidencia` são exigidos porque proposta sem evidência
-- é opinião, e opinião sobre o próprio sistema é exatamente o tipo de ruído que
-- o Rafael não tem tempo de triar.
-- -----------------------------------------------------------------------------
create or replace function public.cfo_proposta_criar(
  p_titulo     text,
  p_problema   text,
  p_evidencia  text,
  p_impacto    text,
  p_mudanca    text,
  p_prioridade text default 'media',
  p_criterios  text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prioridade text := coalesce(nullif(btrim(lower(p_prioridade)), ''), 'media');
  v_linha public.cfo_propostas%rowtype;
begin
  perform public.cfo_exige_admin();

  if nullif(btrim(p_titulo), '') is null then
    raise exception 'A proposta precisa de um título.';
  end if;
  if nullif(btrim(p_problema), '') is null then
    raise exception 'A proposta precisa dizer qual problema resolve.';
  end if;
  if nullif(btrim(p_evidencia), '') is null then
    raise exception 'A proposta precisa de evidência: o que nos dados mostra que este problema existe.';
  end if;
  if v_prioridade not in ('alta', 'media', 'baixa') then
    raise exception 'Prioridade "%" não existe. Use alta, media ou baixa.', v_prioridade;
  end if;

  insert into public.cfo_propostas (
    titulo, problema, evidencia, impacto, mudanca, prioridade, criterios_aceite,
    status, criado_em, atualizado_em
  ) values (
    btrim(p_titulo), btrim(p_problema), btrim(p_evidencia),
    nullif(btrim(p_impacto), ''), nullif(btrim(p_mudanca), ''),
    v_prioridade, nullif(btrim(p_criterios), ''),
    'aberta', now(), now()
  )
  returning * into v_linha;

  return jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_proposta_criar',
      'consultado_em', now(),
      'id', v_linha.id,
      'prioridade', v_linha.prioridade
    ),
    'proposta', jsonb_build_object(
      'id', v_linha.id,
      'titulo', v_linha.titulo,
      'problema', v_linha.problema,
      'evidencia', v_linha.evidencia,
      'impacto', v_linha.impacto,
      'mudanca', v_linha.mudanca,
      'prioridade', v_linha.prioridade,
      'criterios_aceite', v_linha.criterios_aceite,
      'status', v_linha.status,
      'criado_em', v_linha.criado_em
    )
  );
end $$;

-- -----------------------------------------------------------------------------
-- cfo_propostas_listar — o backlog, com as altas primeiro
-- -----------------------------------------------------------------------------
create or replace function public.cfo_propostas_listar(p_status text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text := nullif(btrim(lower(p_status)), '');
  v_itens  jsonb;
  v_total  integer;
begin
  perform public.cfo_exige_admin();

  if v_status is not null and v_status not in
     ('aberta','aceita','em_andamento','entregue','recusada') then
    raise exception 'Status "%" não existe. Use aberta, aceita, em_andamento, entregue ou recusada.', v_status;
  end if;

  select coalesce(jsonb_agg(x.item order by x.peso, x.criado_em desc), '[]'::jsonb), count(*)
    into v_itens, v_total
  from (
    select
      case p.prioridade when 'alta' then 1 when 'media' then 2 else 3 end as peso,
      p.criado_em,
      jsonb_build_object(
        'id', p.id,
        'titulo', p.titulo,
        'problema', p.problema,
        'evidencia', p.evidencia,
        'impacto', p.impacto,
        'mudanca', p.mudanca,
        'prioridade', p.prioridade,
        'criterios_aceite', p.criterios_aceite,
        'status', p.status,
        'criado_em', p.criado_em,
        'atualizado_em', p.atualizado_em
      ) as item
      from public.cfo_propostas p
     where v_status is null or p.status = v_status
  ) x;

  return jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_propostas_listar',
      'consultado_em', now(),
      'filtro_status', coalesce(v_status, 'todos'),
      'ordem', 'prioridade (alta, media, baixa) e depois mais recente primeiro',
      'total', v_total
    ),
    'itens', v_itens
  );
end $$;

-- -----------------------------------------------------------------------------
-- cfo_decisao_registrar — grava a recomendação com a foto dos números
--
-- `decidido_em` só é carimbado quando há `decidido`: recomendação registrada
-- ainda não é decisão tomada, e confundir as duas estragaria justamente a
-- comparação que esta tabela existe para permitir.
-- -----------------------------------------------------------------------------
create or replace function public.cfo_decisao_registrar(
  p_pergunta     text,
  p_recomendacao text,
  p_numeros      jsonb default null,
  p_decidido     text default null,
  p_esperado     text default null,
  p_revisar_em   date default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_decidido text := nullif(btrim(p_decidido), '');
  v_linha public.cfo_decisoes%rowtype;
begin
  perform public.cfo_exige_admin();

  if nullif(btrim(p_pergunta), '') is null then
    raise exception 'A decisão precisa da pergunta que a originou.';
  end if;
  if nullif(btrim(p_recomendacao), '') is null then
    raise exception 'A decisão precisa da recomendação que o CFO deu.';
  end if;

  insert into public.cfo_decisoes (
    pergunta, recomendacao, numeros, decidido, decidido_em, esperado, revisar_em, criado_em
  ) values (
    btrim(p_pergunta), btrim(p_recomendacao), p_numeros,
    v_decidido,
    case when v_decidido is not null then now() end,
    nullif(btrim(p_esperado), ''),
    p_revisar_em,
    now()
  )
  returning * into v_linha;

  return jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_decisao_registrar',
      'consultado_em', now(),
      'id', v_linha.id,
      'tem_numeros', v_linha.numeros is not null,
      'revisar_em', v_linha.revisar_em,
      'aviso', case
                 when v_linha.revisar_em is null
                   then 'Sem data de revisão esta decisão nunca será cobrada. Vale definir revisar_em.'
                 else null
               end
    ),
    'decisao', jsonb_build_object(
      'id', v_linha.id,
      'pergunta', v_linha.pergunta,
      'recomendacao', v_linha.recomendacao,
      'numeros', v_linha.numeros,
      'decidido', v_linha.decidido,
      'decidido_em', v_linha.decidido_em,
      'esperado', v_linha.esperado,
      'revisar_em', v_linha.revisar_em,
      'criado_em', v_linha.criado_em
    )
  );
end $$;

-- -----------------------------------------------------------------------------
-- cfo_decisoes_listar — o que ficou para cobrar
--
-- `pendentes` (o padrão útil) é: ainda não se sabe o que deu (`realizado` nulo)
-- E já passou da hora de olhar (`revisar_em` no passado ou nunca marcada).
-- Decisão com revisão marcada para o futuro NÃO é pendência — é compromisso
-- em dia, e listá-la junto viraria ruído.
-- -----------------------------------------------------------------------------
create or replace function public.cfo_decisoes_listar(p_status text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text := coalesce(nullif(btrim(lower(p_status)), ''), 'todas');
  v_itens  jsonb;
  v_total  integer;
begin
  perform public.cfo_exige_admin();

  if v_status not in ('pendentes', 'todas') then
    raise exception 'Filtro "%" não existe. Use pendentes ou todas.', v_status;
  end if;

  select coalesce(jsonb_agg(x.item order by x.ordem, x.criado_em desc), '[]'::jsonb), count(*)
    into v_itens, v_total
  from (
    select
      -- Em `pendentes`, o que interessa é a fila de cobrança: as mais atrasadas
      -- primeiro, as sem data marcada no fim. Em `todas`, é histórico, e
      -- histórico se lê do mais recente para trás — daí a constante, que deixa
      -- o desempate por `criado_em desc` mandar sozinho.
      case when v_status = 'pendentes'
             then coalesce(d.revisar_em, date '9999-12-31')
             else date '9999-12-31'
      end as ordem,
      d.criado_em,
      jsonb_build_object(
        'id', d.id,
        'pergunta', d.pergunta,
        'recomendacao', d.recomendacao,
        'numeros', d.numeros,
        'alternativas', d.alternativas,
        'decidido', d.decidido,
        'decidido_em', d.decidido_em,
        'esperado', d.esperado,
        'revisar_em', d.revisar_em,
        'realizado', d.realizado,
        'revisado_em', d.revisado_em,
        'criado_em', d.criado_em,
        'vencida', (d.realizado is null and d.revisar_em is not null and d.revisar_em < current_date)
      ) as item
      from public.cfo_decisoes d
     where v_status = 'todas'
        or (d.realizado is null
            and (d.revisar_em is null or d.revisar_em <= current_date))
  ) x;

  return jsonb_build_object(
    '_meta', jsonb_build_object(
      'funcao', 'cfo_decisoes_listar',
      'consultado_em', now(),
      'filtro', v_status,
      'data_de_referencia', current_date,
      'criterio_pendentes', 'sem realizado e com revisar_em no passado ou nula',
      'ordem', case when v_status = 'pendentes'
                      then 'revisão mais atrasada primeiro; sem data marcada, no fim'
                      else 'mais recente primeiro'
               end,
      'total', v_total
    ),
    'itens', v_itens
  );
end $$;

-- -----------------------------------------------------------------------------
-- cfo_execucao_registrar — o log de quem perguntou o quê
--
-- `returns void` de propósito: é chamada no fim de cada consulta e não deve
-- devolver nada que o agente se sinta tentado a interpretar.
-- -----------------------------------------------------------------------------
create or replace function public.cfo_execucao_registrar(
  p_comando    text,
  p_parametros jsonb,
  p_duracao_ms int,
  p_erro       text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.cfo_exige_admin();

  if nullif(btrim(p_comando), '') is null then
    raise exception 'O registro de execução precisa do nome do comando.';
  end if;

  insert into public.cfo_execucoes (comando, parametros, duracao_ms, erro, criado_em)
  values (btrim(p_comando), p_parametros, p_duracao_ms, nullif(btrim(p_erro), ''), now());
end $$;

-- -----------------------------------------------------------------------------
-- Permissões
--
-- SÓ a chave de serviço executa. Lição da 017: a checagem dentro da função já
-- falhou uma vez (cfo_pode() olhava current_user, que dentro de SECURITY
-- DEFINER é sempre o dono, e deixava qualquer um passar). Por isso a permissão
-- de execução é uma segunda camada, independente: `public`, `anon` e
-- `authenticated` perdem tudo. Nenhuma tela do app usa estas funções; se uma
-- área do CFO existir dentro do app, o grant para `authenticated` volta.
-- -----------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'cfo_memoria_listar(text)',
    'cfo_memoria_gravar(text,text,text,text,text)',
    'cfo_memoria_remover(text)',
    'cfo_proposta_criar(text,text,text,text,text,text,text)',
    'cfo_propostas_listar(text)',
    'cfo_decisao_registrar(text,text,jsonb,text,text,date)',
    'cfo_decisoes_listar(text)',
    'cfo_execucao_registrar(text,jsonb,int,text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- A primeira memória: o erro que custaria mais caro
--
-- Confundir VGV com receita infla a imobiliária em uma ordem de grandeza —
-- uma venda de R$ 1.000.000 com 4% de comissão gera R$ 40.000 de receita, não
-- R$ 1.000.000. Um CFO que erra isso recomenda gasto que a empresa não tem
-- como pagar. A própria `cfo_posicao()` já carrega o aviso no bloco carteira;
-- aqui ele vira memória confirmada, para valer em toda conversa.
--
-- `on conflict do nothing`: se o Rafael tiver corrigido o texto depois, a
-- reaplicação da migração não desfaz a correção dele.
-- -----------------------------------------------------------------------------
insert into public.cfo_memoria (tipo, chave, valor, status, origem, confirmado_em)
values (
  'regra',
  'vgv-nao-e-receita',
  'VGV é o valor dos imóveis vendidos, não é receita da imobiliária. A receita é somente a comissão contratada (sales.commission_total), e do que efetivamente entra ainda saem ISS retido na fonte, Simples sobre a parcela líquida de ISS, a comissão do corretor e a fatia do sócio quando houver. Nunca some property_value como faturamento nem calcule margem sobre ele.',
  'confirmado',
  'regra do negócio, verificada no schema',
  now()
)
on conflict (chave) do nothing;

-- =============================================================================
-- REVERSÃO (cole só se precisar voltar atrás)
--
-- drop function if exists public.cfo_execucao_registrar(text,jsonb,int,text);
-- drop function if exists public.cfo_decisoes_listar(text);
-- drop function if exists public.cfo_decisao_registrar(text,text,jsonb,text,text,date);
-- drop function if exists public.cfo_propostas_listar(text);
-- drop function if exists public.cfo_proposta_criar(text,text,text,text,text,text,text);
-- drop function if exists public.cfo_memoria_remover(text);
-- drop function if exists public.cfo_memoria_gravar(text,text,text,text,text);
-- drop function if exists public.cfo_memoria_listar(text);
-- drop table if exists public.cfo_execucoes;
-- drop table if exists public.cfo_decisoes;
-- drop table if exists public.cfo_propostas;
-- drop table if exists public.cfo_memoria;   -- apaga a memória inteira: exporte antes
-- =============================================================================
