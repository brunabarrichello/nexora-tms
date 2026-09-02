# NEX-48 — Pickup and Delivery Proof Integrity

## Scope

NEX-48 is a residual integrity delta over the Trip Execution and Document Core models already delivered by Wave 0023 and Wave 0018.

It does not create a new proof or document aggregate. The canonical structures remain:

- `trip_documents` for typed links from a canonical document to a trip and optional stop;
- `trip_proofs` for pickup, delivery and other execution evidence;
- `trip_delivery_proofs` for delivery-specific POD metadata.

## Existing acceptance coverage

The existing model already records:

- proof type;
- capture date/time;
- notes and metadata;
- responsible user;
- canonical document link;
- tenant-scoped RLS;
- append-only execution evidence;
- delivery receiver/status details;
- read access after the trip reaches a terminal state.

## Residual invariant

Operational pickup and delivery evidence must always identify the exact operational stop it proves.

For `proof_type = pickup` or `delivery`:

1. `trip_stop_id` is mandatory;
2. the referenced stop must belong to the same tenant and trip;
3. a pickup proof must reference a pickup stop;
4. a delivery proof must reference a delivery stop;
5. when the linked `trip_document` is itself stop-scoped, its stop must match the proof stop.

Other evidence types (`seal`, `weight`, `checklist`, `other`) continue to support trip-level or stop-level use cases.

## Enforcement

Migration `0034_nex48_trip_proof_stop_integrity.sql` adds:

- a local check requiring a stop for pickup/delivery proofs;
- the `nexora_trip_proof_stop_integrity_guard` trigger function for cross-table stop/type/document integrity;
- the `trip_proofs_stop_integrity_guard` trigger;
- revoked public execution on the helper function.

The existing composite foreign keys and RLS remain authoritative for tenant/trip ownership.

## Qualification

The existing Neon Trip Execution Gate remains the qualification path. Its API integration now verifies:

- pickup without a stop is rejected;
- delivery proof against a pickup stop is rejected;
- correct pickup and delivery evidence is accepted;
- captured user and notes are persisted;
- delivery POD remains linked to the delivery proof;
- another tenant cannot read the trip proofs;
- pickup and delivery proofs remain readable after the trip is completed.

Production remains frozen and is not changed by NEX-48 PR qualification.