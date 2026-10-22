-- =============================================================================
-- Certificados
--
--   * Um certificado por participante por evento (atividades com presença e
--     carga horária total) + certificados da equipe (palestrantes e
--     organização/monitores), cadastrada pela organização.
--   * A organização LIBERA (liberar_certificados) depois que todas as
--     atividades terminaram. Pode corrigir presenças e liberar de novo: o código
--     se mantém, o conteúdo é recalculado e quem perdeu o direito é REVOGADO
--     (nunca apagado: a validação pública continua respondendo).
--   * Cada certificado guarda um retrato (nome, documento, atividades, horas)
--     do momento da emissão: o aluno editar o perfil depois não muda o
--     documento. Já título/local/datas do evento, texto complementar, registro
--     e assinaturas são lidos na hora de gerar o PDF (o painel avisa).
--   * Documento: genérico (hoje "RGA ..."); se a coordenação exigir CPF, entra
--     aqui sem mudar a estrutura.
--   * Validação pública (validar_certificado) mostra só o essencial e o
--     documento mascarado. Dados completos para o PDF só para dono,
--     organização ou membro da equipe com e-mail confirmado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fila de e-mails: destinatário sem conta (equipe cadastrada só com e-mail)
-- -----------------------------------------------------------------------------
alter table public.notificacoes_email
  alter column usuario_id drop not null,
  add column email_destino text check (email_destino is null or email_destino ~ '^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$'),
  add column nome_destino text check (nome_destino is null or char_length(nome_destino) <= 150),
  add constraint notificacoes_email_destinatario_check
    check (usuario_id is not null or email_destino is not null);

create or replace function public._enfileirar_email_para(
  p_email text, p_nome text, p_assunto text, p_corpo text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notificacoes_email (usuario_id, email_destino, nome_destino, assunto, corpo)
  values (null, lower(btrim(p_email)), left(p_nome, 150),
          left(btrim(regexp_replace(p_assunto, '[[:cntrl:]]+', ' ', 'g')), 200),
          left(p_corpo, 10000));
$$;

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
    returning n.id, n.usuario_id, n.email_destino, n.nome_destino, n.assunto, n.corpo
  )
  select r.id,
         coalesce(u.email::text, r.email_destino),
         coalesce(p.nome_completo, r.nome_destino),
         r.assunto,
         r.corpo
  from reservados r
  left join auth.users u on u.id = r.usuario_id
  left join public.perfis p on p.id = r.usuario_id
  order by r.id;
$$;

-- Quantos e-mails ainda vão sair (painel mostra "enviando N e-mails").
create or replace function public.emails_pendentes()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.eh_organizador()
              then (select count(*)::integer from public.notificacoes_email
                    where enviada_em is null and tentativas < 5)
              else 0 end;
$$;

