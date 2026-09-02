# NEX-47 — Document Validity and Operational Blocking

## Scope

NEX-47 is an additive delta over the canonical Document Core delivered by Wave 0018. It does not create a second document aggregate and does not duplicate `documents`, `document_versions`, `document_validations`, `driver_documents`, `capacity_asset_documents` or typed document links.

The delta adds policy-driven validity warnings, operational compliance evaluation, blocking before contracting/trip execution, and bounded administrative exceptions.

## Canonical state

The `documents` lifecycle remains unchanged. Expiry continues to derive from `expires_on` and a document whose date is before `current_date` is effectively `expired`.

`expiring_soon` is a compliance/read-model state, not a new persisted document lifecycle status. It is calculated from the active policy `warning_days` for the document type.

Compliance evaluation states are:

- `missing`;
- `pending`;
- `rejected`;
- `expired`;
- `expiring_soon`;
- `valid`.

## Policy

`document_compliance_policies` is tenant-scoped and unique by tenant/document type.

A policy defines:

- whether the document type is required for `contracting`;
- whether it is required for `trip` execution;
- warning window (`warning_days`, 0..365);
- whether `expiring_soon` blocks;
- whether pending, rejected and expired documents block;
- active/inactive lifecycle.

Blocking policies are intentionally restricted to document types scoped to `party`, `driver` or `asset`, because those are the subjects carried by a confirmed transport contract and active trip capacity.

## Evaluation

`nexora_evaluate_document_compliance(subject_scope, subject_id, context)` is the single database evaluation function.

It resolves the current document evidence from the existing canonical relationships:

- party → `business_party_documents` + `documents`;
- driver → `driver_documents`, preferring its canonical `documents` link when present;
- asset → `capacity_asset_documents`, preferring its canonical `documents` link when present.

No new document ownership model is introduced.

`nexora_assert_document_compliance(...)` fails closed when any required finding is blocking.

## Operational enforcement

Database triggers prevent bypass through alternate application paths:

- confirmed transport contract insertion/status change checks driver, vehicle and carrier party in `contracting` context;
- trip transition to `ready` or `in_transit` checks active drivers/assets and linked carrier parties in `trip` context;
- adding/replacing active trip driver or asset on a trip already `ready`/`in_transit` is also checked.

Application RBAC remains responsible for who may invoke the use case; PostgreSQL enforcement is the second authority that prevents an unchecked persistence path from bypassing document compliance.

## Administrative override

`document_compliance_overrides` is append-only for `nexora_app`.

An override requires:

- context (`contracting` or `trip`);
- subject scope/id;
- document type;
- reason with at least 10 characters;
- creating user;
- future `valid_until` no more than 30 days after creation.

The database validates that the subject exists in the current tenant, the document type scope matches the subject, and an active policy is enabled for the requested context.

There is no UPDATE or DELETE privilege for runtime overrides. An exception expires naturally; a new record is required for any subsequent decision, preserving the audit trail.

HTTP mutation of policies and overrides requires `tenant.manage`. Evaluation/read operations require `documents.read`.

## Web alerts

The Documents UI now uses policy-aware status:

- a valid document inside its type-specific warning window renders as **A vencer**;
- the main Documents page exposes an `A vencer` filter and metric;
- the expiry page uses each policy's `warningDays` by default, while retaining an explicit window filter for operational inspection;
- `A vencer` can be informational or blocking independently, according to `block_when_expiring_soon`.

Types without a compliance policy keep a 30-day UI fallback only for visibility; fallback does not create a blocking rule.

## Security and least privilege

Both NEX-47 tables use tenant RLS based on `app.tenant_id`.

Runtime permissions:

- policies: SELECT, INSERT and UPDATE only on mutable policy columns; no DELETE and no UPDATE of tenant/type/creation audit identity;
- overrides: SELECT and INSERT only; no UPDATE or DELETE;
- compliance evaluation/assert functions: EXECUTE for `nexora_app`;
- helper/trigger functions: public EXECUTE revoked.

## Migrations

- `0032_nex47_document_compliance.sql` — policy, override, evaluation and enforcement baseline;
- `0033_nex47_document_compliance_hardening.sql` — bounded override, subject guard, safer trigger behavior and least-privilege hardening.

## Qualification gates

The existing **Neon Documents Gate** is extended instead of creating a parallel database qualification workflow.

On every relevant PR it:

1. creates an isolated Neon branch from the frozen Production parent;
2. replays the full migration chain;
3. validates Document Core regressions;
4. validates NEX-47 RLS/privilege/constraint/trigger invariants;
5. seeds two isolated tenants;
6. validates missing and `expiring_soon` states;
7. validates configurable blocking;
8. validates append-only temporary override behavior;
9. validates a real trip `planned → ready` block and a controlled override path;
10. validates cross-tenant invisibility/rejection;
11. removes the ephemeral Neon branch.

The normal CI remains responsible for lint, formatting, typecheck, tests, build, Docker Compose validation and Drizzle artifact checks.

NEX-47 is qualified for merge only when both normal CI and Neon Documents Gate pass on the same user-authored PR head.

## Production

NEX-47 qualification does not apply migrations or deploy code to Production. Production remains frozen until a separate promotion decision and approved SHA.
