from pathlib import Path

path = Path('.github/workflows/neon-pr-gate.yml')
text = path.read_text()


def replace_once(old: str, new: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f'Expected gate fragment not found: {old[:120]!r}')
    text = text.replace(old, new, 1)


replace_once(
    '            driver_operational_enum_count integer;\n',
    '            driver_operational_enum_count integer;\n'
    '            capacity_asset_kind_enum_count integer;\n'
    '            capacity_asset_status_enum_count integer;\n',
)
text = text.replace(
    "'transport_request_commercial_terms','transport_request_commercial_history','drivers','driver_audit'",
    "'transport_request_commercial_terms','transport_request_commercial_history','drivers','driver_audit','capacity_assets','capacity_asset_audit'",
)
replace_once('            IF table_count <> 25 THEN\n', '            IF table_count <> 27 THEN\n')
replace_once(
    "              RAISE EXCEPTION 'Expected 25 application tables, found %', table_count;\n",
    "              RAISE EXCEPTION 'Expected 27 application tables, found %', table_count;\n",
)
replace_once('            IF rls_count <> 22 THEN\n', '            IF rls_count <> 24 THEN\n')
replace_once(
    "              RAISE EXCEPTION 'Expected RLS on 22 tenant-scoped tables, found %', rls_count;\n",
    "              RAISE EXCEPTION 'Expected RLS on 24 tenant-scoped tables, found %', rls_count;\n",
)
replace_once('            IF migration_count <> 10 THEN\n', '            IF migration_count <> 11 THEN\n')
replace_once(
    "              RAISE EXCEPTION 'Expected 10 Drizzle migration records, found %', migration_count;\n",
    "              RAISE EXCEPTION 'Expected 11 Drizzle migration records, found %', migration_count;\n",
)

enum_anchor = """            IF driver_operational_enum_count <> 3 THEN
              RAISE EXCEPTION 'Expected three driver operational status values, found %', driver_operational_enum_count;
            END IF;

            IF NOT EXISTS (
"""
enum_replacement = """            IF driver_operational_enum_count <> 3 THEN
              RAISE EXCEPTION 'Expected three driver operational status values, found %', driver_operational_enum_count;
            END IF;

            SELECT count(*) INTO capacity_asset_kind_enum_count
              FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
             WHERE t.typname='capacity_asset_kind'
               AND e.enumlabel IN ('vehicle','implement');
            IF capacity_asset_kind_enum_count <> 2 THEN
              RAISE EXCEPTION 'Expected two capacity asset kind values, found %', capacity_asset_kind_enum_count;
            END IF;

            SELECT count(*) INTO capacity_asset_status_enum_count
              FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
             WHERE t.typname='capacity_asset_status'
               AND e.enumlabel IN ('active','blocked','inactive');
            IF capacity_asset_status_enum_count <> 3 THEN
              RAISE EXCEPTION 'Expected three capacity asset status values, found %', capacity_asset_status_enum_count;
            END IF;

            IF NOT EXISTS (
"""
replace_once(enum_anchor, enum_replacement)

priv_anchor = """               OR NOT has_table_privilege('nexora_app','public.driver_audit','INSERT')
               OR has_table_privilege('nexora_app','public.driver_audit','UPDATE')
               OR has_table_privilege('nexora_app','public.driver_audit','DELETE') THEN
"""
priv_replacement = """               OR NOT has_table_privilege('nexora_app','public.driver_audit','INSERT')
               OR has_table_privilege('nexora_app','public.driver_audit','UPDATE')
               OR has_table_privilege('nexora_app','public.driver_audit','DELETE')
               OR NOT has_table_privilege('nexora_app','public.capacity_assets','SELECT')
               OR NOT has_table_privilege('nexora_app','public.capacity_assets','INSERT')
               OR NOT has_table_privilege('nexora_app','public.capacity_assets','UPDATE')
               OR has_table_privilege('nexora_app','public.capacity_assets','DELETE')
               OR NOT has_table_privilege('nexora_app','public.capacity_asset_audit','SELECT')
               OR NOT has_table_privilege('nexora_app','public.capacity_asset_audit','INSERT')
               OR has_table_privilege('nexora_app','public.capacity_asset_audit','UPDATE')
               OR has_table_privilege('nexora_app','public.capacity_asset_audit','DELETE') THEN
"""
replace_once(priv_anchor, priv_replacement)

no_context_anchor = """            SELECT count(*) INTO visible_count FROM driver_audit;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'No-context driver audit must be 0, got %', visible_count; END IF;
"""
replace_once(
    no_context_anchor,
    no_context_anchor
    + """            SELECT count(*) INTO visible_count FROM capacity_assets;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'No-context capacity assets must be 0, got %', visible_count; END IF;
            SELECT count(*) INTO visible_count FROM capacity_asset_audit;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'No-context capacity asset audit must be 0, got %', visible_count; END IF;
""",
)

user_context_anchor = """            SELECT count(*) INTO visible_count FROM driver_audit;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'User-only context must not expose driver audit, got %', visible_count; END IF;
"""
replace_once(
    user_context_anchor,
    user_context_anchor
    + """            SELECT count(*) INTO visible_count FROM capacity_assets;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'User-only context must not expose capacity assets, got %', visible_count; END IF;
            SELECT count(*) INTO visible_count FROM capacity_asset_audit;
            IF visible_count <> 0 THEN RAISE EXCEPTION 'User-only context must not expose capacity asset audit, got %', visible_count; END IF;
""",
)

