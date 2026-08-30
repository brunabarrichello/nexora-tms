# ADR-0018 — Colaboração de negociação, threads e mensagens append-only

- Status: Accepted
- Date: 2026-08-30
- Scope: Wave 0021 — Negociação complementar

## Contexto

O Nexora TMS já possui raízes comerciais canônicas para proposta, contraproposta, reserva de capacidade e contratação: `freight_proposals`, `capacity_reservations` e `transport_contracts`.

A evolução da negociação precisa acrescentar contexto colaborativo — conversas, participantes internos/externos, notas e respostas — sem criar uma segunda fonte de verdade para valores, aceite, capacidade reservada ou contrato.

O modelo também precisa preservar isolamento multi-tenant, autoria rastreável por membership, integridade de replies e histórico de mensagens que não possa ser reescrito pelo runtime.

## Decisão

### 1. Propostas, reservas e contratos continuam canônicos

A Wave 0021 não cria agregados paralelos para preço, contraproposta, aceite ou contratação.

- proposta e contraproposta: `freight_proposals`;
- capacidade aceita: `capacity_reservations`;
- compromisso contratual: `transport_contracts`.

A colaboração apenas referencia esses agregados quando necessário.

### 2. A colaboração é organizada por thread

`negotiation_threads` representa um canal de colaboração de uma `transport_request`.

Cada thread possui subject, lifecycle `open | closed | cancelled`, criador e, quando encerrada, membership responsável e timestamp de fechamento.

Threads encerradas não aceitam novos participantes nem novas mensagens pela API.

### 3. Participantes internos e externos são explícitos

`negotiation_participants` registra quem participa da thread.

- participante interno referencia uma membership ativa do tenant;
- participante externo referencia `business_parties` e, opcionalmente, `business_party_contacts`;
- lifecycle de participação usa `joined_at` / `left_at`, sem DELETE runtime;
- o último participante interno ativo não pode ser removido enquanto a thread estiver aberta.

A criação de uma thread inclui automaticamente seu autor como participante interno com papel `operator`.

### 4. Mensagens são fatos append-only

`negotiation_messages` permite `SELECT` e `INSERT` para `nexora_app`, mas não `UPDATE` nem `DELETE`.

O cliente pode criar `message` e `note`. Mensagens `system` ficam reservadas a evoluções controladas do domínio e não podem ser forjadas pelo payload público atual.

Autoria de mensagem exige que a membership do usuário seja um participante interno ativo da thread.

### 5. Replies possuem integridade no banco

Uma reply precisa referenciar uma mensagem da mesma combinação tenant + thread.

A integridade é protegida por `enforce_negotiation_message_reply_scope()` e pelo trigger `negotiation_messages_reply_scope_trigger`, além da validação antecipada na API.

A regra permanece no banco para não depender exclusivamente de um caminho de escrita da aplicação.

### 6. Referência a proposta é contextual, não proprietária

`related_proposal_id`, quando presente, precisa apontar para uma `freight_proposal` pertencente ao mesmo tenant e à mesma `transport_request` da thread.

A relação não transfere ownership comercial à mensagem e não duplica termos da proposta.

### 7. Multi-tenancy é defesa em profundidade

As três tabelas são tenant-scoped e têm RLS baseada em `app.tenant_id`.

FKs compostas tenant-aware protegem request, membership, participant, business party/contact e proposal. A API executa por `TenantDatabaseService.withTenantContext`, definindo `app.user_id` e `app.tenant_id` dentro da transação.

### 8. Runtime usa privilégio mínimo

`nexora_app` recebe:

- threads: `SELECT`, `INSERT`, `UPDATE`;
- participants: `SELECT`, `INSERT`, `UPDATE`;
- messages: `SELECT`, `INSERT`;
- nenhum `DELETE` nas três estruturas.

## API inicial

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

Todos os endpoints usam `TenantRuntimeGateGuard`.

## Validação

A decisão é protegida por:

- CI completo: security audit, lint, formatting, typecheck, testes, build, Compose e Drizzle;
- Neon Database Gate geral;
- Neon Negotiation Gate para schema, grants, RLS e reply scope;
- API Tenant Neon Gate e API OIDC Identity Neon Gate para regressão;
- API Negotiation Collaboration Neon Gate executando o serviço compilado com `nexora_app` em Neon real;
- teste de criação de thread, participante externo, mensagens/reply, remoção de participante, RLS cross-tenant e bloqueio de mutações após fechamento.

## Consequências

### Positivas

- colaboração é persistente e auditável sem duplicar o domínio comercial;
- mensagens não podem ser reescritas pelo runtime;
- autoria interna é ligada à membership do tenant;
- referências cross-thread e cross-tenant são rejeitadas;
- futuras integrações de comunicação podem consumir a thread sem reinterpretar proposta ou contrato.

### Trade-offs

- fechamento de thread é deliberadamente terminal na versão inicial; reabertura, se necessária, exigirá decisão aditiva explícita;
- mensagens `system` ainda não possuem endpoint público;
- anexos/documentos em mensagens permanecem fora desta Wave e devem reutilizar o document core canônico.

## Próxima evolução

A Wave 0022 introduz o core de Viagens reutilizando `transport_requests`, drivers, assets, reservas e contratos existentes, sem transferir responsabilidades comerciais para o agregado de viagem.
