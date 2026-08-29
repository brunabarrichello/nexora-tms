# Platform bootstrap — Vercel and Railway

This runbook materializes the deployment topology defined for Nexora TMS without reusing resources from Moventra.

## Vercel — Web

Target project: `nexora-tms-web`.

Import repository:

- GitHub repository: `brunabarrichello/nexora-tms`.
- Framework: Next.js.
- Root Directory: `apps/web`.
- Production branch: `main`.
- Preview deployments: enabled for pull requests/branches.

Environment variables:

- Preview: `NEXT_PUBLIC_API_BASE_URL` points to the staging/preview API endpoint.
- Production: `NEXT_PUBLIC_API_BASE_URL` points to the production API endpoint.

Do not copy variables or deployment credentials from Moventra.

Validation before production promotion:

1. dependency installation succeeds with the committed `pnpm-lock.yaml`;
2. Next.js build succeeds;
3. preview URL renders the Nexora shell without runtime errors;
4. API base URL resolves to the correct environment;
5. no secret server-side value is exposed with the `NEXT_PUBLIC_` prefix.

## Railway — API and Worker

Target project: `nexora-tms`.

Source of truth: `.railway/railway.ts`.

Services:

- `api` — build `pnpm --filter @nexora/api build`, start `pnpm --filter @nexora/api start`, health `/api/v1/health`;
- `worker` — build `pnpm --filter @nexora/worker build`, start `pnpm --filter @nexora/worker start`.

The monorepo root remains the build context because API/Worker depend on the root workspace and lockfile. The API accepts Railway's injected `PORT` variable and falls back to `API_PORT` for local development.

Required secret injection per environment:

- API: `DATABASE_URL`;
- Worker: `WORKER_DATABASE_URL`.

`MIGRATIONS_DATABASE_URL` belongs to controlled migration execution and must not be injected into normal API/Worker runtime unless the migration job explicitly requires it.

## Environment order

1. Preview/development validation.
2. Staging deployment.
3. Smoke tests and migration validation.
4. Explicit production promotion.

Production is never the first environment used to test a new deployment definition.

## Current external blockers

As recorded on 2026-08-29:

- GitHub Actions accepted the bootstrap workflow but repeatedly failed before runner allocation (`runner_id: 0`, no steps executed).
- Railway Free-plan resource limits rejected creation of a new Nexora project; existing Moventra projects remain untouched.
- No Nexora Vercel project existed when this runbook was written.

These are platform/account-state blockers, not evidence that the Nexora application build failed.
