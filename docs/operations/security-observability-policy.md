# Nexora TMS — Security Observability and Vulnerability Management

Jira: NEX-82 / NEX-80 / NEX-81 / NEX-88

Date: 31/08/2026.

## 1. Scope

This document defines the minimum Free-tier security observability, alerting, retention and vulnerability-management baseline for the current synchronous Nexora TMS Production topology:

`Vercel Web → Railway API → Neon PostgreSQL`

It deliberately does not claim a paid SIEM, APM, cross-region observability stack or Worker monitoring. Worker-specific controls become mandatory when NEX-90/NEX-91 add the asynchronous topology.

## 2. Current evidence sources

### Database audit

Wave 0024 provides the durable database audit baseline. Audit schema, immutability and tenant-runtime behavior are qualified in Production and are re-exercised by the controlled restore workflow.

The audit database is the durable source for security-sensitive application/domain actions that require stronger retention than transient platform logs.

### API structured logs

The API emits structured JSON HTTP completion events with:

- timestamp;
- severity level;
- service and environment;
- correlation ID;
- method;
- sanitized path;
- HTTP status;
- duration.

The access log intentionally excludes request bodies, Authorization headers, cookies and query strings.

### Railway platform metrics

Railway Production exposes service-level CPU, memory, disk/network measurements. A 24-hour baseline query on 31/08/2026 confirmed metrics are available for the Production API service. In that snapshot, memory averaged approximately 0.169 GB and peaked around 0.783 GB; CPU and network series were also available.

These resource metrics are operational signals, not a durable security audit store.

### GitHub Actions

GitHub Actions records:

- required CI results;
- dependency audit results;
- migration/Production qualification results;
- restore/DR qualification results;
- scheduled Production health monitor results.

## 3. Minimum Production availability alert

Workflow: `.github/workflows/production-health-monitor.yml`.

Schedule: twice per hour at minutes 07 and 37 UTC.

Behavior:

1. Probe the configured Railway Production `/health` endpoint.
2. Retry up to three times with bounded connection/request timeouts.
3. Require HTTP 200 and the expected Nexora health payload.
4. If all attempts fail, create one open GitHub incident issue titled `[monitor] Production API health unavailable` unless one is already open.
5. Mark the workflow run failed so GitHub Actions also records the alert state.
6. Do not store or publish the response body, credentials, cookies or request headers in the incident.
7. On a later healthy run, comment on and close the monitor incident automatically.

The monitor is a **minimum Free-tier availability alert**, not an SLA-grade external synthetic monitoring service. GitHub notification delivery depends on repository/account notification settings; the durable alert artifact is the workflow run plus incident issue.

## 4. Critical event taxonomy

The following events require explicit traceability and, where supported, correlation to a Jira/GitHub incident or audit record.

### SEV-1 / critical security or isolation events

- proven cross-tenant data access or mutation;
- RLS/tenant-isolation qualification failure;
- audit immutability failure;
- confirmed privileged credential compromise;
- Production database integrity/corruption event affecting multiple tenants;
- unauthorized Production promotion or release-SHA mismatch.

Target response: immediate containment and incident tracking.

### SEV-2 / high operational-security events

- Production API health outage confirmed after monitor retries;
- authentication/identity infrastructure outage that blocks legitimate access;
- failed Production migration with potential data impact;
- high/critical reachable dependency vulnerability;
- failure of restore/rollback qualification required for a Production change.

Target response: same-day triage and owner assignment.

### SEV-3 / medium operational events

- repeated 5xx behavior without tenant-boundary impact;
- resource saturation trend requiring capacity review;
- non-critical vulnerability requiring scheduled remediation;
- degraded external dependency with an available workaround.

Target response: backlog item with bounded remediation date.

## 5. Retention policy

The project uses different retention classes because Free provider logs are not equivalent to a compliance archive.

### Durable project evidence

Keep indefinitely unless a later legal/data-retention policy supersedes this baseline:

- version-controlled runbooks and policies;
- Jira decisions/findings;
- GitHub incident issues;
- Production Version Matrix history;
- database audit records unless a later approved retention/deletion policy is introduced.

### Provider/platform logs and workflow runs

Railway/Vercel/GitHub platform retention is provider-controlled and may change with plan limits. Therefore:

- do not rely on platform logs as the only evidence for a critical event;
- before provider evidence can expire, summarize critical findings in Jira/GitHub and preserve the relevant immutable identifiers/run IDs;
- never copy secrets or full sensitive payloads merely to extend retention.

### Security incident evidence

For SEV-1/SEV-2 incidents preserve at minimum:

- detection time;
- affected environment/component;
- correlation/run/deployment identifiers;
- containment/recovery action;
- owner;
- outcome;
- linked remediation tickets.

## 6. Dependency and vulnerability controls

### Automated controls

The required CI executes:

`pnpm audit --prod --audit-level=high`

High and critical Production dependency findings therefore block the required CI gate.

Dependabot is configured weekly for:

- npm dependencies, Monday 09:00 America/Sao_Paulo;
- GitHub Actions, Monday 09:30 America/Sao_Paulo.

Minor/patch npm updates are grouped to reduce noise while preserving reviewability.

### Triage process

For every relevant vulnerability:

1. Confirm affected package/version and whether the vulnerable path is reachable in Nexora.
2. Classify severity using upstream advisory severity plus project reachability/business impact.
3. Open or link a tracked Jira/GitHub item when remediation is not immediate.
4. Prefer a supported patched version through a normal PR and required CI.
5. Re-run dependency audit and affected tests.
6. Promote only through the normal release governance when Production runtime changes.
7. If remediation must be deferred, document compensating controls, owner, expiry/review date and explicit acceptance.

### Remediation targets

- **Critical:** immediate containment; patch/mitigate within 24 hours when a supported remediation exists.
- **High:** patch/mitigate within 3 business days.
- **Moderate:** remediate or formally disposition within 14 days.
- **Low:** remediate, group with routine maintenance or disposition within 30 days.

A reachable vulnerability with active exploitation evidence can be escalated above the package advisory severity.

## 7. Metrics review baseline

At minimum review the following signals when investigating an incident or before a major Production promotion:

- Railway CPU and memory usage;
- network RX/TX behavior;
- deployment health status;
- API HTTP status/duration structured logs;
- Production health-monitor history;
- Neon connection/database qualification gates;
- dependency audit state.

Resource thresholds are not hard-coded here because Railway metric units/limits can change with plan/runtime sizing. Thresholds must be expressed against the active service limit when provider-enforced alerting or a stable metrics collector is introduced.

## 8. Alert and finding ownership

- Production health incident: current Production/release owner.
- API security/application event: API/security owner for the tracked work item.
- Database isolation/audit failure: database/Production operator plus release owner.
- Dependency vulnerability: owner of the remediation PR/ticket.
- Cross-platform outage: release owner coordinates component owners.

Unassigned critical findings are not considered triaged.

## 9. Exit criteria for NEX-82 baseline

The NEX-82 minimum baseline is considered implemented when:

- Wave 0024 durable Audit/immutability remains qualified;
- required CI blocks high/critical Production dependency audit failures;
- Dependabot recurring review is configured;
- critical event taxonomy is documented;
- retention/evidence policy is documented;
- vulnerability triage/remediation targets are documented;
- Production resource metrics are confirmed available;
- a recurring external Production health probe creates a durable incident artifact when unhealthy and closes it after verified recovery;
- the monitor's failure and recovery paths are exercised at least once without changing Production runtime.

Future enhancements such as centralized APM, long-term metric storage, SLO/error budgets and Worker observability remain NEX-80/future hardening rather than hidden NEX-82 completion criteria.
