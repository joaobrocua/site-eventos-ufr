-- =============================================================================
-- Plataforma de eventos da UFR — schema inicial
--
-- Regras que moram NO BANCO (não confiar só na aplicação):
--   * vagas e choque de horário são checados dentro de inscrever_em_evento(),
--     com a linha da atividade travada (FOR UPDATE): dois cliques simultâneos
--     nunca vendem a mesma última vaga;
--   * participantes não escrevem direto em inscricoes/inscricoes_atividades:
--     só pelas funções abaixo;
--   * organizador = e-mail CONFIRMADO do usuário logado presente em
--     public.organizadores (nunca um e-mail digitado num formulário);
--   * o QR code carrega inscricoes.codigo (128 bits aleatórios), nunca o id.
--
-- Fora do escopo por enquanto (dependem da coordenação/LGPD): CPF, certificados,
-- pagamento (preco_centavos existe, mas nada o usa) e submissão de trabalhos.
-- Horários: timestamptz; a aplicação exibe em America/Cuiaba (UTC-4).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Utilitário: atualizado_em automático
-- -----------------------------------------------------------------------------
create or replace function public._tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Organizadores (quem pode criar/gerir eventos). Gerido por SQL/admin por ora.
-- -----------------------------------------------------------------------------
create table public.organizadores (
  email      text primary key check (email = lower(btrim(email)) and email like '%_@_%'),
  nome       text,
  papel      text not null default 'organizador' check (papel in ('admin', 'organizador')),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

comment on table public.organizadores is
  'Organização/coordenação do curso. Só e-mails ativos aqui podem criar e gerir eventos.';

-- Papel do usuário logado: 'admin', 'organizador' ou null (participante/anônimo).
-- Exige e-mail confirmado: uma conta criada com o e-mail de um organizador mas
-- não confirmada não herda o papel.
create or replace function public.meu_papel()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select o.papel
  from public.organizadores o
  join auth.users u on u.id = auth.uid()
  where o.ativo
    and u.email_confirmed_at is not null
    and o.email = lower(u.email)
  limit 1;
$$;

create or replace function public.eh_organizador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.meu_papel() is not null;
$$;

-- -----------------------------------------------------------------------------
-- Perfis dos participantes (1:1 com auth.users)
-- -----------------------------------------------------------------------------
create table public.perfis (
  id             uuid primary key references auth.users (id) on delete cascade,
  nome_completo  text not null check (char_length(btrim(nome_completo)) between 3 and 150),
  -- e-mail é copiado de auth.users por trigger (o usuário não escolhe)
  email          text not null,
  -- RGA: registro acadêmico (só dígitos). Opcional para público externo.
  rga            text check (rga is null or rga ~ '^[0-9]{6,20}$'),
  curso          text check (curso is null or char_length(curso) <= 120),
  telefone       text check (telefone is null or telefone ~ '^[0-9]{10,13}$'),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create or replace function public._perfil_definir_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select u.email into new.email from auth.users u where u.id = new.id;
  if new.email is null then
    raise exception 'Usuário inválido.';
  end if;
  new.nome_completo := btrim(regexp_replace(new.nome_completo, '\s+', ' ', 'g'));
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger perfis_definir_email
  before insert or update on public.perfis
  for each row execute function public._perfil_definir_email();

-- -----------------------------------------------------------------------------
-- Eventos
-- -----------------------------------------------------------------------------
create table public.eventos (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique
                        check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  titulo              text not null check (char_length(btrim(titulo)) between 3 and 150),
  resumo              text check (resumo is null or char_length(resumo) <= 300),
  descricao           text check (descricao is null or char_length(descricao) <= 10000),
  local               text check (local is null or char_length(local) <= 200),
  -- datas locais (America/Cuiaba) do evento como um todo
  data_inicio         date not null,
  data_fim            date not null,
  capa_url            text check (capa_url is null or capa_url ~ '^https?://'),
  status              text not null default 'rascunho'
                        check (status in ('rascunho', 'publicado', 'encerrado')),
  inscricoes_abertas  boolean not null default true,
  inscricoes_ate      timestamptz,
  criado_por          uuid references auth.users (id) on delete set null default auth.uid(),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  check (data_fim >= data_inicio)
);

create index eventos_status_data_idx on public.eventos (status, data_inicio desc);

create trigger eventos_atualizado_em
  before update on public.eventos
  for each row execute function public._tocar_atualizado_em();

-- -----------------------------------------------------------------------------
-- Atividades (palestras, minicursos...) dentro de um evento
-- -----------------------------------------------------------------------------
create table public.atividades (
  id                     uuid primary key default gen_random_uuid(),
  evento_id              uuid not null references public.eventos (id) on delete cascade,
  titulo                 text not null check (char_length(btrim(titulo)) between 3 and 150),
  descricao              text check (descricao is null or char_length(descricao) <= 5000),
  tipo                   text not null default 'palestra'
                           check (tipo in ('palestra', 'minicurso', 'oficina', 'mesa_redonda',
                                           'apresentacao', 'outro')),
  palestrantes           text check (palestrantes is null or char_length(palestrantes) <= 300),
  local                  text check (local is null or char_length(local) <= 200),
  inicio                 timestamptz not null,
  fim                    timestamptz not null,
  -- null = vagas ilimitadas
  vagas                  integer check (vagas is null or vagas > 0),
  carga_horaria_minutos  integer not null check (carga_horaria_minutos > 0),
  -- reservado para inscrição paga (fase 2). Nada usa ainda.
  preco_centavos         integer not null default 0 check (preco_centavos >= 0),
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now(),
  check (fim > inicio)
);

create index atividades_evento_inicio_idx on public.atividades (evento_id, inicio);

create trigger atividades_atualizado_em
  before update on public.atividades
  for each row execute function public._tocar_atualizado_em();

-- criado_por sempre é quem criou (não aceita valor enviado pelo cliente).
create or replace function public._evento_criado_por()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por := auth.uid();
  else
    new.criado_por := old.criado_por;
  end if;
  return new;
end;
$$;

create trigger eventos_criado_por
  before insert or update on public.eventos
  for each row execute function public._evento_criado_por();

-- -----------------------------------------------------------------------------
-- Inscrições (participante x evento) e escolha de atividades
-- -----------------------------------------------------------------------------
create table public.inscricoes (
  id            uuid primary key default gen_random_uuid(),
  evento_id     uuid not null references public.eventos (id) on delete cascade,
  -- referencia perfis: só se inscreve quem completou o cadastro
  usuario_id    uuid not null references public.perfis (id) on delete cascade,
  -- conteúdo do QR code: 128 bits aleatórios em hex (32 caracteres)
  codigo        text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  status        text not null default 'confirmada' check (status in ('confirmada', 'cancelada')),
  criado_em     timestamptz not null default now(),
  cancelada_em  timestamptz,
  unique (evento_id, usuario_id)
);

create index inscricoes_usuario_idx on public.inscricoes (usuario_id);

create table public.inscricoes_atividades (
  inscricao_id             uuid not null references public.inscricoes (id) on delete cascade,
  atividade_id             uuid not null references public.atividades (id) on delete cascade,
  status                   text not null default 'confirmada'
                             check (status in ('confirmada', 'cancelada')),
  presente_em              timestamptz,
  presenca_registrada_por  uuid references auth.users (id) on delete set null,
  criado_em                timestamptz not null default now(),
  primary key (inscricao_id, atividade_id)
);

create index inscricoes_atividades_atividade_idx
  on public.inscricoes_atividades (atividade_id) include (inscricao_id) where status = 'confirmada';
create index inscricoes_atividades_presenca_por_idx
  on public.inscricoes_atividades (presenca_registrada_por);
create index eventos_criado_por_idx on public.eventos (criado_por);

-- -----------------------------------------------------------------------------
-- Integridade de atividades/eventos com gente inscrita
-- -----------------------------------------------------------------------------
-- Atividade com inscritos não muda de evento nem fica com menos vagas que inscritos.
-- (Mudar horário continua permitido: remarcações acontecem.)
create or replace function public._atividade_validar_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ocupadas integer;
begin
  if new.evento_id <> old.evento_id
     and exists (select 1 from public.inscricoes_atividades ia where ia.atividade_id = old.id) then
    raise exception 'Esta atividade já tem inscritos e não pode mudar de evento.'
      using hint = 'atividade_com_inscritos';
  end if;

  if new.vagas is not null and new.vagas is distinct from old.vagas then
    select count(*) into v_ocupadas
    from public.inscricoes_atividades ia
    join public.inscricoes i on i.id = ia.inscricao_id
    where ia.atividade_id = old.id and ia.status = 'confirmada' and i.status = 'confirmada';

    if new.vagas < v_ocupadas then
      raise exception 'Já existem % inscritos nesta atividade; as vagas não podem ser menos que isso.', v_ocupadas
        using hint = 'vagas_abaixo_inscritos';
    end if;
  end if;

  return new;
end;
$$;

create trigger atividades_validar_update
  before update on public.atividades
  for each row execute function public._atividade_validar_update();

-- Não apaga atividade/evento com inscrições confirmadas (dados de presença e
-- base dos certificados). Para tirar do ar: encerrar o evento.
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
               where ia.atividade_id = old.id and ia.status = 'confirmada' and i.status = 'confirmada') then
      raise exception 'Esta atividade tem inscritos e não pode ser excluída.'
        using hint = 'atividade_com_inscritos';
    end if;
  else
    if exists (select 1 from public.inscricoes i
               where i.evento_id = old.id and i.status = 'confirmada') then
      raise exception 'Este evento tem inscritos e não pode ser excluído. Encerre o evento em vez disso.'
        using hint = 'evento_com_inscritos';
    end if;
  end if;
  return old;
end;
$$;

create trigger eventos_bloquear_exclusao
  before delete on public.eventos
  for each row execute function public._bloquear_exclusao_com_inscritos();

create trigger atividades_bloquear_exclusao
  before delete on public.atividades
  for each row execute function public._bloquear_exclusao_com_inscritos();

-- -----------------------------------------------------------------------------
-- Auditoria (quem exportou/consultou dados pessoais, etc.)
-- -----------------------------------------------------------------------------
create table public.auditoria (
  id          bigint generated always as identity primary key,
  usuario_id  uuid references auth.users (id) on delete set null default auth.uid(),
  acao        text not null check (acao ~ '^[a-z_]{3,60}$'),
  detalhes    jsonb not null default '{}'::jsonb,
  criado_em   timestamptz not null default now()
);

create index auditoria_criado_em_idx on public.auditoria (criado_em desc);
create index auditoria_usuario_idx on public.auditoria (usuario_id);

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.organizadores         enable row level security;
alter table public.perfis                enable row level security;
alter table public.eventos               enable row level security;
alter table public.atividades            enable row level security;
alter table public.inscricoes            enable row level security;
alter table public.inscricoes_atividades enable row level security;
alter table public.auditoria             enable row level security;

-- organizadores: só organizadores enxergam a lista; escrita só por SQL/admin.
create policy organizadores_select on public.organizadores
  for select to authenticated using ((select public.eh_organizador()));

-- perfis: cada um o seu; organizadores leem todos (listas de inscritos).
create policy perfis_select on public.perfis
  for select to authenticated using (id = (select auth.uid()) or (select public.eh_organizador()));
create policy perfis_insert on public.perfis
  for insert to authenticated with check (id = (select auth.uid()));
create policy perfis_update on public.perfis
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- eventos: público vê publicados/encerrados; organizadores veem e editam tudo.
create policy eventos_select_publico on public.eventos
  for select to anon, authenticated using (status in ('publicado', 'encerrado'));
create policy eventos_select_org on public.eventos
  for select to authenticated using ((select public.eh_organizador()));
create policy eventos_insert_org on public.eventos
  for insert to authenticated with check ((select public.eh_organizador()));
create policy eventos_update_org on public.eventos
  for update to authenticated using ((select public.eh_organizador())) with check ((select public.eh_organizador()));
create policy eventos_delete_org on public.eventos
  for delete to authenticated using ((select public.eh_organizador()));

-- atividades: visíveis se o evento for visível.
create policy atividades_select_publico on public.atividades
  for select to anon, authenticated using (
    exists (select 1 from public.eventos e
            where e.id = evento_id and e.status in ('publicado', 'encerrado'))
  );
create policy atividades_select_org on public.atividades
  for select to authenticated using ((select public.eh_organizador()));
create policy atividades_insert_org on public.atividades
  for insert to authenticated with check ((select public.eh_organizador()));
create policy atividades_update_org on public.atividades
  for update to authenticated using ((select public.eh_organizador())) with check ((select public.eh_organizador()));
create policy atividades_delete_org on public.atividades
  for delete to authenticated using ((select public.eh_organizador()));

-- inscricoes: leitura do dono ou de organizadores. Escrita só via funções.
create policy inscricoes_select on public.inscricoes
  for select to authenticated using (usuario_id = (select auth.uid()) or (select public.eh_organizador()));

create policy inscricoes_atividades_select on public.inscricoes_atividades
  for select to authenticated using (
    (select public.eh_organizador())
    or exists (select 1 from public.inscricoes i
               where i.id = inscricao_id and i.usuario_id = (select auth.uid()))
  );

-- auditoria: só admins leem; gravação via registrar_auditoria().
create policy auditoria_select_admin on public.auditoria
  for select to authenticated using ((select public.meu_papel()) = 'admin');

-- Grants: além da RLS, tira a escrita direta onde ela nunca deve existir.
revoke all on public.organizadores, public.auditoria from anon;
revoke insert, update, delete on public.organizadores, public.auditoria from authenticated;
revoke all on public.perfis, public.inscricoes, public.inscricoes_atividades from anon;
revoke insert, update, delete on public.inscricoes, public.inscricoes_atividades from authenticated;
revoke delete on public.perfis from authenticated;
revoke insert, update, delete on public.eventos, public.atividades from anon;
-- TRUNCATE ignora a RLS: ninguém da API deve ter (nem REFERENCES/TRIGGER).
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;

-- =============================================================================
-- Funções de negócio
-- Erros: message em português (pode ir direto para a tela) e hint com um
-- código estável para a aplicação decidir o que fazer.
-- =============================================================================

-- Adiciona atividades a uma inscrição checando vagas e choque de horário.
-- Interna: chamada por inscrever_em_evento() e registrar_presenca().
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

  -- Trava as atividades (ordem fixa evita deadlock) antes de contar vagas.
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

      if v_ocupadas >= v_ativ.vagas then
        raise exception 'As vagas de "%" acabaram.', v_ativ.titulo
          using hint = 'vagas_esgotadas';
      end if;
    end if;

    select a2.titulo into v_conflito
    from public.inscricoes_atividades ia
    join public.atividades a2 on a2.id = ia.atividade_id
    where ia.inscricao_id = p_inscricao_id
      and ia.status = 'confirmada'
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
      do update set status = 'confirmada';
  end loop;
end;
$$;

-- Inscreve o usuário logado no evento (cria ou reativa) e adiciona atividades.
-- Tudo ou nada: se uma atividade falhar (vagas/choque), nada é gravado.
-- Para adicionar uma atividade depois, chame de novo com só aquela atividade.
create or replace function public.inscrever_em_evento(
  p_evento_id uuid,
  p_atividades uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_evento     public.eventos%rowtype;
  v_inscricao  uuid;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para se inscrever.' using hint = 'nao_autenticado';
  end if;

  if not exists (select 1 from public.perfis where id = v_uid) then
    raise exception 'Complete seu cadastro antes de se inscrever.' using hint = 'perfil_incompleto';
  end if;

  select * into v_evento from public.eventos where id = p_evento_id;
  if not found or v_evento.status <> 'publicado' then
    raise exception 'Este evento não está disponível para inscrição.' using hint = 'evento_indisponivel';
  end if;

  if not v_evento.inscricoes_abertas
     or (v_evento.inscricoes_ate is not null and now() > v_evento.inscricoes_ate) then
    raise exception 'As inscrições deste evento estão encerradas.' using hint = 'inscricoes_encerradas';
  end if;

  if exists (select 1 from public.atividades a
             where a.id = any (coalesce(p_atividades, '{}')) and a.fim <= now()) then
    raise exception 'Uma das atividades escolhidas já terminou.' using hint = 'atividade_encerrada';
  end if;

  insert into public.inscricoes (evento_id, usuario_id)
  values (p_evento_id, v_uid)
  on conflict (evento_id, usuario_id)
    do update set status = 'confirmada', cancelada_em = null
  returning id into v_inscricao;

  perform public._adicionar_atividades(v_inscricao, p_evento_id, p_atividades);
  return v_inscricao;
end;
$$;

-- Participante desiste de uma atividade (não vale depois da presença registrada).
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
end;
$$;

-- Participante cancela a inscrição inteira no evento.
create or replace function public.cancelar_inscricao(p_evento_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_inscricao public.inscricoes%rowtype;
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

  update public.inscricoes_atividades set status = 'cancelada'
  where inscricao_id = v_inscricao.id;

  update public.inscricoes set status = 'cancelada', cancelada_em = now()
  where id = v_inscricao.id;
end;
$$;

-- Vagas por atividade de um evento (só números; nunca quem se inscreveu).
create or replace function public.vagas_por_atividade(p_evento_id uuid)
returns table (atividade_id uuid, vagas integer, ocupadas integer)
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
          where ia.atividade_id = a.id
            and ia.status = 'confirmada'
            and i.status = 'confirmada')
  from public.atividades a
  join public.eventos e on e.id = a.evento_id
  where a.evento_id = p_evento_id
    and (e.status in ('publicado', 'encerrado') or public.eh_organizador());
$$;

-- Check-in pelo QR code. Idempotente: segunda leitura devolve 'ja_registrado'.
-- resultado: registrado | ja_registrado | nao_inscrito | inscricao_cancelada | codigo_invalido
-- p_incluir = true inscreve na hora (respeitando vagas/choque) quem não estava
-- inscrito na atividade, e já registra a presença.
create or replace function public.registrar_presenca(
  p_codigo text,
  p_atividade_id uuid,
  p_incluir boolean default false
)
returns table (
  resultado     text,
  inscricao_id  uuid,
  nome          text,
  rga           text,
  presente_em   timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento_id  uuid;
  v_status     text;
  v_insc       public.inscricoes%rowtype;
  v_perfil     public.perfis%rowtype;
  v_ia         public.inscricoes_atividades%rowtype;
begin
  if not public.eh_organizador() then
    raise exception 'Apenas a organização pode registrar presença.' using hint = 'sem_permissao';
  end if;

  select a.evento_id, e.status into v_evento_id, v_status
  from public.atividades a
  join public.eventos e on e.id = a.evento_id
  where a.id = p_atividade_id;
  if not found then
    raise exception 'Atividade não encontrada.' using hint = 'atividade_invalida';
  end if;

  -- Presença só em evento publicado (rascunho ainda não aconteceu; encerrado
  -- está fechado para mudanças).
  if v_status <> 'publicado' then
    raise exception 'Este evento não está aberto para registro de presença.' using hint = 'evento_indisponivel';
  end if;

  -- Trava a inscrição: duas leituras simultâneas do mesmo QR não furam o choque de horário.
  select * into v_insc from public.inscricoes i
  where i.codigo = lower(btrim(coalesce(p_codigo, ''))) and i.evento_id = v_evento_id
  for update;

  if not found then
    return query select 'codigo_invalido'::text, null::uuid, null::text, null::text, null::timestamptz;
    return;
  end if;

  select * into v_perfil from public.perfis p where p.id = v_insc.usuario_id;

  if v_insc.status <> 'confirmada' then
    return query select 'inscricao_cancelada'::text, v_insc.id, v_perfil.nome_completo, v_perfil.rga, null::timestamptz;
    return;
  end if;

  select * into v_ia from public.inscricoes_atividades ia
  where ia.inscricao_id = v_insc.id and ia.atividade_id = p_atividade_id
  for update;

  if not found or v_ia.status <> 'confirmada' then
    if not p_incluir then
      return query select 'nao_inscrito'::text, v_insc.id, v_perfil.nome_completo, v_perfil.rga, null::timestamptz;
      return;
    end if;
    perform public._adicionar_atividades(v_insc.id, v_evento_id, array[p_atividade_id]);
    select * into v_ia from public.inscricoes_atividades ia
    where ia.inscricao_id = v_insc.id and ia.atividade_id = p_atividade_id;
  end if;

  if v_ia.presente_em is not null then
    return query select 'ja_registrado'::text, v_insc.id, v_perfil.nome_completo, v_perfil.rga, v_ia.presente_em;
    return;
  end if;

  update public.inscricoes_atividades ia
  set presente_em = now(), presenca_registrada_por = auth.uid()
  where ia.inscricao_id = v_insc.id and ia.atividade_id = p_atividade_id
  returning ia.presente_em into v_ia.presente_em;

  return query select 'registrado'::text, v_insc.id, v_perfil.nome_completo, v_perfil.rga, v_ia.presente_em;
end;
$$;

-- Marcação manual (lista na tela, sem QR): marca ou desmarca presença.
create or replace function public.marcar_presenca_manual(
  p_inscricao_id uuid,
  p_atividade_id uuid,
  p_presente boolean
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_presente_em timestamptz;
begin
  if not public.eh_organizador() then
    raise exception 'Apenas a organização pode registrar presença.' using hint = 'sem_permissao';
  end if;

  update public.inscricoes_atividades ia
  set presente_em = case when p_presente then coalesce(ia.presente_em, now()) else null end,
      presenca_registrada_por = case when p_presente then coalesce(ia.presenca_registrada_por, auth.uid()) else null end
  where ia.inscricao_id = p_inscricao_id
    and ia.atividade_id = p_atividade_id
    and ia.status = 'confirmada'
  returning ia.presente_em into v_presente_em;

  if not found then
    raise exception 'Esta pessoa não está inscrita nesta atividade.' using hint = 'nao_inscrito';
  end if;

  return v_presente_em;
end;
$$;

-- Registra ação sensível (ex.: exportação de lista com dados pessoais).
create or replace function public.registrar_auditoria(p_acao text, p_detalhes jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_organizador() then
    raise exception 'Sem permissão.' using hint = 'sem_permissao';
  end if;
  insert into public.auditoria (usuario_id, acao, detalhes)
  values (auth.uid(), p_acao, coalesce(p_detalhes, '{}'::jsonb));
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões de execução das funções
-- -----------------------------------------------------------------------------
revoke execute on function
  public._tocar_atualizado_em(),
  public._evento_criado_por(),
  public._atividade_validar_update(),
  public._bloquear_exclusao_com_inscritos(),
  public._perfil_definir_email(),
  public._adicionar_atividades(uuid, uuid, uuid[]),
  public.meu_papel(),
  public.eh_organizador(),
  public.inscrever_em_evento(uuid, uuid[]),
  public.remover_atividade(uuid),
  public.cancelar_inscricao(uuid),
  public.vagas_por_atividade(uuid),
  public.registrar_presenca(text, uuid, boolean),
  public.marcar_presenca_manual(uuid, uuid, boolean),
  public.registrar_auditoria(text, jsonb)
from public, anon, authenticated;

grant execute on function public.vagas_por_atividade(uuid) to anon, authenticated;
-- eh_organizador/meu_papel são usadas nas policies (inclusive as avaliadas para anon).
grant execute on function public.meu_papel(), public.eh_organizador() to anon, authenticated;
grant execute on function
  public.inscrever_em_evento(uuid, uuid[]),
  public.remover_atividade(uuid),
  public.cancelar_inscricao(uuid),
  public.registrar_presenca(text, uuid, boolean),
  public.marcar_presenca_manual(uuid, uuid, boolean),
  public.registrar_auditoria(text, jsonb)
to authenticated;
