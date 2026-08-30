from pathlib import Path

source = Path('.github/workflows/neon-pr-gate.yml').read_text()
needle = """            '00000000-0000-4000-8000-000000000502','active','2026-09-05T08:00:00Z',
            '00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000102'
          );
          SQL

          set +e
          assignment_carrier_fk_output="""
replacement = """            '00000000-0000-4000-8000-000000000502','active','2026-09-05T08:00:00Z',
            '00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000102'
          );
          UPDATE capacity_assignments
             SET status='ended', ends_at='2026-09-06T08:00:00Z', updated_at=now()
           WHERE id='00000000-0000-4000-8000-000000000909';
          SQL

          set +e
          assignment_carrier_fk_output="""
count = source.count(needle)
if count != 1:
    raise SystemExit(f'Expected one tenant-B assignment fixture marker, found {count}')
rendered = source.replace(needle, replacement, 1)
if "WHERE id='00000000-0000-4000-8000-000000000909';" not in rendered:
    raise SystemExit('Corrected fixture marker missing')
Path('scripts/.nex-38-neon-gate-fixed.yml').write_text(rendered)
