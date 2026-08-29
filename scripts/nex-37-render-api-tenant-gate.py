from pathlib import Path

path = Path('.github/workflows/api-tenant-neon-gate.yml')
text = path.read_text()


def replace_once(old: str, new: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f'Expected gate fragment not found: {old[:180]!r}')
    text = text.replace(old, new, 1)


roles_anchor = """          roles="$(psql "$OWNER_DATABASE_URL" -Atqc "select session_user || ':' || current_user")"
          [[ "$roles" == "nexora_migrator:nexora_owner" ]] || { echo "Unexpected migration role chain: $roles" >&2; exit 1; }

          psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
"""
replace_once(
    roles_anchor,
    roles_anchor.replace(
        '          psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 <<\'SQL\'\n',
        '          DATABASE_URL="$OWNER_DATABASE_URL" pnpm --filter @nexora/database db:migrate\n\n'
        '          psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 <<\'SQL\'\n',
    ),
)

seed_anchor = """          INSERT INTO memberships (id, tenant_id, user_id, status) VALUES
            ('51000000-0000-4000-8000-000000000301', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000101', 'active');
          SQL
"""
seed_replacement = """          INSERT INTO memberships (id, tenant_id, user_id, status) VALUES
            ('51000000-0000-4000-8000-000000000301', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000101', 'active');

          INSERT INTO business_parties (id, tenant_id, tax_id, legal_name, email, status, homologation_status) VALUES
            ('52000000-0000-4000-8000-000000000501','51000000-0000-4000-8000-000000000001','11111111111111','Matching Carrier A','carrier-a@example.test','active','approved'),
            ('52000000-0000-4000-8000-000000000503','51000000-0000-4000-8000-000000000001','22222222222222','Matching Shipper A','shipper-a@example.test','active','approved'),
            ('52000000-0000-4000-8000-000000000504','51000000-0000-4000-8000-000000000001','33333333333333','Matching Consignee A','consignee-a@example.test','active','approved'),
            ('52000000-0000-4000-8000-000000000502','51000000-0000-4000-8000-000000000002','44444444444444','Matching Carrier B','carrier-b@example.test','active','approved');

          INSERT INTO business_party_roles (tenant_id, party_id, role) VALUES
            ('51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000501','carrier'),
            ('51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000503','customer'),
            ('51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000503','shipper'),
            ('51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000504','consignee'),
            ('51000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000502','carrier');

          INSERT INTO business_party_addresses (
            id,tenant_id,party_id,type,label,street,number,city,state,is_active
          ) VALUES
            ('52000000-0000-4000-8000-000000000701','51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000503','pickup','Matching Origin','Rua A','100','São Paulo','SP',true),
            ('52000000-0000-4000-8000-000000000702','51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000504','delivery','Matching Destination','Rua B','200','Cuiabá','MT',true);

          INSERT INTO transport_requests (
            id,tenant_id,customer_party_id,shipper_party_id,consignee_party_id,origin_address_id,destination_address_id,
            planned_pickup_at,planned_delivery_at,cargo_description,status,created_by_user_id,updated_by_user_id
          ) VALUES (
            '52000000-0000-4000-8000-000000000801','51000000-0000-4000-8000-000000000001',
            '52000000-0000-4000-8000-000000000503','52000000-0000-4000-8000-000000000503','52000000-0000-4000-8000-000000000504',
            '52000000-0000-4000-8000-000000000701','52000000-0000-4000-8000-000000000702',
            '2026-09-10T08:00:00Z','2026-09-11T18:00:00Z','Matching integration cargo','ready_for_quote',
            '51000000-0000-4000-8000-000000000101','51000000-0000-4000-8000-000000000101'
          );

          INSERT INTO transport_request_cargo_profiles (
            tenant_id,transport_request_id,material,cargo_type,total_weight_kg,volume_count,pallet_count,cubage_m3,
            max_length_m,max_width_m,max_height_m,tracking_required,vehicle_type,body_type,non_stackable,special_cargo
          ) VALUES (
            '51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000801',
            'Eletrônicos gerais','general',5000,20,4,18.5,2.4,1.2,1.8,true,'carreta','sider',true,false
          );

          INSERT INTO drivers (
            id,tenant_id,carrier_party_id,full_name,tax_id,phone,cnh_number,cnh_category,cnh_expires_on,
            registration_status,operational_status,status_reason,created_by_user_id,updated_by_user_id
          ) VALUES
            ('52000000-0000-4000-8000-000000000901','51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000501','Compatible Driver','98765432111','11990000001','12345678911','E','2030-12-31','qualified','active',NULL,'51000000-0000-4000-8000-000000000101','51000000-0000-4000-8000-000000000101'),
            ('52000000-0000-4000-8000-000000000902','51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000501','Mismatch Driver','98765432112','11990000002','12345678912','D','2030-12-31','qualified','active',NULL,'51000000-0000-4000-8000-000000000101','51000000-0000-4000-8000-000000000101'),
            ('52000000-0000-4000-8000-000000000903','51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000501','Blocked Driver','98765432113','11990000003','12345678913','E','2030-12-31','qualified','blocked','Operational block for matching gate','51000000-0000-4000-8000-000000000101','51000000-0000-4000-8000-000000000101'),
            ('52000000-0000-4000-8000-000000000904','51000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000502','Tenant B Driver','98765432114','11990000004','12345678914','E','2030-12-31','qualified','active',NULL,'51000000-0000-4000-8000-000000000101','51000000-0000-4000-8000-000000000101');

          INSERT INTO capacity_assets (
            id,tenant_id,carrier_party_id,asset_kind,identifier,plate,vehicle_type,body_type,capacity_weight_kg,capacity_volume_m3,
            max_length_m,max_width_m,max_height_m,tracking_available,status,created_by_user_id,updated_by_user_id
          ) VALUES
            ('52000000-0000-4000-8000-000000000911','51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000501','vehicle','MATCH-COMPATIBLE','AAA1A11','carreta','sider',14000,85,14.8,2.6,2.9,true,'active','51000000-0000-4000-8000-000000000101','51000000-0000-4000-8000-000000000101'),
            ('52000000-0000-4000-8000-000000000912','51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000501','vehicle','MATCH-INCOMPATIBLE','BBB2B22','toco','bau',4000,10,2.0,1.0,1.5,false,'active','51000000-0000-4000-8000-000000000101','51000000-0000-4000-8000-000000000101'),
            ('52000000-0000-4000-8000-000000000913','51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000501','vehicle','MATCH-BLOCKED-DRIVER','CCC3C33','carreta','sider',14000,85,14.8,2.6,2.9,true,'active','51000000-0000-4000-8000-000000000101','51000000-0000-4000-8000-000000000101'),
            ('52000000-0000-4000-8000-000000000914','51000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000502','vehicle','MATCH-TENANT-B','DDD4D44','carreta','sider',14000,85,14.8,2.6,2.9,true,'active','51000000-0000-4000-8000-000000000101','51000000-0000-4000-8000-000000000101');

          INSERT INTO capacity_assignments (
            id,tenant_id,driver_id,vehicle_id,carrier_party_id,status,starts_at,created_by_user_id,updated_by_user_id
          ) VALUES
            ('52000000-0000-4000-8000-000000000921','51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000901','52000000-0000-4000-8000-000000000911','52000000-0000-4000-8000-000000000501','active','2026-09-01T08:00:00Z','51000000-0000-4000-8000-000000000101','51000000-0000-4000-8000-000000000101'),
            ('52000000-0000-4000-8000-000000000922','51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000902','52000000-0000-4000-8000-000000000912','52000000-0000-4000-8000-000000000501','active','2026-09-01T08:00:00Z','51000000-0000-4000-8000-000000000101','51000000-0000-4000-8000-000000000101'),
            ('52000000-0000-4000-8000-000000000923','51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000903','52000000-0000-4000-8000-000000000913','52000000-0000-4000-8000-000000000501','active','2026-09-01T08:00:00Z','51000000-0000-4000-8000-000000000101','51000000-0000-4000-8000-000000000101'),
            ('52000000-0000-4000-8000-000000000924','51000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000904','52000000-0000-4000-8000-000000000914','52000000-0000-4000-8000-000000000502','active','2026-09-01T08:00:00Z','51000000-0000-4000-8000-000000000101','51000000-0000-4000-8000-000000000101');
          SQL
"""
replace_once(seed_anchor, seed_replacement)

