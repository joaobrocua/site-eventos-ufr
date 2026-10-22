-- Certificados. Rodar: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create schema if not exists tests;
grant usage on schema tests to public;
create or replace function tests.login(p_uid uuid, p_role text default 'authenticated')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', p_role)::text, true);
  execute format('set local role %I', p_role);
end $$;
create or replace function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'reset role';
end $$;
grant execute on function tests.login(uuid, text), tests.logout() to public;

-- ---------- dados ----------
insert into auth.users (id, email, email_confirmed_at, instance_id, aud, role) values
 ('00000000-0000-0000-0000-0000000000a1','a@t.test', now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000a2','b@t.test', now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000e1','palestrante@t.test', now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000e2','falso@t.test', null, '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c1','org@t.test', now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated');
insert into public.organizadores (email, papel) values ('org@t.test','organizador');
insert into public.perfis (id, nome_completo, email, rga) values
 ('00000000-0000-0000-0000-0000000000a1','Aluna Ação Çedilha','', '202311900123'),
 ('00000000-0000-0000-0000-0000000000a2','Aluno B','', null);
insert into public.eventos (id, slug, titulo, data_inicio, data_fim, status) values
 ('10000000-0000-0000-0000-000000000001','c-passado','Evento passado','2099-01-10','2099-01-10','publicado');
insert into public.atividades (id, evento_id, titulo, tipo, inicio, fim, vagas, carga_horaria_minutos) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Minicurso X','minicurso','2099-01-10 08:00-04','2099-01-10 12:00-04',null,240),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Palestra Y','palestra','2099-01-10 14:00-04','2099-01-10 16:00-04',null,120);
-- inscrições (como postgres)
select tests.login('00000000-0000-0000-0000-0000000000a1');
select public.inscrever_em_evento('10000000-0000-0000-0000-000000000001','{20000000-0000-0000-0000-000000000001,20000000-0000-0000-0000-000000000002}');
select tests.logout();
select tests.login('00000000-0000-0000-0000-0000000000a2');
select public.inscrever_em_evento('10000000-0000-0000-0000-000000000001','{20000000-0000-0000-0000-000000000002}');
select tests.logout();
insert into public.equipe_evento (id, evento_id, nome, email, tipo, funcao, atividade_id, carga_horaria_minutos) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Palestrante P','palestrante@t.test','palestrante','Ministrante','20000000-0000-0000-0000-000000000001',240),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Membro sem conta','falso@t.test','organizacao','Monitor(a)',null,600);

-- ---------- Liberação antes da hora ----------
select tests.login('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$select * from public.liberar_certificados('10000000-0000-0000-0000-000000000001')$$,
  null, null, 'não libera com atividades ainda por acontecer');
select tests.logout();

-- "O evento aconteceu": move as atividades para o passado e marca presenças.
update public.atividades set inicio = inicio - interval '100 years', fim = fim - interval '100 years'
  where evento_id = '10000000-0000-0000-0000-000000000001';
update public.inscricoes_atividades ia set presente_em = now()
  from public.inscricoes i
  where i.id = ia.inscricao_id and i.evento_id = '10000000-0000-0000-0000-000000000001';

select tests.login('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$select * from public.liberar_certificados('10000000-0000-0000-0000-000000000001')$$,
  null, null, 'aluno não libera certificados');
select tests.logout();

select tests.login('00000000-0000-0000-0000-0000000000c1');
select results_eq($$select novos, atualizados, revogados from public.liberar_certificados('10000000-0000-0000-0000-000000000001')$$,
  $$values (4, 0, 0)$$, 'libera 2 participantes + 2 da equipe');
select results_eq($$select novos, atualizados, revogados from public.liberar_certificados('10000000-0000-0000-0000-000000000001')$$,
  $$values (0, 0, 0)$$, 'liberar de novo sem mudanças não duplica nada');
select tests.logout();

select is((select carga_horaria_minutos from public.certificados where usuario_id = '00000000-0000-0000-0000-0000000000a1' and tipo = 'participante'),
  360, 'carga total soma as atividades com presença');
select is((select jsonb_array_length(atividades) from public.certificados where usuario_id = '00000000-0000-0000-0000-0000000000a1' and tipo = 'participante'),
  2, 'certificado lista as atividades');
