# Wave 0024 — Transactional Outbox + Durable Jobs

**Jira:** NEX-90  
**ADR:** ADR-0006 — Transactional Outbox + Durable Jobs  
**Status:** implementation in progress

## Objective

Complete the reliability portion left open after the Wave 0024 audit delivery. Domain state and asynchronous intent must commit atomically, while processing survives API/Worker restarts without requiring an external broker in the initial architecture.

## Ownership

### API / transactional producers

The API owns creation of asynchronous intent while a tenant transaction is open.

- write business state;
- insert `outbox_events` in the same PostgreSQL transaction;
- optionally insert a `durable_jobs` row in that same transaction when the use case already knows the concrete job;
- never mark an outbox event processed;
- never acquire worker leases;
- never delete async history to hide failure.

`nexora_app` therefore has `SELECT, INSERT` only on `outbox_events` and `durable_jobs`. Tenant RLS remains mandatory through `app.tenant_id`.

### Worker / asynchronous consumer

`apps/worker` will consume the persistence model under `nexora_worker` in NEX-91.

- poll due work;
- acquire bounded leases;
- increment attempts;
- execute an idempotent handler;
- mark success or schedule retry;
- move exhausted work to logical dead-letter state;
- preserve correlation/request/idempotency metadata in logs and audit.

The worker intentionally needs cross-tenant queue visibility. This is granted only through explicit RLS policies on the two async tables. `nexora_worker` must never receive `BYPASSRLS` and does not receive `DELETE`.

## `outbox_events`

Each row is an immutable domain/integration intent plus mutable delivery metadata.

Core identity:

- `id`;
- `tenant_id`;
- `aggregate_type` + `aggregate_id`;
- `event_type` + `event_version`;
- `payload`;
- `idempotency_key` unique inside a tenant;
- `correlation_id` / `request_id`.

Delivery state:

- `available_at`;
- `processed_at`;
- `attempts` / `max_attempts`;
- `lease_owner` / `lease_expires_at`;
- `last_error`;
- `dead_lettered_at` / `dead_letter_reason`.

An event cannot be both processed and dead-lettered. Lease owner and lease expiry are an atomic pair.

## `durable_jobs`

A job is an explicit persistent execution state machine. It may reference the outbox event that originated it using a tenant-aware composite foreign key.

Statuses:

```text
pending
  -> running
  -> succeeded

pending/running
  -> retry_wait
  -> running

pending/running/retry_wait
  -> dead_lettered

pending/retry_wait
  -> cancelled
```

Terminal states (`succeeded`, `dead_lettered`, `cancelled`) require `finished_at`.

A `running` job requires a complete lock tuple:

- `locked_at`;
- `locked_by`;
- `lease_expires_at`.

## Idempotency

Both tables enforce a unique `(tenant_id, idempotency_key)`.

Handler idempotency remains mandatory even with the database constraint because delivery is at-least-once: a process may complete an external side effect and crash before persisting local completion.

Recommended handler key:

```text
<event-or-job-type>:<business-stable-key>:<version>
```

Keys must not contain secrets or raw sensitive document content.

## Retry and backoff

NEX-90 persists the inputs required by the retry policy. The Worker implementation in NEX-91 owns the scheduling algorithm.

Default policy target:

```text
next_run = now + min(base * 2^(attempt-1), max_backoff) + jitter
```

Rules:

- attempts are bounded by `max_attempts`;
- retries update `available_at` for outbox or `run_at` for durable jobs;
- retryable and terminal errors must be classified explicitly;
- `last_error` is sanitized and bounded;
- exhausted work becomes logical dead-letter rather than being deleted.

## Lease and concurrency contract

The runtime claim operation must use a single database transaction and row-level locking (`FOR UPDATE SKIP LOCKED` or an equivalent atomic claim pattern).

A claimant sets its worker identity and lease expiry before releasing the transaction. Expired leases are reclaimable. A healthy worker must not process a row leased by another live worker.

NEX-90 provides persistence constraints and indexes for this algorithm. NEX-91 provides the continuously running poller/processor.

## Dead-letter and reprocessing

Dead-letter is a state, not a second queue and not deletion.

Reprocessing must:

1. be explicitly authorized/audited;
2. preserve the original row and correlation chain;
3. clear terminal/lease state only through a controlled command;
4. reset availability/run time intentionally;
5. never reset an idempotency key to bypass duplicate protection.

An administrative reprocessing surface is not part of the initial NEX-90 API.

## RLS and privileges

`nexora_app`:

- tenant-scoped RLS only;
- `SELECT`, `INSERT`;
- no `UPDATE`, `DELETE`.

`nexora_worker`:

- explicit cross-tenant RLS policy only on `outbox_events` and `durable_jobs`;
- `SELECT`, `INSERT`, `UPDATE`;
- no `DELETE`;
- no `BYPASSRLS`.

## CI qualification

`Neon Async Reliability Gate` creates an isolated temporary Neon branch and validates:

- migration replay;
- table constraints and RLS;
- minimum privileges;
- tenant A/B isolation for `nexora_app`;
- duplicate idempotency rejection;
- inability of the API role to mutate consumer state;
- cross-tenant processing by `nexora_worker` without `BYPASSRLS`;
- lease, retry, success and dead-letter persistence;
- no Production mutation.

## Boundary with NEX-91

NEX-90 is the persistence/reliability contract. It does **not** declare `apps/worker` operationally complete.

NEX-91 starts after the NEX-90 data contract is qualified and owns:

- worker database connection lifecycle;
- atomic polling/claim implementation;
- handler registry;
- retry/backoff execution;
- structured logs/metrics/health;
- Railway service configuration;
- Development/Staging smoke processing;
- rollback and troubleshooting runbook.

## Broker policy

No RabbitMQ, Kafka, SQS or other broker is introduced by NEX-90. PostgreSQL is the initial durable coordination mechanism, exactly as accepted by ADR-0006. A broker requires evidence of need and a new ADR.
