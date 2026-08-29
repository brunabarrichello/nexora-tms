# Database Migrations

Jira: NEX-22 / NEX-78

## Principles

- one ordered migration history for the Nexora TMS monorepo;
- migrations are reproducible from an empty database;
- production migrations run only through the migrator credential/capability;
- runtime API/Worker credentials never execute DDL;
- generated SQL must be reviewed before production application;
- PostgreSQL-specific SQL is allowed and expected for capabilities such as RLS, constraints and indexes;
- destructive changes follow expand/contract and the destructive-change runbook.

## Validation flow

1. create or use an isolated Neon branch;
2. apply all migrations from zero;
3. execute schema/constraint tests;
4. validate cross-tenant negative scenarios when tenant-scoped objects are involved;
5. validate application compatibility;
6. compare expected schema with target environment;
7. apply to staging;
8. observe and validate;
9. apply to production through the approved release path.

## Naming

Migration names should be ordered and descriptive, for example:

```text
0001_foundation.sql
0002_tenancy.sql
0003_identity.sql
```

The concrete Drizzle migration layout will be added when `packages/database` is materialized after NEX-18 is validated.

## Rollback policy

Prefer forward fixes. Down migrations are not assumed safe for production. Every risky migration must document recovery, compatibility window and data preservation strategy.
