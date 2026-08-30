# ADR-0019 — Execução de viagens, fatos operacionais e POD

- Status: Accepted
- Date: 2026-08-30
- Scope: Wave 0023 — Viagens: execução, tracking, despesas, pedágios, combustível e POD

## Contexto

A Wave 0022 estabeleceu o agregado canônico de viagem em `trips`, com stops, motoristas, ativos, vínculos com solicitações e histórico de status. A execução operacional precisa registrar o que efetivamente acontece durante a viagem sem criar uma segunda raiz de viagem, sem substituir Document Core, Financeiro ou o futuro módulo genérico de Ocorrências.

Também é necessário preservar isolamento multi-tenant, integridade de stop/document/proof, idempotência de posições provenientes de integrações e imutabilidade dos fatos históricos.

## Decisão

### 1. `trips` continua sendo a raiz canônica

A Wave 0023 não cria outro agregado de viagem. As novas estruturas dependem de `trips` e, quando aplicável, de `trip_stops`.

### 2. Fatos operacionais são append-only

São tratados como fatos históricos e recebem somente `SELECT` + `INSERT` para `nexora_app`:

- `trip_events`;
- `trip_checkins`;
- `trip_locations`;
- `trip_documents`;
- `trip_tolls`;
- `trip_fuel`;
- `trip_proofs`;
- `trip_delivery_proofs`.

O runtime não recebe `UPDATE` nem `DELETE` nessas tabelas.

### 3. Checklists e despesas possuem lifecycle controlado

`trip_checklists` e `trip_expenses` permitem `SELECT`, `INSERT` e `UPDATE`, mas não `DELETE`.

Checklists registram estado operacional e autoria de conclusão/dispensa. Despesas registram revisão sem transformar a Wave 0023 em razão financeira ou contas a pagar.

### 4. Tracking persiste observações, não ETA

`trip_locations` persiste latitude/longitude, origem da posição, timestamp de captura, timestamp de recebimento e metadados operacionais.

Para eventos externos, `provider + provider_event_id` fornece idempotência. `recorded_at` não pode ser posterior a `received_at`.

Esta Wave não declara motor de ETA, geofencing avançado ou integração obrigatória com fornecedor específico.

### 5. Check-ins podem avançar fatos do Trips Core

Check-ins de chegada/saída/coleta/entrega são registrados como fatos e a camada de serviço pode refletir o progresso correspondente no lifecycle dos stops e da viagem, preservando as transições definidas no Trips Core.

Viagens `completed` ou `cancelled` não aceitam novas mutações operacionais pela API.

### 6. Documentos reutilizam o Document Core

`trip_documents` referencia `documents` da Wave 0018 e classifica a relação operacional (`execution`, provas, recibos e evidências).

A Wave 0023 não armazena bytes nem cria storage paralelo.

### 7. POD é especializado sobre prova de entrega

`trip_proofs` registra a evidência operacional. `trip_delivery_proofs` especializa apenas provas de tipo `delivery` vinculadas ao mesmo tenant, viagem e stop de entrega.

A API valida tipo, viagem e stop antes da criação, além das FKs tenant-aware do banco.

### 8. Custos são fatos operacionais, não Financeiro

`trip_expenses`, `trip_tolls` e `trip_fuel` registram fatos de custo ocorridos durante a execução.

Eles não substituem faturamento, contas a pagar/receber, conciliação, centros de resultado ou lançamentos contábeis futuros. A integração com Financeiro deverá consumir esses fatos por vínculo explícito e sem alterar sua história operacional.

### 9. Multi-tenancy é defesa em profundidade

As dez tabelas da Wave são tenant-scoped, usam RLS baseada em `app.tenant_id` e FKs compostas tenant-aware quando referenciam trip, stop, documento ou proof.

A API executa através de `TenantDatabaseService.withTenantContext`, definindo `app.user_id` e `app.tenant_id` na transação.

## Estruturas

- `trip_events`
- `trip_checkins`
- `trip_locations`
- `trip_checklists`
- `trip_documents`
- `trip_expenses`
- `trip_tolls`
- `trip_fuel`
- `trip_proofs`
- `trip_delivery_proofs`

## Validação

A decisão é protegida por:

- CI completo: audit, lint, formatting, typecheck, testes, build, Compose e Drizzle;
- Neon Database Gate geral;
- gates de regressão de Documents, Freight, Matching, Negotiation, Tenant/OIDC e Trips Core;
- Neon Trip Execution Gate em branch Neon isolada;
- validação real com `nexora_app` para migrations, RLS, grants, tracking idempotente, check-ins, checklists, documentos, despesas, pedágios, combustível, proof/POD, isolamento cross-tenant e bloqueio de UPDATE/DELETE em fatos append-only.

## Consequências

### Positivas

- histórico operacional não pode ser reescrito pelo runtime;
- tracking e comprovantes permanecem tenant-aware;
- documentos usam a fonte canônica já existente;
- custos operacionais podem alimentar Financeiro posteriormente sem acoplamento prematuro;
- POD possui integridade explícita de viagem, stop e tipo de proof.

### Trade-offs

- não há edição física de fatos append-only; correções futuras devem ser aditivas/auditáveis;
- ETA, telemetria avançada e geofencing permanecem fora desta Wave;
- fatos de custo ainda não representam liquidação financeira;
- revisão mais sofisticada de POD poderá exigir evolução aditiva posterior.

## Próxima evolução

A Wave 0024 adiciona infraestrutura transversal — `audit_events`, transactional outbox, durable jobs, idempotência, retries e dead-letter — reutilizável por Viagens e pelos demais módulos sem mover responsabilidades para o agregado de execução.
