-- Dados de exemplo para desenvolvimento local (supabase db reset).
-- E-mails de teste no domínio .test: nunca recebem e-mail de verdade; o código
-- de acesso aparece no Mailpit (http://127.0.0.1:55424).

insert into public.organizadores (email, nome, papel) values
  ('coordenacao@ufr.test', 'Coordenação (teste)', 'admin'),
  ('organizacao@ufr.test', 'Organização (teste)', 'organizador');

-- Horários em America/Cuiaba (UTC-4).
with ev as (
  insert into public.eventos
    (slug, titulo, resumo, descricao, local, data_inicio, data_fim, status, inscricoes_abertas)
  values (
    'semana-academica-2026',
    'Semana Acadêmica 2026',
    'Três dias de palestras, minicursos e oficinas para toda a comunidade acadêmica.',
    'A Semana Acadêmica reúne estudantes, professores e profissionais da área para '
    || 'palestras, minicursos práticos e oficinas. Escolha as atividades que quer fazer: '
    || 'as vagas dos minicursos e oficinas são limitadas.',
    'Campus UFR — Rondonópolis/MT',
    date '2026-11-10', date '2026-11-12',
    'publicado', true
  )
  returning id
)
insert into public.atividades
  (evento_id, titulo, descricao, tipo, palestrantes, local, inicio, fim, vagas, carga_horaria_minutos)
select ev.id, a.titulo, a.descricao, a.tipo, a.palestrantes, a.local,
       a.inicio::timestamptz, a.fim::timestamptz, a.vagas, a.carga
from ev, (values
  ('Abertura e palestra magna', 'Abertura oficial da Semana Acadêmica.', 'palestra',
     'Coordenação do curso', 'Auditório central',
     '2026-11-10 08:00:00-04', '2026-11-10 10:00:00-04', null::int, 120),
  ('Minicurso: Introdução ao Python', 'Do zero ao primeiro script. Traga seu notebook.', 'minicurso',
     'Profa. Ana Souza', 'Laboratório 3',
     '2026-11-10 14:00:00-04', '2026-11-10 18:00:00-04', 30, 240),
  ('Oficina: Currículo e LinkedIn', 'Como apresentar sua trajetória acadêmica.', 'oficina',
     'Carreiras UFR', 'Sala 12',
     '2026-11-10 14:00:00-04', '2026-11-10 16:00:00-04', 25, 120),
  ('Mesa-redonda: Pesquisa e extensão', 'Experiências de projetos do campus.', 'mesa_redonda',
     'Professores convidados', 'Auditório central',
     '2026-11-11 19:00:00-04', '2026-11-11 21:00:00-04', null::int, 120),
  ('Minicurso: Planilhas para a vida acadêmica', 'Fórmulas, gráficos e organização de dados.', 'minicurso',
     'Prof. Carlos Lima', 'Laboratório 1',
     '2026-11-12 08:00:00-04', '2026-11-12 12:00:00-04', 2, 240)
) as a(titulo, descricao, tipo, palestrantes, local, inicio, fim, vagas, carga);

insert into public.eventos
  (slug, titulo, resumo, local, data_inicio, data_fim, status)
values (
  'jornada-de-extensao-2026',
  'Jornada de Extensão 2026',
  'Rascunho: ainda não aparece para o público.',
  'Campus UFR — Rondonópolis/MT',
  date '2026-12-03', date '2026-12-03',
  'rascunho'
);