runtime_anchor = """          set +e
          commercial_cross_tenant_output="$(psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
"""
runtime_insert = """          psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
          SELECT set_config('app.user_id','00000000-0000-4000-8000-000000000101',false);
          SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',false);
          INSERT INTO capacity_assets (
            id,tenant_id,carrier_party_id,asset_kind,identifier,plate,vehicle_type,body_type,
            capacity_weight_kg,capacity_volume_m3,max_length_m,max_width_m,max_height_m,
            tracking_available,status,created_by_user_id,updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000501',
            'vehicle','GATE-TRUCK-001','ABC1D23','truck','sider',14000,85,14.8,2.6,2.9,true,'active',
            '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101'
          );
          INSERT INTO capacity_asset_audit (tenant_id,asset_id,actor_user_id,change_type,after_snapshot)
          VALUES (
            '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000101',
            'created','{"id":"00000000-0000-4000-8000-000000000902","identifier":"GATE-TRUCK-001","status":"active"}'::jsonb
          );
          DO $$ DECLARE a integer; h integer; BEGIN
            SELECT count(*) INTO a FROM capacity_assets WHERE id='00000000-0000-4000-8000-000000000902';
            SELECT count(*) INTO h FROM capacity_asset_audit WHERE asset_id='00000000-0000-4000-8000-000000000902';
            IF a <> 1 OR h <> 1 THEN RAISE EXCEPTION 'Capacity asset runtime create/audit failed: asset %, audit %', a, h; END IF;
          END $$;
          SQL

          set +e
          capacity_audit_update_output="$(psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          SELECT set_config('app.user_id','00000000-0000-4000-8000-000000000101',false);
          SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',false);
          UPDATE capacity_asset_audit SET change_type='updated' WHERE asset_id='00000000-0000-4000-8000-000000000902';
          SQL
          )"
          capacity_audit_update_status=$?
          set -e
          if [[ "$capacity_audit_update_status" -eq 0 ]] || ! grep -qi "permission denied" <<<"$capacity_audit_update_output"; then
            echo "Capacity asset audit must be append-only for nexora_app." >&2
            echo "$capacity_audit_update_output" >&2
            exit 1
          fi

          set +e
          capacity_cross_tenant_output="$(psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          SELECT set_config('app.user_id','00000000-0000-4000-8000-000000000101',false);
          SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',false);
          INSERT INTO capacity_assets (
            tenant_id,carrier_party_id,asset_kind,identifier,plate,vehicle_type,body_type,capacity_weight_kg,
            created_by_user_id,updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000502','vehicle','CROSS-TENANT-ASSET','ABC1234','truck','bau',10000,
            '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101'
          );
          SQL
          )"
          capacity_cross_tenant_status=$?
          set -e
          if [[ "$capacity_cross_tenant_status" -eq 0 ]] || ! grep -qi "row-level security policy" <<<"$capacity_cross_tenant_output"; then
            echo "Cross-tenant capacity asset RLS rejection did not behave as expected." >&2
            echo "$capacity_cross_tenant_output" >&2
            exit 1
          fi

""" + runtime_anchor
replace_once(runtime_anchor, runtime_insert)

fk_anchor = """          set +e
          commercial_request_fk_output="$(psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
"""
fk_insert = """          set +e
          capacity_carrier_fk_output="$(psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          INSERT INTO capacity_assets (
            tenant_id,carrier_party_id,owner_name,asset_kind,identifier,vehicle_type,body_type,capacity_weight_kg,
            created_by_user_id,updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000502','Fallback Owner','vehicle','INVALID-CARRIER-ASSET','truck','sider',10000,
            '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101'
          );
          SQL
          )"
          capacity_carrier_fk_status=$?
          set -e
          if [[ "$capacity_carrier_fk_status" -eq 0 ]] || ! grep -qi "capacity_assets_carrier_party_fk" <<<"$capacity_carrier_fk_output"; then
            echo "Cross-tenant capacity asset/carrier FK rejection did not behave as expected." >&2
            echo "$capacity_carrier_fk_output" >&2
            exit 1
          fi

          set +e
          capacity_owner_fk_output="$(psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          INSERT INTO capacity_assets (
            tenant_id,owner_party_id,asset_kind,identifier,vehicle_type,body_type,capacity_weight_kg,
            created_by_user_id,updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000502','implement','INVALID-OWNER-ASSET','carreta','sider',12000,
            '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101'
          );
          SQL
          )"
          capacity_owner_fk_status=$?
          set -e
          if [[ "$capacity_owner_fk_status" -eq 0 ]] || ! grep -qi "capacity_assets_owner_party_fk" <<<"$capacity_owner_fk_output"; then
            echo "Cross-tenant capacity asset/owner FK rejection did not behave as expected." >&2
            echo "$capacity_owner_fk_output" >&2
            exit 1
          fi

""" + fk_anchor
replace_once(fk_anchor, fk_insert)

replace_once(
    '        run: echo "Neon database gate passed through NEX-33 driver qualification."\n',
    '        run: echo "Neon database gate passed through NEX-34 vehicle and implement capacity."\n',
)

path.write_text(text)
