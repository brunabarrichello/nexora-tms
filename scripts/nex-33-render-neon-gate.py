from pathlib import Path

p = Path('.github/workflows/neon-pr-gate.yml')
s = p.read_text()


def once(old: str, new: str) -> None:
    global s
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'Expected exactly one occurrence ({count} found): {old[:100]!r}')
    s = s.replace(old, new, 1)


once('      - "apps/api/src/freight/**"\n', '      - "apps/api/src/freight/**"\n      - "apps/api/src/capacity/**"\n')
once(
    '            commercial_enum_count integer;\n',
    '            commercial_enum_count integer;\n            driver_registration_enum_count integer;\n            driver_operational_enum_count integer;\n',
)

# The application-table and RLS lists each end with the commercial tables.
s = s.replace(
    "'transport_request_commercial_terms','transport_request_commercial_history'",
    "'transport_request_commercial_terms','transport_request_commercial_history',\n                 'drivers','driver_audit'",
)
if s.count("'drivers','driver_audit'") < 2:
    raise SystemExit('Driver tables were not added to both schema/RLS lists')

once(
    "            IF table_count <> 23 THEN\n              RAISE EXCEPTION 'Expected 23 application tables, found %', table_count;\n",
    "            IF table_count <> 25 THEN\n              RAISE EXCEPTION 'Expected 25 application tables, found %', table_count;\n",
)
once(
    "            IF rls_count <> 20 THEN\n              RAISE EXCEPTION 'Expected RLS on 20 tenant-scoped tables, found %', rls_count;\n",
    "            IF rls_count <> 22 THEN\n              RAISE EXCEPTION 'Expected RLS on 22 tenant-scoped tables, found %', rls_count;\n",
)
once(
    "            IF migration_count <> 9 THEN\n              RAISE EXCEPTION 'Expected 9 Drizzle migration records, found %', migration_count;\n",
    "            IF migration_count <> 10 THEN\n              RAISE EXCEPTION 'Expected 10 Drizzle migration records, found %', migration_count;\n",
)

commercial_enum = """            IF commercial_enum_count <> 4 THEN
              RAISE EXCEPTION 'Expected four commercial terms status values, found %', commercial_enum_count;
            END IF;
"""
once(
    commercial_enum,
    commercial_enum
    + """
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
""",
)

privilege_tail = """               OR has_table_privilege('nexora_app','public.transport_request_commercial_history','UPDATE')
               OR has_table_privilege('nexora_app','public.transport_request_commercial_history','DELETE') THEN
"""
once(
    privilege_tail,
    """               OR has_table_privilege('nexora_app','public.transport_request_commercial_history','UPDATE')
               OR has_table_privilege('nexora_app','public.transport_request_commercial_history','DELETE')
               OR NOT has_table_privilege('nexora_app','public.drivers','SELECT')
               OR NOT has_table_privilege('nexora_app','public.drivers','INSERT')
               OR NOT has_table_privilege('nexora_app','public.drivers','UPDATE')
               OR has_table_privilege('nexora_app','public.drivers','DELETE')
               OR NOT has_table_privilege('nexora_app','public.driver_audit','SELECT')
               OR NOT has_table_privilege('nexora_app','public.driver_audit','INSERT')
               OR has_table_privilege('nexora_app','public.driver_audit','UPDATE')
               OR has_table_privilege('nexora_app','public.driver_audit','DELETE') THEN
""",
)

no_context = """            SELECT count(*) INTO visible_count FROM transport_request_commercial_history;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'No-context commercial history must be 0, got %', visible_count; END IF;
"""
once(
    no_context,
    no_context
    + """            SELECT count(*) INTO visible_count FROM drivers;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'No-context drivers must be 0, got %', visible_count; END IF;
            SELECT count(*) INTO visible_count FROM driver_audit;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'No-context driver audit must be 0, got %', visible_count; END IF;
""",
)

user_only = """            SELECT count(*) INTO visible_count FROM transport_request_commercial_history;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'User-only context must not expose commercial history, got %', visible_count; END IF;
"""
once(
    user_only,
    user_only
    + """            SELECT count(*) INTO visible_count FROM drivers;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'User-only context must not expose drivers, got %', visible_count; END IF;
            SELECT count(*) INTO visible_count FROM driver_audit;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'User-only context must not expose driver audit, got %', visible_count; END IF;
""",
)

