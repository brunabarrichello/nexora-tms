# Contributing to Nexora TMS

Thank you for contributing to Nexora TMS.

## Local setup

Before feature work, use the repository-pinned toolchain and bootstrap:

```bash
pnpm doctor
pnpm bootstrap
pnpm validate
```

The complete procedure is documented in `docs/operations/local-development.md`.

## Development flow

1. Create a short-lived branch from the current `main`.
2. Include the Jira key in the branch name, for example `feature/NEX-123-description`, `fix/NEX-124-description`, `chore/NEX-125-description`, `docs/NEX-126-description`, or `refactor/NEX-127-description`.
3. Keep changes scoped and reviewable.
4. Add or update tests when behavior changes.
5. Update relevant documentation and ADRs when architecture or operational behavior changes.
6. Run `pnpm validate` before pushing.
7. Open a pull request whose title includes the Jira key.
8. Do not merge until required checks and reviews pass.

## Commit convention

Use the Jira key plus Conventional Commits when practical:

```text
NEX-123 feat(module): add capability
NEX-124 fix(module): correct behavior
NEX-125 chore(dx): update tooling
```

Supported categories include:

- `feat`: new functionality
- `fix`: bug fix
- `chore`: repository or tooling work
- `docs`: documentation only
- `refactor`: internal code change without intended behavior change
- `test`: test-only changes
- `ci`: CI/CD changes
- `security`: security hardening

## Git hooks

The repository configures local guardrails during dependency installation:

```text
pre-commit → lint-staged
pre-push   → pnpm validate
```

Git hooks do not replace protected GitHub Actions checks.

## Security and secrets

Never commit credentials, tokens, certificates, production data, populated `.env` files, or other secrets. Use approved secret-management mechanisms for runtime credentials.

## Architecture decisions

Material architectural decisions should be recorded as ADRs under `docs/adr/`.

## Pull requests

Pull requests should explain:

- what changed;
- why it changed;
- how it was validated;
- risks and rollback considerations;
- documentation or migration impact.
