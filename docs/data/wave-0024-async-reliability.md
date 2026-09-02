# Wave 0024 — Transactional Outbox + Durable Jobs

**Jira:** NEX-90  
**ADR:** ADR-0006 — Transactional Outbox + Durable Jobs  
**Status:** implementation in progress

## Objective

Complete the reliability portion left open after the Wave 0024 audit delivery. Domain state and asynchronous intent commit atomically, while processing state survives API/Worker restarts without requiring an external broker in the initial architecture.

## Ownership

### API / transactional producers

The API owns creation of asynchronous intent while a tenant transaction is open.

- write business state;
- insert `outbox_events` in the same PostgreSQL transaction;
- optionally insert a `durable_jobs` row in that same transaction when the use case already knows the concrete job;
- never mark an outbox event processed;
- never acquire worker leases;
- never delete async history to hide failure.

`apps/api/src/reliability/transactional-async.ts` provides transaction-bound helpers. They accept the caller's existing `TenantQueryClient` and deliberately do not create a connection or issue `BEGIN`/`COMMIT`.

`nexora_app` therefore has `SELECT, INSERT` only on `outbox_events` and `durable_jobs`. Tenant RLS remains mandatory through `app.tenant_id`.

### Worker / asynchronous consumer

`apps/worker` will consume the persistence model under `nexora_worker` in NEX-91.

- poll due work;
- call the database claim primitives;
- execute an idempotent handler;
- call success/failure primitives;
- emit structured runtime logs/metrics using the correlation metadata returned by each claimed row;
- expose worker health/readiness and Railway operational behavior.

The worker intentionally needs cross-tenant queue visibility. This is granted only through explicit RLS policies on the two async tables. `nexora_worker` never receives `BYPASSRLS` or `DELETE`.

## `outbox_events`

Each row is a durable domain/integration intent plus mutable delivery metadata.

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

Completion functions are lease-owner aware and return false when the row is already terminal or belongs to another worker, preventing local double completion.

## Atomic claim and concurrency

NEX-90 implements the claim algorithm in PostgreSQL so all Worker instances share one concurrency contract:

- `nexora_claim_outbox_events(worker_id, batch_size, lease_seconds)`;
- `nexora_claim_durable_jobs(worker_id, batch_size, lease_seconds)`.

Both use one atomic statement with `FOR UPDATE SKIP LOCKED`, a bounded batch, worker identity and lease expiry. A second worker cannot claim currently leased work. Expired leases are eligible for recovery while attempts remain.

The functions are `SECURITY INVOKER`; only `nexora_worker` receives `EXECUTE`.

## Retry and backoff

NEX-90 implements bounded exponential retry persistence:

```text
next_run = now + min(base_backoff * 2^(attempt-1), max_backoff)
```

Runtime functions:

- `nexora_fail_outbox_event(...)`;
- `nexora_fail_durable_job(...)`.

Rules:

- attempts are bounded by `max_attempts`;
- base/max backoff are caller-configurable within safe bounds;
- retries update `available_at` for outbox or `run_at` for durable jobs;
- `last_error` and dead-letter reasons are length-bounded;
- exhausted work becomes logical dead-letter rather than being deleted;
- retry/dead-letter transitions write correlated `audit_events`.

Jitter and handler-specific error classification remain runtime policy in NEX-91; the durable scheduling and upper bounds are already enforced by NEX-90.

## Completion

Worker-only completion primitives:

- `nexora_complete_outbox_event(event_id, worker_id)`;
- `nexora_complete_durable_job(job_id, worker_id)`.

They require the active lease owner, clear the lease atomically, persist terminal success and append a correlated audit event. Repeating completion after terminal state is a no-op (`false`).

## Dead-letter and controlled reprocessing

Dead-letter is a state, not a second queue and not deletion.

NEX-90 implements owner-only reprocessing primitives:

- `nexora_requeue_dead_lettered_outbox_event(...)`;
- `nexora_requeue_dead_lettered_job(...)`.

Only `nexora_owner` receives `EXECUTE`; `nexora_worker`, `nexora_app` and `PUBLIC` do not.

Reprocessing:

1. only accepts a current dead-letter row;
2. preserves row identity, tenant, payload, correlation and idempotency key;
3. clears terminal/lease/error state;
4. resets the attempt counter intentionally;
5. sets a new availability/run time;
6. writes an `admin` audit event;
7. cannot be applied twice without the row becoming dead-lettered again.

An HTTP/UI administrative reprocessing surface is not part of NEX-90.

## Audit and observability contract

Processing transitions persist audit envelopes in the existing append-only `audit_events` model:

- `async.outbox.processed`;
- `async.outbox.retry_scheduled`;
- `async.outbox.dead_lettered`;
- `async.outbox.requeued`;
- `async.job.succeeded`;
- `async.job.retry_scheduled`;
- `async.job.dead_lettered`;
- `async.job.requeued`.

The events retain tenant, entity id, correlation id, request id and idempotency key. `nexora_worker` receives INSERT-only audit access through a worker-specific RLS policy; it cannot mutate immutable audit history.

Runtime structured logs, counters, latency metrics, health/readiness and alerting are operational behavior of `apps/worker` and remain NEX-91. NEX-90 supplies every correlation/state field required for those signals.

## RLS and privileges

`nexora_app`:

- tenant-scoped RLS only;
- `SELECT`, `INSERT` on async tables;
- no consumer `UPDATE` or destructive `DELETE`;
- no Worker function execution.

`nexora_worker`:

- explicit cross-tenant RLS policy only on `outbox_events` and `durable_jobs`;
- `SELECT`, `INSERT`, `UPDATE` on async tables;
- `INSERT` only on `audit_events`;
- `EXECUTE` only on claim/complete/fail primitives;
- no owner requeue execution;
- no `DELETE`;
- no `BYPASSRLS`.

`nexora_owner` owns controlled dead-letter requeue execution.

## CI qualification

`Neon Async Reliability Gate` creates an isolated temporary Neon branch and validates:

- full migration replay;
- table constraints and RLS;
- minimum privileges and function execution boundaries;
- tenant A/B isolation for `nexora_app`;
- duplicate idempotency rejection;
- inability of the API role to mutate consumer state;
- cross-tenant processing by `nexora_worker` without `BYPASSRLS`;
- atomic claims and lease ownership;
- wrong-worker completion rejection;
- duplicate completion rejection;
- bounded retry scheduling;
- retry → reclaim → success;
- dead-letter transitions;
- execution audit metadata;
- owner-only controlled reprocessing while preserving idempotency;
- ephemeral branch cleanup;
- no Production mutation.

The gate includes bounded retries for ephemeral Neon branch allocation because the current Free plan has a shared branch limit and multiple database gates may execute concurrently.

## Boundary with NEX-91

NEX-90 is the persistence/reliability contract. It does **not** declare `apps/worker` operationally complete.

NEX-91 consumes, rather than reimplements, the NEX-90 primitives and owns:

- worker database connection lifecycle;
- continuously running poll loop;
- handler registry;
- handler idempotency against real side effects;
- runtime error classification/jitter policy;
- structured logs, metrics, latency and queue-age telemetry;
- health/readiness;
- Railway service configuration;
- Development/Staging smoke processing;
- rollback and troubleshooting runbook.

## Broker policy

No RabbitMQ, Kafka, SQS or other broker is introduced by NEX-90. PostgreSQL is the initial durable coordination mechanism, exactly as accepted by ADR-0006. A broker requires evidence of need and a new ADR.
