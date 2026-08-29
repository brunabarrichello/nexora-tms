from pathlib import Path

path = Path('.github/workflows/neon-pr-gate.yml')
text = path.read_text()


def replace_once(old: str, new: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f'Expected gate fragment not found: {old[:140]!r}')
    text = text.replace(old, new, 1)


replace_once(
    '            capacity_asset_status_enum_count integer;\n',
    '            capacity_asset_status_enum_count integer;\n            capacity_assignment_enum_count integer;\n',
)
text = text.replace(
    "'capacity_assets','capacity_asset_audit'",
    "'capacity_assets','capacity_asset_audit','capacity_assignments'",
)
replace_once('            IF table_count <> 27 THEN\n', '            IF table_count <> 28 THEN\n')
replace_once(
    "              RAISE EXCEPTION 'Expected 27 application tables, found %', table_count;\n",
    "              RAISE EXCEPTION 'Expected 28 application tables, found %', table_count;\n",
)
replace_once('            IF rls_count <> 24 THEN\n', '            IF rls_count <> 25 THEN\n')
replace_once(
    "              RAISE EXCEPTION 'Expected RLS on 24 tenant-scoped tables, found %', rls_count;\n",
    "              RAISE EXCEPTION 'Expected RLS on 25 tenant-scoped tables, found %', rls_count;\n",
)
replace_once('            IF migration_count <> 11 THEN\n', '            IF migration_count <> 12 THEN\n')
replace_once(
    "              RAISE EXCEPTION 'Expected 11 Drizzle migration records, found %', migration_count;\n",
    "              RAISE EXCEPTION 'Expected 12 Drizzle migration records, found %', migration_count;\n",
)

enum_anchor = """            IF capacity_asset_status_enum_count <> 3 THEN
              RAISE EXCEPTION 'Expected three capacity asset status values, found %', capacity_asset_status_enum_count;
            END IF;

            IF NOT EXISTS (
"""
enum_replacement = """            IF capacity_asset_status_enum_count <> 3 THEN
              RAISE EXCEPTION 'Expected three capacity asset status values, found %', capacity_asset_status_enum_count;
            END IF;

            SELECT count(*) INTO capacity_assignment_enum_count
              FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
             WHERE t.typname='capacity_assignment_status'
               AND e.enumlabel IN ('active','ended','cancelled');
            IF capacity_assignment_enum_count <> 3 THEN
              RAISE EXCEPTION 'Expected three capacity assignment status values, found %', capacity_assignment_enum_count;
            END IF;

            IF NOT EXISTS (
"""
replace_once(enum_anchor, enum_replacement)

priv_anchor = """               OR NOT has_table_privilege('nexora_app','public.capacity_asset_audit','INSERT')
               OR has_table_privilege('nexora_app','public.capacity_asset_audit','UPDATE')
               OR has_table_privilege('nexora_app','public.capacity_asset_audit','DELETE') THEN
"""
priv_replacement = """               OR NOT has_table_privilege('nexora_app','public.capacity_asset_audit','INSERT')
               OR has_table_privilege('nexora_app','public.capacity_asset_audit','UPDATE')
               OR has_table_privilege('nexora_app','public.capacity_asset_audit','DELETE')
               OR NOT has_table_privilege('nexora_app','public.capacity_assignments','SELECT')
               OR NOT has_table_privilege('nexora_app','public.capacity_assignments','INSERT')
               OR has_table_privilege('nexora_app','public.capacity_assignments','UPDATE')
               OR has_table_privilege('nexora_app','public.capacity_assignments','DELETE')
               OR NOT has_column_privilege('nexora_app','public.capacity_assignments','status','UPDATE')
               OR NOT has_column_privilege('nexora_app','public.capacity_assignments','ends_at','UPDATE')
               OR NOT has_column_privilege('nexora_app','public.capacity_assignments','status_reason','UPDATE')
               OR NOT has_column_privilege('nexora_app','public.capacity_assignments','updated_by_user_id','UPDATE')
               OR NOT has_column_privilege('nexora_app','public.capacity_assignments','updated_at','UPDATE')
               OR has_column_privilege('nexora_app','public.capacity_assignments','tenant_id','UPDATE')
               OR has_column_privilege('nexora_app','public.capacity_assignments','driver_id','UPDATE')
               OR has_column_privilege('nexora_app','public.capacity_assignments','vehicle_id','UPDATE')
               OR has_column_privilege('nexora_app','public.capacity_assignments','carrier_party_id','UPDATE')
               OR has_column_privilege('nexora_app','public.capacity_assignments','starts_at','UPDATE') THEN
"""
replace_once(priv_anchor, priv_replacement)

no_context_anchor = """            SELECT count(*) INTO visible_count FROM capacity_asset_audit;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'No-context capacity asset audit must be 0, got %', visible_count; END IF;
"""
replace_once(
    no_context_anchor,
    no_context_anchor
    + """            SELECT count(*) INTO visible_count FROM capacity_assignments;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'No-context capacity assignments must be 0, got %', visible_count; END IF;
""",
)

user_context_anchor = """            SELECT count(*) INTO visible_count FROM capacity_asset_audit;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'User-only context must not expose capacity asset audit, got %', visible_count; END IF;
"""
replace_once(
    user_context_anchor,
    user_context_anchor
    + """            SELECT count(*) INTO visible_count FROM capacity_assignments;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'User-only context must not expose capacity assignments, got %', visible_count; END IF;
""",
)

