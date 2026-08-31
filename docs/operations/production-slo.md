# Nexora TMS — Production Availability SLO and Error Budget

Jira: NEX-80

Date: 31/08/2026.

## 1. Scope

This document defines the internal availability SLO for the current Free-tier synchronous Production topology:

`Vercel Web → Railway API → Neon PostgreSQL`

It is an engineering reliability objective, not a contractual customer SLA. It intentionally uses the existing Free-tier Production health-monitor evidence and does not claim paid APM, SIEM or long-term metrics storage.

Worker-specific SLI/SLO and readiness controls become mandatory when NEX-90/NEX-91 add the asynchronous Worker topology.

## 2. Availability SLI

The availability SLI is calculated from completed **scheduled** runs of `.github/workflows/production-health-monitor.yml`.

A scheduled sample is successful only when the Production monitor workflow concludes with `success`. The underlying monitor already requires:

- the Railway Production API `/health` endpoint to be reachable;
- HTTP 200;
- the expected Nexora health payload;
- up to three bounded attempts before declaring the probe unhealthy.

Manual qualification runs and push-triggered monitor-test runs are excluded from the SLI so controlled tests cannot improve or degrade the Production availability calculation.

Formula:

`availability = successful completed scheduled monitor runs / all completed scheduled monitor runs in the rolling window`

## 3. Objective and error budget

Baseline objective for the current MVP/Free-tier phase:

- rolling window: **7 days / 168 hours**;
- availability target: **99.0%**;
- error budget: **1.0%** of completed scheduled monitor samples;
- monitor cadence: twice per hour, nominally 336 samples in a complete 7-day window;
- nominal full-window budget: approximately 3 failed scheduled samples before availability falls below 99.0%.

The evaluator uses the actual number of completed samples rather than assuming all 336 probes exist. This prevents missing GitHub runs from being silently counted as successful availability.

## 4. Data sufficiency and monitor freshness

The guard distinguishes application availability from monitor coverage.

- minimum completed samples before asserting the availability objective: **12**;
- scheduled monitor freshness threshold: **90 minutes**;
- fewer than 12 completed samples produces `insufficient_data`;
- a latest scheduled monitor older than 90 minutes produces `monitor_stale`, independent of the calculated availability ratio.

`insufficient_data` is not treated as proof of a healthy SLO. `monitor_stale` is an alert state because the measurement path itself is no longer providing timely evidence.

## 5. Guard states

`scripts/production-slo-evaluate.mjs` produces one of four states:

- `healthy` — sufficient samples, monitor fresh and observed availability at or above 99.0%;
- `insufficient_data` — monitor history exists but the minimum completed-sample threshold is not yet met;
- `budget_exhausted` — sufficient samples exist and observed availability is below 99.0%;
- `monitor_stale` — the scheduled monitor has not produced a timely run within the freshness threshold.

The evaluator also emits aggregate evidence including sample count, successful/failed samples, availability percentage, error-budget consumption and age of the latest scheduled monitor.

## 6. Operational reconciliation

Workflow: `.github/workflows/production-slo-guard.yml`.

Schedule: every six hours at minute 17 UTC, plus manual dispatch.

Behavior:

1. Read scheduled `Production Health Monitor` workflow history through the GitHub API.
2. Restrict evidence to the rolling seven-day window.
3. Evaluate the SLO using the versioned deterministic evaluator.
4. If state is `budget_exhausted` or `monitor_stale`, create one durable GitHub issue titled `[slo] Production API availability error budget` unless one is already open.
5. Mark the SLO workflow failed while the alert state is active so GitHub Actions also records the condition.
6. If a later evaluation returns `healthy`, comment on and close the durable SLO issue automatically.
7. If state is `insufficient_data`, do not claim health and do not automatically close an existing incident.

The incident contains aggregate monitor metadata only. It must not store Production response bodies, Authorization headers, cookies, credentials, secrets or tenant payloads.

## 7. Qualification

Pull-request and push executions are read-only qualifications. They:

- run deterministic evaluator self-tests;
- read the current scheduled Production monitor history;
- calculate and print the current state without opening or closing incidents.

This makes changes to the SLO algorithm reviewable and testable before operational reconciliation is enabled on the merged version.

## 8. Error-budget policy

When `budget_exhausted` is active:

- treat the open SLO issue as an operational reliability finding;
- investigate monitor failures and correlate them with Railway HTTP/runtime logs and deployment history;
- do not consume the error budget as permission to ignore a known outage;
- prioritize availability restoration over non-essential Production changes;
- require explicit reliability review before a new Production promotion when the error budget remains exhausted.

A SEV-1 security/isolation event is never downgraded by a healthy availability SLO. Security and tenant-isolation gates remain independent hard blockers.

## 9. Free-tier limitations

This baseline is deliberately compatible with the approved Free-only architecture:

- GitHub Actions workflow retention is provider-controlled;
- the SLI is sampled, not continuous;
- GitHub-hosted scheduling may be delayed;
- Railway resource metrics remain provider-retained;
- this is not multi-region synthetic monitoring;
- a provider-wide GitHub Actions outage may reduce measurement freshness and can trigger `monitor_stale` rather than being misclassified as healthy Production.

Critical reliability findings therefore remain summarized in durable Jira/GitHub evidence instead of relying only on transient provider telemetry.

## 10. NEX-80 boundary

For the current synchronous Production topology, NEX-80 is closure-ready when all of the following are true:

- API HTTP logs are structured JSON and exclude body, Authorization, cookies and query strings;
- Web→API correlation ID propagation exists;
- `/health/live` and DB-backed `/health/ready` are qualified;
- minimum Production metrics/alerting from NEX-82 remains available;
- the rolling Production availability SLO/error-budget guard is implemented and qualified;
- Worker observability is explicitly transferred to NEX-91 and becomes a mandatory acceptance gate before Worker joins active Production topology.
