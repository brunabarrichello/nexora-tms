# Wave 0021 — Negociação complementar

## Objetivo

Adicionar colaboração persistente à negociação — threads, participantes e mensagens — sem duplicar os agregados comerciais canônicos já existentes.

## Baseline de entrada

- Wave 0020 concluída;
- Matching persistente e explicável disponível;
- `freight_proposals` permanece a fonte canônica de propostas e contrapropostas;
- `capacity_reservations` permanece a fonte canônica de capacidade aceita;
- `transport_contracts` permanece a fonte canônica de contratação;
- cadeia Drizzle de entrada: 21 migrations.

## Migration

- migration: `0021_dizzy_longshot`;
- tipo: aditiva;
- journal esperado após a Wave: 22 migrations;
- não contém `DROP`, `TRUNCATE` ou renomeação destrutiva.

Durante o gate de PR foi identificado um problema de ordenação gerado na migration: a FK composta de `negotiation_messages` para `freight_proposals` era criada antes da unique composta referenciada. A correção preservou o schema e alterou somente a ordem das statements. A cadeia completa `0000 → 0021` foi então reproduzida com sucesso em PostgreSQL/Neon real e novamente pelo migrador oficial Drizzle.

## Tabelas

### `negotiation_threads`

Canal de colaboração de uma `transport_request`.

Principais responsabilidades:

- subject;
- status `open | closed | cancelled`;
- membership criadora;
- membership responsável pelo fechamento;
- timestamps de criação, atualização e fechamento.

### `negotiation_participants`

Participantes internos e externos de uma thread.

- internos referenciam membership tenant-scoped;
- externos referenciam business party e contato opcional;
- papéis: `operator`, `commercial`, `carrier`, `driver`, `observer`;
- entrada/saída por `joined_at` e `left_at`;
- nenhuma exclusão física pelo runtime.

### `negotiation_messages`

Histórico append-only de mensagens, notas e eventos de sistema.

- autoria por participant;
- referência opcional a freight proposal do mesmo request;
- reply opcional para mensagem da mesma thread;
- runtime sem UPDATE/DELETE.

## Integridade de replies

A migration cria:

- função `enforce_negotiation_message_reply_scope()`;
- trigger `negotiation_messages_reply_scope_trigger`.

Uma reply fora do tenant/thread é rejeitada com integridade no PostgreSQL, mesmo que outro caminho de escrita tente contornar a validação da API.

## RLS e privilégios runtime

Todas as três tabelas têm RLS baseada em `app.tenant_id`.

| Tabela | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `negotiation_threads` | sim | sim | sim | não |
| `negotiation_participants` | sim | sim | sim | não |
| `negotiation_messages` | sim | sim | não | não |

## API

Base: `/api/v1/negotiation`

- `GET /requests/:requestId/threads`;
- `POST /requests/:requestId/threads`;
- `GET /threads/:threadId`;
- `POST /threads/:threadId/status`;
- `GET /threads/:threadId/participants`;
- `POST /threads/:threadId/participants`;
- `POST /threads/:threadId/participants/:participantId/remove`;
- `GET /threads/:threadId/messages`;
- `POST /threads/:threadId/messages`.

### Regras de serviço

- mutations de negociação exigem request em `ready_for_quote` ou `in_negotiation` quando aplicável;
- o usuário atual precisa de membership ativa;
- criador da thread entra automaticamente como `operator` interno;
- mensagens só podem ser criadas por participante interno ativo;
- thread fechada/cancelada rejeita novos participantes e mensagens;
- último participante interno ativo não pode ser removido;
- participante externo precisa de business party ativa e contato ativo quando informado;
- payload público não aceita `system` como kind de mensagem;
- related proposal precisa pertencer ao mesmo request;
- reply precisa pertencer à mesma thread.

## Testes e gates

### CI

Valida:

- production dependency audit;
- lint;
- Prettier;
- typecheck;
- testes;
- build;
- Docker Compose model;
- geração/check dos artefatos Drizzle;
- confirmação de artefatos versionados.

### Neon Database Gate

Reproduz a cadeia completa até 0021 e preserva todas as regressões de RLS, grants, reservations, contracts e FKs tenant-aware.

### Neon Negotiation Gate

Valida:

- existência das três tabelas;
- RLS;
- grants mutáveis versus append-only;
- trigger de reply scope;
- isolamento entre dois tenants;
- reply válida dentro da thread;
- rejeição de reply cross-thread;
- cleanup da branch efêmera.

### API Negotiation Collaboration Neon Gate

Compila a API e executa `NegotiationCollaborationService` usando uma conexão real `nexora_app` em branch Neon isolada.

Valida:

- criação da thread e membership autora;
- participante interno automático;
- participante externo;
- mensagem e note/reply;
- remoção lógica do participante externo;
- invisibilidade da thread sob contexto de outro tenant;
- fechamento da thread;
- rejeição de nova mensagem e participante após fechamento.

### Gates de regressão

Permanecem obrigatórios:

- API Tenant Neon Gate;
- API OIDC Identity Neon Gate;
- Neon Documents Gate;
- Neon Freight Normalization Gate;
- Neon Matching Gate.

## Frontend relacionado

As páginas de negociação foram evoluídas em PR independente antes desta migration, mantendo frontend e mudança física do banco desacoplados.

## ADR

Ver `ADR-0018 — Colaboração de negociação, threads e mensagens append-only`.

## Promoção

Sequência permitida após merge e CI verde da `main`:

`main → development → staging`

`production` permanece fora desta Wave até promoção explicitamente aprovada.

## Próxima Wave

Wave 0022 — Viagens Core:

- `trips`;
- `trip_transport_requests`;
- `trip_stops`;
- `trip_drivers`;
- `trip_assets`;
- `trip_status_history`.

A implementação deve reutilizar requests, drivers, capacity assets, reservations e contracts canônicos e evitar raízes paralelas.
