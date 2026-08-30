from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


api_path = Path('.github/workflows/api-tenant-neon-gate.yml')
api = api_path.read_text()
api = replace_once(
    api,
    """      - name: Gate summary
""",
    """      - name: Run Capacity Reservation integration against Neon
        shell: bash
        env:
          DATABASE_URL: ${{ env.APP_DATABASE_URL }}
          DATABASE_POOL_MAX: \"2\"
        run: |
          set -euo pipefail
          node apps/api/dist/negotiation/capacity-reservation.integration.js

      - name: Gate summary
""",
    'API reservation integration step',
)
api = replace_once(
    api,
    """            echo \"- Freight proposal terminal status immutability: verified\"
""",
    """            echo \"- Freight proposal terminal status immutability: verified\"
            echo \"- Winning proposal capacity reservation: verified\"
            echo \"- Double active capacity allocation: rejected\"
            echo \"- Reservation cancellation with reason: verified\"
            echo \"- Reservation history and capacity release: verified\"
""",
    'API summary',
)
api_path.write_text(api)


db_path = Path('.github/workflows/neon-pr-gate.yml')
db = db_path.read_text()

# Extend all canonical application-table lists that end with the NEX-38 negotiation tables.
db = db.replace(
    "'freight_proposals','freight_proposal_events'",
    "'freight_proposals','freight_proposal_events','capacity_reservations','capacity_reservation_events'",
)

db = replace_once(db, 'IF table_count <> 30 THEN', 'IF table_count <> 32 THEN', 'table count check')
db = replace_once(
    db,
    "RAISE EXCEPTION 'Expected 30 application tables, found %', table_count;",
    "RAISE EXCEPTION 'Expected 32 application tables, found %', table_count;",
    'table count message',
)
db = replace_once(db, 'IF rls_count <> 27 THEN', 'IF rls_count <> 29 THEN', 'RLS count check')
db = replace_once(
    db,
    "RAISE EXCEPTION 'Expected RLS on 27 tenant-scoped tables, found %', rls_count;",
    "RAISE EXCEPTION 'Expected RLS on 29 tenant-scoped tables, found %', rls_count;",
    'RLS count message',
)
db = replace_once(db, 'IF migration_count <> 13 THEN', 'IF migration_count <> 14 THEN', 'migration count check')
db = replace_once(
    db,
    "RAISE EXCEPTION 'Expected 13 Drizzle migration records, found %', migration_count;",
    "RAISE EXCEPTION 'Expected 14 Drizzle migration records, found %', migration_count;",
    'migration count message',
)

db = replace_once(
    db,
    '            freight_proposal_status_enum_count integer;\n',
    '            freight_proposal_status_enum_count integer;\n            capacity_reservation_status_enum_count integer;\n            capacity_reservation_event_enum_count integer;\n',
    'enum declarations',
)

enum_marker = """            IF freight_proposal_status_enum_count <> 4 THEN
              RAISE EXCEPTION 'Expected four freight proposal status values, found %', freight_proposal_status_enum_count;
            END IF;

"""
enum_extension = enum_marker + """            SELECT count(*) INTO capacity_reservation_status_enum_count
              FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
             WHERE t.typname='capacity_reservation_status'
               AND e.enumlabel IN ('active','cancelled');
            IF capacity_reservation_status_enum_count <> 2 THEN
              RAISE EXCEPTION 'Expected two capacity reservation status values, found %', capacity_reservation_status_enum_count;
            END IF;

            SELECT count(*) INTO capacity_reservation_event_enum_count
              FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
             WHERE t.typname='capacity_reservation_event_type'
               AND e.enumlabel IN ('approved','cancelled');
            IF capacity_reservation_event_enum_count <> 2 THEN
              RAISE EXCEPTION 'Expected two capacity reservation event values, found %', capacity_reservation_event_enum_count;
            END IF;

"""
db = replace_once(db, enum_marker, enum_extension, 'reservation enum checks')

