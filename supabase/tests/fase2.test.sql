-- Fase 2: lista de espera, fila de e-mails e trabalhos. Rodar: npx supabase test db
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
 ('00000000-0000-0000-0000-0000000000a3','c@t.test', now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000a4','d@t.test', now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c1','org@t.test', now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated');
insert into public.organizadores (email, papel) values ('org@t.test','organizador');
insert into public.perfis (id, nome_completo, email) values
 ('00000000-0000-0000-0000-0000000000a1','Aluno A',''),
 ('00000000-0000-0000-0000-0000000000a2','Aluno B',''),
 ('00000000-0000-0000-0000-0000000000a3','Aluno C',''),
 ('00000000-0000-0000-0000-0000000000a4','Aluno D','');
insert into public.eventos (id, slug, titulo, data_inicio, data_fim, status, submissoes_abertas, areas_tematicas) values
 ('10000000-0000-0000-0000-000000000001','f2-pub','Evento F2','2099-11-10','2099-11-12','publicado', true, '{Engenharias,Saúde}'),
 ('10000000-0000-0000-0000-000000000002','f2-fechado','Sem submissão','2099-11-10','2099-11-12','publicado', false, '{}');
insert into public.atividades (id, evento_id, titulo, tipo, inicio, fim, vagas, carga_horaria_minutos) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Lotada (1 vaga)','minicurso','2099-11-10 08:00-04','2099-11-10 10:00-04',1,120),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Choca com a lotada','oficina','2099-11-10 09:00-04','2099-11-10 11:00-04',null,120),
 ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Sessão de apresentações','apresentacao','2099-11-11 14:00-04','2099-11-11 17:00-04',null,180),
 ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','Palestra','palestra','2099-11-12 08:00-04','2099-11-12 10:00-04',null,120);

-- ---------- Lista de espera ----------
select tests.login('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$select public.inscrever_em_evento('10000000-0000-0000-0000-000000000001','{20000000-0000-0000-0000-000000000001}')$$,
  'A pega a única vaga');
select throws_ok($$select public.entrar_lista_espera('20000000-0000-0000-0000-000000000001')$$,
  null, null, 'quem já está inscrito não entra na fila da mesma atividade');
select tests.logout();

select tests.login('00000000-0000-0000-0000-0000000000a2');
select throws_ok($$select public.inscrever_em_evento('10000000-0000-0000-0000-000000000001','{20000000-0000-0000-0000-000000000001}')$$,
  null, null, 'B não consegue a vaga lotada');
select is(public.entrar_lista_espera('20000000-0000-0000-0000-000000000001'), 1, 'B é o 1º da fila');
select throws_ok($$select public.inscrever_em_evento('10000000-0000-0000-0000-000000000001','{20000000-0000-0000-0000-000000000002}')$$,
  null, null, 'lugar na fila conta como horário ocupado (choque)');
select is((select posicao from public.minhas_posicoes_fila('10000000-0000-0000-0000-000000000001')), 1,
  'B vê a própria posição');
select tests.logout();

select tests.login('00000000-0000-0000-0000-0000000000a3');
select is(public.entrar_lista_espera('20000000-0000-0000-0000-000000000001'), 2, 'C é o 2º da fila');
select tests.logout();

select tests.login('00000000-0000-0000-0000-0000000000a4');
select throws_ok($$select public.entrar_lista_espera('20000000-0000-0000-0000-000000000004')$$,
  null, null, 'atividade ilimitada não tem fila');
select tests.logout();

-- A desiste: B é promovido na mesma transação; ninguém de fora fura a fila.
select tests.login('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$select public.remover_atividade('20000000-0000-0000-0000-000000000001')$$, 'A desiste da vaga');
select tests.logout();
select is((select ia.status from public.inscricoes_atividades ia join public.inscricoes i on i.id = ia.inscricao_id
           where i.usuario_id = '00000000-0000-0000-0000-0000000000a2' and ia.atividade_id = '20000000-0000-0000-0000-000000000001'),
  'confirmada', 'B foi promovido automaticamente');
select is((select count(*)::int from public.notificacoes_email where usuario_id = '00000000-0000-0000-0000-0000000000a2'), 1,
  'B recebe e-mail avisando da vaga');

select tests.login('00000000-0000-0000-0000-0000000000a4');
select throws_ok($$select public.inscrever_em_evento('10000000-0000-0000-0000-000000000001','{20000000-0000-0000-0000-000000000001}')$$,
  null, null, 'D não fura a fila');
select tests.logout();
select tests.login('00000000-0000-0000-0000-0000000000a3');
select is((select posicao from public.minhas_posicoes_fila('10000000-0000-0000-0000-000000000001')), 1,
  'C passa a ser o 1º da fila');
select tests.logout();

-- Organizador aumenta as vagas: C é promovido.
select tests.login('00000000-0000-0000-0000-0000000000c1');
update public.atividades set vagas = 2 where id = '20000000-0000-0000-0000-000000000001';
select tests.logout();
select is((select ia.status from public.inscricoes_atividades ia join public.inscricoes i on i.id = ia.inscricao_id
           where i.usuario_id = '00000000-0000-0000-0000-0000000000a3' and ia.atividade_id = '20000000-0000-0000-0000-000000000001'),
  'confirmada', 'aumentar vagas promove a fila');

-- B cancela a inscrição inteira: libera a vaga; D (agora na fila) é promovido.
select tests.login('00000000-0000-0000-0000-0000000000a4');
select is(public.entrar_lista_espera('20000000-0000-0000-0000-000000000001'), 1, 'D entra na fila');
select tests.logout();
select tests.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$select public.cancelar_inscricao('10000000-0000-0000-0000-000000000001')$$, 'B cancela tudo');
select tests.logout();
select is((select ia.status from public.inscricoes_atividades ia join public.inscricoes i on i.id = ia.inscricao_id
           where i.usuario_id = '00000000-0000-0000-0000-0000000000a4' and ia.atividade_id = '20000000-0000-0000-0000-000000000001'),
  'confirmada', 'cancelar inscrição promove a fila');
