# ADR-0006 — Transactional Outbox + Durable Jobs

- **Status:** Accepted
- **Jira:** NEX-17 / NEX-64

## Context

Notifications, webhooks, document processing and integrations must not depend on synchronous execution or lose events after a successful business transaction.

## Decision

Persist relevant domain/application events in a transactional outbox in the same database transaction as business state. The Worker processes events/jobs with unique identifiers, tenant/correlation context, idempotency, bounded retry and auditable failure/reprocessing state.

The initial implementation may use PostgreSQL-backed durability. Introducing an external broker requires a later ADR supported by evidence.

## Alternatives considered

- call external providers inside the HTTP transaction;
- publish messages without an outbox;
- require a dedicated broker from the first release.

## Consequences

**Positive:** reliable asynchronous processing with strong consistency and lower initial complexity.  
**Trade-off:** eventual latency and backlog/retry operations must be managed.  
**Mitigation:** queue metrics, logical dead-letter handling and audited reprocessing tools.
