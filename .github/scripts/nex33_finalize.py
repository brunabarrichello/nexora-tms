from pathlib import Path

path = Path('.github/workflows/neon-pr-gate.yml')
text = path.read_text()


def replace_once(source: str, old: str, new: str) -> str:
    if old not in source:
        raise SystemExit(f'Expected gate fragment not found: {old[:120]!r}')
    return source.replace(old, new, 1)


text = replace_once(
    text,
    '      - "apps/api/src/freight/**"\n',
    '      - "apps/api/src/freight/**"\n      - "apps/api/src/capacity/**"\n',
)
text = replace_once(
    text,
    '            commercial_enum_count integer;\n',
    '            commercial_enum_count integer;\n            driver_registration_enum_count integer;\n            driver_operational_enum_count integer;\n',
)
text = text.replace(
    "'transport_request_commercial_terms','transport_request_commercial_history'",
    "'transport_request_commercial_terms','transport_request_commercial_history','drivers','driver_audit'",
)
text = replace_once(text, '            IF table_count <> 23 THEN\n', '            IF table_count <> 25 THEN\n')
text = replace_once(
    text,
    "              RAISE EXCEPTION 'Expected 23 application tables, found %', table_count;\n",
    "              RAISE EXCEPTION 'Expected 25 application tables, found %', table_count;\n",
)
text = replace_once(text, '            IF rls_count <> 20 THEN\n', '            IF rls_count <> 22 THEN\n')
text = replace_once(
    text,
    "              RAISE EXCEPTION 'Expected RLS on 20 tenant-scoped tables, found %', rls_count;\n",
    "              RAISE EXCEPTION 'Expected RLS on 22 tenant-scoped tables, found %', rls_count;\n",
)
text = replace_once(text, '            IF migration_count <> 9 THEN\n', '            IF migration_count <> 10 THEN\n')
text = replace_once(
    text,
    "              RAISE EXCEPTION 'Expected 9 Drizzle migration records, found %', migration_count;\n",
    "              RAISE EXCEPTION 'Expected 10 Drizzle migration records, found %', migration_count;\n",
)

enum_anchor = """            IF commercial_enum_count <> 4 THEN
              RAISE EXCEPTION 'Expected four commercial terms status values, found %', commercial_enum_count;
            END IF;

            IF NOT EXISTS (
"""
enum_replacement = """            IF commercial_enum_count <> 4 THEN
              RAISE EXCEPTION 'Expected four commercial terms status values, found %', commercial_enum_count;
            END IF;

            SELECT count(*) INTO driver_registration_enum_count
              FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
             WHERE t.typname='driver_registration_status'
               AND e.enumlabel IN ('pending','qualified','blocked','inactive');
            IF driver_registration_enum_count <> 4 THEN
              RAISE EXCEPTION 'Expected four driver registration status values, found %', driver_registration_enum_count;
            END IF;

            SELECT count(*) INTO driver_operational_enum_count
              FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
             WHERE t.typname='driver_operational_status'
               AND e.enumlabel IN ('active','blocked','inactive');
            IF driver_operational_enum_count <> 3 THEN
              RAISE EXCEPTION 'Expected three driver operational status values, found %', driver_operational_enum_count;
            END IF;

            IF NOT EXISTS (
"""
text = replace_once(text, enum_anchor, enum_replacement)

privilege_anchor = """               OR has_table_privilege('nexora_app','public.transport_request_commercial_history','UPDATE')
               OR has_table_privilege('nexora_app','public.transport_request_commercial_history','DELETE') THEN
"""
privilege_replacement = """               OR has_table_privilege('nexora_app','public.transport_request_commercial_history','UPDATE')
               OR has_table_privilege('nexora_app','public.transport_request_commercial_history','DELETE')
               OR NOT has_table_privilege('nexora_app','public.drivers','SELECT')
               OR NOT has_table_privilege('nexora_app','public.drivers','INSERT')
               OR NOT has_table_privilege('nexora_app','public.drivers','UPDATE')
               OR has_table_privilege('nexora_app','public.drivers','DELETE')
               OR NOT has_table_privilege('nexora_app','public.driver_audit','SELECT')
               OR NOT has_table_privilege('nexora_app','public.driver_audit','INSERT')
               OR has_table_privilege('nexora_app','public.driver_audit','UPDATE')
               OR has_table_privilege('nexora_app','public.driver_audit','DELETE') THEN
"""
text = replace_once(text, privilege_anchor, privilege_replacement)

no_context_anchor = """            SELECT count(*) INTO visible_count FROM transport_request_commercial_history;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'No-context commercial history must be 0, got %', visible_count; END IF;
"""
no_context_replacement = no_context_anchor + """            SELECT count(*) INTO visible_count FROM drivers;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'No-context drivers must be 0, got %', visible_count; END IF;
            SELECT count(*) INTO visible_count FROM driver_audit;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'No-context driver audit must be 0, got %', visible_count; END IF;
"""
text = replace_once(text, no_context_anchor, no_context_replacement)

