# Local development

This runbook defines the supported local bootstrap for Nexora TMS.

## 1. Prerequisites

Use the repository-pinned toolchain:

```text
Node.js 24.20.0
pnpm 11.24.0
```

Verify it from the repository root:

```bash
pnpm doctor
```

The command also verifies that `pnpm-lock.yaml` is present.

## 2. Install dependencies

Run:

```bash
pnpm bootstrap
```

Bootstrap performs the toolchain check and installs all workspace dependencies using the committed lockfile with `--frozen-lockfile`.

Do not replace the committed lockfile with an unreviewed locally generated dependency graph.

## 3. Runtime environment

The API variable contract is maintained in:

```text
apps/api/.env.example
```

The API reads variables from `process.env`; it does not automatically load `.env` files. Supply local values through the process environment or another approved local secret mechanism.

Never commit populated environment files, database passwords, Auth0 credentials, tokens or certificates.

The local API fallback port is `3001`. A supplied `PORT` overrides it. Next.js uses port `3000` by default, which avoids a local Web/API collision.

## 4. Validate the repository

Before starting feature work or pushing a branch, run:

```bash
pnpm validate
```

It executes:

1. ESLint;
2. Prettier check;
3. TypeScript typecheck;
4. tests;
5. builds.

Database migration checks are additionally enforced by GitHub Actions.

## 5. Start deployables

Web:

```bash
pnpm dev:web
```

API:

```bash
pnpm dev:api
```

Worker:

```bash
pnpm dev:worker
```

The API health endpoint is available at:

```text
http://localhost:3001/health
```

## 6. Git hooks

Dependency installation configures repository hooks through `simple-git-hooks`:

```text
pre-commit → lint-staged
pre-push   → pnpm validate
```

Hooks are a local guardrail, not a replacement for protected GitHub CI.

## 7. Branch and PR flow

Create a short-lived branch from the current `main` and include the Jira key in the branch and pull request title, for example:

```text
feature/NEX-123-short-description
fix/NEX-124-short-description
chore/NEX-125-short-description
```

Do not push directly to `main`. The protected branch requires its configured status checks before merge.
