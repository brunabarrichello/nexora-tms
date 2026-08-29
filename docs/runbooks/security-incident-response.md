# Runbook — Security Incident Response Baseline

**Jira:** NEX-23 / NEX-82

## Trigger examples

Use the incident process for suspected or confirmed:

- cross-tenant exposure;
- authentication/authorization bypass;
- leaked secret/credential;
- compromised account/service identity;
- malicious or unexpected data access;
- critical dependency vulnerability with relevant exposure;
- document or financial-data exposure;
- destructive unauthorized action;
- integrity compromise affecting audit or operational records.

## Immediate priorities

1. protect people/customer data and stop active exposure;
2. preserve evidence without spreading sensitive data;
3. identify affected environments/tenants/components;
4. revoke/rotate compromised credentials where appropriate;
5. contain the vulnerable path;
6. establish incident owner and timeline;
7. choose recovery/rollback based on verified state.

## Secret exposure

If a credential is committed, logged, shared or otherwise exposed:

- treat it as compromised even if quickly deleted;
- revoke/rotate it first;
- identify workloads/environments that used it;
- review access/activity evidence;
- remove the value from normal repository/document surfaces where appropriate;
- do not rely on Git history rewriting as credential remediation.

## Cross-tenant incident

- block the vulnerable operation/path;
- preserve request/correlation/audit evidence;
- determine source tenant(s), affected tenant(s), resource types and time window;
- test alternate access paths, not only the reported endpoint;
- verify database policies/queries and application authorization separately;
- create a regression test before declaring the defect fixed;
- assess notification/legal obligations through the appropriate organizational process.

## Recovery

For integrity/data-loss incidents, use the database backup/restore runbook. Restore into isolation for verification whenever possible before production cutover.

## Evidence

Record:

- incident identifier and severity;
- discovery time/source;
- affected systems/environments;
- known tenant/data scope;
- relevant correlation/audit IDs;
- containment actions;
- credential rotations;
- remediation PR/migration/deployment;
- validation/regression evidence;
- follow-up actions/owners.

Do not paste raw secrets, sensitive documents or unnecessary personal data into incident tickets.

## Closure

An incident is not closed only because service is restored. Closure requires verified containment, remediation, regression coverage where feasible, credential/data recovery actions, documented residual risk and follow-up ownership.