positive_anchor = """          END $$;
          SQL

          set +e
          commercial_cross_tenant_output="$(psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
"""
once(
    positive_anchor,
    """          END $$;

          INSERT INTO drivers (
            id, tenant_id, carrier_party_id, full_name, tax_id, email, phone, whatsapp,
            cnh_number, cnh_category, cnh_expires_on, registration_status, operational_status,
            created_by_user_id, updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000501','Gate Driver A','98765432100','driver-a@example.test',
            '11999999999','11999999999','12345678901','E','2029-12-31','qualified','active',
            '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101'
          );

          INSERT INTO driver_audit (
            id, tenant_id, driver_id, actor_user_id, change_type, after_snapshot
          ) VALUES (
            '00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000101',
            'created','{"registrationStatus":"qualified","operationalStatus":"active"}'::jsonb
          );

          UPDATE drivers
             SET operational_status='blocked', status_reason='Gate operational block', updated_at=now()
           WHERE id='00000000-0000-4000-8000-000000000901';

          INSERT INTO driver_audit (
            id, tenant_id, driver_id, actor_user_id, change_type, before_snapshot, after_snapshot
          ) VALUES (
            '00000000-0000-4000-8000-000000000903','00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000101',
            'status_changed','{"operationalStatus":"active"}'::jsonb,'{"operationalStatus":"blocked"}'::jsonb
          );

          DO $$ DECLARE d integer; a integer; op text; reason text; BEGIN
            SELECT count(*), max(operational_status::text), max(status_reason) INTO d, op, reason
              FROM drivers WHERE id='00000000-0000-4000-8000-000000000901';
            SELECT count(*) INTO a FROM driver_audit WHERE driver_id='00000000-0000-4000-8000-000000000901';
            IF d <> 1 OR op <> 'blocked' OR reason <> 'Gate operational block' THEN
              RAISE EXCEPTION 'Runtime driver lifecycle validation failed';
            END IF;
            IF a <> 2 THEN RAISE EXCEPTION 'Driver audit must contain 2 entries, got %', a; END IF;
          END $$;
          SQL

          set +e
          driver_cross_tenant_output="$(psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          SELECT set_config('app.user_id','00000000-0000-4000-8000-000000000101',false);
          SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',false);
          INSERT INTO drivers (
            tenant_id, full_name, tax_id, phone, cnh_number, cnh_category, cnh_expires_on,
            registration_status, operational_status, created_by_user_id, updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000002','Cross Tenant Driver','98765432101','11988888888',
            '12345678902','D','2029-12-31','qualified','active',
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

          set +e
          driver_invalid_status_output="$(psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          SELECT set_config('app.user_id','00000000-0000-4000-8000-000000000101',false);
          SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',false);
          INSERT INTO drivers (
            tenant_id, full_name, tax_id, phone, cnh_number, cnh_category, cnh_expires_on,
            registration_status, operational_status, created_by_user_id, updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000001','Invalid Active Driver','98765432102','11977777777',
            '12345678903','D','2029-12-31','pending','active',
            '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101'
          );
          SQL
          )"
          driver_invalid_status=$?
          set -e
          if [[ "$driver_invalid_status" -eq 0 ]] || ! grep -qi "drivers_active_status_check" <<<"$driver_invalid_status_output"; then
            echo "Driver active/qualified database constraint did not behave as expected." >&2
            echo "$driver_invalid_status_output" >&2
            exit 1
          fi

          set +e
          commercial_cross_tenant_output="$(psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
""",
)

fk_anchor = """          set +e
          commercial_request_fk_output="$(psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
"""
once(
    fk_anchor,
    """          set +e
          driver_carrier_fk_output="$(psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          INSERT INTO drivers (
            tenant_id, carrier_party_id, full_name, tax_id, phone, cnh_number, cnh_category, cnh_expires_on,
            registration_status, operational_status, created_by_user_id, updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000501',
            'Invalid Carrier Driver','98765432103','11966666666','12345678904','D','2029-12-31',
            'qualified','inactive','00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000102'
          );
          SQL
          )"
          driver_carrier_fk_status=$?
          set -e
          if [[ "$driver_carrier_fk_status" -eq 0 ]] || ! grep -qi "drivers_carrier_party_fk" <<<"$driver_carrier_fk_output"; then
            echo "Cross-tenant driver carrier FK rejection did not behave as expected." >&2
            echo "$driver_carrier_fk_output" >&2
            exit 1
          fi

          set +e
          commercial_request_fk_output="$(psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
""",
)

once(
    '      - name: Gate summary\n        run: echo "Neon database gate passed through NEX-32 commercial terms."\n',
    '      - name: Gate summary\n        run: echo "Neon database gate passed through NEX-33 driver capacity."\n',
)

p.write_text(s)
print(f'Wrote {p} ({len(s)} bytes)')