select ok((select codigo from public.certificados limit 1) ~ '^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$',
  'código no formato XXXX-XXXX-XXXX');
select is((select count(*)::int from public.notificacoes_email where email_destino = 'palestrante@t.test' or usuario_id = '00000000-0000-0000-0000-0000000000a1'), 2,
  'participante e palestrante recebem e-mail');
select is((select usuario_id from public.certificados where equipe_id = '30000000-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-0000000000e1'::uuid, 'palestrante com conta confirmada fica ligado à conta');
select is((select usuario_id from public.certificados where equipe_id = '30000000-0000-0000-0000-000000000002'),
  null, 'e-mail não confirmado não liga à conta');

-- ---------- Acesso ----------
create temp table t_cod as
  select (select codigo from public.certificados where usuario_id = '00000000-0000-0000-0000-0000000000a1' and tipo = 'participante') as a,
         (select codigo from public.certificados where equipe_id = '30000000-0000-0000-0000-000000000001') as p,
         (select codigo from public.certificados where equipe_id = '30000000-0000-0000-0000-000000000002') as f;
grant select on t_cod to public;

select tests.login('00000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from public.certificados where usuario_id <> '00000000-0000-0000-0000-0000000000a2'), 0,
  'aluno não vê certificado de outra pessoa');
select is((select count(*)::int from public.dados_certificado((select a from t_cod))), 0,
  'aluno não obtém dados do PDF de outra pessoa');
select throws_ok($$insert into public.certificados (codigo, evento_id, tipo, nome, carga_horaria_minutos) values ('AAAA-AAAA-AAAA','10000000-0000-0000-0000-000000000001','participante','Forjado',60)$$,
  '42501', null, 'ninguém forja certificado por escrita direta');
select tests.logout();

select tests.login('00000000-0000-0000-0000-0000000000a1');
select is((select nome from public.dados_certificado(lower(replace((select a from t_cod), '-', ' ')))),
  'Aluna Ação Çedilha', 'dono obtém os dados do PDF (código digitado de qualquer jeito)');
select tests.logout();

select tests.login('00000000-0000-0000-0000-0000000000e1');
select is((select count(*)::int from public.dados_certificado((select p from t_cod))), 1,
  'palestrante com e-mail confirmado baixa o próprio certificado');
select tests.logout();
select tests.login('00000000-0000-0000-0000-0000000000e2');
select is((select count(*)::int from public.dados_certificado((select f from t_cod))), 0,
  'e-mail NÃO confirmado não dá acesso');
select tests.logout();

select tests.login(null, 'anon');
select is((select documento_mascarado from public.validar_certificado((select a from t_cod))), 'RGA ********0123',
  'validação pública mascara o documento');
select is((select count(*)::int from public.validar_certificado('XXXX-XXXX-XXXX')), 0, 'código inexistente não valida');
select throws_ok($$select count(*) from public.certificados$$, '42501', null, 'anon não lê a tabela de certificados');
select throws_ok($$select * from public.dados_certificado('x')$$, '42501', null, 'anon não obtém dados do PDF');
select tests.logout();

-- ---------- Revisão: presença retirada e re-liberação ----------
select tests.login('00000000-0000-0000-0000-0000000000c1');
select lives_ok($$select public.marcar_presenca_manual(
  (select id from public.inscricoes where usuario_id = '00000000-0000-0000-0000-0000000000a2'),
  '20000000-0000-0000-0000-000000000002', false)$$, 'organizador corrige presença depois do evento');
select lives_ok($$select public.marcar_presenca_manual(
  (select id from public.inscricoes where usuario_id = '00000000-0000-0000-0000-0000000000a1'),
  '20000000-0000-0000-0000-000000000002', false)$$, 'tira uma das presenças da aluna A');
delete from public.equipe_evento where id = '30000000-0000-0000-0000-000000000002';
select tests.logout();
select isnt((select revogado_em from public.certificados c join t_cod on c.codigo = t_cod.f), null,
  'membro excluído da equipe tem o certificado revogado na hora');
-- A muda o nome no perfil depois da emissão: o certificado NÃO muda.
update public.perfis set nome_completo = 'Outro Nome Qualquer', rga = '999999999' where id = '00000000-0000-0000-0000-0000000000a1';
select tests.login('00000000-0000-0000-0000-0000000000c1');
select results_eq($$select novos, atualizados, revogados from public.liberar_certificados('10000000-0000-0000-0000-000000000001')$$,
  $$values (0, 1, 1)$$, 're-liberação: A atualizado (carga) e B revogado');
select tests.logout();
select is((select nome || ' / ' || documento from public.certificados where usuario_id = '00000000-0000-0000-0000-0000000000a1' and tipo = 'participante'),
  'Aluna Ação Çedilha / RGA 202311900123', 'nome e documento ficam congelados na emissão');

-- Fuso da conexão diferente não gera "atualização" falsa.
set local timezone = 'America/Cuiaba';
select tests.login('00000000-0000-0000-0000-0000000000c1');
select results_eq($$select novos, atualizados, revogados from public.liberar_certificados('10000000-0000-0000-0000-000000000001')$$,
  $$values (0, 0, 0)$$, 'fuso da sessão não muda nada');
-- Revogação manual não é desfeita pela re-liberação.
select lives_ok($$select public.revogar_certificado((select id from public.certificados where equipe_id = '30000000-0000-0000-0000-000000000001'), 'Não compareceu ao evento.')$$,
  'organizador revoga manualmente');
select results_eq($$select novos, atualizados, revogados from public.liberar_certificados('10000000-0000-0000-0000-000000000001')$$,
  $$values (0, 0, 0)$$, 're-liberação não reativa revogado à mão');
select tests.logout();
reset timezone;

-- Membro da equipe: trocar o e-mail corta o acesso da conta antiga.
update public.certificados set revogado_em = null, revogado_motivo = null, revogado_manual = false
  where equipe_id = '30000000-0000-0000-0000-000000000001';
update public.equipe_evento set email = 'outra@t.test' where id = '30000000-0000-0000-0000-000000000001';
select tests.login('00000000-0000-0000-0000-0000000000e1');
select is((select count(*)::int from public.dados_certificado((select p from t_cod))), 0,
  'e-mail trocado: a conta antiga perde o acesso na hora');
select tests.logout();

-- Validação pública não mostra o motivo da revogação.
select tests.login(null, 'anon');
select is((select revogado_motivo from public.validar_certificado((select f from t_cod))), null,
  'anon não vê o motivo da revogação');
select tests.logout();

-- Máscara do documento em vários formatos.
select is(public._mascarar_documento('RGA 202311900123'), 'RGA ********0123', 'máscara RGA');
select is(public._mascarar_documento('CPF 123.456.789-01'), 'CPF ***.***.**9-01', 'máscara CPF com pontuação');
select is(public._mascarar_documento('123.456.789-01'), '***.***.**9-01', 'máscara CPF sem prefixo');
select is(public._mascarar_documento('RGA 123456'), 'RGA ****56', 'RGA curto mostra no máximo 1/3');
select is(public._mascarar_documento('RGA 1234'), 'RGA ***4', 'documento muito curto quase todo mascarado');
select is(public._mascarar_documento(null), null, 'documento nulo');

-- E-mail de equipe com quebra de linha é recusado.
select throws_ok($$insert into public.equipe_evento (evento_id, nome, email, tipo, funcao, carga_horaria_minutos)
  values ('10000000-0000-0000-0000-000000000001', 'X Y Z', E'a@b.com\nbcc: x@y.com', 'organizacao', 'Monitor', 60)$$,
  '23514', null, 'e-mail de equipe com quebra de linha é recusado');

select is((select codigo from public.certificados where usuario_id = '00000000-0000-0000-0000-0000000000a1' and tipo = 'participante'),
  (select a from t_cod), 'código continua o mesmo após atualização');
select is((select carga_horaria_minutos from public.certificados where usuario_id = '00000000-0000-0000-0000-0000000000a1' and tipo = 'participante'),
  240, 'carga recalculada');
select isnt((select revogado_em from public.certificados where usuario_id = '00000000-0000-0000-0000-0000000000a2'), null,
  'quem perdeu a presença tem o certificado revogado (não apagado)');
select tests.login(null, 'anon');
select isnt((select revogado_em from public.validar_certificado((select f from t_cod))), null,
  'validação pública informa revogação');
select tests.logout();

select tests.login('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$delete from public.eventos where id = '10000000-0000-0000-0000-000000000001'$$,
  null, null, 'evento com certificados não pode ser excluído');
select tests.logout();

select * from finish();
rollback;
