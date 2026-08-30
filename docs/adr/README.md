# Architecture Decision Records

ADRs document significant technical decisions for Nexora TMS and preserve decision history.

## Status values

- Proposed
- Accepted
- Superseded
- Deprecated
- Rejected

## Naming

Use sequential names: `NNNN-short-decision-title.md`.

## Accepted foundational ADRs — Wave 0

1. [`0001-monorepo-modular-monolith.md`](./0001-monorepo-modular-monolith.md) — monorepo + modular monolith.
2. [`0002-multi-tenant-isolation-rls.md`](./0002-multi-tenant-isolation-rls.md) — application tenant isolation + PostgreSQL RLS defense in depth.
3. [`0003-drizzle-explicit-sql.md`](./0003-drizzle-explicit-sql.md) — Drizzle ORM + versioned explicit SQL.
4. [`0004-deployment-platforms.md`](./0004-deployment-platforms.md) — Vercel Web; Railway API/Worker; Neon PostgreSQL.
5. [`0005-managed-idp-membership-rbac.md`](./0005-managed-idp-membership-rbac.md) — managed IdP adapter; Nexora owns membership/RBAC.
6. [`0006-transactional-outbox-durable-jobs.md`](./0006-transactional-outbox-durable-jobs.md) — transactional outbox + durable jobs.
7. [`0007-rest-openapi.md`](./0007-rest-openapi.md) — REST + OpenAPI external API baseline.
8. [`0008-production-data-sanitization.md`](./0008-production-data-sanitization.md) — no production-data clones to lower environments without sanitization.
9. [`0009-object-storage-port-adapter.md`](./0009-object-storage-port-adapter.md) — document storage behind a port/adapter.
10. [`0010-security-observability-feature-gates.md`](./0010-security-observability-feature-gates.md) — security and observability are feature gates.
11. [`0011-auth0-initial-managed-idp.md`](./0011-auth0-initial-managed-idp.md) — Auth0 is the initial concrete managed IdP behind the vendor-neutral adapter.

ADRs 0001–0010 form the accepted NEX-17 / NEX-64 Wave 0 baseline. ADR-0011 concretizes the managed IdP implementation while preserving ADR-0005's authorization boundary.

## Accepted data-model evolution ADRs

12. [`0012-master-data-catalog-and-schema-evolution.md`](./0012-master-data-catalog-and-schema-evolution.md) — canonical aggregate roots, data catalog and Wave-based schema evolution.
13. [`0013-master-data-enrichment-controlled-extensibility.md`](./0013-master-data-enrichment-controlled-extensibility.md) — Wave 0016 locations, dimensions, typed tags, controlled custom fields, currency and lifecycle rules.
14. [`0014-driver-asset-qualification-document-boundary.md`](./0014-driver-asset-qualification-document-boundary.md) — Wave 0017 qualification extensions, append-only facts, catalog normalization and document-core boundary.

## Process

1. Copy `0000-template.md` for a new decision.
2. Document context, drivers, options, decision, consequences, security/data/operational impact and validation.
3. Open the ADR through the normal pull-request process.
4. Reference related Jira work.
5. Never silently change the historical meaning of an Accepted ADR. Create a new ADR and mark the previous decision Superseded.
