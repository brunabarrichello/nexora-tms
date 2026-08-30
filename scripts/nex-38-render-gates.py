from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one marker, found {count}")
    return text.replace(old, new, 1)


def require(text: str, needle: str, label: str) -> None:
    if needle not in text:
        raise SystemExit(f"{label}: required marker not found: {needle}")


api_path = Path('.github/workflows/api-tenant-neon-gate.yml')
api = api_path.read_text()
if 'Run Freight Proposal integration against Neon' not in api:
    api = replace_once(
        api,
        "      - name: Gate summary\n",
        "      - name: Run Freight Proposal integration against Neon\n"
        "        shell: bash\n"
        "        env:\n"
        "          DATABASE_URL: ${{ env.APP_DATABASE_URL }}\n"
        "          DATABASE_POOL_MAX: \"2\"\n"
        "        run: |\n"
        "          set -euo pipefail\n"
        "          node apps/api/dist/negotiation/freight-proposal.integration.js\n\n"
        "      - name: Gate summary\n",
        'api integration step',
    )
    api = replace_once(
        api,
        '            echo "- Matching cross-tenant capacity leakage: 0"\n',
        '            echo "- Matching cross-tenant capacity leakage: 0"\n'
        '            echo "- Freight proposal append-only history: verified"\n'
        '            echo "- Freight counterproposal version preservation: verified"\n'
        '            echo "- Freight proposal terminal status immutability: verified"\n',
        'api summary',
    )
Path('scripts/.nex-38-api-tenant-gate-rendered.yml').write_text(api)

