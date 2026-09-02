# NEX-55 — Processamento assíncrono, retries e idempotência

## Objetivo

Fechar a story NEX-55 sem duplicar as fundações já entregues em NEX-90/NEX-91.

NEX-90 continua sendo o contrato persistente de Transactional Outbox + Durable Jobs; NEX-91 continua sendo o runtime Worker. NEX-55 conecta essas capacidades aos intents operacionais de NEX-54 e acrescenta a superfície administrativa segura que faltava para operação de dead letters.

## Base reutilizada

Já existente antes do NEX-55:

- `outbox_events` e `durable_jobs`;
- idempotency key única por tenant;
- atomic claim com `FOR UPDATE SKIP LOCKED`;
- bounded exponential retry;
- `last_error` e dead-letter lógico;
- lease recovery/reaper;
- owner-only requeue primitives;
- Worker com polling, concurrency, timeout, handlers, health/readiness e telemetria.

NEX-55 não cria uma fila paralela e não introduz broker.

## Worker para intents NEX-54

O handler registry padrão passa a reconhecer:

- `freight.transport_request.created`;
- `negotiation.transport_contract.confirmed`;
- `trips.status.changed`;
- `documents.validation.recorded`.

Esses intents já tiveram a projeção in-app persistida atomicamente pelo NEX-54. O Worker valida que o payload possui `channel=in_app` e `contextUrl` interno, registra acknowledgement estruturado e conclui o Outbox.

O handler é idempotente porque não repete a projeção da inbox nem executa efeito externo. Payload inválido falha normalmente e entra no mecanismo de retry/dead-letter em vez de ser descartado silenciosamente.

## Administração

Base API:

`/api/v1/admin/async`

Consultas (`audit.read`):

- `GET /outbox`;
- `GET /jobs`.

Filtros incluem estado/tipo e limite. As projeções exibem:

- tenant-scoped entity/event/job identity;
- attempts/max attempts;
- idempotency key;
- correlation/request IDs;
- lease/lock state;
- last error/dead-letter reason;
- timestamps de disponibilidade, execução e conclusão.

Reprocessamento (`tenant.manage`):

- `POST /outbox/:eventId/reprocess`;
- `POST /jobs/:jobId/reprocess`.

Body:

```json
{
  "reason": "motivo administrativo obrigatório"
}
```

Somente dead letters são elegíveis.

## Boundary privilegiado

O `nexora_app` continua **sem** `EXECUTE` direto em:

- `nexora_requeue_dead_lettered_outbox_event(...)`;
- `nexora_requeue_dead_lettered_job(...)`.

Migration `0044_nex55_async_admin_reprocessing.sql` adiciona wrappers `SECURITY DEFINER`:

- `nexora_admin_requeue_outbox_event(uuid,text)`;
- `nexora_admin_requeue_durable_job(uuid,text)`.

Antes de delegar à primitive owner-only, o PostgreSQL exige:

- `app.tenant_id`;
- `app.user_id`;
- tenant correto;
- membership ativa;
- usuário ativo;
- role `tenant_admin` ativa;
- item no estado dead-letter;
- motivo de 3–500 caracteres.

Isso fornece defesa em profundidade além do `tenant.manage` aplicado no controller.

O runtime não recebe `UPDATE`/`DELETE` direto nas tabelas async.

## Auditoria

O requeue original do NEX-90 continua emitindo:

- `async.outbox.requeued`;
- `async.job.requeued`.

O wrapper NEX-55 adiciona a decisão humana:

- `async.outbox.reprocess_requested`;
- `async.job.reprocess_requested`.

Esses eventos retêm:

- actor user;
- tenant;
- entity ID;
- correlation/request ID;
- idempotency key;
- motivo;
- tipo do evento/job e estado anterior relevante.

## Web

Nova rota:

`/administracao/integracoes/processamento`

Mostra Outbox e Durable Jobs com filtros, tentativas, correlação, idempotência, erros e dead letters. Reprocessamento exige motivo e é explicitamente uma operação de Tenant Admin.

## Gate Neon

`Neon Async Admin Gate` prova em branch efêmera:

1. replay completo das migrations até `0044`;
2. wrappers protegidos e least privilege;
3. `nexora_app` sem acesso direto às primitives owner-only;
4. fixtures em dois tenants e perfis admin/não-admin;
5. primeiro claim/failure → `retry_wait`;
6. segundo claim/failure → `dead_lettered`;
7. não-admin bloqueado pelo PostgreSQL;
8. cross-tenant invisível/bloqueado;
9. Tenant Admin reprocessa sem alterar idempotency key;
10. Worker reclama novamente e conclui com sucesso;
11. mesmo ciclo para Durable Job;
12. auditoria completa de retry, dead-letter, requeue, pedido administrativo e sucesso;
13. Worker default registry reconhece os quatro intents de NEX-54;
14. cleanup da branch Neon.

Production permanece congelada durante toda a qualificação.
