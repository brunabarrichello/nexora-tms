# Nexora TMS — Observability Baseline

**Status:** Wave 0 baseline in progress  
**Jira:** NEX-23 / NEX-80 / NEX-82

## Objective

Nexora must make requests, jobs, integrations and sensitive operational events traceable across Web, API, Worker and PostgreSQL without exposing secrets or unnecessary personal data.

## Correlation model

Every externally initiated request receives or generates a correlation identifier at the trusted API boundary.

Propagation targets:

```text
Web request
  -> API correlationId
  -> database/outbox record where relevant
  -> worker job/event
  -> outbound integration/webhook delivery
```

Asynchronous work additionally tracks:

- event/job ID;
- causation ID when applicable;
- tenant ID when tenant-scoped;
- aggregate/resource reference when safe and useful;
- attempt/retry state.

Do not use a correlation ID as authorization proof.

## Structured logs

Application/worker logs should use structured fields rather than free-form concatenated context.

Recommended common fields:

- timestamp;
- level;
- service (`web`, `api`, `worker`);
- environment;
- correlation ID;
- request/job/event identifier;
- tenant identifier when operationally necessary;
- operation/module name;
- outcome/status;
- duration;
- error code/classification.

Never log:

- passwords;
- API/access/refresh tokens;
- private keys;
- raw database connection strings;
- session secrets;
- full sensitive documents;
- unnecessary personal/financial payloads.

## Health and readiness

### Liveness

Answers whether the process is alive and able to continue executing.

Liveness should not fail merely because a transient external dependency is down if the process itself is healthy.

### Readiness

Answers whether the instance can safely receive its intended workload.

Readiness may consider essential dependencies such as database connectivity and required startup state.

### Worker readiness

Worker readiness must reflect whether it can safely process jobs, not merely whether the process exists.

## Metrics baseline

Initial service metrics should cover, when executable infrastructure exists:

- request count/rate;
- latency distribution;
- error rate by stable error classification;
- health/readiness state;
- database connectivity/pool pressure signals available to the app;
- worker queue/backlog size;
- job success/failure/retry counts;
- outbox processing lag;
- external integration latency/failure/retry;
- webhook delivery/replay/rejection counts;
- critical authorization-denial patterns without exposing sensitive payloads.

Business metrics are separate from technical telemetry and require explicit definitions/ownership.

## Audit vs application logs

Audit events are durable business/security evidence and must not depend solely on transient application logs.

Audit candidates include:

- login/session security events;
- membership/role/permission changes;
- privileged configuration changes;
- sensitive document access/change;
- security-relevant authorization denials;
- destructive/administrative actions;
- manual job/event reprocessing;
- financial-state changes where required.

Audit records should include actor/service identity, tenant context, operation, target reference, timestamp, result and correlation information while minimizing sensitive payload duplication.

## Alerting principles

Alerts should indicate actionable degradation rather than raw noise.

Initial alert candidates:

- API/Worker sustained readiness failure;
- elevated error rate;
- abnormal latency;
- growing/stalled async backlog;
- repeated job failure/dead-letter state;
- database unavailability;
- repeated webhook signature/replay failures;
- critical security scanning failure on release path.

Exact thresholds are established after baseline traffic measurements exist.

## Retention and access

- log/audit retention must follow data classification and operational need;
- production telemetry access is least-privilege;
- lower-environment logs never receive copied production payloads;
- deletion/retention requirements must account for incident/audit needs and LGPD obligations.

## Completion gate

This document is the observability target. NEX-80/NEX-82 are not complete until structured logging, correlation propagation, health/readiness, metrics/audit and scanning are implemented and observed in an executable environment.
