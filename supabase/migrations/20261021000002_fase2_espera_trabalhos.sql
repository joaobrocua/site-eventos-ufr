-- =============================================================================
-- Fase 2: lista de espera automática, fila de e-mails e submissão de trabalhos.
--
-- Lista de espera
--   * Atividade lotada aceita fila (inscricoes_atividades.status = 'lista_espera').
--   * INVARIANTE: um lugar na fila conta como horário ocupado. Ninguém fica na
--     fila de Y e confirmado (ou na fila) de X que choca com Y. Assim a promoção
--     nunca precisa rechecar choque nem travar a inscrição de outra pessoa
--     (o que inverteria a ordem de travas inscrição -> atividade e daria deadlock).
--   * A promoção acontece NA MESMA transação que libera a vaga, com a atividade
--     travada: quem chega depois não fura a fila.
--   * Lacuna conhecida: exclusão em cascata de auth.users não dispara promoção.
--
-- E-mails
--   * notificacoes_email é uma fila (outbox). Só funções do banco gravam; só o
--     service_role reserva/conclui envios (reservar_emails / concluir_email).
--
-- Trabalhos
--   * Participantes e organizadores só escrevem via funções (sem UPDATE direto:
--     o autor não pode se autoaprovar).
--   * PDF no bucket privado 'trabalhos', caminho {evento}/{autor}/{trabalho}.pdf,
--     enviado direto do navegador; policies do Storage conferem dono e prazo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Lista de espera: estrutura
-- -----------------------------------------------------------------------------
alter table public.inscricoes_atividades
  drop constraint inscricoes_atividades_status_check;
alter table public.inscricoes_atividades
  add constraint inscricoes_atividades_status_check
  check (status in ('confirmada', 'lista_espera', 'cancelada'));

alter table public.inscricoes_atividades
  add column entrou_fila_em timestamptz,
  add column promovida_em timestamptz;

create index inscricoes_atividades_fila_idx
  on public.inscricoes_atividades (atividade_id, entrou_fila_em, inscricao_id)
  where status = 'lista_espera';
-- FK sem filtro de status (cascatas e consultas gerais por atividade).
create index inscricoes_atividades_atividade_todas_idx
  on public.inscricoes_atividades (atividade_id);

-- Remarcar uma atividade não pode criar choque para quem já está nela
-- (confirmado ou na fila): manteria o invariante só "na entrada".
create or replace function public._atividade_bloquear_choque_remarcacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text;
begin
  if (new.inicio is distinct from old.inicio or new.fim is distinct from old.fim) then
    select p.nome_completo into v_nome
    from public.inscricoes_atividades ia
    join public.inscricoes i on i.id = ia.inscricao_id and i.status = 'confirmada'
    join public.perfis p on p.id = i.usuario_id
    join public.inscricoes_atividades ib
      on ib.inscricao_id = ia.inscricao_id and ib.atividade_id <> ia.atividade_id
    join public.atividades b on b.id = ib.atividade_id
    where ia.atividade_id = new.id
      and ia.status in ('confirmada', 'lista_espera')
      and ib.status in ('confirmada', 'lista_espera')
      and b.inicio < new.fim and new.inicio < b.fim
    limit 1;

    if v_nome is not null then
      raise exception 'O novo horário choca com outra atividade de inscritos (ex.: %). Ajuste o horário ou fale com os inscritos.', v_nome
        using hint = 'choque_horario';
    end if;
  end if;
  return new;
end;
$$;

create trigger atividades_bloquear_choque_remarcacao
  before update of inicio, fim on public.atividades
  for each row execute function public._atividade_bloquear_choque_remarcacao();

-- -----------------------------------------------------------------------------
-- Fila de e-mails (outbox)
-- -----------------------------------------------------------------------------
create table public.notificacoes_email (
  id              bigint generated always as identity primary key,
  usuario_id      uuid not null references auth.users (id) on delete cascade,
  assunto         text not null check (char_length(assunto) between 3 and 200),
  corpo           text not null check (char_length(corpo) between 3 and 10000),
  criada_em       timestamptz not null default now(),
  processando_em  timestamptz,
  enviada_em      timestamptz,
  tentativas      integer not null default 0,
  ultimo_erro     text
);

create index notificacoes_email_pendentes_idx
  on public.notificacoes_email (id) where enviada_em is null and tentativas < 5;
create index notificacoes_email_usuario_idx on public.notificacoes_email (usuario_id);

alter table public.notificacoes_email enable row level security;
-- Sem policy e sem grants: invisível para anon/authenticated.
revoke all on public.notificacoes_email from anon, authenticated;

create or replace function public._enfileirar_email(p_usuario uuid, p_assunto text, p_corpo text)
returns void
language sql
security definer
set search_path = ''
as $$
  -- Assunto sem caracteres de controle (quebra de linha no assunto = injeção de cabeçalho).
  insert into public.notificacoes_email (usuario_id, assunto, corpo)
  values (p_usuario,
          left(btrim(regexp_replace(p_assunto, '[[:cntrl:]]+', ' ', 'g')), 200),
          left(p_corpo, 10000));
$$;

