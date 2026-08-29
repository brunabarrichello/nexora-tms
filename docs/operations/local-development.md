# Local development

## Required toolchain

- Node.js `24.20.0`
- pnpm `11.23.0`

The exact versions are pinned by `.nvmrc`, `.node-version`, `package.json`, and `.npmrc`.

## First bootstrap

```bash
corepack enable
corepack prepare pnpm@11.23.0 --activate
node scripts/check-toolchain.mjs
pnpm install
pnpm validate
```

Until the first dependency installation is validated in the pinned Node.js runtime, the repository
may not contain `pnpm-lock.yaml`. Once generated, the lockfile must be reviewed and committed before
NEX-18 is considered complete.

## Run locally

```bash
pnpm dev
```

Expected local endpoints:

- Web: `http://localhost:3000`
- API health: `http://localhost:3001/api/v1/health`

The worker runs as a persistent process and currently performs only its bootstrap lifecycle.

## Environment

Copy `.env.example` to a local `.env` or use platform/IDE secret injection. Never commit real
credentials. The current database value is only a placeholder; database wiring belongs to the data
foundation work.

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm format:check
pnpm validate
```

`pnpm validate` is also the pre-push quality gate.

## Branching

`main` is the only long-lived branch. Use short-lived `feature/*`, `fix/*`, `chore/*`, or
`refactor/*` branches and merge through pull requests.
