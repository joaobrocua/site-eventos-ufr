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
  ('Sessão de apresentações orais', 'Apresentação dos trabalhos aprovados.', 'apresentacao',
     'Autores dos trabalhos', 'Sala 20',
     '2026-11-11 14:00:00-04', '2026-11-11 17:00:00-04', null::int, 180),
  ('Mesa-redonda: Pesquisa e extensão', 'Experiências de projetos do campus.', 'mesa_redonda',
     'Professores convidados', 'Auditório central',
     '2026-11-11 19:00:00-04', '2026-11-11 21:00:00-04', null::int, 120),
  ('Minicurso: Planilhas para a vida acadêmica', 'Fórmulas, gráficos e organização de dados.', 'minicurso',
     'Prof. Carlos Lima', 'Laboratório 1',
     '2026-11-12 08:00:00-04', '2026-11-12 12:00:00-04', 2, 240)
) as a(titulo, descricao, tipo, palestrantes, local, inicio, fim, vagas, carga);

-- Submissão de trabalhos aberta na Semana Acadêmica.
update public.eventos
set submissoes_abertas = true,
    submissoes_ate = '2026-11-05 23:59:00-04',
    areas_tematicas = array['Engenharias', 'Ciências Exatas', 'Ciências Humanas', 'Saúde'],
    submissao_instrucoes = 'Envie um resumo expandido de até 2 páginas em PDF. '
      || 'Trabalhos aprovados serão apresentados na Sessão de apresentações orais.'
where slug = 'semana-academica-2026';

-- Certificado: assinaturas (nomes fictícios) e equipe.
update public.eventos
set certificado_assinaturas = '[{"nome": "Coordenação do Curso (exemplo)", "cargo": "Coordenador(a) do Curso"},
                               {"nome": "Comissão Organizadora (exemplo)", "cargo": "Presidente da Comissão"}]'::jsonb,
    certificado_promotor = 'Coordenação do Curso (exemplo)'
where slug = 'semana-academica-2026';

insert into public.equipe_evento (evento_id, nome, email, tipo, funcao, atividade_id, carga_horaria_minutos)
select e.id, 'Ana Souza (exemplo)', 'ana.souza@ufr.test', 'palestrante', 'Ministrante do minicurso', a.id, 240
from public.eventos e join public.atividades a on a.evento_id = e.id
where e.slug = 'semana-academica-2026' and a.titulo like 'Minicurso: Introdução%';

insert into public.equipe_evento (evento_id, nome, tipo, funcao, carga_horaria_minutos)
select e.id, 'Monitor de Exemplo', 'organizacao', 'Monitor(a)', 720
from public.eventos e where e.slug = 'semana-academica-2026';

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
