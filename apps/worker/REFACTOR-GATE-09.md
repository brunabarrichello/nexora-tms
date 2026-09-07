# Worker refactor — Gate 09 runtime readiness

## Objective

Keep the Worker deployment path deterministic and fail fast when the runtime is connected to the wrong PostgreSQL identity or database.

## Changes

- `WORKER_DATABASE_URL` remains the preferred credential source.
- Parameterized database configuration is restricted to `nexora_worker`.
- Both configuration modes target the `nexora` database by default/validation.
- PostgreSQL connection timeout is bounded and configurable through `WORKER_DATABASE_CONNECTION_TIMEOUT_MS`.
- Runtime connection validation requires `current_user=nexora_worker` and `current_database=nexora`.
- Worker startup does not execute migrations.
- Production is not changed by this refactor.

## Acceptance

CI must pass build, typecheck and tests. A real Development deployment must subsequently prove:

- `current_user=nexora_worker`
- `session_user=nexora_worker`
- `current_database=nexora`
- `BYPASSRLS=false` where applicable
- Worker bootstrap completed
- `/health` succeeds

Railway account provisioning capacity remains an independent infrastructure gate and is not bypassed by code.
