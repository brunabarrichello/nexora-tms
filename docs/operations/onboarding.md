# Nexora TMS — Technical Onboarding

## 1. Purpose

This guide is the minimum safe path for a developer to understand, run, validate and change Nexora TMS without bypassing tenant isolation, migrations or quality gates.

## 2. Required toolchain

Use the repository-pinned versions:

- Node.js 24.20.0;
- pnpm 11.24.0;
- Git;
- Docker + Docker Compose when using the local container topology.

Validate the checkout before changing code:

```bash
node --version
pnpm --version
pnpm doctor
pnpm bootstrap
pnpm validate
```

## 3. Architecture orientation

Read these areas before the first change:

```text
apps/api        NestJS HTTP API
apps/web        Next.js application
apps/worker     asynchronous worker
packages/*      shared packages and database model
packages/database/migrations
                canonical ordered database migrations
docs/adr        architecture decisions
docs/operations operational procedures
.github/workflows
                required CI and Neon gates
```

Key rules:

- `tenant_id` is never trusted from arbitrary browser payloads;
- authenticated identity, active membership and tenant context precede tenant data access;
- RLS is a mandatory database safety boundary;
- migrations are append-only once shared environments have consumed them;
- production is never the first environment for a schema or runtime change;
- no populated `.env` or credentials are committed.

## 4. Runtime configuration

Start from the contracts under each application, especially `apps/api/.env.example`. Use development-only credentials from approved secret stores. Never copy staging or production secrets into source files or Compose manifests.

OIDC values must use the environment-specific issuer/audience. A token issued for one audience must not be accepted by another environment.

## 5. Local infrastructure with Docker

Start only infrastructure dependencies:

```bash
docker compose up -d postgres redis
```

The committed local PostgreSQL initializer creates a non-superuser `nexora_app` runtime role. The application profile also runs the canonical Drizzle migration chain before the API.

To start the application profile, first export valid **development** OIDC values, then run:

```bash
docker compose --profile application up --build
```

Do not use the local Compose passwords outside local development.

## 6. Non-container development

```bash
pnpm dev:web
pnpm dev:api
pnpm dev:worker
```

Health endpoint:

```text
GET http://localhost:3001/health
```

API base path:

```text
/api/v1
```

## 7. Before opening a PR

Run:

```bash
pnpm validate
pnpm audit:prod
```

For database changes also run the Drizzle generation/check commands and inspect generated SQL for destructive operations. PR database gates remain authoritative for Neon/RLS behavior.

## 8. PR expectations

A PR must describe:

- problem and bounded context;
- migration/data impact;
- tenant/security impact;
- tests executed;
- rollout and rollback;
- any manual platform action still required.

A successful build alone is not proof of completion. Validate behavior, persistence, isolation, permissions and error paths relevant to the change.

## 9. First-week learning path

1. README and architecture ADRs.
2. Tenant context and RLS path.
3. One bounded context end to end: Web → API → database.
4. CI and Neon PR gates.
5. Release/promotion flow.
6. Observability and incident/DR runbooks.

## 10. Escalation rule

If a change would weaken RLS, broaden privileges, rewrite an applied migration, expose a secret, or promote directly to production, stop that change and require an explicit architecture/security review before proceeding.
