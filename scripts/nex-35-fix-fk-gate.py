from pathlib import Path

path = Path('.github/workflows/neon-pr-gate.yml')
text = path.read_text()

old = """          set +e
          assignment_carrier_fk_output=\"$(psql \"$OWNER_DATABASE_URL\" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          INSERT INTO capacity_assignments (
            tenant_id,driver_id,vehicle_id,carrier_party_id,status,created_by_user_id,updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000901',
            '00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000502','active',
            '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101'
          );
          SQL
          )\"
          assignment_carrier_fk_status=$?
          set -e
          if [[ \"$assignment_carrier_fk_status\" -eq 0 ]] || ! grep -qi \"capacity_assignments_carrier_party_fk\" <<<\"$assignment_carrier_fk_output\"; then
            echo \"Cross-tenant capacity assignment/carrier FK rejection did not behave as expected.\" >&2
            echo \"$assignment_carrier_fk_output\" >&2
            exit 1
          fi

          set +e
          assignment_driver_fk_output=\"$(psql \"$OWNER_DATABASE_URL\" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          INSERT INTO capacity_assignments (
            tenant_id,driver_id,vehicle_id,carrier_party_id,status,created_by_user_id,updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000901',
            '00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000502','active',
            '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101'
          );
          SQL
          )\"
          assignment_driver_fk_status=$?
          set -e
          if [[ \"$assignment_driver_fk_status\" -eq 0 ]] || ! grep -qi \"capacity_assignments_driver_fk\" <<<\"$assignment_driver_fk_output\"; then
            echo \"Cross-tenant capacity assignment/driver FK rejection did not behave as expected.\" >&2
            echo \"$assignment_driver_fk_output\" >&2
            exit 1
          fi

"""

new = """          # Close the runtime assignment so FK fixtures are not masked by the active uniqueness indexes.
          psql \"$OWNER_DATABASE_URL\" -v ON_ERROR_STOP=1 <<'SQL'
          UPDATE capacity_assignments
             SET status='ended', ends_at='2026-09-04T08:00:00Z', updated_at=now()
           WHERE id='00000000-0000-4000-8000-000000000904' AND status='active';

          INSERT INTO drivers (
            id,tenant_id,carrier_party_id,full_name,tax_id,phone,cnh_number,cnh_category,cnh_expires_on,
            created_by_user_id,updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000905','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000502',
            'Gate Driver B','98765432103','11999990003','12345678904','D','2029-12-31',
            '00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000102'
          );

          INSERT INTO capacity_assets (
            id,tenant_id,carrier_party_id,asset_kind,identifier,plate,vehicle_type,body_type,capacity_weight_kg,
            created_by_user_id,updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000906','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000502',
            'vehicle','GATE-TRUCK-B','DEF2G34','truck','bau',12000,
            '00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000102'
          );
          SQL

          set +e
          assignment_carrier_fk_output=\"$(psql \"$OWNER_DATABASE_URL\" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          INSERT INTO capacity_assignments (
            tenant_id,driver_id,vehicle_id,carrier_party_id,status,created_by_user_id,updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000901',
            '00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000502','active',
            '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101'
          );
          SQL
          )\"
          assignment_carrier_fk_status=$?
          set -e
          if [[ \"$assignment_carrier_fk_status\" -eq 0 ]] || ! grep -qi \"capacity_assignments_carrier_party_fk\" <<<\"$assignment_carrier_fk_output\"; then
            echo \"Cross-tenant capacity assignment/carrier FK rejection did not behave as expected.\" >&2
            echo \"$assignment_carrier_fk_output\" >&2
            exit 1
          fi

          set +e
          assignment_driver_fk_output=\"$(psql \"$OWNER_DATABASE_URL\" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          INSERT INTO capacity_assignments (
            tenant_id,driver_id,vehicle_id,carrier_party_id,status,created_by_user_id,updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000901',
            '00000000-0000-4000-8000-000000000906','00000000-0000-4000-8000-000000000502','active',
            '00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000102'
          );
          SQL
          )\"
          assignment_driver_fk_status=$?
          set -e
          if [[ \"$assignment_driver_fk_status\" -eq 0 ]] || ! grep -qi \"capacity_assignments_driver_fk\" <<<\"$assignment_driver_fk_output\"; then
            echo \"Cross-tenant capacity assignment/driver FK rejection did not behave as expected.\" >&2
            echo \"$assignment_driver_fk_output\" >&2
            exit 1
          fi

          set +e
          assignment_vehicle_fk_output=\"$(psql \"$OWNER_DATABASE_URL\" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          INSERT INTO capacity_assignments (
            tenant_id,driver_id,vehicle_id,carrier_party_id,status,created_by_user_id,updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000905',
            '00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000502','active',
            '00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000102'
          );
          SQL
          )\"
          assignment_vehicle_fk_status=$?
          set -e
          if [[ \"$assignment_vehicle_fk_status\" -eq 0 ]] || ! grep -qi \"capacity_assignments_vehicle_fk\" <<<\"$assignment_vehicle_fk_output\"; then
            echo \"Cross-tenant capacity assignment/vehicle FK rejection did not behave as expected.\" >&2
            echo \"$assignment_vehicle_fk_output\" >&2
            exit 1
          fi

"""

if old not in text:
    raise SystemExit('Expected NEX-35 assignment FK gate block not found')

path.write_text(text.replace(old, new, 1))
