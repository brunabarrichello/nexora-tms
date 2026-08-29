# Nexora TMS — Testing Strategy

**Status:** Wave 0 baseline in progress  
**Jira:** NEX-24 / NEX-83 / NEX-84 / NEX-85

## Objective

Quality gates must detect functional regressions, broken module boundaries, unsafe database changes, authorization defects and cross-tenant access before a change is promoted.

Tests are part of feature Definition of Done. They are not deferred to a post-MVP hardening phase.

## Test portfolio

### 1. Unit tests

Fast tests for domain rules, value objects, policies, application services and deterministic utilities.

Expected characteristics:

- no network or real managed services;
- no shared mutable external state;
- deterministic and parallelizable;
- focused on observable business behavior rather than implementation details.

### 2. Architecture tests

Protect modular-monolith boundaries.

They must detect, at minimum:

- circular module dependencies;
- domain imports of NestJS, Drizzle, HTTP or provider SDKs;
- forbidden cross-module infrastructure/repository imports;
- public contracts accidentally exposing ORM/domain internals;
- inappropriate dependency direction between domain/application/infrastructure/presentation.

### 3. Contract tests

Validate stable boundaries:

- REST/OpenAPI request and response contracts;
- standard error envelope;
- event schemas and versions;
- job envelope/versioning;
- adapter expectations for external integrations.

Breaking contract changes require explicit versioning/review.

### 4. Integration tests

Exercise real framework/database integration using disposable or isolated resources.

Priority scenarios:

- repositories and constraints;
- migrations from a clean database;
- transaction + outbox atomicity;
- tenant context propagation;
- RLS/authorization defense-in-depth where enabled;
- API validation/error handling;
- worker idempotency and retry state.

Tests must not depend on shared production data.

### 5. E2E tests

Cover critical user/business paths through real application boundaries.

Initial Wave 0/early MVP critical paths include:

- identity/session lifecycle once IAM is implemented;
- tenant selection/membership enforcement;
- permission denial and positive permission paths;
- cross-tenant negative access attempts;
- health/readiness and basic Web→API flow;
- migration/deployment smoke paths.

E2E is intentionally smaller than the unit/integration portfolio and focuses on high-value journeys.

## Multi-tenant test rule

Any tenant-scoped feature requires positive and negative isolation coverage.

A minimum fixture set uses at least two independent tenants and validates that a user or service context from Tenant A cannot read, mutate, infer or link protected Tenant B data through:

- direct resource IDs;
- list/search/filter endpoints;
- relationship/foreign-key paths;
- bulk operations;
- background jobs/events;
- report/read-model paths;
- object/document access.

A test that only proves correct access within one tenant is not sufficient isolation evidence.

## Authorization tests

For protected commands/queries, test:

1. unauthenticated request;
2. authenticated identity without membership;
3. membership without required permission;
4. permitted membership;
5. wrong-tenant resource identifier;
6. disabled/suspended membership where applicable.

Default behavior is deny.

## Data and fixtures

- synthetic data by default;
- deterministic builders/factories;
- no production dumps without approved sanitization;
- each test owns or isolates mutable data;
- test cleanup must be reliable or resources disposable;
- credentials/secrets never appear in snapshots or fixtures.

## Flaky tests

Flaky tests are defects.

- do not normalize repeated retries as a permanent solution;
- quarantine only with an issue, owner and removal condition;
- a quarantined critical security/tenant-isolation test blocks release until restored or explicitly risk-accepted.

## Coverage policy

Line/branch percentages are supporting signals, not the definition of quality. Critical authorization, tenancy, financial, migration and state-transition paths require scenario coverage even if aggregate coverage is high.

Initial numeric thresholds may be introduced after the first executable test baseline provides realistic measurements. Thresholds must not encourage low-value tests solely to satisfy a percentage.

## Test ownership

The code owner of a module owns its tests. Cross-cutting security/tenant tests are jointly owned by the relevant module and platform/security boundaries.

## Completion gate

The testing strategy becomes physically validated only when the pinned NEX-18 toolchain can install dependencies and the test framework executes in CI/local development. Until then this document is the approved target policy, not evidence of passing tests.
