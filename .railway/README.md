# Railway Infrastructure as Code

The Nexora TMS Railway target is defined in `.railway/railway.ts`.

## Managed services

- `api` — NestJS API, health check at `/api/v1/health`.
- `worker` — persistent NestJS worker.

Both services use the shared monorepo root and workspace-filtered build/start commands.

## Secrets

Database credentials are not stored in this repository. The IaC file uses `preserve()` for secret values that must be injected in Railway per environment:

- API: `DATABASE_URL`.
- Worker: `WORKER_DATABASE_URL`.

Production, staging and development credentials must be distinct.

## Plan and apply

After the project exists in Railway and the local directory is linked to the intended environment:

```bash
pnpm infra:railway:plan
pnpm infra:railway:apply
```

Always review the plan before applying. Do not use destructive confirmation flags unless the proposed deletions were explicitly reviewed.

## Current provisioning gate

At the time this baseline was created, the connected Railway workspace was on the Free plan and rejected creation of `nexora-tms` with a resource-provision limit error. No existing Moventra project is to be deleted or reused to bypass this limit.
