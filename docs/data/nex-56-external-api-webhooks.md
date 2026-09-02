# NEX-56 — API externa e webhooks

## Objetivo

O NEX-56 introduz o primeiro contrato de integração máquina-a-máquina do Nexora TMS. Ele é separado da autenticação OIDC de usuários humanos e reutiliza a infraestrutura de confiabilidade NEX-90/NEX-91 e o reprocessamento administrativo do NEX-55.

## Credenciais externas

Cada integração possui um `integration_client` tenant-scoped. A credencial entregue uma única vez usa o formato:

`nxint_<clientId>.<secret>`

A API recebe a credencial em `Authorization: Bearer ...`.

O banco nunca armazena o secret em claro. Somente o SHA-256 de 32 bytes é persistido. O endpoint administrativo de consulta não possui privilégio de leitura sobre `secret_hash`.

Clientes podem ser revogados e podem possuir expiração. Revogar um client também revoga suas subscriptions ativas.

## Scopes v1

A primeira versão suporta somente leitura e somente os scopes explícitos:

- `freight.read`
- `trips.read`
- `documents.read`

Não existe herança automática do RBAC humano. Cada rota externa exige metadata de scope e falha fechada caso a metadata esteja ausente.

## API externa versionada

Base path: `/api/external/v1`

Rotas iniciais:

- `GET /transport-requests`
- `GET /transport-requests/:id`
- `GET /trips`
- `GET /trips/:id`
- `GET /documents`
- `GET /documents/:id`

Todas respondem com envelope `{ "apiVersion": "v1", "data": ... }` e executam sob RLS do tenant resolvido pela credencial. Dados internos como storage keys, metadados sensíveis de documento, segredos e dados de autenticação não entram no contrato externo.

## Administração

Base path interno: `/api/v1/integrations`.

Leituras exigem `audit.read`. Criação/revogação de clients e criação/alteração de subscriptions exigem `tenant.manage`.

O API key do client e o signing secret do webhook são retornados apenas no momento da criação e não aparecem em listagens posteriores.

## Webhooks

Subscriptions armazenam:

- client de integração;
- endpoint HTTPS;
- tipos de evento;
- versão de contrato;
- estado;
- limite de tentativas;
- timeout;
- signing secret cifrado.

Endpoints são validados para HTTPS na porta TLS padrão e rejeitam hosts locais ou IPs privados conhecidos. O Worker também resolve DNS antes da entrega e rejeita destinos locais/privados, além de desabilitar redirects.

### Segredo de assinatura

O signing secret por subscription é aleatório e fica cifrado com AES-256-GCM. A chave mestra é `NEXORA_INTEGRATION_SECRET_KEY`, uma chave de 32 bytes codificada em Base64 mantida exclusivamente no secret manager do runtime. Ela não deve ser commitada nem armazenada no banco.

## Envelope de entrega

O Worker envia JSON determinístico:

```json
{
  "id": "<webhook-delivery-id>",
  "type": "<event-type>",
  "apiVersion": "v1",
  "createdAt": "<ISO-8601>",
  "data": {}
}
```

Headers:

- `Content-Type: application/json`
- `User-Agent: Nexora-TMS-Webhook/1.0`
- `X-Nexora-Webhook-Id`
- `X-Nexora-Webhook-Event`
- `X-Nexora-Webhook-Timestamp`
- `X-Nexora-Webhook-Signature: v1=<hex>`
- `Idempotency-Key`

A assinatura é HMAC-SHA256 sobre:

`<unix-timestamp>.<raw-json-body>`

O consumidor deve reconstruir exatamente essa string usando o corpo bruto recebido, calcular HMAC-SHA256 com seu signing secret, comparar de forma constante e rejeitar timestamps fora de uma janela de replay recomendada de cinco minutos.

## Outbox, Durable Jobs e idempotência

O NEX-56 não cria uma segunda fila.

Um trigger `AFTER INSERT` em `outbox_events` identifica subscriptions ativas para o `event_type` e cria:

1. um `webhook_delivery`;
2. um Durable Job `integrations.webhook.deliver`.

A chave idempotente é estável:

`webhook:<subscriptionId>:<outboxEventId>`

Existe unicidade por tenant/subscription/outbox event, portanto o mesmo evento não gera duas entregas para a mesma subscription.

## Retry, dead-letter e reprocessamento

O Worker registra cada tentativa em `webhook_delivery_attempts` e deixa NEX-90/NEX-91 controlar retry/backoff/dead-letter do Durable Job.

Após dead-letter, o NEX-55 continua sendo o único caminho administrativo para reprocessamento. O job mantém o mesmo ID e idempotency key; o status do `webhook_delivery` é sincronizado com o Durable Job e volta a `retry_wait` após a solicitação administrativa.

## Auditoria

São registrados, sem segredos:

- autenticação externa aceita/rejeitada para clients conhecidos;
- criação/revogação de client;
- criação/alteração/revogação de subscription;
- fan-out/queue de webhook;
- falha/sucesso/cancelamento de entrega;
- lifecycle async de retry/dead-letter;
- pedido administrativo de reprocessamento do NEX-55;
- acessos bem-sucedidos à API externa.

Logs e auditorias mantêm tenant, entidade, client, correlação e idempotency key quando aplicável.

## Gate

`Neon External Integrations Gate` aplica toda a cadeia de migrations em branch Neon efêmera e prova:

- RLS;
- hash-only da credencial;
- impossibilidade de leitura dos segredos por `nexora_app`;
- ausência de acesso direto do Worker às tabelas de segredo;
- autenticação própria e isolamento cross-tenant;
- fan-out transacional Outbox → Durable Job;
- contrato de assinatura HMAC do Worker;
- retry → dead-letter → reprocessamento NEX-55 → sucesso;
- preservação de idempotência, correlação e auditoria;
- cleanup da branch efêmera.

Production permanece congelada durante a qualificação do NEX-56.
