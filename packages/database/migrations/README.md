# Database migrations

This directory is the Drizzle Kit migration output for `@nexora/database`.

## Foundation workflow

Using the repository-pinned Node.js 24.20.0 / pnpm 11.24.0 toolchain:

```bash
pnpm install --no-frozen-lockfile
pnpm --filter @nexora/database db:generate
pnpm --filter @nexora/database db:check
```

Review every generated migration before execution. Generation is not deployment.

The schema defines tenant-aware foreign keys and PostgreSQL row-level security policies. Runtime connections must set trusted, transaction-local tenant and user context from authenticated server-side state before tenant-scoped queries.

Migrations are forward-only and run with the dedicated migrator credential. Runtime API and Worker credentials remain least-privilege and must not own application tables.

No migration in this branch is considered applied to Neon until it is generated, reviewed, tested on a disposable/development branch, and committed through the NEX-22 migration gate.