priv_marker = """               OR has_table_privilege('nexora_app','public.freight_proposal_events','DELETE') THEN
"""
priv_extension = """               OR has_table_privilege('nexora_app','public.freight_proposal_events','DELETE')
               OR NOT has_table_privilege('nexora_app','public.capacity_reservations','SELECT')
               OR NOT has_table_privilege('nexora_app','public.capacity_reservations','INSERT')
               OR has_table_privilege('nexora_app','public.capacity_reservations','UPDATE')
               OR has_table_privilege('nexora_app','public.capacity_reservations','DELETE')
               OR NOT has_column_privilege('nexora_app','public.capacity_reservations','status','UPDATE')
               OR NOT has_column_privilege('nexora_app','public.capacity_reservations','cancelled_by_user_id','UPDATE')
               OR NOT has_column_privilege('nexora_app','public.capacity_reservations','cancelled_at','UPDATE')
               OR NOT has_column_privilege('nexora_app','public.capacity_reservations','cancel_reason','UPDATE')
               OR NOT has_column_privilege('nexora_app','public.capacity_reservations','updated_at','UPDATE')
               OR has_column_privilege('nexora_app','public.capacity_reservations','tenant_id','UPDATE')
               OR has_column_privilege('nexora_app','public.capacity_reservations','transport_request_id','UPDATE')
               OR has_column_privilege('nexora_app','public.capacity_reservations','proposal_id','UPDATE')
               OR has_column_privilege('nexora_app','public.capacity_reservations','capacity_assignment_id','UPDATE')
               OR has_column_privilege('nexora_app','public.capacity_reservations','driver_id','UPDATE')
               OR has_column_privilege('nexora_app','public.capacity_reservations','vehicle_id','UPDATE')
               OR has_column_privilege('nexora_app','public.capacity_reservations','carrier_party_id','UPDATE')
               OR has_column_privilege('nexora_app','public.capacity_reservations','approved_by_user_id','UPDATE')
               OR has_column_privilege('nexora_app','public.capacity_reservations','approved_at','UPDATE')
               OR NOT has_table_privilege('nexora_app','public.capacity_reservation_events','SELECT')
               OR NOT has_table_privilege('nexora_app','public.capacity_reservation_events','INSERT')
               OR has_table_privilege('nexora_app','public.capacity_reservation_events','UPDATE')
               OR has_table_privilege('nexora_app','public.capacity_reservation_events','DELETE') THEN
"""
db = replace_once(db, priv_marker, priv_extension, 'reservation privileges')

no_context_marker = """            SELECT count(*) INTO visible_count FROM freight_proposal_events;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'No-context freight proposal events must be 0, got %', visible_count; END IF;
"""
no_context_extension = no_context_marker + """            SELECT count(*) INTO visible_count FROM capacity_reservations;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'No-context capacity reservations must be 0, got %', visible_count; END IF;
            SELECT count(*) INTO visible_count FROM capacity_reservation_events;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'No-context capacity reservation events must be 0, got %', visible_count; END IF;
"""
db = replace_once(db, no_context_marker, no_context_extension, 'no-context reservation visibility')

user_only_marker = """            SELECT count(*) INTO visible_count FROM freight_proposal_events;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'User-only context must not expose freight proposal events, got %', visible_count; END IF;
"""
user_only_extension = user_only_marker + """            SELECT count(*) INTO visible_count FROM capacity_reservations;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'User-only context must not expose capacity reservations, got %', visible_count; END IF;
            SELECT count(*) INTO visible_count FROM capacity_reservation_events;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'User-only context must not expose capacity reservation events, got %', visible_count; END IF;
"""
db = replace_once(db, user_only_marker, user_only_extension, 'user-only reservation visibility')

