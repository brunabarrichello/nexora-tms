# NEX-54 — Notificações in-app operacionais

## Objetivo

Entregar uma caixa de notificações interna, tenant-safe e por usuário para eventos operacionais essenciais do Nexora TMS, sem acoplar cargas, negociação, viagens ou documentos a provedores externos.

NEX-54 cobre somente o canal **in-app**. Processamento assíncrono/reprocessamento administrativo pertence ao NEX-55; API externa/webhooks ao NEX-56; e-mail, WhatsApp e SMS ao NEX-57.

## Modelo

### `in_app_notification_events`

Registro imutável do evento que originou uma notificação interna.

Principais campos:

- `event_key`: chave idempotente por tenant;
- `event_type` e `event_version`;
- `module`: `freight`, `negotiation`, `trips` ou `documents`;
- `aggregate_type` e `aggregate_id`;
- `title`, `body`, `severity`;
- `context_url`: rota interna do Nexora;
- `target_role_codes`: perfis destinatários resolvidos no momento da emissão;
- `payload`: metadados do domínio;
- `outbox_event_id`: correlação com Transactional Outbox;
- `actor_user_id`.

Eventos não podem ser atualizados ou apagados.

### `in_app_notification_deliveries`

Projeção por destinatário.

Cada linha representa uma entrega interna para um usuário específico e registra:

- evento de origem;
- usuário destinatário;
- `delivered_at`;
- `read_at`.

A única mutação permitida ao runtime é preencher `read_at`. Uma notificação lida não volta para não lida.

## Targeting

A função protegida `nexora_emit_in_app_notification` resolve destinatários usando o modelo IAM canônico:

`tenant → memberships ativas → users ativos → membership_roles → roles`.

A mesma pessoa com múltiplos roles recebe uma única entrega para o evento.

Memberships `invited`, `suspended` ou `revoked` e usuários `suspended`/`disabled` não recebem novas entregas.

## Isolamento

RLS possui granularidade de tenant **e usuário**:

- um usuário só lista deliveries cujo `user_id = app.user_id`;
- um evento só é visível quando existe uma delivery desse evento para o usuário atual;
- um usuário não consegue marcar a delivery de outro como lida;
- dados de outro tenant não são visíveis.

O papel `nexora_app` não possui INSERT/DELETE direto nas tabelas de notificações.

## Idempotência e Outbox

A emissão usa a mesma transação PostgreSQL do evento de negócio.

Para cada `event_key`:

1. registra uma linha em `outbox_events` com `idempotency_key = in-app:<event_key>`;
2. registra um `in_app_notification_event`;
3. projeta as deliveries dos destinatários.

Repetir a mesma emissão não cria novo Outbox, novo evento ou novas deliveries.

O Outbox permanece disponível para NEX-55/NEX-57 consumirem efeitos assíncronos futuros sem mudar o contrato dos módulos de negócio.

## Catálogo v1

| Evento                                     | Origem                            | Perfis                                                        | Link           |
| ------------------------------------------ | --------------------------------- | ------------------------------------------------------------- | -------------- |
| `freight.transport_request.created`        | nova solicitação de transporte    | Tenant Admin, Operations Manager, Dispatcher                  | `/cargas`      |
| `negotiation.transport_contract.confirmed` | contratação confirmada            | Tenant Admin, Operations Manager, Dispatcher, Finance Manager | `/negociacoes` |
| `trips.status.changed`                     | transição de status da viagem     | Tenant Admin, Operations Manager, Dispatcher                  | `/viagens`     |
| `documents.validation.recorded`            | resultado de validação documental | Tenant Admin, Operations Manager, Dispatcher                  | `/documentos`  |

Os produtores são triggers transacionais e só emitem quando `app.tenant_id` e `app.user_id` estão presentes. Inserts administrativos/seeds sem contexto de runtime permanecem neutros.

## API

Base: `/api/v1/notifications`.

- `GET /` — lista a própria inbox; filtros `state`, `module`, `limit`;
- `GET /unread-count` — total não lido do usuário atual;
- `PATCH /:notificationId/read` — marca a própria delivery como lida.

Todas as rotas exigem membership/autorização de tenant (`tenant.read`). RLS fornece defesa adicional por usuário.

Não existe endpoint de criação manual de notificações.

## Web

`/notificacoes` apresenta:

- contador de não lidas;
- filtros por estado e módulo;
- título e corpo;
- origem e severidade;
- estado lida/não lida;
- link para contexto relacionado;
- ação para marcar como lida.

A tela não expõe preferências ou canais externos porque pertencem ao NEX-57.

## Qualificação

O `Neon In-App Notifications Gate` deve provar em branch efêmera:

- replay completo das migrations `0041/0042`;
- RLS e least privilege;
- função protegida de emissão;
- presença dos quatro produtores de domínio;
- targeting por role;
- deduplicação do evento/Outbox/deliveries;
- leitura independente por usuário;
- bloqueio cross-user;
- isolamento cross-tenant;
- cleanup da branch Neon.

Production permanece congelada durante toda a qualificação.