neon_path = Path('.github/workflows/neon-pr-gate.yml')
neon = neon_path.read_text()
if 'freight_proposal_kind_enum_count' not in neon:
    neon = replace_once(
        neon,
        '      - "apps/api/src/capacity/**"\n',
        '      - "apps/api/src/capacity/**"\n      - "apps/api/src/negotiation/**"\n',
        'neon trigger path',
    )
    neon = replace_once(
        neon,
        '            capacity_assignment_enum_count integer;\n',
        '            capacity_assignment_enum_count integer;\n'
        '            freight_proposal_kind_enum_count integer;\n'
        '            freight_proposal_status_enum_count integer;\n',
        'neon enum declarations',
    )
    neon = neon.replace(
        "'capacity_asset_audit','capacity_assignments'",
        "'capacity_asset_audit','capacity_assignments','freight_proposals','freight_proposal_events'",
    )
    neon = replace_once(
        neon,
        "            IF table_count <> 28 THEN\n              RAISE EXCEPTION 'Expected 28 application tables, found %', table_count;\n",
        "            IF table_count <> 30 THEN\n              RAISE EXCEPTION 'Expected 30 application tables, found %', table_count;\n",
        'neon table count',
    )
    neon = replace_once(
        neon,
        "            IF rls_count <> 25 THEN\n              RAISE EXCEPTION 'Expected RLS on 25 tenant-scoped tables, found %', rls_count;\n",
        "            IF rls_count <> 27 THEN\n              RAISE EXCEPTION 'Expected RLS on 27 tenant-scoped tables, found %', rls_count;\n",
        'neon rls count',
    )
    neon = replace_once(
        neon,
        "            IF migration_count <> 12 THEN\n              RAISE EXCEPTION 'Expected 12 Drizzle migration records, found %', migration_count;\n",
        "            IF migration_count <> 13 THEN\n              RAISE EXCEPTION 'Expected 13 Drizzle migration records, found %', migration_count;\n",
        'neon migration count',
    )
    enum_marker = (
        "            IF capacity_assignment_enum_count <> 3 THEN\n"
        "              RAISE EXCEPTION 'Expected three capacity assignment status values, found %', capacity_assignment_enum_count;\n"
        "            END IF;\n"
    )
    enum_block = enum_marker + "\n" + (
        "            SELECT count(*) INTO freight_proposal_kind_enum_count\n"
        "              FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid\n"
        "             WHERE t.typname='freight_proposal_kind'\n"
        "               AND e.enumlabel IN ('proposal','counterproposal');\n"
        "            IF freight_proposal_kind_enum_count <> 2 THEN\n"
        "              RAISE EXCEPTION 'Expected two freight proposal kind values, found %', freight_proposal_kind_enum_count;\n"
        "            END IF;\n\n"
        "            SELECT count(*) INTO freight_proposal_status_enum_count\n"
        "              FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid\n"
        "             WHERE t.typname='freight_proposal_status'\n"
        "               AND e.enumlabel IN ('open','accepted','rejected','expired');\n"
        "            IF freight_proposal_status_enum_count <> 4 THEN\n"
        "              RAISE EXCEPTION 'Expected four freight proposal status values, found %', freight_proposal_status_enum_count;\n"
        "            END IF;\n"
    )
    neon = replace_once(neon, enum_marker, enum_block, 'neon proposal enums')

    privilege_marker = (
        "               OR has_column_privilege('nexora_app','public.capacity_assignments','starts_at','UPDATE') THEN\n"
    )
    privilege_block = (
        "               OR has_column_privilege('nexora_app','public.capacity_assignments','starts_at','UPDATE')\n"
        "               OR NOT has_table_privilege('nexora_app','public.freight_proposals','SELECT')\n"
        "               OR NOT has_table_privilege('nexora_app','public.freight_proposals','INSERT')\n"
        "               OR has_table_privilege('nexora_app','public.freight_proposals','UPDATE')\n"
        "               OR has_table_privilege('nexora_app','public.freight_proposals','DELETE')\n"
        "               OR NOT has_table_privilege('nexora_app','public.freight_proposal_events','SELECT')\n"
        "               OR NOT has_table_privilege('nexora_app','public.freight_proposal_events','INSERT')\n"
        "               OR has_table_privilege('nexora_app','public.freight_proposal_events','UPDATE')\n"
        "               OR has_table_privilege('nexora_app','public.freight_proposal_events','DELETE') THEN\n"
    )
    neon = replace_once(neon, privilege_marker, privilege_block, 'neon proposal privileges')

    no_context_marker = (
        "            SELECT count(*) INTO visible_count FROM capacity_assignments;\n"
        "            IF visible_count <> 0 THEN RAISE EXCEPTION 'No-context capacity assignments must be 0, got %', visible_count; END IF;\n"
    )
    neon = replace_once(
        neon,
        no_context_marker,
        no_context_marker
        + "            SELECT count(*) INTO visible_count FROM freight_proposals;\n"
        + "            IF visible_count <> 0 THEN RAISE EXCEPTION 'No-context freight proposals must be 0, got %', visible_count; END IF;\n"
        + "            SELECT count(*) INTO visible_count FROM freight_proposal_events;\n"
        + "            IF visible_count <> 0 THEN RAISE EXCEPTION 'No-context freight proposal events must be 0, got %', visible_count; END IF;\n",
        'neon no-context proposal visibility',
    )
    user_context_marker = (
        "            SELECT count(*) INTO visible_count FROM capacity_assignments;\n"
        "            IF visible_count <> 0 THEN RAISE EXCEPTION 'User-only context must not expose capacity assignments, got %', visible_count; END IF;\n"
    )
    neon = replace_once(
        neon,
        user_context_marker,
        user_context_marker
        + "            SELECT count(*) INTO visible_count FROM freight_proposals;\n"
        + "            IF visible_count <> 0 THEN RAISE EXCEPTION 'User-only context must not expose freight proposals, got %', visible_count; END IF;\n"
        + "            SELECT count(*) INTO visible_count FROM freight_proposal_events;\n"
        + "            IF visible_count <> 0 THEN RAISE EXCEPTION 'User-only context must not expose freight proposal events, got %', visible_count; END IF;\n",
        'neon user-only proposal visibility',
    )

    runtime_marker = "          set +e\n          commercial_cross_tenant_output=\"$(psql \"$APP_DATABASE_URL\" -v ON_ERROR_STOP=1 2>&1 <<'SQL'\n"
    runtime_block = """          psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
          SELECT set_config('app.user_id','00000000-0000-4000-8000-000000000101',false);
          SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',false);
          INSERT INTO freight_proposals (
            id,tenant_id,transport_request_id,capacity_assignment_id,carrier_party_id,parent_proposal_id,
            sequence,kind,currency_code,freight_amount,toll_amount,additional_amount,payment_terms,commercial_notes,authored_by_user_id
          ) VALUES
            ('00000000-0000-4000-8000-000000000907','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000904','00000000-0000-4000-8000-000000000501',NULL,1,'proposal','BRL',9700,313.80,0,'70/30 Pix','Initial proposal','00000000-0000-4000-8000-000000000101'),
            ('00000000-0000-4000-8000-000000000908','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000904','00000000-0000-4000-8000-000000000501','00000000-0000-4000-8000-000000000907',2,'counterproposal','BRL',9500,313.80,100,'50/50 Pix','Counterproposal','00000000-0000-4000-8000-000000000101');
          INSERT INTO freight_proposal_events (tenant_id,proposal_id,status,actor_user_id,reason) VALUES
            ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000907','open','00000000-0000-4000-8000-000000000101',NULL),
            ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000907','rejected','00000000-0000-4000-8000-000000000101','Superseded by counterproposal'),
            ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000908','open','00000000-0000-4000-8000-000000000101',NULL),
            ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000908','accepted','00000000-0000-4000-8000-000000000101',NULL);
          DO $$ DECLARE p integer; e integer; first_amount numeric; second_amount numeric; BEGIN
            SELECT count(*), min(freight_amount), max(freight_amount) INTO p, second_amount, first_amount
              FROM freight_proposals WHERE transport_request_id='00000000-0000-4000-8000-000000000801';
            SELECT count(*) INTO e FROM freight_proposal_events WHERE proposal_id IN ('00000000-0000-4000-8000-000000000907','00000000-0000-4000-8000-000000000908');
            IF p <> 2 OR e <> 4 THEN RAISE EXCEPTION 'Freight proposal history failed: proposals %, events %', p, e; END IF;
            IF first_amount <> 9700 OR second_amount <> 9500 THEN RAISE EXCEPTION 'Freight proposal versions were not preserved'; END IF;
          END $$;
          SQL

          set +e
          proposal_update_output="$(psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          SELECT set_config('app.user_id','00000000-0000-4000-8000-000000000101',false);
          SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',false);
          UPDATE freight_proposals SET freight_amount=1 WHERE id='00000000-0000-4000-8000-000000000908';
          SQL
          )"
          proposal_update_status=$?
          set -e
          if [[ "$proposal_update_status" -eq 0 ]] || ! grep -qi "permission denied" <<<"$proposal_update_output"; then
            echo "Freight proposal commercial terms must be append-only for nexora_app." >&2
            echo "$proposal_update_output" >&2
            exit 1
          fi

          set +e
          proposal_event_update_output="$(psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          SELECT set_config('app.user_id','00000000-0000-4000-8000-000000000101',false);
          SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',false);
          UPDATE freight_proposal_events SET reason='mutated' WHERE proposal_id='00000000-0000-4000-8000-000000000908';
          SQL
          )"
          proposal_event_update_status=$?
          set -e
          if [[ "$proposal_event_update_status" -eq 0 ]] || ! grep -qi "permission denied" <<<"$proposal_event_update_output"; then
            echo "Freight proposal events must be append-only for nexora_app." >&2
            echo "$proposal_event_update_output" >&2
            exit 1
          fi

          set +e
          proposal_cross_tenant_output="$(psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          SELECT set_config('app.user_id','00000000-0000-4000-8000-000000000101',false);
          SELECT set_config('app.tenant_id','00000000-0000-4000-8000-000000000001',false);
          INSERT INTO freight_proposals (tenant_id,transport_request_id,capacity_assignment_id,carrier_party_id,sequence,kind,freight_amount,payment_terms,authored_by_user_id)
          VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000904','00000000-0000-4000-8000-000000000501',3,'proposal',9000,'Pix','00000000-0000-4000-8000-000000000101');
          SQL
          )"
          proposal_cross_tenant_status=$?
          set -e
          if [[ "$proposal_cross_tenant_status" -eq 0 ]] || ! grep -qi "row-level security policy" <<<"$proposal_cross_tenant_output"; then
            echo "Cross-tenant freight proposal RLS rejection did not behave as expected." >&2
            echo "$proposal_cross_tenant_output" >&2
            exit 1
          fi

""" + runtime_marker
    neon = replace_once(neon, runtime_marker, runtime_block, 'neon runtime proposal tests')

    b_assignment_marker = "          set +e\n          assignment_carrier_fk_output=\"$(psql \"$OWNER_DATABASE_URL\" -v ON_ERROR_STOP=1 2>&1 <<'SQL'\n"
    b_assignment_block = """          psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
          INSERT INTO capacity_assignments (
            id,tenant_id,driver_id,vehicle_id,carrier_party_id,status,starts_at,created_by_user_id,updated_by_user_id
          ) VALUES (
            '00000000-0000-4000-8000-000000000909','00000000-0000-4000-8000-000000000002',
            '00000000-0000-4000-8000-000000000905','00000000-0000-4000-8000-000000000906',
            '00000000-0000-4000-8000-000000000502','active','2026-09-05T08:00:00Z',
            '00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000102'
          );
          SQL

""" + b_assignment_marker
    neon = replace_once(neon, b_assignment_marker, b_assignment_block, 'neon tenant B assignment fixture')

    fk_marker = "          set +e\n          commercial_request_fk_output=\"$(psql \"$OWNER_DATABASE_URL\" -v ON_ERROR_STOP=1 2>&1 <<'SQL'\n"
    fk_block = """          set +e
          proposal_request_fk_output="$(psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          INSERT INTO freight_proposals (tenant_id,transport_request_id,capacity_assignment_id,carrier_party_id,sequence,kind,freight_amount,payment_terms,authored_by_user_id)
          VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000909','00000000-0000-4000-8000-000000000502',1,'proposal',1000,'Pix','00000000-0000-4000-8000-000000000102');
          SQL
          )"
          proposal_request_fk_status=$?
          set -e
          if [[ "$proposal_request_fk_status" -eq 0 ]] || ! grep -qi "freight_proposals_request_fk" <<<"$proposal_request_fk_output"; then
            echo "Cross-tenant freight proposal/request FK rejection did not behave as expected." >&2
            echo "$proposal_request_fk_output" >&2
            exit 1
          fi

          set +e
          proposal_assignment_fk_output="$(psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          INSERT INTO freight_proposals (tenant_id,transport_request_id,capacity_assignment_id,carrier_party_id,sequence,kind,freight_amount,payment_terms,authored_by_user_id)
          VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000909','00000000-0000-4000-8000-000000000501',3,'proposal',1000,'Pix','00000000-0000-4000-8000-000000000101');
          SQL
          )"
          proposal_assignment_fk_status=$?
          set -e
          if [[ "$proposal_assignment_fk_status" -eq 0 ]] || ! grep -qi "freight_proposals_capacity_assignment_fk" <<<"$proposal_assignment_fk_output"; then
            echo "Cross-tenant freight proposal/capacity FK rejection did not behave as expected." >&2
            echo "$proposal_assignment_fk_output" >&2
            exit 1
          fi

          set +e
          proposal_carrier_fk_output="$(psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          INSERT INTO freight_proposals (tenant_id,transport_request_id,capacity_assignment_id,carrier_party_id,sequence,kind,freight_amount,payment_terms,authored_by_user_id)
          VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000904','00000000-0000-4000-8000-000000000502',3,'proposal',1000,'Pix','00000000-0000-4000-8000-000000000101');
          SQL
          )"
          proposal_carrier_fk_status=$?
          set -e
          if [[ "$proposal_carrier_fk_status" -eq 0 ]] || ! grep -qi "freight_proposals_carrier_party_fk" <<<"$proposal_carrier_fk_output"; then
            echo "Cross-tenant freight proposal/carrier FK rejection did not behave as expected." >&2
            echo "$proposal_carrier_fk_output" >&2
            exit 1
          fi

          set +e
          proposal_event_fk_output="$(psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
          INSERT INTO freight_proposal_events (tenant_id,proposal_id,status,actor_user_id)
          VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000907','open','00000000-0000-4000-8000-000000000102');
          SQL
          )"
          proposal_event_fk_status=$?
          set -e
          if [[ "$proposal_event_fk_status" -eq 0 ]] || ! grep -qi "freight_proposal_events_proposal_fk" <<<"$proposal_event_fk_output"; then
            echo "Cross-tenant freight proposal event FK rejection did not behave as expected." >&2
            echo "$proposal_event_fk_output" >&2
            exit 1
          fi

""" + fk_marker
    neon = replace_once(neon, fk_marker, fk_block, 'neon proposal fk tests')

    neon = replace_once(
        neon,
        '        run: echo "Neon database gate passed through NEX-35 active capacity composition history."\n',
        '        run: echo "Neon database gate passed through NEX-38 append-only freight proposal negotiation history."\n',
        'neon summary',
    )

require(neon, "Expected 30 application tables", 'rendered neon table count')
require(neon, "Expected RLS on 27 tenant-scoped tables", 'rendered neon rls count')
require(neon, "Expected 13 Drizzle migration records", 'rendered neon migration count')
require(neon, "freight_proposals_capacity_assignment_fk", 'rendered neon proposal fk coverage')
require(neon, "Freight proposal commercial terms must be append-only", 'rendered neon append-only coverage')
Path('scripts/.nex-38-neon-gate-rendered.yml').write_text(neon)