select is((select fila from public.vagas_por_atividade('10000000-0000-0000-0000-000000000001')
           where atividade_id = '20000000-0000-0000-0000-000000000001'), 0, 'fila zerada');

-- ---------- Fila de e-mails ----------
select tests.login('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$select count(*) from public.notificacoes_email$$, '42501', null, 'aluno não lê a fila de e-mails');
select throws_ok($$select * from public.reservar_emails(10)$$, '42501', null, 'aluno não reserva e-mails');
select tests.logout();
select tests.login(null, 'anon');
select throws_ok($$select count(*) from public.notificacoes_email$$, '42501', null, 'anon não lê a fila de e-mails');
select tests.logout();
set local role service_role;
select ok((select count(*) from public.reservar_emails(100)) >= 3, 'service_role reserva os pendentes');
select is((select count(*)::int from public.reservar_emails(100)), 0, 'reservados não são entregues duas vezes');
reset role;

-- ---------- Trabalhos ----------
select tests.login('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$select public.submeter_trabalho('10000000-0000-0000-0000-000000000002','Título de teste','Resumo com tamanho suficiente para passar na validação de cinquenta caracteres.')$$,
  null, null, 'evento sem submissão aberta recusa');
select throws_ok($$select public.submeter_trabalho('10000000-0000-0000-0000-000000000001','Título de teste','Resumo com tamanho suficiente para passar na validação de cinquenta caracteres.', null, 'Inexistente')$$,
  null, null, 'área fora da lista do evento recusa');
create temp table t_trab as
  select public.submeter_trabalho('10000000-0000-0000-0000-000000000001','Título de teste',
    'Resumo com tamanho suficiente para passar na validação de cinquenta caracteres.', 'a, b', 'Engenharias', 'oral',
    '["Coautor Um", "Coautora Dois"]'::jsonb) as id;
select is((select status from public.trabalhos where id = (select id from t_trab)), 'submetido', 'trabalho enviado');
select throws_ok($$update public.trabalhos set status = 'aprovado'$$, '42501', null, 'autor não altera status direto');
select throws_ok($$select public.decidir_trabalho((select id from t_trab), 'aprovado')$$,
  null, null, 'autor não se autoaprova');
select tests.logout();

select tests.login('00000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from public.trabalhos), 0, 'outro aluno não vê o trabalho');
select tests.logout();

select tests.login('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$select public.vincular_trabalho_sessao((select id from t_trab), '20000000-0000-0000-0000-000000000003')$$,
  null, null, 'só aprovado entra na programação');
select lives_ok($$select public.decidir_trabalho((select id from t_trab), 'aprovado', 'Muito bom.')$$, 'organizador aprova');
select throws_ok($$select public.vincular_trabalho_sessao((select id from t_trab), '20000000-0000-0000-0000-000000000004')$$,
  null, null, 'não vincula a atividade que não é apresentação');
select lives_ok($$select public.vincular_trabalho_sessao((select id from t_trab), '20000000-0000-0000-0000-000000000003', 1)$$,
  'vincula à sessão de apresentações');
select tests.logout();
select is((select count(*)::int from public.notificacoes_email
           where usuario_id = '00000000-0000-0000-0000-0000000000a1' and assunto like 'Trabalho aprovado%'), 1,
  'autor recebe e-mail da aprovação');

select tests.login('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$select public.editar_trabalho((select id from t_trab),'Novo título','Resumo com tamanho suficiente para passar na validação de cinquenta caracteres.')$$,
  null, null, 'trabalho avaliado não pode ser editado');
select tests.logout();

select tests.login(null, 'anon');
select is((select autores from public.trabalhos_da_programacao('10000000-0000-0000-0000-000000000001')),
  'Aluno A, Coautor Um, Coautora Dois', 'programação pública mostra título e autores');
select throws_ok($$select count(*) from public.trabalhos$$, '42501', null, 'anon não lê a tabela de trabalhos');
select tests.logout();

-- ---------- Storage ----------
select tests.login('00000000-0000-0000-0000-0000000000a2');
create temp table t_trab_b as
  select public.submeter_trabalho('10000000-0000-0000-0000-000000000001','Trabalho do B',
    'Resumo com tamanho suficiente para passar na validação de cinquenta caracteres.', null, 'Saúde') as id;
select lives_ok(format($$insert into storage.objects (bucket_id, name) values ('trabalhos', %L)$$,
  '10000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-0000000000a2/' || (select id from t_trab_b) || '.pdf'),
  'autor envia o PDF do próprio trabalho');
select throws_ok(format($$insert into storage.objects (bucket_id, name) values ('trabalhos', %L)$$,
  '10000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-0000000000a1/' || (select id from t_trab) || '.pdf'),
  '42501', null, 'não envia arquivo no caminho de outra pessoa');
select lives_ok($$select public.confirmar_arquivo_trabalho((select id from t_trab_b))$$, 'confirma o arquivo enviado');
select tests.logout();

select tests.login('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from storage.objects where bucket_id = 'trabalhos'), 0,
  'aluno não vê o PDF de outro');
select tests.logout();
select tests.login('00000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from storage.objects where bucket_id = 'trabalhos'), 1, 'organizador vê os PDFs');
select throws_ok($$delete from public.eventos where id = '10000000-0000-0000-0000-000000000001'$$,
  null, null, 'evento com trabalhos não pode ser excluído');
select tests.logout();

-- ---------- Correções da auditoria ----------
-- Remarcar não pode criar choque para quem está na atividade.
select tests.login('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$select public.inscrever_em_evento('10000000-0000-0000-0000-000000000001','{20000000-0000-0000-0000-000000000004}')$$,
  'A se inscreve na palestra');
select tests.logout();
select tests.login('00000000-0000-0000-0000-0000000000c1');
-- A está na lotada (08–10, voltou?) não; D está confirmado na lotada. Pomos D também na palestra e remarcamos.
select tests.logout();
select tests.login('00000000-0000-0000-0000-0000000000a4');
select lives_ok($$select public.inscrever_em_evento('10000000-0000-0000-0000-000000000001','{20000000-0000-0000-0000-000000000004}')$$,
  'D se inscreve na palestra');
select tests.logout();
select tests.login('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$update public.atividades set inicio = '2099-11-10 08:30-04', fim = '2099-11-10 09:30-04' where id = '20000000-0000-0000-0000-000000000004'$$,
  null, null, 'remarcação que cria choque é recusada');
select lives_ok($$update public.atividades set inicio = '2099-11-12 09:00-04', fim = '2099-11-12 11:00-04' where id = '20000000-0000-0000-0000-000000000004'$$,
  'remarcação sem choque é aceita');
select throws_ok($$update public.atividades set tipo = 'palestra' where id = '20000000-0000-0000-0000-000000000003'$$,
  null, null, 'sessão com trabalhos não deixa de ser apresentação');
select tests.logout();

-- Assunto de e-mail sem quebra de linha; concluir_email não "des-envia".
select public._enfileirar_email('00000000-0000-0000-0000-0000000000a1', E'Título\r\nBcc: x@y.z', 'corpo');
select is((select assunto from public.notificacoes_email order by id desc limit 1), 'Título Bcc: x@y.z',
  'assunto sem caracteres de controle');
update public.notificacoes_email set enviada_em = now() where id = (select max(id) from public.notificacoes_email);
select public.concluir_email((select max(id) from public.notificacoes_email), 'erro tardio');
select isnt((select enviada_em from public.notificacoes_email order by id desc limit 1), null,
  'e-mail enviado não volta para a fila');

-- Retirar trabalho aprovado depois do encerramento: recusado.
update public.eventos set status = 'encerrado' where id = '10000000-0000-0000-0000-000000000001';
select tests.login('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$select public.retirar_trabalho((select id from t_trab))$$, null, null,
  'trabalho aprovado não é retirado com o evento encerrado');
select tests.logout();
update public.eventos set status = 'publicado' where id = '10000000-0000-0000-0000-000000000001';

-- Storage: o autor apaga o PDF só depois de retirar o trabalho.
-- (apagar de verdade só pela API do Storage; aqui testamos a regra da policy)
select tests.login('00000000-0000-0000-0000-0000000000a2');
create temp table t_pdf_b as
  select '10000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-0000000000a2/' || (select id from t_trab_b) || '.pdf' as nome;
select is(public._pode_apagar_arquivo((select nome from t_pdf_b)), false, 'PDF de trabalho em análise não pode ser apagado');
select lives_ok($$select public.retirar_trabalho((select id from t_trab_b))$$, 'B retira o trabalho');
select is(public._pode_apagar_arquivo((select nome from t_pdf_b)), true, 'depois de retirar, o autor pode apagar o PDF');
select is(public._pode_apagar_arquivo('10000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-0000000000a1/' || (select id from t_trab) || '.pdf'),
  false, 'ninguém apaga PDF de outra pessoa');
select tests.logout();

select * from finish();
rollback;