-- -----------------------------------------------------------------------------
-- Configuração do certificado no evento
-- -----------------------------------------------------------------------------
alter table public.eventos
  -- texto livre opcional (ex.: "evento de extensão vinculado ao curso X")
  add column certificado_texto text check (certificado_texto is null or char_length(certificado_texto) <= 1500),
  -- quem promove: entra no texto como "promovido por ..." (ex.: "Curso de
  -- Engenharia de Minas", "Secretaria de Inovação e Empreendedorismo")
  add column certificado_promotor text check (certificado_promotor is null or char_length(certificado_promotor) <= 200),
  -- nº do registro da ação de extensão/processo, se houver
  add column certificado_registro text check (certificado_registro is null or char_length(certificado_registro) <= 200),
  -- até 3 assinaturas: [{ "nome": "...", "cargo": "..." }]
  add column certificado_assinaturas jsonb not null default '[]'::jsonb
    check (jsonb_typeof(certificado_assinaturas) = 'array' and jsonb_array_length(certificado_assinaturas) <= 3),
  add column certificados_liberados_em timestamptz;

-- -----------------------------------------------------------------------------
-- Equipe do evento (palestrantes/ministrantes e organização/monitores)
-- -----------------------------------------------------------------------------
create table public.equipe_evento (
  id                     uuid primary key default gen_random_uuid(),
  evento_id              uuid not null references public.eventos (id) on delete cascade,
  nome                   text not null check (char_length(btrim(nome)) between 3 and 150),
  -- opcional: para avisar por e-mail e para a pessoa baixar o PDF entrando com ele
  email                  text check (email is null or (email = lower(btrim(email))
                                     and email ~ '^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$')),
  tipo                   text not null check (tipo in ('palestrante', 'organizacao')),
  -- ex.: "Ministrante do minicurso", "Monitor(a)", "Comissão organizadora"
  funcao                 text not null check (char_length(btrim(funcao)) between 3 and 120),
  atividade_id           uuid references public.atividades (id) on delete set null,
  -- até 720 h (limite de sanidade contra erro de digitação)
  carga_horaria_minutos  integer not null check (carga_horaria_minutos between 1 and 43200),
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);

create index equipe_evento_evento_idx on public.equipe_evento (evento_id);
create index equipe_evento_atividade_idx on public.equipe_evento (atividade_id);
create index equipe_evento_email_idx on public.equipe_evento (email);

create trigger equipe_evento_atualizado_em
  before update on public.equipe_evento
  for each row execute function public._tocar_atualizado_em();

alter table public.equipe_evento enable row level security;

create policy equipe_evento_org_select on public.equipe_evento
  for select to authenticated using ((select public.eh_organizador()));
create policy equipe_evento_org_insert on public.equipe_evento
  for insert to authenticated with check ((select public.eh_organizador()));
create policy equipe_evento_org_update on public.equipe_evento
  for update to authenticated using ((select public.eh_organizador())) with check ((select public.eh_organizador()));
create policy equipe_evento_org_delete on public.equipe_evento
  for delete to authenticated using ((select public.eh_organizador()));

revoke all on public.equipe_evento from anon;
revoke truncate, references, trigger on public.equipe_evento from authenticated;

-- A atividade da equipe precisa ser do mesmo evento.
create or replace function public._equipe_validar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.atividade_id is not null
     and not exists (select 1 from public.atividades a
                     where a.id = new.atividade_id and a.evento_id = new.evento_id) then
    raise exception 'A atividade escolhida não é deste evento.' using hint = 'atividade_invalida';
  end if;
  return new;
end;
$$;

create trigger equipe_evento_validar
  before insert or update on public.equipe_evento
  for each row execute function public._equipe_validar();
-- (o trigger de sincronização com certificados é criado depois da tabela certificados)

-- -----------------------------------------------------------------------------
-- Certificados
-- -----------------------------------------------------------------------------
create table public.certificados (
  id                     uuid primary key default gen_random_uuid(),
  -- código de validação: Crockford base32, 60 bits, formato XXXX-XXXX-XXXX
  codigo                 text not null unique check (codigo ~ '^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$'),
  evento_id              uuid not null references public.eventos (id) on delete restrict,
  tipo                   text not null check (tipo in ('participante', 'palestrante', 'organizacao')),
  usuario_id             uuid references auth.users (id) on delete set null,
  equipe_id              uuid references public.equipe_evento (id) on delete set null,
  -- retrato do momento da emissão
  nome                   text not null,
  documento              text,
  funcao                 text,
  atividades             jsonb not null default '[]'::jsonb check (jsonb_typeof(atividades) = 'array'),
  carga_horaria_minutos  integer not null check (carga_horaria_minutos > 0),
  emitido_em             timestamptz not null default now(),
  atualizado_em          timestamptz not null default now(),
  revogado_em            timestamptz,
  revogado_motivo        text check (revogado_motivo is null or char_length(revogado_motivo) <= 300),
  -- revogado à mão pela organização: a re-liberação NÃO reativa
  revogado_manual        boolean not null default false
);

create unique index certificados_participante_unico
  on public.certificados (evento_id, usuario_id) where tipo = 'participante';
create unique index certificados_equipe_unico
  on public.certificados (evento_id, equipe_id) where equipe_id is not null;
create index certificados_usuario_idx on public.certificados (usuario_id);
create index certificados_evento_idx on public.certificados (evento_id);

alter table public.certificados enable row level security;

-- E-mail confirmado do usuário logado (mesma regra de meu_papel).
create or replace function public._meu_email_confirmado()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email::text) from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null;
$$;

