# Nexora TMS — Vercel Web Runtime

Status: verified baseline for NEX-14 on 2026-08-30

## Scope

This runbook defines the canonical Vercel configuration for `apps/web`. The Nexora API and worker are not deployed to Vercel; they remain Railway workloads.

## Verified project

- Vercel team: `ALEBRU`
- Vercel project: `nexora-tms-web`
- Vercel Project ID: `prj_rck0NSOQfYGlVWHMoEkQyBgomIN2`
- Git repository: `brunabarrichello/nexora-tms`
- Framework: Next.js
- Production branch: `main`
- Application root: `apps/web`
- Package manager: pnpm `11.24.0`
- Vercel Node.js setting: `24.x`
- Canonical production domain: `nexora-tms-web.vercel.app`

Do not reuse, rename, or attach any Moventra or legacy freight project to Nexora.

## Build behavior

Vercel detects the Turborepo workspace automatically. A verified Preview build for `NEX-14-vercel-web-foundation` performed the following sequence:

```text
pnpm install
Detect Next.js 16.3.3
Detect Turborepo
Scope build to @nexora/web
turbo run build
next build
```

The verified build completed successfully and generated 108 application routes.

Keep Vercel framework-native Next.js routing and output behavior. Do not add a root `vercel.json` only to reproduce settings already represented by Next.js or the Vercel project configuration.

## Node.js compatibility note

The repository development and CI baseline is Node.js `24.20.0`. Vercel accepts a Node.js major line such as `24.x` and currently resolved that setting to Node.js `24.19.0` during the verified build on 2026-08-30.

This produces an engine warning during `pnpm install` because the root repository currently declares the exact version `24.20.0`. The Preview build still completes successfully. Treat this as a documented platform compatibility exception until either Vercel's Node.js 24 runtime reaches `24.20.0` or newer, or the repository's exact-version policy is deliberately revised through the normal architecture/governance process.

Do not silently weaken the repository Node.js baseline only to suppress this warning.

## Monorepo build contract

The repository root owns the lockfile and workspace configuration. Vercel must install from the pnpm workspace and build only `@nexora/web` for this project.

Canonical local verification remains:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @nexora/web typecheck
pnpm --filter @nexora/web test
pnpm --filter @nexora/web build
```

The repository-wide CI remains responsible for the complete `pnpm validate` gate.

## Environment model

### Development

Local development uses the repository tooling and local environment values. Secrets must not be committed.

The canonical API endpoint for this environment is:

```text
https://nexora-tms-api-development.up.railway.app
```

The latest successful Railway `development` API deployment verified on 2026-08-30 is commit `4ff8a3b90a70b4c5ac7607dca5c1e0d52cc6ee06`, which contains the Wave 0021 negotiation collaboration baseline plus the previously promoted Documents and Matching modules.

### Preview

Eligible non-production branches and pull requests create Preview Deployments. Preview is the default verification surface for UI changes before merge.

The canonical API endpoint for Preview is the Railway staging API:

```text
https://nexora-tms-api-staging.up.railway.app
```

The latest successful Railway `staging` API deployment verified on 2026-08-30 is also commit `4ff8a3b90a70b4c5ac7607dca5c1e0d52cc6ee06`.

The NEX-14 Preview Deployment reached `READY` and served the root page with HTTP 200. Preview Deployment Protection is active. Direct route checks can require Vercel SSO even when the deployment itself is healthy, so protected-route smoke validation must use an authenticated browser/session or an approved bypass mechanism.

### Production

Only the `main` branch is the production source. Production promotion must occur only after protected GitHub checks are green and the change is merged according to repository governance.

The canonical API endpoint for Production is:

```text
https://nexora-tms-api-production.up.railway.app
```

`NEXORA_API_BASE_URL` is now active in Vercel Production. Vercel production deployment `dpl_DQTCEc7TyfsrwQU5J6yheoD3kA5B`, built from `main` commit `4ff8a3b90a70b4c5ac7607dca5c1e0d52cc6ee06`, reached `READY` on 2026-08-30.

Production route smoke returns HTTP 200 for the web shell, including `/documentos`. The page now reaches Railway instead of reporting an unconfigured API base URL, but Railway responds `Cannot GET /api/v1/documents`.

This response is caused by deployment drift, not by a wrong Web route. The current repository `main` defines `@Controller('api/v1/documents')` and imports `DocumentsModule`, while Railway Production is still running commit `298a4df01afda83b7595a677d6eeb8feaef8a51f` from 2026-08-29. Development and Staging are already aligned on `4ff8a3b90a70b4c5ac7607dca5c1e0d52cc6ee06` with successful API deployments.

Railway Production currently lists only the baseline runtime variable names `APP_ENV`, `APP_NAME`, `LOG_LEVEL`, `NODE_ENV` and `TZ`; the production database/authentication runtime has not been promoted to the current API baseline. Therefore the Production API must not be blindly redeployed only to make the Vercel smoke green.

The correct Production gate is: prepare and approve the Railway/Neon/Auth production runtime first, promote the API through the established environment sequence, and only then repeat the Vercel API-backed smoke.

## Environment variables

`NEXORA_API_BASE_URL` is the current server-only frontend integration contract. The web API client reads this variable on the server and forwards only approved incoming headers (`Authorization` and `x-correlation-id`) to the Nexora API.

Configure the value by environment:

- Local/Development: `https://nexora-tms-api-development.up.railway.app`
- Preview: `https://nexora-tms-api-staging.up.railway.app`
- Production: `https://nexora-tms-api-production.up.railway.app`