-- Reserva até p_limite e-mails pendentes (atômico: dois processos nunca pegam o
-- mesmo). Linhas presas em "processando" há mais de 5 min voltam para a fila.
create or replace function public.reservar_emails(p_limite integer default 20)
returns table (id bigint, email text, nome text, assunto text, corpo text)
language sql
security definer
set search_path = ''
as $$
  with escolhidos as (
    select n.id
    from public.notificacoes_email n
    where n.enviada_em is null
      and n.tentativas < 5
      and (n.processando_em is null or n.processando_em < now() - interval '5 minutes')
    order by n.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limite, 20), 100))
  ), reservados as (
    update public.notificacoes_email n
    set processando_em = now(), tentativas = n.tentativas + 1
    from escolhidos e
    where n.id = e.id
    returning n.id, n.usuario_id, n.assunto, n.corpo
  )
  select r.id, u.email::text, p.nome_completo, r.assunto, r.corpo
  from reservados r
  join auth.users u on u.id = r.usuario_id
  left join public.perfis p on p.id = r.usuario_id
  order by r.id;
$$;

-- Marca o resultado do envio. p_erro null = enviado.
create or replace function public.concluir_email(p_id bigint, p_erro text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  -- Nunca "des-envia": linha já enviada não volta para a fila.
  update public.notificacoes_email
  set processando_em = null,
      enviada_em = case when p_erro is null then now() else enviada_em end,
      ultimo_erro = left(p_erro, 1000)
  where id = p_id and enviada_em is null;
$$;

-- -----------------------------------------------------------------------------
-- Lista de espera: regras
-- -----------------------------------------------------------------------------

-- Reescrita: além de vagas e choque com atividades CONFIRMADAS, agora
--   * lugar na fila conta como horário ocupado (invariante);
--   * se já existe fila na atividade, ninguém de fora pega a vaga (fila primeiro).
create or replace function public._adicionar_atividades(
  p_inscricao_id uuid,
  p_evento_id uuid,
  p_atividades uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ativ      public.atividades%rowtype;
  v_ocupadas  integer;
  v_conflito  text;
begin
  if p_atividades is null or cardinality(p_atividades) = 0 then
    return;
  end if;

  if exists (
    select 1 from unnest(p_atividades) as x(id)
    where not exists (select 1 from public.atividades a
                      where a.id = x.id and a.evento_id = p_evento_id)
  ) then
    raise exception 'Uma das atividades escolhidas não pertence a este evento.'
      using hint = 'atividade_invalida';
  end if;

  perform 1 from public.atividades
    where id = any (p_atividades) order by id for update;

  for v_ativ in
    select a.* from public.atividades a
    where a.id = any (p_atividades)
    order by a.inicio, a.id
  loop
    if exists (select 1 from public.inscricoes_atividades ia
               where ia.inscricao_id = p_inscricao_id
                 and ia.atividade_id = v_ativ.id
                 and ia.status = 'confirmada') then
      continue;
    end if;

    if v_ativ.vagas is not null then
      select count(*) into v_ocupadas
      from public.inscricoes_atividades ia
      join public.inscricoes i on i.id = ia.inscricao_id
      where ia.atividade_id = v_ativ.id
        and ia.status = 'confirmada'
        and i.status = 'confirmada';

      if v_ocupadas >= v_ativ.vagas
         or exists (select 1 from public.inscricoes_atividades ia
                    join public.inscricoes i on i.id = ia.inscricao_id
                    where ia.atividade_id = v_ativ.id
                      and ia.status = 'lista_espera'
                      and ia.inscricao_id <> p_inscricao_id
                      and i.status = 'confirmada') then
        raise exception 'As vagas de "%" acabaram. Você pode entrar na lista de espera.', v_ativ.titulo
          using hint = 'vagas_esgotadas';
      end if;
    end if;

    select a2.titulo into v_conflito
    from public.inscricoes_atividades ia
    join public.atividades a2 on a2.id = ia.atividade_id
    where ia.inscricao_id = p_inscricao_id
      and ia.status in ('confirmada', 'lista_espera')
      and a2.id <> v_ativ.id
      and a2.inicio < v_ativ.fim
      and v_ativ.inicio < a2.fim
    limit 1;

    if v_conflito is not null then
      raise exception '"%" acontece no mesmo horário de "%".', v_ativ.titulo, v_conflito
        using hint = 'choque_horario';
    end if;

    insert into public.inscricoes_atividades (inscricao_id, atividade_id)
    values (p_inscricao_id, v_ativ.id)
    on conflict (inscricao_id, atividade_id)
      do update set status = 'confirmada', entrou_fila_em = null;
  end loop;
end;
$$;

-- Promove a fila de uma atividade enquanto houver vaga. Chamada por quem
-- libera vaga, na mesma transação. Avisa cada promovido por e-mail.
create or replace function public._promover_fila(p_atividade_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ativ        public.atividades%rowtype;
  v_evento      public.eventos%rowtype;
  v_ocupadas    integer;
  v_proximo     record;
  v_promovidos  integer := 0;
begin
  select * into v_ativ from public.atividades where id = p_atividade_id for update;
  if not found then
    return 0;
  end if;
  select * into v_evento from public.eventos where id = v_ativ.evento_id;
  if v_evento.status <> 'publicado' or v_ativ.fim <= now() then
    return 0;
  end if;

  loop
    if v_ativ.vagas is not null then
      select count(*) into v_ocupadas
      from public.inscricoes_atividades ia
      join public.inscricoes i on i.id = ia.inscricao_id
      where ia.atividade_id = p_atividade_id
        and ia.status = 'confirmada'
        and i.status = 'confirmada';
      exit when v_ocupadas >= v_ativ.vagas;
    end if;

    select ia.inscricao_id, i.usuario_id into v_proximo
    from public.inscricoes_atividades ia
    join public.inscricoes i on i.id = ia.inscricao_id
    where ia.atividade_id = p_atividade_id
      and ia.status = 'lista_espera'
      and i.status = 'confirmada'
    order by ia.entrou_fila_em, ia.inscricao_id
    limit 1
    for update of ia;

    exit when not found;

    update public.inscricoes_atividades
    set status = 'confirmada', promovida_em = now(), entrou_fila_em = null
    where inscricao_id = v_proximo.inscricao_id and atividade_id = p_atividade_id;

    perform public._enfileirar_email(
      v_proximo.usuario_id,
      'Abriu uma vaga para você: ' || v_ativ.titulo,
      'Boa notícia! Uma vaga abriu e você saiu da lista de espera.' || chr(10) || chr(10)
      || 'Você está inscrito(a) em "' || v_ativ.titulo || '" (' || v_evento.titulo || ').' || chr(10)
      || 'Data e horário: '
      || to_char(v_ativ.inicio at time zone 'America/Cuiaba', 'DD/MM/YYYY "às" HH24:MI') || chr(10)
      || coalesce('Local: ' || v_ativ.local || chr(10), '') || chr(10)
      || 'Se não puder ir, entre na sua área e libere a vaga para a próxima pessoa da fila.'
    );

    v_promovidos := v_promovidos + 1;
  end loop;

  return v_promovidos;
end;
$$;

-- Entra na lista de espera de uma atividade lotada. Devolve a posição na fila.
create or replace function public.entrar_lista_espera(p_atividade_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_ativ       public.atividades%rowtype;
  v_evento     public.eventos%rowtype;
  v_inscricao  uuid;
  v_ia         public.inscricoes_atividades%rowtype;
  v_ocupadas   integer;
  v_conflito   text;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para entrar na lista de espera.' using hint = 'nao_autenticado';
  end if;
  if not exists (select 1 from public.perfis where id = v_uid) then
    raise exception 'Complete seu cadastro antes de se inscrever.' using hint = 'perfil_incompleto';
  end if;

  select * into v_ativ from public.atividades where id = p_atividade_id;
  if not found then
    raise exception 'Atividade não encontrada.' using hint = 'atividade_invalida';
  end if;
  select * into v_evento from public.eventos where id = v_ativ.evento_id;

  if v_evento.status <> 'publicado' then
    raise exception 'Este evento não está disponível para inscrição.' using hint = 'evento_indisponivel';
  end if;
  if not v_evento.inscricoes_abertas
     or (v_evento.inscricoes_ate is not null and now() > v_evento.inscricoes_ate) then
    raise exception 'As inscrições deste evento estão encerradas.' using hint = 'inscricoes_encerradas';
  end if;
  if v_ativ.fim <= now() then
    raise exception 'Esta atividade já terminou.' using hint = 'atividade_encerrada';
  end if;
  if v_ativ.vagas is null then
    raise exception 'Esta atividade tem vagas ilimitadas: é só se inscrever.' using hint = 'ha_vagas';
  end if;

  -- Ordem de travas igual à da inscrição: primeiro a inscrição, depois a atividade.
  insert into public.inscricoes (evento_id, usuario_id)
  values (v_evento.id, v_uid)
  on conflict (evento_id, usuario_id)
    do update set status = 'confirmada', cancelada_em = null
  returning id into v_inscricao;

  -- Relê a atividade JÁ travada: vagas/horário podem ter mudado desde a 1ª leitura.
  select * into v_ativ from public.atividades where id = p_atividade_id for update;
  if v_ativ.vagas is null then
    raise exception 'Esta atividade tem vagas ilimitadas: é só se inscrever.' using hint = 'ha_vagas';
  end if;

  select * into v_ia from public.inscricoes_atividades ia
  where ia.inscricao_id = v_inscricao and ia.atividade_id = p_atividade_id;

  if found and v_ia.status = 'confirmada' then
    raise exception 'Você já está inscrito(a) nesta atividade.' using hint = 'ja_inscrito';
  end if;

  if not (found and v_ia.status = 'lista_espera') then
    select count(*) into v_ocupadas
    from public.inscricoes_atividades ia
    join public.inscricoes i on i.id = ia.inscricao_id
    where ia.atividade_id = p_atividade_id and ia.status = 'confirmada' and i.status = 'confirmada';

    if v_ocupadas < v_ativ.vagas
       and not exists (select 1 from public.inscricoes_atividades ia
                       join public.inscricoes i on i.id = ia.inscricao_id
                       where ia.atividade_id = p_atividade_id
                         and ia.status = 'lista_espera' and i.status = 'confirmada') then
      raise exception 'Ainda há vagas nesta atividade: é só se inscrever.' using hint = 'ha_vagas';
    end if;

    select a2.titulo into v_conflito
    from public.inscricoes_atividades ia
    join public.atividades a2 on a2.id = ia.atividade_id
    where ia.inscricao_id = v_inscricao
      and ia.status in ('confirmada', 'lista_espera')
      and a2.id <> p_atividade_id
      and a2.inicio < v_ativ.fim
      and v_ativ.inicio < a2.fim
    limit 1;

    if v_conflito is not null then
      raise exception '"%" acontece no mesmo horário de "%".', v_ativ.titulo, v_conflito
        using hint = 'choque_horario';
    end if;

    insert into public.inscricoes_atividades (inscricao_id, atividade_id, status, entrou_fila_em)
    values (v_inscricao, p_atividade_id, 'lista_espera', clock_timestamp())
    on conflict (inscricao_id, atividade_id)
      do update set status = 'lista_espera', entrou_fila_em = clock_timestamp(),
                    presente_em = null, presenca_registrada_por = null;
  end if;

  return (
    select count(*)::integer
    from public.inscricoes_atividades ia
    join public.inscricoes i on i.id = ia.inscricao_id
    where ia.atividade_id = p_atividade_id
      and ia.status = 'lista_espera'
      and i.status = 'confirmada'
      and (ia.entrou_fila_em, ia.inscricao_id) <=
          (select f.entrou_fila_em, f.inscricao_id from public.inscricoes_atividades f
           where f.inscricao_id = v_inscricao and f.atividade_id = p_atividade_id)
  );
end;
$$;

create or replace function public.sair_lista_espera(p_atividade_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta.' using hint = 'nao_autenticado';
  end if;

  update public.inscricoes_atividades ia
  set status = 'cancelada', entrou_fila_em = null
  from public.inscricoes i
  where i.id = ia.inscricao_id
    and i.usuario_id = auth.uid()
    and ia.atividade_id = p_atividade_id
    and ia.status = 'lista_espera';

  if not found then
    raise exception 'Você não está na lista de espera desta atividade.' using hint = 'nao_inscrito';
  end if;
end;
$$;

-- Posição do usuário logado em cada fila de um evento.
create or replace function public.minhas_posicoes_fila(p_evento_id uuid)
returns table (atividade_id uuid, posicao integer)
language sql
stable
security definer
set search_path = ''
as $$
  select minha.atividade_id,
         (select count(*)::integer
          from public.inscricoes_atividades f
          join public.inscricoes i2 on i2.id = f.inscricao_id
          where f.atividade_id = minha.atividade_id
            and f.status = 'lista_espera'
            and i2.status = 'confirmada'
            and (f.entrou_fila_em, f.inscricao_id) <= (minha.entrou_fila_em, minha.inscricao_id))
  from public.inscricoes_atividades minha
  join public.inscricoes i on i.id = minha.inscricao_id
  where i.usuario_id = auth.uid()
    and i.evento_id = p_evento_id
    and i.status = 'confirmada'
    and minha.status = 'lista_espera';
$$;

-- remover_atividade: agora promove a fila na mesma transação.
create or replace function public.remover_atividade(p_atividade_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ia  record;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta.' using hint = 'nao_autenticado';
  end if;

  -- Ordem de travas: atividade antes das linhas de inscrição (a promoção da
  -- fila segue a mesma ordem; o contrário dá deadlock).
  perform 1 from public.atividades where id = p_atividade_id for update;

  select ia.inscricao_id, ia.presente_em, e.status as evento_status into v_ia
  from public.inscricoes_atividades ia
  join public.inscricoes i on i.id = ia.inscricao_id
  join public.eventos e on e.id = i.evento_id
  where ia.atividade_id = p_atividade_id
    and i.usuario_id = v_uid
    and ia.status = 'confirmada'
  for update of ia;

  if not found then
    raise exception 'Você não está inscrito nesta atividade.' using hint = 'nao_inscrito';
  end if;
  if v_ia.presente_em is not null then
    raise exception 'Sua presença nesta atividade já foi registrada.' using hint = 'presenca_registrada';
  end if;
  if v_ia.evento_status <> 'publicado' then
    raise exception 'Este evento já foi encerrado.' using hint = 'evento_indisponivel';
  end if;

  update public.inscricoes_atividades
  set status = 'cancelada'
  where inscricao_id = v_ia.inscricao_id and atividade_id = p_atividade_id;

  perform public._promover_fila(p_atividade_id);
end;
$$;

-- cancelar_inscricao: cancela tudo (inclusive filas) e promove as filas das
-- atividades em que a pessoa estava confirmada.
create or replace function public.cancelar_inscricao(p_evento_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_inscricao  public.inscricoes%rowtype;
  v_liberadas  uuid[];
  v_ativ       uuid;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta.' using hint = 'nao_autenticado';
  end if;

  select * into v_inscricao from public.inscricoes
  where evento_id = p_evento_id and usuario_id = v_uid and status = 'confirmada'
  for update;

  if not found then
    raise exception 'Você não está inscrito neste evento.' using hint = 'nao_inscrito';
  end if;

  if (select e.status from public.eventos e where e.id = p_evento_id) <> 'publicado' then
    raise exception 'Este evento já foi encerrado.' using hint = 'evento_indisponivel';
  end if;

  if exists (select 1 from public.inscricoes_atividades
             where inscricao_id = v_inscricao.id and presente_em is not null) then
    raise exception 'Você já tem presença registrada neste evento; a inscrição não pode ser cancelada.'
      using hint = 'presenca_registrada';
  end if;

  -- Trava as atividades envolvidas (ordem por id) ANTES de mexer nas linhas de
  -- inscrição: evita deadlock com a promoção de outra pessoa.
  perform 1 from public.atividades
  where id in (select atividade_id from public.inscricoes_atividades
               where inscricao_id = v_inscricao.id and status in ('confirmada', 'lista_espera'))
  order by id
  for update;

  select coalesce(array_agg(atividade_id order by atividade_id), '{}') into v_liberadas
  from public.inscricoes_atividades
  where inscricao_id = v_inscricao.id and status = 'confirmada';

  update public.inscricoes_atividades set status = 'cancelada', entrou_fila_em = null
  where inscricao_id = v_inscricao.id;

  update public.inscricoes set status = 'cancelada', cancelada_em = now()
  where id = v_inscricao.id;

  foreach v_ativ in array v_liberadas loop
    perform public._promover_fila(v_ativ);
  end loop;
end;
$$;

-- Organizador aumentou as vagas (ou deixou ilimitadas): promove a fila.
create or replace function public._atividade_promover_ao_aumentar_vagas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.vagas is not null and (new.vagas is null or new.vagas > old.vagas) then
    perform public._promover_fila(new.id);
  end if;
  return null;
end;
$$;

create trigger atividades_promover_fila
  after update of vagas on public.atividades
  for each row execute function public._atividade_promover_ao_aumentar_vagas();

-- vagas_por_atividade passa a informar o tamanho da fila.
drop function public.vagas_por_atividade(uuid);
create function public.vagas_por_atividade(p_evento_id uuid)
returns table (atividade_id uuid, vagas integer, ocupadas integer, fila integer)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id,
         a.vagas,
         (select count(*)::integer
          from public.inscricoes_atividades ia
          join public.inscricoes i on i.id = ia.inscricao_id
          where ia.atividade_id = a.id and ia.status = 'confirmada' and i.status = 'confirmada'),
         (select count(*)::integer
          from public.inscricoes_atividades ia
          join public.inscricoes i on i.id = ia.inscricao_id
          where ia.atividade_id = a.id and ia.status = 'lista_espera' and i.status = 'confirmada')
  from public.atividades a
  join public.eventos e on e.id = a.evento_id
  where a.evento_id = p_evento_id
    and (e.status in ('publicado', 'encerrado') or public.eh_organizador());
$$;

-- =============================================================================
-- Submissão de trabalhos
-- =============================================================================
alter table public.eventos
  add column submissoes_abertas    boolean not null default false,
  add column submissoes_ate        timestamptz,
  add column submissao_instrucoes  text check (submissao_instrucoes is null or char_length(submissao_instrucoes) <= 5000),
  add column areas_tematicas       text[] not null default '{}'
    check (cardinality(areas_tematicas) <= 30);

create table public.trabalhos (
  id                  uuid primary key default gen_random_uuid(),
  evento_id           uuid not null references public.eventos (id) on delete cascade,
  autor_id            uuid not null references public.perfis (id) on delete cascade,
  titulo              text not null check (char_length(btrim(titulo)) between 5 and 300),
  resumo              text not null check (char_length(btrim(resumo)) between 50 and 5000),
  palavras_chave      text check (palavras_chave is null or char_length(palavras_chave) <= 300),
  area                text check (area is null or char_length(area) <= 120),
  modalidade          text not null default 'oral' check (modalidade in ('oral', 'poster')),
  -- nomes dos coautores (vão para o certificado futuramente)
  coautores           jsonb not null default '[]'::jsonb
                        check (jsonb_typeof(coautores) = 'array' and jsonb_array_length(coautores) <= 15),
  arquivo_path        text,
  status              text not null default 'submetido'
                        check (status in ('submetido', 'aprovado', 'reprovado', 'retirado')),
  parecer             text check (parecer is null or char_length(parecer) <= 3000),
  decidido_em         timestamptz,
  decidido_por        uuid references auth.users (id) on delete set null,
  -- sessão de apresentação (atividade do tipo 'apresentacao') do mesmo evento
  atividade_id        uuid references public.atividades (id) on delete set null,
  ordem_apresentacao  integer check (ordem_apresentacao is null or ordem_apresentacao between 1 and 999),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

create index trabalhos_evento_status_idx on public.trabalhos (evento_id, status);
create index trabalhos_autor_idx on public.trabalhos (autor_id);
create index trabalhos_atividade_idx on public.trabalhos (atividade_id);
create index trabalhos_decidido_por_idx on public.trabalhos (decidido_por);

create trigger trabalhos_atualizado_em
  before update on public.trabalhos
  for each row execute function public._tocar_atualizado_em();

alter table public.trabalhos enable row level security;

create policy trabalhos_select on public.trabalhos
  for select to authenticated
  using (autor_id = (select auth.uid()) or (select public.eh_organizador()));

-- Escrita só pelas funções abaixo.
revoke all on public.trabalhos from anon;
revoke insert, update, delete, truncate, references, trigger on public.trabalhos from authenticated;

-- Exclusão de evento/atividade: também bloqueia evento com trabalhos (os PDFs
-- ficariam órfãos no Storage). Atividade com trabalhos vinculados só desvincula.
create or replace function public._bloquear_exclusao_com_inscritos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'atividades' then
    if exists (select 1 from public.inscricoes_atividades ia
               join public.inscricoes i on i.id = ia.inscricao_id
               where ia.atividade_id = old.id
                 and ia.status in ('confirmada', 'lista_espera')
                 and i.status = 'confirmada') then
      raise exception 'Esta atividade tem inscritos e não pode ser excluída.'
        using hint = 'atividade_com_inscritos';
    end if;
  else
    if exists (select 1 from public.inscricoes i
               where i.evento_id = old.id and i.status = 'confirmada') then
      raise exception 'Este evento tem inscritos e não pode ser excluído. Encerre o evento em vez disso.'
        using hint = 'evento_com_inscritos';
    end if;
    if exists (select 1 from public.trabalhos t where t.evento_id = old.id) then
      raise exception 'Este evento tem trabalhos enviados e não pode ser excluído. Encerre o evento em vez disso.'
        using hint = 'evento_com_trabalhos';
    end if;
  end if;
  return old;
end;
$$;

-- Sessão com trabalhos vinculados não muda de evento nem deixa de ser 'apresentacao'.
create or replace function public._atividade_validar_trabalhos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.evento_id <> old.evento_id or new.tipo <> 'apresentacao')
     and exists (select 1 from public.trabalhos t where t.atividade_id = old.id) then
    raise exception 'Esta sessão tem trabalhos vinculados. Tire os trabalhos da sessão antes de mudar o tipo ou o evento.'
      using hint = 'atividade_com_trabalhos';
  end if;
  return new;
end;
$$;

create trigger atividades_validar_trabalhos
  before update of evento_id, tipo on public.atividades
  for each row execute function public._atividade_validar_trabalhos();

revoke execute on function public._atividade_validar_trabalhos() from public, anon, authenticated;

-- Prazo/abertura de submissão de um evento.
create or replace function public._submissoes_abertas(p_evento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.eventos e
    where e.id = p_evento_id
      and e.status = 'publicado'
      and e.submissoes_abertas
      and (e.submissoes_ate is null or now() <= e.submissoes_ate)
  );
$$;

-- Valida e normaliza os campos de um trabalho (usada por submeter/editar).
create or replace function public._validar_trabalho(
  p_evento_id uuid, p_area text, p_coautores jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_areas text[];
  v_limpos jsonb;
begin
  select areas_tematicas into v_areas from public.eventos where id = p_evento_id;
  if cardinality(v_areas) > 0 and (p_area is null or not (p_area = any (v_areas))) then
    raise exception 'Escolha uma das áreas temáticas do evento.' using hint = 'trabalho_invalido';
  end if;

  if p_coautores is null or jsonb_typeof(p_coautores) <> 'array' then
    return '[]'::jsonb;
  end if;

  if exists (select 1 from jsonb_array_elements(p_coautores) x
             where jsonb_typeof(x) <> 'string' or char_length(btrim(x #>> '{}')) not between 3 and 150) then
    raise exception 'Cada coautor precisa de um nome entre 3 e 150 caracteres.' using hint = 'trabalho_invalido';
  end if;

  select coalesce(jsonb_agg(btrim(x #>> '{}')), '[]'::jsonb) into v_limpos
  from jsonb_array_elements(p_coautores) x;
  return v_limpos;
end;
$$;

create or replace function public.submeter_trabalho(
  p_evento_id uuid,
  p_titulo text,
  p_resumo text,
  p_palavras_chave text default null,
  p_area text default null,
  p_modalidade text default 'oral',
  p_coautores jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para enviar um trabalho.' using hint = 'nao_autenticado';
  end if;
  if not exists (select 1 from public.perfis where id = v_uid) then
    raise exception 'Complete seu cadastro antes de enviar um trabalho.' using hint = 'perfil_incompleto';
  end if;
  if not public._submissoes_abertas(p_evento_id) then
    raise exception 'O envio de trabalhos para este evento está fechado.' using hint = 'submissoes_encerradas';
  end if;
  if (select count(*) from public.trabalhos
      where evento_id = p_evento_id and autor_id = v_uid and status <> 'retirado') >= 5 then
    raise exception 'Você já enviou o máximo de 5 trabalhos para este evento.' using hint = 'limite_trabalhos';
  end if;

  insert into public.trabalhos
    (evento_id, autor_id, titulo, resumo, palavras_chave, area, modalidade, coautores)
  values
    (p_evento_id, v_uid, btrim(p_titulo), btrim(p_resumo), nullif(btrim(p_palavras_chave), ''),
     nullif(btrim(p_area), ''), coalesce(p_modalidade, 'oral'),
     public._validar_trabalho(p_evento_id, nullif(btrim(p_area), ''), p_coautores))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.editar_trabalho(
  p_trabalho_id uuid,
  p_titulo text,
  p_resumo text,
  p_palavras_chave text default null,
  p_area text default null,
  p_modalidade text default 'oral',
  p_coautores jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trab public.trabalhos%rowtype;
begin
  select * into v_trab from public.trabalhos
  where id = p_trabalho_id and autor_id = auth.uid()
  for update;

  if not found then
    raise exception 'Trabalho não encontrado.' using hint = 'trabalho_invalido';
  end if;
  if v_trab.status <> 'submetido' then
    raise exception 'Este trabalho já foi avaliado e não pode mais ser alterado.' using hint = 'trabalho_avaliado';
  end if;
  if not public._submissoes_abertas(v_trab.evento_id) then
    raise exception 'O prazo de envio terminou; o trabalho não pode mais ser alterado.' using hint = 'submissoes_encerradas';
  end if;

  update public.trabalhos
  set titulo = btrim(p_titulo),
      resumo = btrim(p_resumo),
      palavras_chave = nullif(btrim(p_palavras_chave), ''),
      area = nullif(btrim(p_area), ''),
      modalidade = coalesce(p_modalidade, 'oral'),
      coautores = public._validar_trabalho(v_trab.evento_id, nullif(btrim(p_area), ''), p_coautores)
  where id = p_trabalho_id;
end;
$$;

create or replace function public.retirar_trabalho(p_trabalho_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Em análise: pode retirar sempre. Aprovado: só enquanto o evento está
  -- publicado (depois do encerramento a programação não muda mais).
  update public.trabalhos t
  set status = 'retirado', atividade_id = null, ordem_apresentacao = null
  where t.id = p_trabalho_id
    and t.autor_id = auth.uid()
    and (t.status = 'submetido'
         or (t.status = 'aprovado'
             and exists (select 1 from public.eventos e where e.id = t.evento_id and e.status = 'publicado')));

  if not found then
    raise exception 'Este trabalho não pode ser retirado.' using hint = 'trabalho_invalido';
  end if;
end;
$$;

-- Caminho esperado do PDF de um trabalho no bucket 'trabalhos'.
create or replace function public.caminho_arquivo_trabalho(p_trabalho_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select t.evento_id::text || '/' || t.autor_id::text || '/' || t.id::text || '.pdf'
  from public.trabalhos t
  where t.id = p_trabalho_id
    and (t.autor_id = auth.uid() or public.eh_organizador());
$$;

-- Depois do upload pelo navegador: confere que o arquivo existe e grava o caminho.
create or replace function public.confirmar_arquivo_trabalho(p_trabalho_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trab    public.trabalhos%rowtype;
  v_caminho text;
begin
  select * into v_trab from public.trabalhos
  where id = p_trabalho_id and autor_id = auth.uid()
  for update;

  if not found then
    raise exception 'Trabalho não encontrado.' using hint = 'trabalho_invalido';
  end if;

  v_caminho := v_trab.evento_id::text || '/' || v_trab.autor_id::text || '/' || v_trab.id::text || '.pdf';

  if not exists (select 1 from storage.objects o
                 where o.bucket_id = 'trabalhos' and o.name = v_caminho) then
    raise exception 'O arquivo PDF não foi encontrado. Envie o arquivo novamente.' using hint = 'arquivo_ausente';
  end if;

  update public.trabalhos set arquivo_path = v_caminho where id = p_trabalho_id;
end;
$$;

-- Organização aprova/reprova (ou volta para 'submetido'). Avisa o autor por e-mail.
create or replace function public.decidir_trabalho(
  p_trabalho_id uuid,
  p_status text,
  p_parecer text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trab   public.trabalhos%rowtype;
  v_evento text;
begin
  if not public.eh_organizador() then
    raise exception 'Apenas a organização pode avaliar trabalhos.' using hint = 'sem_permissao';
  end if;
  if p_status not in ('aprovado', 'reprovado', 'submetido') then
    raise exception 'Situação inválida.' using hint = 'trabalho_invalido';
  end if;

  select * into v_trab from public.trabalhos where id = p_trabalho_id for update;
  if not found or v_trab.status = 'retirado' then
    raise exception 'Trabalho não encontrado ou retirado pelo autor.' using hint = 'trabalho_invalido';
  end if;

  update public.trabalhos
  set status = p_status,
      parecer = nullif(btrim(p_parecer), ''),
      decidido_em = case when p_status = 'submetido' then null else now() end,
      decidido_por = case when p_status = 'submetido' then null else auth.uid() end,
      atividade_id = case when p_status = 'aprovado' then atividade_id else null end,
      ordem_apresentacao = case when p_status = 'aprovado' then ordem_apresentacao else null end
  where id = p_trabalho_id;

  if p_status in ('aprovado', 'reprovado') and p_status is distinct from v_trab.status then
    select titulo into v_evento from public.eventos where id = v_trab.evento_id;
    perform public._enfileirar_email(
      v_trab.autor_id,
      case when p_status = 'aprovado'
           then 'Trabalho aprovado: ' || v_trab.titulo
           else 'Resultado do seu trabalho: ' || v_trab.titulo end,
      case when p_status = 'aprovado'
           then 'Parabéns! Seu trabalho "' || v_trab.titulo || '" foi aprovado para o evento "'
                || v_evento || '". Fique atento(a) à programação: o horário da apresentação aparece na sua área.'
           else 'Seu trabalho "' || v_trab.titulo || '" não foi aprovado para o evento "'
                || v_evento || '".' end
      || coalesce(chr(10) || chr(10) || 'Comentário da organização:' || chr(10) || nullif(btrim(p_parecer), ''), '')
    );
  end if;
end;
$$;

-- Coloca um trabalho aprovado numa sessão de apresentação (ou tira, com null).
create or replace function public.vincular_trabalho_sessao(
  p_trabalho_id uuid,
  p_atividade_id uuid,
  p_ordem integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trab public.trabalhos%rowtype;
begin
  if not public.eh_organizador() then
    raise exception 'Apenas a organização pode montar as sessões.' using hint = 'sem_permissao';
  end if;

  select * into v_trab from public.trabalhos where id = p_trabalho_id for update;
  if not found then
    raise exception 'Trabalho não encontrado.' using hint = 'trabalho_invalido';
  end if;

  if p_atividade_id is not null then
    if v_trab.status <> 'aprovado' then
      raise exception 'Só trabalhos aprovados podem entrar na programação.' using hint = 'trabalho_invalido';
    end if;
    if not exists (select 1 from public.atividades a
                   where a.id = p_atividade_id
                     and a.evento_id = v_trab.evento_id
                     and a.tipo = 'apresentacao') then
      raise exception 'Escolha uma atividade do tipo "Apresentação" deste evento.' using hint = 'atividade_invalida';
    end if;
  end if;

  update public.trabalhos
  set atividade_id = p_atividade_id,
      ordem_apresentacao = case when p_atividade_id is null then null else p_ordem end
  where id = p_trabalho_id;
end;
$$;

-- Público: trabalhos aprovados nas sessões da programação (sem ids de pessoas,
-- e-mail ou arquivo).
create or replace function public.trabalhos_da_programacao(p_evento_id uuid)
returns table (
  atividade_id  uuid,
  trabalho_id   uuid,
  titulo        text,
  autores       text,
  modalidade    text,
  area          text,
  ordem         integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.atividade_id,
         t.id,
         t.titulo,
         concat_ws(', ', p.nome_completo,
                   nullif((select string_agg(x #>> '{}', ', ') from jsonb_array_elements(t.coautores) x), '')),
         t.modalidade,
         t.area,
         t.ordem_apresentacao
  from public.trabalhos t
  join public.eventos e on e.id = t.evento_id
  join public.perfis p on p.id = t.autor_id
  where t.evento_id = p_evento_id
    and t.status = 'aprovado'
    and t.atividade_id is not null
    and e.status in ('publicado', 'encerrado')
  order by t.atividade_id, t.ordem_apresentacao nulls last, t.titulo;
$$;

-- -----------------------------------------------------------------------------
-- Storage: bucket privado 'trabalhos'
-- Caminho: {evento_id}/{autor_id}/{trabalho_id}.pdf
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trabalhos', 'trabalhos', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- O autor pode gravar o PDF do PRÓPRIO trabalho, ainda 'submetido' e dentro do prazo.
create or replace function public._pode_enviar_arquivo(p_nome text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_nome ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'
     and exists (
       select 1 from public.trabalhos t
       where t.evento_id::text = split_part(p_nome, '/', 1)
         and t.autor_id::text = split_part(p_nome, '/', 2)
         and t.id::text || '.pdf' = split_part(p_nome, '/', 3)
         and t.autor_id = auth.uid()
         and t.status = 'submetido'
         and public._submissoes_abertas(t.evento_id)
     );
$$;

create policy trabalhos_arquivo_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'trabalhos' and public._pode_enviar_arquivo(name));

create policy trabalhos_arquivo_update on storage.objects
  for update to authenticated
  using (bucket_id = 'trabalhos' and public._pode_enviar_arquivo(name))
  with check (bucket_id = 'trabalhos' and public._pode_enviar_arquivo(name));

-- O autor apaga o próprio PDF quando o trabalho é retirado (ou ficou sem
-- registro): evita guardar dados pessoais sem necessidade (LGPD).
create or replace function public._pode_apagar_arquivo(p_nome text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select split_part(p_nome, '/', 2) = auth.uid()::text
     and not exists (
       select 1 from public.trabalhos t
       where t.id::text || '.pdf' = split_part(p_nome, '/', 3)
         and t.status in ('submetido', 'aprovado', 'reprovado')
     );
$$;

create policy trabalhos_arquivo_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'trabalhos' and public._pode_apagar_arquivo(name));

create policy trabalhos_arquivo_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'trabalhos'
    and ((storage.foldername(name))[2] = (select auth.uid())::text
         or (select public.eh_organizador()))
  );

-- -----------------------------------------------------------------------------
-- Permissões de execução
-- -----------------------------------------------------------------------------
revoke execute on function
  public._enfileirar_email(uuid, text, text),
  public.reservar_emails(integer),
  public.concluir_email(bigint, text),
  public._promover_fila(uuid),
  public._atividade_promover_ao_aumentar_vagas(),
  public._adicionar_atividades(uuid, uuid, uuid[]),
  public.entrar_lista_espera(uuid),
  public.sair_lista_espera(uuid),
  public.minhas_posicoes_fila(uuid),
  public.remover_atividade(uuid),
  public.cancelar_inscricao(uuid),
  public.vagas_por_atividade(uuid),
  public._submissoes_abertas(uuid),
  public._validar_trabalho(uuid, text, jsonb),
  public.submeter_trabalho(uuid, text, text, text, text, text, jsonb),
  public.editar_trabalho(uuid, text, text, text, text, text, jsonb),
  public.retirar_trabalho(uuid),
  public.caminho_arquivo_trabalho(uuid),
  public.confirmar_arquivo_trabalho(uuid),
  public.decidir_trabalho(uuid, text, text),
  public.vincular_trabalho_sessao(uuid, uuid, integer),
  public.trabalhos_da_programacao(uuid),
  public._pode_enviar_arquivo(text)
from public, anon, authenticated;

grant execute on function public.reservar_emails(integer), public.concluir_email(bigint, text)
  to service_role;
grant execute on function public.vagas_por_atividade(uuid), public.trabalhos_da_programacao(uuid)
  to anon, authenticated;
-- usada pelas policies do Storage
grant execute on function public._pode_enviar_arquivo(text), public._pode_apagar_arquivo(text) to authenticated;
revoke execute on function public._atividade_bloquear_choque_remarcacao() from public, anon, authenticated;
grant execute on function
  public.entrar_lista_espera(uuid),
  public.sair_lista_espera(uuid),
  public.minhas_posicoes_fila(uuid),
  public.remover_atividade(uuid),
  public.cancelar_inscricao(uuid),
  public.submeter_trabalho(uuid, text, text, text, text, text, jsonb),
  public.editar_trabalho(uuid, text, text, text, text, text, jsonb),
  public.retirar_trabalho(uuid),
  public.caminho_arquivo_trabalho(uuid),
  public.confirmar_arquivo_trabalho(uuid),
  public.decidir_trabalho(uuid, text, text),
  public.vincular_trabalho_sessao(uuid, uuid, integer)
to authenticated;

-- Novas tabelas: nada de TRUNCATE/REFERENCES/TRIGGER para a API.
revoke truncate, references, trigger on public.notificacoes_email, public.trabalhos from anon, authenticated;