runtime_anchor = """          set +e
          commercial_cross_tenant_output="$(psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
"""
runtime_assignment_checks = """          psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
          SELECT set_config('app.user_id','00000000-0000-4000-8000-000000000101',false);
          SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',false);
          INSERT INTO capacity_assignments (
            id,tenant_id,driver_id,vehicle_id,carrier_party_id,status,starts_at,created_by_user_id,updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000903','00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000902',
            '00000000-0000-4000-8000-000000000501','active','2026-09-01T08:00:00Z',
            '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101'
          );
          UPDATE capacity_assignments
             SET status='ended',ends_at='2026-09-02T08:00:00Z',updated_by_user_id='00000000-0000-4000-8000-000000000101',updated_at=now()
           WHERE id='00000000-0000-4000-8000-000000000903';
          INSERT INTO capacity_assignments (
            id,tenant_id,driver_id,vehicle_id,carrier_party_id,status,starts_at,created_by_user_id,updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000904','00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000902',
            '00000000-0000-4000-8000-000000000501','active','2026-09-03T08:00:00Z',
            '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101'
          );
          DO $$ DECLARE h integer; a integer; BEGIN
            SELECT count(*) INTO h FROM capacity_assignments WHERE driver_id='00000000-0000-4000-8000-000000000901';
            SELECT count(*) INTO a FROM capacity_assignments WHERE driver_id='00000000-0000-4000-8000-000000000901' AND status='active';
            IF h <> 2 OR a <> 1 THEN RAISE EXCEPTION 'Capacity assignment history/active composition failed: history %, active %', h, a; END IF;
          END $$;
          SQL

          set +e
          assignment_duplicate_output="$(psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          SELECT set_config('app.user_id','00000000-0000-4000-8000-000000000101',false);
          SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',false);
          INSERT INTO capacity_assignments (
            tenant_id,driver_id,vehicle_id,carrier_party_id,status,created_by_user_id,updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000901',
            '00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000501','active',
            '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101'
          );
          SQL
          )"
          assignment_duplicate_status=$?
          set -e
          if [[ "$assignment_duplicate_status" -eq 0 ]] || ! grep -qi "capacity_assignments_active_" <<<"$assignment_duplicate_output"; then
            echo "Duplicate active capacity assignment was not rejected as expected." >&2
            echo "$assignment_duplicate_output" >&2
            exit 1
          fi

          set +e
          assignment_immutable_output="$(psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          SELECT set_config('app.user_id','00000000-0000-4000-8000-000000000101',false);
          SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',false);
          UPDATE capacity_assignments SET carrier_party_id='00000000-0000-4000-8000-000000000503'
           WHERE id='00000000-0000-4000-8000-000000000904';
          SQL
          )"
          assignment_immutable_status=$?
          set -e
          if [[ "$assignment_immutable_status" -eq 0 ]] || ! grep -qi "permission denied" <<<"$assignment_immutable_output"; then
            echo "Historical assignment identity columns must not be mutable by nexora_app." >&2
            echo "$assignment_immutable_output" >&2
            exit 1
          fi

          set +e
          assignment_cross_tenant_output="$(psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          SELECT set_config('app.user_id','00000000-0000-4000-8000-000000000101',false);
          SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',false);
          INSERT INTO capacity_assignments (
            tenant_id,driver_id,vehicle_id,carrier_party_id,status,created_by_user_id,updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000901',
            '00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000501','active',
            '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101'
          );
          SQL
          )"
          assignment_cross_tenant_status=$?
          set -e
          if [[ "$assignment_cross_tenant_status" -eq 0 ]] || ! grep -qi "row-level security policy" <<<"$assignment_cross_tenant_output"; then
            echo "Cross-tenant capacity assignment RLS rejection did not behave as expected." >&2
            echo "$assignment_cross_tenant_output" >&2
            exit 1
          fi

""" + runtime_anchor
replace_once(runtime_anchor, runtime_assignment_checks)

fk_anchor = """          set +e
          commercial_request_fk_output="$(psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
"""
fk_assignment_checks = """          set +e
          assignment_carrier_fk_output="$(psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          INSERT INTO capacity_assignments (
            tenant_id,driver_id,vehicle_id,carrier_party_id,status,created_by_user_id,updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000901',
            '00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000502','active',
            '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101'
          );
          SQL
          )"
          assignment_carrier_fk_status=$?
          set -e
          if [[ "$assignment_carrier_fk_status" -eq 0 ]] || ! grep -qi "capacity_assignments_carrier_party_fk" <<<"$assignment_carrier_fk_output"; then
            echo "Cross-tenant capacity assignment/carrier FK rejection did not behave as expected." >&2
            echo "$assignment_carrier_fk_output" >&2
            exit 1
          fi

          set +e
          assignment_driver_fk_output="$(psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          INSERT INTO capacity_assignments (
            tenant_id,driver_id,vehicle_id,carrier_party_id,status,created_by_user_id,updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000901',
            '00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000502','active',
            '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101'
          );
          SQL
          )"
          assignment_driver_fk_status=$?
          set -e
          if [[ "$assignment_driver_fk_status" -eq 0 ]] || ! grep -qi "capacity_assignments_driver_fk" <<<"$assignment_driver_fk_output"; then
            echo "Cross-tenant capacity assignment/driver FK rejection did not behave as expected." >&2
            echo "$assignment_driver_fk_output" >&2
            exit 1
          fi

""" + fk_anchor
replace_once(fk_anchor, fk_assignment_checks)

replace_once(
    '        run: echo "Neon database gate passed through NEX-34 vehicle and implement capacity."\n',
    '        run: echo "Neon database gate passed through NEX-35 active capacity composition history."\n',
)

path.write_text(text)
