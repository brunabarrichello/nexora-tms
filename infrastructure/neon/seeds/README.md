# Database Seeds and Fixtures

Jira: NEX-22 / NEX-78

## Baseline

Seeds exist to make development, integration tests and controlled demos reproducible without copying production data.

Rules:

- use synthetic data by default;
- never commit customer documents, credentials, tokens or real personal/financial data;
- production exports require an explicit sanitization/anonymization process before use outside production;
- seed operations must be idempotent or have a clearly documented reset strategy;
- tenant-scoped fixtures must include at least two tenants so isolation tests can prove negative access;
- stable identifiers may be used only for deterministic test fixtures, never as assumptions in production code;
- secrets and environment-specific integration credentials are never seeded from Git.

## Planned seed groups

1. platform/reference data;
2. development tenant and memberships;
3. synthetic master data;
4. synthetic capacity/freight/trip scenarios;
5. negative multi-tenant test fixtures.

Concrete executable seeds will be added with `packages/database` after the monorepo bootstrap is validated.
