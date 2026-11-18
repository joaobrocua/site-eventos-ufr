-- =============================================================================
-- Revisão de segurança (nov/2026)
--   1. eventos.criado_por deixa de ser legível pela API (anon e authenticated):
--      é o id de login de quem criou o evento e o site não precisa dele.
--   2. Auditoria das ações da organização que mexem em presença, certificado
--      e equipe (antes só a liberação de certificados e exportações eram
--      registradas).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Colunas legíveis de eventos
-- -----------------------------------------------------------------------------
-- Permissão por coluna: qualquer `select *` em eventos passa a dar "permission
-- denied". O app lista as colunas (COLUNAS_EVENTO em src/lib/tipos.ts).
-- ATENÇÃO: coluna nova em eventos precisa entrar neste grant, senão fica
-- invisível para o site.
revoke select on public.eventos from anon, authenticated;
grant select (
  id, slug, titulo, resumo, descricao, local, data_inicio, data_fim, capa_url,
  status, inscricoes_abertas, inscricoes_ate, criado_em, atualizado_em,
  submissoes_abertas, submissoes_ate, submissao_instrucoes, areas_tematicas,
  certificado_texto, certificado_promotor, certificado_registro,
  certificado_assinaturas, certificados_liberados_em
) on public.eventos to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2a. Presença marcada à mão pela organização
-- -----------------------------------------------------------------------------
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

  insert into public.auditoria (usuario_id, acao, detalhes)
  values (auth.uid(), 'marcar_presenca_manual',
          jsonb_build_object('inscricao_id', p_inscricao_id,
                             'atividade_id', p_atividade_id,
                             'presente', p_presente));

  return v_presente_em;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2b. Revogação manual de certificado
-- -----------------------------------------------------------------------------
create or replace function public.revogar_certificado(p_certificado_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento_id uuid;
  v_codigo    text;
begin
  if not public.eh_organizador() then
    raise exception 'Apenas a organização pode revogar certificados.' using hint = 'sem_permissao';
  end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Explique o motivo da revogação.' using hint = 'motivo_obrigatorio';
  end if;

  update public.certificados
  set revogado_em = now(), revogado_motivo = left(btrim(p_motivo), 300), revogado_manual = true
  where id = p_certificado_id and revogado_em is null
  returning evento_id, codigo into v_evento_id, v_codigo;

  if not found then
    raise exception 'Certificado não encontrado ou já revogado.' using hint = 'certificado_invalido';
  end if;

  insert into public.auditoria (usuario_id, acao, detalhes)
  values (auth.uid(), 'revogar_certificado',
          jsonb_build_object('certificado_id', p_certificado_id, 'codigo', v_codigo,
                             'evento_id', v_evento_id, 'motivo', left(btrim(p_motivo), 300)));
end;
$$;

-- -----------------------------------------------------------------------------
-- 2c. Equipe do evento (palestrantes/organização: geram certificado)
-- -----------------------------------------------------------------------------
-- Trigger em vez de mexer nas actions: pega qualquer caminho de escrita.
-- SECURITY DEFINER porque authenticated não grava em auditoria.
create or replace function public._auditar_equipe_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linha public.equipe_evento%rowtype;
  v_acao  text;
begin
  if tg_op = 'DELETE' then
    v_linha := old;
    v_acao := 'equipe_remover';
  elsif tg_op = 'UPDATE' then
    v_linha := new;
    v_acao := 'equipe_alterar';
  else
    v_linha := new;
    v_acao := 'equipe_incluir';
  end if;

  insert into public.auditoria (usuario_id, acao, detalhes)
  values (auth.uid(), v_acao,
          jsonb_build_object('evento_id', v_linha.evento_id, 'membro_id', v_linha.id,
                             'nome', v_linha.nome, 'tipo', v_linha.tipo,
                             'funcao', v_linha.funcao,
                             'carga_horaria_minutos', v_linha.carga_horaria_minutos));
  return null;
end;
$$;

revoke execute on function public._auditar_equipe_evento() from public, anon, authenticated;

create trigger equipe_evento_auditar
  after insert or update or delete on public.equipe_evento
  for each row execute function public._auditar_equipe_evento();
