# Contributing to Nexora TMS

Thank you for contributing to Nexora TMS.

## Development flow

1. Create a branch from the current default branch.
2. Use a focused branch name such as `feat/...`, `fix/...`, `chore/...`, `docs/...`, or `refactor/...`.
3. Keep changes scoped and reviewable.
4. Add or update tests when behavior changes.
5. Update relevant documentation and ADRs when architecture or operational behavior changes.
6. Open a pull request and complete the repository checklist.
7. Do not merge until required checks and reviews pass.

## Commit convention

Use Conventional Commits when practical:

- `feat:` new functionality
- `fix:` bug fix
- `chore:` repository or tooling work
- `docs:` documentation only
- `refactor:` internal code change without intended behavior change
- `test:` test-only changes
- `ci:` CI/CD changes
- `security:` security hardening

## Security and secrets

Never commit credentials, tokens, certificates, production data, `.env` files, or other secrets. Use approved secret-management mechanisms for runtime credentials.

## Architecture decisions

Material architectural decisions should be recorded as ADRs under `docs/adr/`.

## Pull requests

Pull requests should explain:

- what changed;
- why it changed;
- how it was validated;
- risks and rollback considerations;
- documentation or migration impact.