integration_anchor = """      - name: Run API TenantContext integration against Neon
        shell: bash
        env:
          DATABASE_URL: ${{ env.APP_DATABASE_URL }}
          DATABASE_POOL_MAX: "2"
        run: |
          set -euo pipefail
          node apps/api/dist/tenancy/tenant-database.integration.js

      - name: Gate summary
"""
integration_replacement = """      - name: Run API TenantContext integration against Neon
        shell: bash
        env:
          DATABASE_URL: ${{ env.APP_DATABASE_URL }}
          DATABASE_POOL_MAX: "2"
        run: |
          set -euo pipefail
          node apps/api/dist/tenancy/tenant-database.integration.js

      - name: Run Capacity Matching integration against Neon
        shell: bash
        env:
          DATABASE_URL: ${{ env.APP_DATABASE_URL }}
          DATABASE_POOL_MAX: "2"
        run: |
          set -euo pipefail
          node apps/api/dist/matching/capacity-matching.integration.js

      - name: Gate summary
"""
replace_once(integration_anchor, integration_replacement)

summary_anchor = """            echo "- Cross-tenant write: denied by RLS"
            echo "- IdP integration: intentionally not part of this gate"
"""
summary_replacement = """            echo "- Cross-tenant write: denied by RLS"
            echo "- Matching compatible composition: verified"
            echo "- Matching capability mismatch reasons: verified"
            echo "- Matching blocked driver exclusion: verified"
            echo "- Matching cross-tenant capacity leakage: 0"
            echo "- IdP integration: intentionally not part of this gate"
"""
replace_once(summary_anchor, summary_replacement)

path.write_text(text)
