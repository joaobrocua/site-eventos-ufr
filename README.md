# Eventos UFR

Plataforma de eventos acadêmicos da Universidade Federal de Rondonópolis: eventos com
várias atividades (palestras, minicursos, oficinas) em dias diferentes, inscrição com
escolha de atividades, vagas limitadas ou ilimitadas, check-in por QR code e painel da
organização. Alternativa mais simples à Even3.

## O que já existe (fase 1)

- **Público:** lista de eventos, página do evento com a programação por dia.
- **Inscrição:** login sem senha (código de 6 dígitos no e-mail), cadastro rápido (nome,
  RGA, curso), escolha das atividades com bloqueio de choque de horário e de vagas
  esgotadas.
- **Minha área:** inscrições, atividades escolhidas, presença registrada e QR code pessoal.
- **Painel da organização:** criar/editar eventos e atividades, publicar/encerrar, lista de
  inscritos e exportação para Excel.
- **Presença:** leitura do QR code pela câmera do celular, lista para marcar à mão ou
  digitação do código.

Ainda não: certificados, CPF, pagamento, submissão de trabalhos. Dependem de definições
da coordenação (LGPD, exigências da pró-reitoria de extensão).

## Regras importantes (ficam no banco, não só na tela)

- Vagas e choque de horário são checados em `inscrever_em_evento()` com a atividade
  travada: duas pessoas clicando ao mesmo tempo nunca pegam a mesma última vaga.
- Alunos não gravam direto nas tabelas de inscrição; só pelas funções do banco.
- Organizador é quem tem o e-mail **confirmado** cadastrado em `public.organizadores`.
- Todo horário é exibido no fuso de Rondonópolis (`America/Cuiaba`, UTC-4) via
  `src/lib/datas.ts`.

## Rodar no computador

Pré-requisitos: Node 24+, Docker Desktop aberto.

```bash
npm install
npx supabase start
```

Copie `.env.example` para `.env.local` e preencha com a `ANON_KEY` mostrada por
`npx supabase status`. Depois:

```bash
npm run dev
```

- Site: http://localhost:3000
- E-mails (código de acesso): http://127.0.0.1:55424 (Mailpit)
- Banco (Supabase Studio): http://127.0.0.1:55423

Contas de teste da organização (entre com o código que chega no Mailpit):
`coordenacao@ufr.test` (admin) e `organizacao@ufr.test`.

### Câmera no celular

A câmera só funciona em `https` ou `localhost`. Para testar o check-in no celular pela
rede local, use `npm run dev -- --experimental-https` ou um deploy.

## Comandos úteis

| Comando | O que faz |
| --- | --- |
| `npm run verificar` | tipos + lint + testes |
| `npx supabase db reset` | recria o banco local com a migration e os dados de exemplo |
| `npm run db:tipos` | regenera `src/lib/database.types.ts` após mudar o banco |

## Adicionar um organizador

No Supabase Studio (SQL Editor):

```sql
insert into public.organizadores (email, nome, papel)
values ('fulano@ufr.edu.br', 'Fulano de Tal', 'organizador');
```
