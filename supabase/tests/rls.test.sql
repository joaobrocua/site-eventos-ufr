-- Testes de segurança e regras do banco. Rodar: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------- helpers ----------
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
 ('00000000-0000-0000-0000-0000000000c1','org@t.test', now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c2','adm@t.test', now(), '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c3','falso@t.test', null,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated');
insert into public.organizadores (email, papel) values
 ('org@t.test','organizador'), ('adm@t.test','admin'), ('falso@t.test','organizador');
insert into public.perfis (id, nome_completo, email) values
 ('00000000-0000-0000-0000-0000000000a1','Aluno A',''),
 ('00000000-0000-0000-0000-0000000000a2','Aluno B','');
insert into public.eventos (id, slug, titulo, data_inicio, data_fim, status) values
 ('10000000-0000-0000-0000-000000000001','t-pub','Publicado','2099-11-10','2099-11-12','publicado'),
 ('10000000-0000-0000-0000-000000000002','t-enc','Encerrado','2025-01-01','2025-01-02','encerrado'),
 ('10000000-0000-0000-0000-000000000003','t-rasc','Rascunho','2099-12-01','2099-12-02','rascunho');
insert into public.atividades (id, evento_id, titulo, inicio, fim, vagas, carga_horaria_minutos) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Com 1 vaga','2099-11-10 08:00-04','2099-11-10 10:00-04',1,120),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Choca com a 1','2099-11-10 09:00-04','2099-11-10 11:00-04',null,120),
 ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','Do encerrado','2025-01-01 08:00-04','2025-01-01 10:00-04',null,120),
 ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000003','Do rascunho','2099-12-01 08:00-04','2099-12-01 10:00-04',null,120),
 ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','Já passou','2020-01-01 08:00-04','2020-01-01 10:00-04',null,120);
-- inscrições "plantadas" (como postgres) para testar presença
insert into public.inscricoes (id, evento_id, usuario_id, codigo) values
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a2','codigo-enc'),
 ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000a2','codigo-rasc');

-- ---------- Regra 1: vagas e choque ----------
select tests.login('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$select public.inscrever_em_evento('10000000-0000-0000-0000-000000000001','{20000000-0000-0000-0000-000000000001}')$$,
  'A se inscreve na atividade de 1 vaga');
select throws_ok($$select public.inscrever_em_evento('10000000-0000-0000-0000-000000000001','{20000000-0000-0000-0000-000000000002}')$$,
  null, null, 'choque de horário é barrado');
select throws_ok($$select public.inscrever_em_evento('10000000-0000-0000-0000-000000000001','{20000000-0000-0000-0000-000000000003}')$$,
  null, null, 'atividade de outro evento é barrada');
select throws_ok($$select public.inscrever_em_evento('10000000-0000-0000-0000-000000000001','{20000000-0000-0000-0000-000000000005}')$$,
  null, null, 'atividade que já terminou é barrada');
select tests.logout();
select tests.login('00000000-0000-0000-0000-0000000000a2');
select throws_ok($$select public.inscrever_em_evento('10000000-0000-0000-0000-000000000001','{20000000-0000-0000-0000-000000000001}')$$,
  null, null, 'B não leva a última vaga já ocupada');
select throws_ok($$select public.inscrever_em_evento('10000000-0000-0000-0000-000000000003')$$,
  null, null, 'inscrever em rascunho é barrado');
select tests.logout();

-- ---------- Regra 2: sem escrita direta ----------
select tests.login('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$insert into public.inscricoes (evento_id, usuario_id) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'aluno não insere em inscricoes');
select throws_ok($$update public.inscricoes_atividades set presente_em = now()$$,
  '42501', null, 'aluno não atualiza inscricoes_atividades');
select throws_ok($$delete from public.inscricoes$$, '42501', null, 'aluno não apaga inscricoes');
select throws_ok($$truncate public.auditoria$$, '42501', null, 'aluno não faz TRUNCATE');
select tests.logout();
select tests.login('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$insert into public.inscricoes (evento_id, usuario_id) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a2')$$,
  '42501', null, 'organizador também não insere direto em inscricoes');
select tests.logout();

-- ---------- Regra 3: organizador = e-mail confirmado ----------
select tests.login('00000000-0000-0000-0000-0000000000c3');
select is(public.eh_organizador(), false, 'e-mail NÃO confirmado não herda papel');
select tests.logout();
select tests.login('00000000-0000-0000-0000-0000000000c1');
select is(public.meu_papel(), 'organizador', 'organizador confirmado');
select throws_ok($$insert into public.organizadores (email) values ('x@t.test')$$, '42501', null,
  'organizador não escreve em organizadores');
select tests.logout();
select tests.login('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$insert into public.organizadores (email) values ('a@t.test')$$, '42501', null,
  'aluno não vira organizador');
select is((select count(*) from public.organizadores)::int, 0, 'aluno não enxerga a lista de organizadores');
select tests.logout();

-- ---------- Regra 4: QR (inscricoes.codigo) ----------
select tests.login('00000000-0000-0000-0000-0000000000a2');
select is((select count(*) from public.inscricoes where usuario_id <> '00000000-0000-0000-0000-0000000000a2')::int, 0,
  'B não vê inscrições/códigos de outros');
