# Wave 0023 — Viagens: Execução

## Objetivo

Adicionar persistência e API operacional para execução de viagens sobre o Trips Core da Wave 0022, cobrindo eventos, check-ins, tracking, checklists, documentos, despesas, pedágios, combustível, provas e POD sem duplicar agregados canônicos.

## Migration

- `0023_moaning_iron_fist.sql`
- ledger esperado após aplicação: **24 migrations** (`0000`–`0023`)
- evolução aditiva; sem `DROP`, `TRUNCATE` ou rename destrutivo.

## Tabelas tenant-scoped

1. `trip_events` — fatos/eventos operacionais da viagem.
2. `trip_checkins` — chegada, saída, coleta, entrega e checkpoint.
3. `trip_locations` — posições persistidas com fonte/provider e idempotência externa.
4. `trip_checklists` — itens operacionais com lifecycle controlado.
5. `trip_documents` — vínculo tipado com o Document Core.
6. `trip_expenses` — despesas operacionais e revisão.
7. `trip_tolls` — fatos de pedágio.
8. `trip_fuel` — fatos de abastecimento.
9. `trip_proofs` — evidências operacionais.
10. `trip_delivery_proofs` — especialização de POD.

Todas possuem RLS baseada no tenant de sessão.

## Privilégios `nexora_app`

### Append-only

`SELECT`, `INSERT`; sem `UPDATE`/`DELETE`:

- `trip_events`
- `trip_checkins`
- `trip_locations`
- `trip_documents`
- `trip_tolls`
- `trip_fuel`
- `trip_proofs`
- `trip_delivery_proofs`

### Lifecycle controlado

`SELECT`, `INSERT`, `UPDATE`; sem `DELETE`:

- `trip_checklists`
- `trip_expenses`

## Integridade

- referências a trip/stop usam escopo tenant-aware;
- `trip_documents` referencia `documents`, sem storage paralelo;
- referências opcionais a documentos são revalidadas pela API;
- POD exige proof de tipo `delivery` da mesma viagem e do mesmo stop de entrega;
- posições externas usam índice único de provider/evento para idempotência;
- `received_at >= recorded_at` protege coerência temporal de tracking;
- fatos append-only não podem ser atualizados ou excluídos pelo runtime.

## API

Base do módulo: `/api/v1/trips/:tripId`

Capacidades implementadas:

- listar/criar eventos;
- listar/criar check-ins;
- listar/criar posições;
- listar/criar checklists e alterar estado;
- listar/vincular documentos;
- listar/criar despesas e revisar estado;
- listar/criar pedágios;
- listar/criar abastecimentos;
- listar/criar proofs;
- listar/criar delivery proofs/POD.

Todos os acessos são executados sob `TenantRuntimeGateGuard` e `TenantDatabaseService.withTenantContext`.

## Regras de lifecycle

- check-ins podem refletir progresso nos stops e na viagem;
- execução operacional é bloqueada depois que a viagem está `completed` ou `cancelled`;
- histórico append-only permanece preservado;
- fatos de custo são operacionais e não substituem Financeiro.

## Testes e gates

A Wave é considerada validada somente quando o mesmo head passa:

- CI completo;
- Neon Database Gate;
- API Tenant Neon Gate;
- API OIDC Identity Neon Gate;
- Neon Documents Gate;
- Neon Freight Normalization Gate;
- Neon Matching Gate;
- Neon Negotiation Gate;
- API Negotiation Collaboration Neon Gate;
- Neon Trips Core Gate;
- Neon Trip Execution Gate.

O gate dedicado executa migrations em branch Neon isolada, verifica as dez tabelas, RLS e grants, compila a API e executa integração real como `nexora_app`, incluindo isolamento entre tenants e imutabilidade.

## Limites explícitos

Fora da Wave 0023:

- razão financeira e liquidação de despesas;
- contas a pagar/receber e faturamento;
- ocorrências genéricas;
- ETA avançado/geofencing;
- integração obrigatória com fornecedor de telemetria;
- outbox/jobs/retries transversais — Wave 0024.

## Próxima dependência

Wave 0024 — Infraestrutura Transversal:

- `audit_events`;
- `outbox_events`;
- `durable_jobs`;
- idempotência;
- retries/backoff;
- dead-letter e observabilidade operacional.