runtime_marker = """      - name: Validate tenant-aware foreign-key rejection
"""
runtime_step = """      - name: Validate NEX-39 capacity reservation runtime and isolation
        shell: bash
        env:
          APP_DATABASE_URL: ${{ steps.app-connection.outputs.db_url }}
        run: |
          set -euo pipefail
          echo \"::add-mask::$APP_DATABASE_URL\"

          psql \"$APP_DATABASE_URL\" -v ON_ERROR_STOP=1 <<'SQL'
          SELECT set_config('app.user_id','00000000-0000-4000-8000-000000000101',false);
          SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',false);
          INSERT INTO capacity_reservations (
            id,tenant_id,transport_request_id,proposal_id,capacity_assignment_id,driver_id,vehicle_id,carrier_party_id,approved_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000910','00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000908',
            '00000000-0000-4000-8000-000000000904','00000000-0000-4000-8000-000000000901',
            '00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000501',
            '00000000-0000-4000-8000-000000000101'
          );
          INSERT INTO capacity_reservation_events (tenant_id,reservation_id,type,actor_user_id)
          VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000910','approved','00000000-0000-4000-8000-000000000101');
          DO $$ DECLARE r integer; e integer; BEGIN
            SELECT count(*) INTO r FROM capacity_reservations WHERE status='active';
            SELECT count(*) INTO e FROM capacity_reservation_events WHERE reservation_id='00000000-0000-4000-8000-000000000910';
            IF r <> 1 OR e <> 1 THEN RAISE EXCEPTION 'Capacity reservation approval trail failed: reservations %, events %', r, e; END IF;
          END $$;
          SQL

          set +e
          reservation_duplicate_output=\"$(psql \"$APP_DATABASE_URL\" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          SELECT set_config('app.user_id','00000000-0000-4000-8000-000000000101',false);
          SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',false);
          INSERT INTO capacity_reservations (
            tenant_id,transport_request_id,proposal_id,capacity_assignment_id,driver_id,vehicle_id,carrier_party_id,approved_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000801',
            '00000000-0000-4000-8000-000000000908','00000000-0000-4000-8000-000000000904',
            '00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000902',
            '00000000-0000-4000-8000-000000000501','00000000-0000-4000-8000-000000000101'
          );
          SQL
          )\"
          reservation_duplicate_status=$?
          set -e
          if [[ \"$reservation_duplicate_status\" -eq 0 ]] || ! grep -qi \"capacity_reservations_active_\" <<<\"$reservation_duplicate_output\"; then
            echo \"Duplicate active capacity reservation was not rejected as expected.\" >&2
            echo \"$reservation_duplicate_output\" >&2
            exit 1
          fi

          set +e
          reservation_immutable_output=\"$(psql \"$APP_DATABASE_URL\" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          SELECT set_config('app.user_id','00000000-0000-4000-8000-000000000101',false);
          SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',false);
          UPDATE capacity_reservations SET proposal_id='00000000-0000-4000-8000-000000000907'
           WHERE id='00000000-0000-4000-8000-000000000910';
          SQL
          )\"
          reservation_immutable_status=$?
          set -e
          if [[ \"$reservation_immutable_status\" -eq 0 ]] || ! grep -qi \"permission denied\" <<<\"$reservation_immutable_output\"; then
            echo \"Reservation identity columns must not be mutable by nexora_app.\" >&2
            echo \"$reservation_immutable_output\" >&2
            exit 1
          fi

          set +e
          reservation_cross_tenant_output=\"$(psql \"$APP_DATABASE_URL\" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          SELECT set_config('app.user_id','00000000-0000-4000-8000-000000000101',false);
          SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',false);
          INSERT INTO capacity_reservations (
            tenant_id,transport_request_id,proposal_id,capacity_assignment_id,driver_id,vehicle_id,carrier_party_id,approved_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000801',
            '00000000-0000-4000-8000-000000000908','00000000-0000-4000-8000-000000000904',
            '00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000902',
            '00000000-0000-4000-8000-000000000501','00000000-0000-4000-8000-000000000101'
          );
          SQL
          )\"
          reservation_cross_tenant_status=$?
          set -e
          if [[ \"$reservation_cross_tenant_status\" -eq 0 ]] || ! grep -qi \"row-level security policy\" <<<\"$reservation_cross_tenant_output\"; then
            echo \"Cross-tenant capacity reservation RLS rejection did not behave as expected.\" >&2
            echo \"$reservation_cross_tenant_output\" >&2
            exit 1
          fi

          psql \"$APP_DATABASE_URL\" -v ON_ERROR_STOP=1 <<'SQL'
          SELECT set_config('app.user_id','00000000-0000-4000-8000-000000000101',false);
          SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',false);
          UPDATE capacity_reservations
             SET status='cancelled',cancelled_by_user_id='00000000-0000-4000-8000-000000000101',
                 cancelled_at=now(),cancel_reason='Gate cancellation',updated_at=now()
           WHERE id='00000000-0000-4000-8000-000000000910';
          INSERT INTO capacity_reservation_events (tenant_id,reservation_id,type,actor_user_id,reason)
          VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000910','cancelled','00000000-0000-4000-8000-000000000101','Gate cancellation');
          INSERT INTO capacity_reservations (
            id,tenant_id,transport_request_id,proposal_id,capacity_assignment_id,driver_id,vehicle_id,carrier_party_id,approved_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000911','00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000908',
            '00000000-0000-4000-8000-000000000904','00000000-0000-4000-8000-000000000901',
            '00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000501',
            '00000000-0000-4000-8000-000000000101'
          );
          INSERT INTO capacity_reservation_events (tenant_id,reservation_id,type,actor_user_id)
          VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000911','approved','00000000-0000-4000-8000-000000000101');
          DO $$ DECLARE active_count integer; cancelled_count integer; event_count integer; BEGIN
            SELECT count(*) FILTER (WHERE status='active'), count(*) FILTER (WHERE status='cancelled')
              INTO active_count,cancelled_count FROM capacity_reservations;
            SELECT count(*) INTO event_count FROM capacity_reservation_events;
            IF active_count <> 1 OR cancelled_count <> 1 OR event_count <> 3 THEN
              RAISE EXCEPTION 'Reservation release/history failed: active %, cancelled %, events %', active_count,cancelled_count,event_count;
            END IF;
          END $$;
          SQL

""" + runtime_marker
db = replace_once(db, runtime_marker, runtime_step, 'reservation runtime step')

summary_marker = """            echo \"- Freight proposal append-only history: verified\"
"""
summary_extension = summary_marker + """            echo \"- Capacity reservation active uniqueness: verified\"
            echo \"- Capacity reservation restricted cancellation update: verified\"
            echo \"- Capacity reservation approval/cancellation trail: verified\"
            echo \"- Capacity reservation cross-tenant RLS: verified\"
"""
db = replace_once(db, summary_marker, summary_extension, 'database summary')

db_path.write_text(db)

print('NEX-39 permanent gates rendered successfully')