select tests.logout();
select is((select length(codigo) from public.inscricoes where usuario_id = '00000000-0000-0000-0000-0000000000a1' limit 1), 32,
  'codigo gerado tem 32 hex (128 bits)');

-- ---------- Regra 5: anônimo ----------
select tests.login(null, 'anon');
select is((select count(*) from public.eventos where status = 'rascunho')::int, 0, 'anon não vê rascunho');
select is((select count(*) from public.atividades where evento_id = '10000000-0000-0000-0000-000000000003')::int, 0,
  'anon não vê atividades de rascunho');
select throws_ok($$select count(*) from public.perfis$$, '42501', null, 'anon não lê perfis');
select throws_ok($$select count(*) from public.inscricoes$$, '42501', null, 'anon não lê inscricoes');
select throws_ok($$insert into public.eventos (slug,titulo,data_inicio,data_fim) values ('x','xxx','2026-01-01','2026-01-01')$$,
  '42501', null, 'anon não cria evento');
select ok((select count(*) from public.vagas_por_atividade('10000000-0000-0000-0000-000000000001')) = 3,
  'anon vê vagas do evento publicado');
select tests.logout();

-- ---------- Regra 6: aluno vê só o seu; organizador vê todos ----------
select tests.login('00000000-0000-0000-0000-0000000000a1');
select is((select count(*) from public.perfis)::int, 1, 'aluno vê só o próprio perfil');
select throws_ok($$update public.perfis set id = '00000000-0000-0000-0000-0000000000a2' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'aluno não troca o id do perfil');
select tests.logout();
select tests.login('00000000-0000-0000-0000-0000000000c1');
select is((select count(*) from public.perfis
           where id in ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2'))::int, 2,
  'organizador vê todos os perfis');
select tests.logout();

-- ---------- Regra 7: auditoria só admin lê ----------
select tests.login('00000000-0000-0000-0000-0000000000c1');
select lives_ok($$select public.registrar_auditoria('exportacao_teste')$$, 'organizador grava auditoria');
select throws_ok($$select public.registrar_auditoria('Ação <livre>')$$, null, null, 'ação de auditoria fora do padrão é recusada');
select is((select count(*) from public.auditoria)::int, 0, 'organizador comum não lê auditoria');
select tests.logout();
select tests.login('00000000-0000-0000-0000-0000000000c2');
select ok((select count(*) from public.auditoria) >= 1, 'admin lê auditoria');
select tests.logout();

-- ---------- Funções internas não executáveis ----------
select tests.login('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$select public._adicionar_atividades('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','{}')$$,
  '42501', null, 'aluno não executa _adicionar_atividades');
select tests.logout();

-- ---------- Grants perigosos ----------
select is((select count(*) from information_schema.role_table_grants
           where table_schema='public' and grantee in ('anon','authenticated')
             and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER'))::int, 0,
  'anon/authenticated sem TRUNCATE/REFERENCES/TRIGGER');

-- ---------- Integridade ----------
select tests.login('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$update public.atividades set evento_id = '10000000-0000-0000-0000-000000000002' where id = '20000000-0000-0000-0000-000000000001'$$,
  null, null, 'não move atividade com inscritos para outro evento');
select throws_ok($$update public.atividades set vagas = 0 where id = '20000000-0000-0000-0000-000000000001'$$,
  null, null, 'vagas não ficam abaixo dos inscritos');
select throws_ok($$delete from public.atividades where id = '20000000-0000-0000-0000-000000000001'$$,
  null, null, 'não exclui atividade com inscritos');
select throws_ok($$delete from public.eventos where id = '10000000-0000-0000-0000-000000000001'$$,
  null, null, 'não exclui evento com inscritos');
select lives_ok($$delete from public.atividades where id = '20000000-0000-0000-0000-000000000002'$$,
  'exclui atividade sem inscritos');
select throws_ok($$select * from public.registrar_presenca('codigo-enc','20000000-0000-0000-0000-000000000003', true)$$,
  null, null, 'presença não é registrada em evento encerrado');
select throws_ok($$select * from public.registrar_presenca('codigo-rasc','20000000-0000-0000-0000-000000000004', true)$$,
  null, null, 'presença não é registrada em evento rascunho');
insert into public.eventos (slug, titulo, data_inicio, data_fim, criado_por)
  values ('t-forj','Forjado','2026-01-01','2026-01-01','00000000-0000-0000-0000-0000000000a1');
-- criado_por não é legível pela API (nem para organizador): confere como superusuário.
select throws_ok($$select criado_por from public.eventos where slug = 't-forj'$$,
  '42501', null, 'criado_por não é legível pela API');
select tests.logout();
select is((select criado_por from public.eventos where slug = 't-forj'), '00000000-0000-0000-0000-0000000000c1'::uuid,
  'criado_por não pode ser forjado');

-- Colunas de eventos: anon lê as públicas, mas não criado_por nem select *.
select tests.login(null, 'anon');
select lives_ok($$select id, slug, titulo, certificados_liberados_em from public.eventos$$,
  'anon lê as colunas públicas de eventos');
select throws_ok($$select criado_por from public.eventos$$, '42501', null, 'anon não lê criado_por');
select throws_ok($$select * from public.eventos$$, '42501', null, 'select * em eventos é recusado');
select tests.logout();

select * from finish();
rollback;