user_context_anchor = """            SELECT count(*) INTO visible_count FROM transport_request_commercial_history;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'User-only context must not expose commercial history, got %', visible_count; END IF;
"""
user_context_replacement = user_context_anchor + """            SELECT count(*) INTO visible_count FROM drivers;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'User-only context must not expose drivers, got %', visible_count; END IF;
            SELECT count(*) INTO visible_count FROM driver_audit;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'User-only context must not expose driver audit, got %', visible_count; END IF;
"""
text = replace_once(text, user_context_anchor, user_context_replacement)

runtime_anchor = """          set +e
          commercial_cross_tenant_output="$(psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
"""
runtime_driver_checks = """          psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
          SELECT set_config('app.user_id','00000000-0000-4000-8000-000000000101',false);
          SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',false);
          INSERT INTO drivers (
            id,tenant_id,carrier_party_id,full_name,tax_id,email,phone,whatsapp,cnh_number,cnh_category,
            cnh_expires_on,registration_status,operational_status,created_by_user_id,updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000501',
            'Gate Driver A','98765432100','driver-a@example.test','11999990000','11999990000','12345678901','E',
            '2029-12-31','qualified','active','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101'
          );
          INSERT INTO driver_audit (tenant_id,driver_id,actor_user_id,change_type,after_snapshot)
          VALUES (
            '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000101',
            'created','{"id":"00000000-0000-4000-8000-000000000901","registrationStatus":"qualified","operationalStatus":"active"}'::jsonb
          );
          DO $$ DECLARE d integer; a integer; BEGIN
            SELECT count(*) INTO d FROM drivers WHERE id='00000000-0000-4000-8000-000000000901';
            SELECT count(*) INTO a FROM driver_audit WHERE driver_id='00000000-0000-4000-8000-000000000901';
            IF d <> 1 OR a <> 1 THEN RAISE EXCEPTION 'Driver runtime create/audit failed: driver %, audit %', d, a; END IF;
          END $$;
          SQL

          set +e
          driver_audit_update_output="$(psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          SELECT set_config('app.user_id','00000000-0000-4000-8000-000000000101',false);
          SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',false);
          UPDATE driver_audit SET change_type='updated' WHERE driver_id='00000000-0000-4000-8000-000000000901';
          SQL
          )"
          driver_audit_update_status=$?
          set -e
          if [[ "$driver_audit_update_status" -eq 0 ]] || ! grep -qi "permission denied" <<<"$driver_audit_update_output"; then
            echo "Driver audit must be append-only for nexora_app." >&2
            echo "$driver_audit_update_output" >&2
            exit 1
          fi

          set +e
          driver_cross_tenant_output="$(psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          SELECT set_config('app.user_id','00000000-0000-4000-8000-000000000101',false);
          SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',false);
          INSERT INTO drivers (
            tenant_id,carrier_party_id,full_name,tax_id,phone,cnh_number,cnh_category,cnh_expires_on,
            created_by_user_id,updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000502','Cross Tenant Driver',
            '98765432101','11999990001','12345678902','D','2029-12-31',
            '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101'
          );
          SQL
          )"
          driver_cross_tenant_status=$?
          set -e
          if [[ "$driver_cross_tenant_status" -eq 0 ]] || ! grep -qi "row-level security policy" <<<"$driver_cross_tenant_output"; then
            echo "Cross-tenant driver RLS rejection did not behave as expected." >&2
            echo "$driver_cross_tenant_output" >&2
            exit 1
          fi

""" + runtime_anchor
text = replace_once(text, runtime_anchor, runtime_driver_checks)

fk_anchor = """          set +e
          commercial_request_fk_output="$(psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
"""
fk_driver_check = """          set +e
          driver_carrier_fk_output="$(psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          INSERT INTO drivers (
            tenant_id,carrier_party_id,full_name,tax_id,phone,cnh_number,cnh_category,cnh_expires_on,
            created_by_user_id,updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000502','Invalid Cross Tenant Carrier Driver',
            '98765432102','11999990002','12345678903','C','2029-12-31',
            '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101'
          );
          SQL
          )"
          driver_carrier_fk_status=$?
          set -e
          if [[ "$driver_carrier_fk_status" -eq 0 ]] || ! grep -qi "drivers_carrier_party_fk" <<<"$driver_carrier_fk_output"; then
            echo "Cross-tenant driver/carrier FK rejection did not behave as expected." >&2
            echo "$driver_carrier_fk_output" >&2
            exit 1
          fi

""" + fk_anchor
text = replace_once(text, fk_anchor, fk_driver_check)

text = replace_once(
    text,
    '        run: echo "Neon database gate passed through NEX-32 commercial terms."\n',
    '        run: echo "Neon database gate passed through NEX-33 driver qualification."\n',
)

path.write_text(text)
