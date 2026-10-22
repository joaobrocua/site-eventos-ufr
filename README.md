# Eventos UFR

Plataforma de eventos acadêmicos da Universidade Federal de Rondonópolis: eventos com
várias atividades (palestras, minicursos, oficinas) em dias diferentes, inscrição com
escolha de atividades, vagas limitadas ou ilimitadas, check-in por QR code e painel da
organização. Alternativa mais simples à Even3.

> **Aviso:** este é um projeto desenvolvido por estudantes da UFR e **ainda não é um sistema
> oficial da Universidade Federal de Rondonópolis**. O nome e o logo da UFR são marcas da
> universidade e aparecem aqui apenas para identificar o contexto do projeto. Certificados
> emitidos por instalações de teste ou de desenvolvimento não têm validade oficial.
>
> Os dados presentes no repositório (alunos, organizadores, e-mails `*.test`) são fictícios.

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

## Fase 2

- **Lista de espera automática:** atividade lotada aceita fila. Quando alguém desiste,
  cancela ou a organização aumenta as vagas, o primeiro da fila entra sozinho e recebe
  e-mail. Um lugar na fila conta como horário ocupado (não dá para pegar outra atividade
  no mesmo horário).
- **Submissão de trabalhos:** a organização abre o envio (prazo, instruções, áreas
  temáticas); o participante envia título, resumo, coautores e PDF (até 10 MB); a
  organização aprova ou não (o autor recebe e-mail) e coloca os aprovados em sessões de
  apresentação, que aparecem na programação.
- **E-mails:** ficam numa fila no banco e saem logo após a ação (`after()`); a rota
  `/api/cron/emails` reenvia pendentes (uma vez por dia na Vercel gratuita).

## Certificados

- Um certificado por participante por evento (atividades com presença e carga horária
  total), mais certificados da equipe (palestrantes/ministrantes e organização/monitores).
- A organização revisa as presenças e **libera** depois que todas as atividades terminam;
  pode liberar de novo após correções (o código não muda; quem perdeu o direito é revogado).
- PDF no padrão visual da UFR, com QR code e código de validação (`XXXX-XXXX-XXXX`);
  qualquer pessoa confere a autenticidade em `/certificados/validar`.
- Nome, documento, atividades e horas ficam congelados na emissão. Exemplos (dados
  fictícios) em [`docs/exemplos`](docs/exemplos).

Ainda não: CPF no certificado, imagem de assinatura, pagamento, avaliação por pares e
anais. Dependem de definições da coordenação (LGPD, exigências da pró-reitoria de
extensão, conta de recebimento).

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

Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_ANON_KEY` e
`SUPABASE_SERVICE_ROLE_KEY` com os valores de `npx supabase status` (a service role é só
do servidor: usada apenas pela fila de e-mails). Depois:

```bash
npm run dev
```

- Site: http://localhost:3000
- E-mails (código de acesso, vaga liberada, resultado de trabalho): http://127.0.0.1:55424 (Mailpit)
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
