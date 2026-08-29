# ADR-0009 — Object Storage Behind a Port/Adapter

- **Status:** Accepted
- **Jira:** NEX-17 / NEX-64

## Context

Documents and evidence require binary storage, but business logic must remain independent from a concrete provider.

## Decision

Expose a `DocumentStoragePort`. PostgreSQL stores metadata, ownership and authorization state; binary objects live in managed object storage. Access is mediated through short-lived signed URLs or authorized streaming.

## Alternatives considered

- store binaries directly in PostgreSQL;
- spread provider SDK usage through domain/application code;
- permanent public object URLs.

## Consequences

**Positive:** provider portability, clearer authorization and a smaller transactional database footprint.  
**Trade-off:** DB/storage consistency must be handled explicitly.  
**Mitigation:** controlled upload/commit workflow, orphan cleanup and audit logging.