The API base URLs are not credentials, but the variable must remain server-only. Do not rename it to `NEXT_PUBLIC_NEXORA_API_BASE_URL`.

When additional variables are introduced, classify them explicitly:

- `NEXT_PUBLIC_*`: safe for browser exposure; never place secrets here.
- server-only variables: Vercel encrypted environment variables, scoped by environment.
- Auth/OIDC variables: remain pending until the authentication block is resumed; do not invent production credentials.

A populated `.env`, API token, OIDC secret, database URL, or Vercel token must never be committed.

## Required deployment checks

For every Preview Deployment:

1. deployment reaches `READY`;
2. root page returns HTTP 200;
3. navigation shell renders;
4. `/cadastros` is generated and accessible through an authenticated Preview session;
5. `/cargas` is generated and accessible through an authenticated Preview session;
6. `/documentos` is generated and accessible through an authenticated Preview session;
7. server-side API integration uses the Preview-scoped `NEXORA_API_BASE_URL`;
8. no uncaught runtime error is present in Vercel logs;
9. no production-only secret is available to Preview unless explicitly approved.

For Production, repeat the same smoke checks only after the Railway Production API has been deliberately promoted to a compatible backend/database/auth baseline. A web HTTP 200 alone is not sufficient when an API-backed page reports an upstream route or runtime error.

## Deployment protection

Production and Preview protection must follow the capabilities available on the active Vercel plan. Do not weaken GitHub branch protection to compensate for Vercel plan limits.

## Rollback

If a production deployment fails smoke validation:

1. do not patch directly in production;
2. identify the last known-good Vercel deployment;
3. restore or roll back using Vercel deployment controls when available;
4. fix the issue through a Jira-keyed Git branch and pull request;
5. re-run CI and Preview validation before production promotion.

## Observability

For each relevant deployment, record and validate:

- deployment ID;
- commit SHA and branch;
- deployment state;
- build logs;
- runtime errors;
- canonical/branch aliases;
- environment-variable names and scopes without exposing secret values.

## Gate for completing the NEX-14 Vercel baseline

The Vercel portion of NEX-14 can be considered operationally complete when:

- `nexora-tms-web` exists in team `ALEBRU`;
- it is linked only to `brunabarrichello/nexora-tms`;
- application root is `apps/web`;
- `main` is the Production Branch;
- a Preview Deployment passes the build gate;
- protected Preview smoke checks are completed with an authenticated session;
- `NEXORA_API_BASE_URL` is configured with the correct scope-specific endpoint;
- Preview-to-Staging API integration is verified on a deployment created after the environment-variable configuration;
- Railway Production is deliberately promoted from its stale `298a4df...` baseline to the approved current production runtime before API-backed Production smoke is considered valid;
- Production API-backed smoke passes after that backend promotion;
- environment separation is documented and verified;
- the Node.js `24.x` versus repository `24.20.0` compatibility warning is either accepted as a documented exception or resolved deliberately.
