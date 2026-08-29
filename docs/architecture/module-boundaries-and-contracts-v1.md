# Nexora TMS — Module Boundaries and Contracts v1

**Status:** Accepted Wave 0 baseline  
**Jira:** NEX-17 / NEX-63

## Canonical stack

| Layer | Decision |
| --- | --- |
| Runtime | Node.js 24 LTS, pinned in repository |
| Language | TypeScript strict |
| Monorepo | pnpm workspaces + Turborepo |
| Web | Next.js App Router + React |
| API | NestJS |
| Worker | NestJS standalone / TypeScript |
| Database | Neon PostgreSQL |
| Persistence | Drizzle ORM + versioned explicit SQL |
| Validation | Zod + boundary DTOs |
| API | REST + OpenAPI |
| Web runtime | Vercel |
| API/Worker runtime | Railway |
| Testing | unit, integration, contract, architecture and E2E |

## Backend structural rule

The backend starts as a **modular monolith**. Every bounded context owns its domain and use cases while sharing `apps/api` and the same PostgreSQL deployment until objective extraction criteria exist.

Recommended internal structure:

```text
module/
  domain/
    entities/
    value-objects/
    policies/
    events/
  application/
    commands/
    queries/
    use-cases/
    ports/
  infrastructure/
    persistence/
    adapters/
  presentation/
    http/
```

Rules:

- `domain` does not import NestJS, Drizzle, HTTP, provider SDKs or UI code;
- `application` depends on domain and ports, not concrete adapters;
- `infrastructure` implements ports;
- `presentation` translates transport input into commands/queries;
- circular module dependencies are forbidden;
- a module cannot mutate another module's tables directly;
- cross-module reads require an explicit contract/query service/read model.

## Bounded contexts v1

| Context | Responsibility | Owned data examples |
| --- | --- | --- |
| Identity | local identity and IdP linkage | identity refs, sessions, auth audit |
| Tenancy | organizations and memberships | organizations, memberships, tenant settings |
| Master Data | customers, partners, contacts, locations | parties, addresses, contacts, operational points |
| Capacity | drivers, vehicles and equipment | drivers, vehicles, equipment, assignments |
| Freight | transport requests, cargo, route and quote | freight requests, cargo, stops, commercial quote |
| Matching | proposals, negotiation, reservation and contracting | proposals, negotiations, reservations, contracts |
| Trips | physical execution, milestones and incidents | trips, trip stops, milestones, incidents |
| Documents | document metadata, validity and blocks | documents, requirements, compliance status |
| Finance | cost, margin, payment and billing | obligations, receivables, settlements |
| Notifications | internal notifications and preferences | notifications, delivery state |
| Integrations | adapters, webhooks and integration metadata | configs, subscriptions, delivery logs |
| Analytics | managerial projections/read models | projections/materialized read models |
| Audit | immutable sensitive-event trail | audit events |

## Allowed dependency flow

```text
Tenancy + Identity
       |
       v
Master Data ---> Capacity ---> Documents
      |             |             |
      v             v             v
    Freight ------> Matching ------+
                      |
                      v
                    Trips
                      |
                      v
                   Finance
                      |
                      v
                  Analytics
```

Notifications, Integrations and Audit are cross-cutting capabilities but must not become central coupling points.

## Web → API contract

- API is the business-contract authority.
- Web never imports backend entities or ORM models.
- OpenAPI is generated/versioned from API boundaries.
- `packages/contracts` contains public/stable schemas only.
- Every inbound payload is validated.
- Every tenant-scoped resource is resolved inside the authenticated tenant, never only by a browser-supplied ID.

Standard error envelope:

```json
{
  "code": "FREIGHT_INVALID_STATE",
  "message": "Operation is not allowed for the current state.",
  "correlationId": "...",
  "details": []
}
```

Do not expose stack traces, SQL, secrets, tokens or internal structures.

## REST v1 conventions

- external prefix `/api/v1`;
- plural resource names;
- explicit pagination and documented filters;
- API timestamps are ISO-8601 UTC;
- opaque/UUID identifiers;
- critical commands support `Idempotency-Key` when duplicate execution is possible;
- `PATCH` for authorized partial updates;
- domain actions may use explicit command/sub-resource endpoints instead of arbitrary RPC;
- breaking changes require a new contract version.

## Internal module contracts

Preferred mechanisms, in order:

1. application service/query port for local synchronous interaction;
2. domain/application event for decoupled reactions;
3. read model for analytics/dashboard aggregation.

Forbidden:

- importing another module's concrete repository;
- mutating another module's table directly;
- reusing another context's domain entity as a DTO;
- resolving tenant context ad hoc deep in services instead of central `TenantContext`;
- publishing unversioned event schemas.

## Event envelope

```json
{
  "eventId": "uuid",
  "eventType": "trip.completed",
  "eventVersion": 1,
  "occurredAt": "2026-08-29T00:00:00Z",
  "tenantId": "uuid",
  "correlationId": "uuid",
  "causationId": "uuid",
  "aggregateType": "trip",
  "aggregateId": "uuid",
  "payload": {}
}
```

Rules: unique event ID, idempotent consumer, no secrets, minimum necessary personal data, explicit versioning, facts rather than implicit commands, and transactional outbox persistence.

## Worker/job contract

A durable job includes at minimum:

- `jobId`;
- `jobType`;
- `tenantId` when applicable;
- `correlationId`;
- `idempotencyKey`;
- versioned payload;
- attempts;
- next execution time;
- terminal/failure state.

System jobs run under an auditable service identity and do not silently bypass business authorization policy.

## Database ownership

- every tenant-scoped entity includes `tenant_id`;
- FKs/indexes include tenant dimensions where required to prevent cross-tenant relationships;
- repositories know only owned tables and explicitly authorized read models/views;
- migrations form one ordered monorepo history;
- migration credentials are distinct from runtime credentials;
- advanced SQL/RLS/triggers must be versioned and tested.

## Shared packages governance

| Package | May contain | Must not contain |
| --- | --- | --- |
| `ui` | reusable visual components | domain rules |
| `database` | client/schema/migration helpers | business services |
| `auth` | identity adapters/helpers | module-specific RBAC |
| `config` | environment/config validation | hardcoded secrets |
| `contracts` | public DTOs/schemas/events | ORM/domain entities |
| `validation` | genuinely common validators | use-case logic |
| `observability` | logging/correlation/telemetry | functional rules |
| `security` | cross-cutting security primitives | one-module policies |
| `testing` | fixtures/builders/helpers | real sensitive data |
| `shared` | truly universal primitives | unowned generic code |

Shared packages are created only when real reuse exists across two or more deployables.

## Future microservice extraction criteria

Extraction requires evidence of at least one of:

- materially different scaling needs;
- fault-isolation requirement;
- distinct security/regulatory boundary;
- independent team/release cycle;
- specialized asynchronous workload;
- performance limits unsolved within the modular monolith.