create or replace function public._pode_ver_certificado(p_usuario uuid, p_equipe uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Certificado de equipe vale pelo e-mail ATUAL do cadastro da equipe (trocou
  -- o e-mail ou removeu a pessoa: o acesso antigo acaba na hora).
  select (p_equipe is null and p_usuario = auth.uid())
      or public.eh_organizador()
      or exists (select 1 from public.equipe_evento e
                 where e.id = p_equipe and e.email is not null
                   and e.email = public._meu_email_confirmado());
$$;

create policy certificados_select on public.certificados
  for select to authenticated
  using ((select public._pode_ver_certificado(usuario_id, equipe_id)));

-- Escrita só pelas funções (ninguém forja certificado por escrita direta).
revoke all on public.certificados from anon;
revoke insert, update, delete, truncate, references, trigger on public.certificados from authenticated;

-- Código aleatório: 12 símbolos Crockford (256 % 32 = 0, sem viés).
create or replace function public._gerar_codigo_certificado()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_alfabeto constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_bytes    bytea;
  v_codigo   text;
begin
  loop
    v_bytes := extensions.gen_random_bytes(12);
    v_codigo := '';
    for i in 0..11 loop
      v_codigo := v_codigo || substr(v_alfabeto, (get_byte(v_bytes, i) % 32) + 1, 1);
      if i in (3, 7) then
        v_codigo := v_codigo || '-';
      end if;
    end loop;
    exit when not exists (select 1 from public.certificados where codigo = v_codigo);
  end loop;
  return v_codigo;
end;
$$;

-- Normaliza o que a pessoa digitou: minúsculas, espaços/traços, O->0, I/L->1.
create or replace function public.normalizar_codigo_certificado(p_codigo text)
returns text
language sql
immutable
set search_path = ''
as $$
  with limpo as (
    select translate(upper(regexp_replace(coalesce(p_codigo, ''), '[^0-9A-Za-z]', '', 'g')), 'OIL', '011') as c
  )
  select case when char_length(c) = 12
              then substr(c, 1, 4) || '-' || substr(c, 5, 4) || '-' || substr(c, 9, 4)
              else c end
  from limpo;
$$;

-- Mascara o documento por POSIÇÃO: mantém um prefixo em letras ("RGA ", "CPF ")
-- e só os últimos k caracteres alfanuméricos, k = min(4, total/3). Funciona
-- para RGA, CPF com pontuação etc. Ex.: "RGA 202311900123" -> "RGA ********0123",
-- "CPF 123.456.789-01" -> "CPF ***.***.**9-01".
create or replace function public._mascarar_documento(p_documento text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_prefixo text;
  v_resto   text;
  v_total   integer;
  v_mostrar integer;
  v_vistos  integer := 0;
  v_saida   text := '';
  v_c       text;
begin
  if p_documento is null then
    return null;
  end if;
  v_prefixo := coalesce(substring(p_documento from '^[A-Za-z]+\s+'), '');
  v_resto := substr(p_documento, char_length(v_prefixo) + 1);
  v_total := char_length(regexp_replace(v_resto, '[^0-9A-Za-z]', '', 'g'));
  v_mostrar := least(4, v_total / 3);

  -- percorre de trás para frente: os últimos v_mostrar alfanuméricos ficam visíveis
  for i in reverse char_length(v_resto)..1 loop
    v_c := substr(v_resto, i, 1);
    if v_c ~ '[0-9A-Za-z]' then
      v_vistos := v_vistos + 1;
      v_saida := case when v_vistos <= v_mostrar then v_c else '*' end || v_saida;
    else
      v_saida := v_c || v_saida;
    end if;
  end loop;

  return v_prefixo || v_saida;
end;
$$;

-- Equipe alterada/removida: corta na hora o vínculo do certificado com a conta
-- antiga; exclusão revoga imediatamente (BEFORE: o FK ainda não zerou equipe_id).
create or replace function public._equipe_sincronizar_certificado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.certificados
    set revogado_em = now(), revogado_motivo = 'Removido(a) da equipe do evento pela organização.'
    where equipe_id = old.id and revogado_em is null;
    return old;
  end if;
  if new.email is distinct from old.email then
    update public.certificados set usuario_id = null where equipe_id = old.id;
  end if;
  return new;
end;
$$;

create trigger equipe_evento_sincronizar_exclusao
  before delete on public.equipe_evento
  for each row execute function public._equipe_sincronizar_certificado();
create trigger equipe_evento_sincronizar_email
  after update of email on public.equipe_evento
  for each row execute function public._equipe_sincronizar_certificado();

-- Bloqueio de exclusão de evento: também com certificados emitidos.
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
    if exists (select 1 from public.certificados c where c.evento_id = old.id) then
      raise exception 'Este evento já tem certificados emitidos e não pode ser excluído.'
        using hint = 'evento_com_certificados';
    end if;
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

-- Marcação manual de presença: vale com o evento publicado ou encerrado (a
-- revisão de presenças acontece depois do evento, antes de liberar os
-- certificados). Nunca em rascunho.
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

  if not exists (select 1 from public.atividades a
                 join public.eventos e on e.id = a.evento_id
                 where a.id = p_atividade_id and e.status in ('publicado', 'encerrado')) then
    raise exception 'A presença só pode ser marcada em evento publicado ou encerrado.' using hint = 'evento_indisponivel';
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

-- -----------------------------------------------------------------------------
-- Liberação (e re-liberação) dos certificados de um evento
-- -----------------------------------------------------------------------------
create or replace function public.liberar_certificados(p_evento_id uuid)
returns table (novos integer, atualizados integer, revogados integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento       public.eventos%rowtype;
  v_novos        integer := 0;
  v_atualizados  integer := 0;
  v_revogados    integer := 0;
  v_part         record;
  v_eq           record;
  v_cert         public.certificados%rowtype;
  v_retrato      jsonb;
  v_codigo       text;
  v_usuario_eq   uuid;
  v_aviso        text;
begin
  if not public.eh_organizador() then
    raise exception 'Apenas a organização pode liberar certificados.' using hint = 'sem_permissao';
  end if;

  select * into v_evento from public.eventos where id = p_evento_id for update;
  if not found then
    raise exception 'Evento não encontrado.' using hint = 'evento_indisponivel';
  end if;
  if v_evento.status not in ('publicado', 'encerrado') then
    raise exception 'Publique o evento antes de liberar os certificados.' using hint = 'evento_indisponivel';
  end if;
  if not exists (select 1 from public.atividades where evento_id = p_evento_id) then
    raise exception 'O evento não tem atividades.' using hint = 'atividade_invalida';
  end if;
  if exists (select 1 from public.atividades where evento_id = p_evento_id and fim > now()) then
    raise exception 'Os certificados só podem ser liberados depois que todas as atividades terminarem.'
      using hint = 'atividades_em_andamento';
  end if;

  v_aviso := chr(10) || chr(10) || 'Para ver e baixar: {{SITE}}/minha-area/certificados'
          || chr(10) || 'Qualquer pessoa pode conferir a autenticidade em {{SITE}}/certificados/validar';

  -- ---------- Participantes: quem teve ao menos uma presença ----------
  for v_part in
    select i.usuario_id,
           p.nome_completo,
           case when p.rga is not null then 'RGA ' || p.rga end as documento,
           jsonb_agg(jsonb_build_object(
             'titulo', a.titulo, 'tipo', a.tipo, 'inicio', to_char(a.inicio at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
             'fim', to_char(a.fim at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
             'carga_horaria_minutos', a.carga_horaria_minutos) order by a.inicio, a.titulo) as atividades,
           sum(a.carga_horaria_minutos)::integer as carga
    from public.inscricoes i
    join public.perfis p on p.id = i.usuario_id
    join public.inscricoes_atividades ia on ia.inscricao_id = i.id
    join public.atividades a on a.id = ia.atividade_id
    where i.evento_id = p_evento_id
      and i.status = 'confirmada'
      and ia.status = 'confirmada'
      and ia.presente_em is not null
    group by i.usuario_id, p.nome_completo, p.rga
  loop
    -- Nome e documento ficam CONGELADOS na emissão (o aluno pode editar o perfil
    -- depois); a re-liberação só recalcula atividades e carga.
    v_retrato := jsonb_build_object('atividades', v_part.atividades, 'carga', v_part.carga);

    select * into v_cert from public.certificados
    where evento_id = p_evento_id and tipo = 'participante' and usuario_id = v_part.usuario_id
    for update;

    if not found then
      v_codigo := public._gerar_codigo_certificado();
      insert into public.certificados
        (codigo, evento_id, tipo, usuario_id, nome, documento, atividades, carga_horaria_minutos)
      values
        (v_codigo, p_evento_id, 'participante', v_part.usuario_id, v_part.nome_completo,
         v_part.documento, v_part.atividades, v_part.carga);
      v_novos := v_novos + 1;
      perform public._enfileirar_email(
        v_part.usuario_id,
        'Seu certificado está disponível: ' || v_evento.titulo,
        'O certificado de participação no evento "' || v_evento.titulo || '" está disponível.' || chr(10)
        || 'Código de validação: ' || v_codigo || v_aviso);
    elsif v_cert.revogado_manual then
      null;  -- revogado à mão pela organização: a re-liberação não reativa
    elsif v_cert.revogado_em is not null
       or jsonb_build_object('atividades', v_cert.atividades, 'carga', v_cert.carga_horaria_minutos)
          is distinct from v_retrato then
      update public.certificados
      set atividades = v_part.atividades,
          carga_horaria_minutos = v_part.carga, atualizado_em = now(),
          revogado_em = null, revogado_motivo = null
      where id = v_cert.id;
      v_atualizados := v_atualizados + 1;
      perform public._enfileirar_email(
        v_part.usuario_id,
        'Seu certificado foi atualizado: ' || v_evento.titulo,
        'A organização revisou as presenças e o seu certificado do evento "' || v_evento.titulo
        || '" foi atualizado. O código de validação continua o mesmo: ' || v_cert.codigo || v_aviso);
    end if;
  end loop;

  -- Participantes que perderam o direito (presença retirada na revisão).
  with revog as (
    update public.certificados c
    set revogado_em = now(), revogado_motivo = 'Presença não confirmada na revisão da organização.'
    where c.evento_id = p_evento_id
      and c.tipo = 'participante'
      and c.revogado_em is null
      and not exists (
        select 1 from public.inscricoes i
        join public.inscricoes_atividades ia on ia.inscricao_id = i.id
        where i.evento_id = p_evento_id and i.usuario_id = c.usuario_id
          and i.status = 'confirmada' and ia.status = 'confirmada' and ia.presente_em is not null)
    returning 1
  )
  select v_revogados + count(*)::integer into v_revogados from revog;

  -- ---------- Equipe ----------
  for v_eq in
    select e.*,
           a.titulo as atividade_titulo, a.tipo as atividade_tipo, a.inicio as atividade_inicio, a.fim as atividade_fim
    from public.equipe_evento e
    left join public.atividades a on a.id = e.atividade_id
    where e.evento_id = p_evento_id
  loop
    -- conta confirmada com o mesmo e-mail (para aparecer na área da pessoa)
    select u.id into v_usuario_eq from auth.users u
    where v_eq.email is not null and lower(u.email::text) = v_eq.email and u.email_confirmed_at is not null
    limit 1;

    v_retrato := jsonb_build_object(
      'nome', btrim(v_eq.nome), 'funcao', btrim(v_eq.funcao), 'carga', v_eq.carga_horaria_minutos,
      'atividades', case when v_eq.atividade_id is null then '[]'::jsonb
                         else jsonb_build_array(jsonb_build_object(
                           'titulo', v_eq.atividade_titulo, 'tipo', v_eq.atividade_tipo,
                           'inicio', to_char(v_eq.atividade_inicio at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                           'fim', to_char(v_eq.atividade_fim at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                           'carga_horaria_minutos', v_eq.carga_horaria_minutos)) end);

    select * into v_cert from public.certificados
    where evento_id = p_evento_id and equipe_id = v_eq.id
    for update;

    if not found then
      v_codigo := public._gerar_codigo_certificado();
      insert into public.certificados
        (codigo, evento_id, tipo, usuario_id, equipe_id, nome, funcao, atividades, carga_horaria_minutos)
      values
        (v_codigo, p_evento_id, v_eq.tipo, v_usuario_eq, v_eq.id, v_retrato ->> 'nome',
         v_retrato ->> 'funcao', v_retrato -> 'atividades', v_eq.carga_horaria_minutos);
      v_novos := v_novos + 1;
      if v_eq.email is not null then
        perform public._enfileirar_email_para(
          v_eq.email, v_eq.nome,
          'Seu certificado está disponível: ' || v_evento.titulo,
          'Olá! O certificado da sua participação como "' || btrim(v_eq.funcao) || '" no evento "'
          || v_evento.titulo || '" está disponível.' || chr(10)
          || 'Código de validação: ' || v_codigo || chr(10) || chr(10)
          || 'Para baixar, entre em {{SITE}}/minha-area/certificados com este e-mail '
          || '(você recebe um código de acesso; não precisa de senha).');
      end if;
    elsif v_cert.revogado_manual then
      null;
    elsif v_cert.revogado_em is not null
       or jsonb_build_object('nome', v_cert.nome, 'funcao', v_cert.funcao,
                             'carga', v_cert.carga_horaria_minutos, 'atividades', v_cert.atividades)
          is distinct from v_retrato
       or v_cert.tipo is distinct from v_eq.tipo
       or v_cert.usuario_id is distinct from v_usuario_eq then
      update public.certificados
      set tipo = v_eq.tipo, usuario_id = v_usuario_eq, nome = v_retrato ->> 'nome',
          funcao = v_retrato ->> 'funcao', atividades = v_retrato -> 'atividades',
          carga_horaria_minutos = v_eq.carga_horaria_minutos, atualizado_em = now(),
          revogado_em = null, revogado_motivo = null
      where id = v_cert.id;
      v_atualizados := v_atualizados + 1;
    end if;
  end loop;

  -- Membros da equipe removidos do cadastro.
  with revog as (
    update public.certificados c
    set revogado_em = now(), revogado_motivo = 'Removido(a) da equipe do evento pela organização.'
    where c.evento_id = p_evento_id
      and c.tipo in ('palestrante', 'organizacao')
      and c.revogado_em is null
      and (c.equipe_id is null
           or not exists (select 1 from public.equipe_evento e where e.id = c.equipe_id))
    returning 1
  )
  select v_revogados + count(*)::integer into v_revogados from revog;

  update public.eventos
  set certificados_liberados_em = coalesce(certificados_liberados_em, now())
  where id = p_evento_id;

  insert into public.auditoria (usuario_id, acao, detalhes)
  values (auth.uid(), 'liberar_certificados',
          jsonb_build_object('evento_id', p_evento_id, 'novos', v_novos,
                             'atualizados', v_atualizados, 'revogados', v_revogados));

  return query select v_novos, v_atualizados, v_revogados;
end;
$$;

create or replace function public.revogar_certificado(p_certificado_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_organizador() then
    raise exception 'Apenas a organização pode revogar certificados.' using hint = 'sem_permissao';
  end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Explique o motivo da revogação.' using hint = 'motivo_obrigatorio';
  end if;

  update public.certificados
  set revogado_em = now(), revogado_motivo = left(btrim(p_motivo), 300), revogado_manual = true
  where id = p_certificado_id and revogado_em is null;

  if not found then
    raise exception 'Certificado não encontrado ou já revogado.' using hint = 'certificado_invalido';
  end if;
end;
$$;

-- Pública: conferir autenticidade pelo código.
create or replace function public.validar_certificado(p_codigo text)
returns table (
  codigo                 text,
  tipo                   text,
  nome                   text,
  documento_mascarado    text,
  funcao                 text,
  evento_titulo          text,
  evento_local           text,
  data_inicio            date,
  data_fim               date,
  carga_horaria_minutos  integer,
  atividades             jsonb,
  emitido_em             timestamptz,
  atualizado_em          timestamptz,
  revogado_em            timestamptz,
  revogado_motivo        text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.codigo, c.tipo, c.nome, public._mascarar_documento(c.documento), c.funcao,
         e.titulo, e.local, e.data_inicio, e.data_fim, c.carga_horaria_minutos, c.atividades,
         c.emitido_em, c.atualizado_em, c.revogado_em,
         -- motivo da revogação só para quem pode ver o certificado (LGPD)
         case when public._pode_ver_certificado(c.usuario_id, c.equipe_id) then c.revogado_motivo end
  from public.certificados c
  join public.eventos e on e.id = c.evento_id
  where c.codigo = public.normalizar_codigo_certificado(p_codigo);
$$;

-- Dados completos para gerar o PDF (dono, organização ou equipe com e-mail
-- confirmado). Certificado revogado não gera PDF.
create or replace function public.dados_certificado(p_codigo text)
returns table (
  codigo                   text,
  tipo                     text,
  nome                     text,
  documento                text,
  funcao                   text,
  atividades               jsonb,
  carga_horaria_minutos    integer,
  emitido_em               timestamptz,
  atualizado_em            timestamptz,
  evento_titulo            text,
  evento_local             text,
  data_inicio              date,
  data_fim                 date,
  certificado_texto        text,
  certificado_registro     text,
  certificado_assinaturas  jsonb,
  certificado_promotor     text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.codigo, c.tipo, c.nome, c.documento, c.funcao, c.atividades, c.carga_horaria_minutos,
         c.emitido_em, c.atualizado_em,
         e.titulo, e.local, e.data_inicio, e.data_fim,
         e.certificado_texto, e.certificado_registro, e.certificado_assinaturas, e.certificado_promotor
  from public.certificados c
  join public.eventos e on e.id = c.evento_id
  where c.codigo = public.normalizar_codigo_certificado(p_codigo)
    and c.revogado_em is null
    and public._pode_ver_certificado(c.usuario_id, c.equipe_id);
$$;

-- -----------------------------------------------------------------------------
-- Permissões
-- -----------------------------------------------------------------------------
revoke execute on function
  public._enfileirar_email_para(text, text, text, text),
  public.reservar_emails(integer),
  public.emails_pendentes(),
  public._equipe_validar(),
  public._equipe_sincronizar_certificado(),
  public._meu_email_confirmado(),
  public._pode_ver_certificado(uuid, uuid),
  public._gerar_codigo_certificado(),
  public.normalizar_codigo_certificado(text),
  public._mascarar_documento(text),
  public.marcar_presenca_manual(uuid, uuid, boolean),
  public.liberar_certificados(uuid),
  public.revogar_certificado(uuid, text),
  public.validar_certificado(text),
  public.dados_certificado(text)
from public, anon, authenticated;

grant execute on function public.reservar_emails(integer) to service_role;
grant execute on function public.validar_certificado(text), public.normalizar_codigo_certificado(text)
  to anon, authenticated;
-- usada pela policy de certificados
grant execute on function public._pode_ver_certificado(uuid, uuid) to authenticated;
grant execute on function
  public.emails_pendentes(),
  public.marcar_presenca_manual(uuid, uuid, boolean),
  public.liberar_certificados(uuid),
  public.revogar_certificado(uuid, text),
  public.dados_certificado(text)
to authenticated;
