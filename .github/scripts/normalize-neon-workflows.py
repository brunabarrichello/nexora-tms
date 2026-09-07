from pathlib import Path
import re

ROOT = Path('.github/workflows')
SKIP = {'neon-production-migrate.yml'}

for path in sorted(ROOT.glob('*.yml')):
    if path.name in SKIP:
        continue
    text = path.read_text()
    original = text

    # Canonical application database for all non-production Neon gates.
    text = re.sub(r'(?m)^(\s*)database:\s*neondb\s*$', r'\1database: nexora', text)
    text = re.sub(r'(?m)^(\s*)GRANT (CREATE|CONNECT) ON DATABASE neondb TO', r'\1GRANT \2 ON DATABASE nexora TO', text)

    # The owner role is the bootstrap authority for the nexora database.
    text = re.sub(r'(?m)^(\s*)role:\s*neondb_owner\s*$', r'\1role: nexora_owner', text)

    # Canonical shared capacity lock: never cancel another Neon branch operation.
    text = re.sub(
        r'(?ms)^concurrency:\n\s+group:\s+[^\n]+\n\s+cancel-in-progress:\s+true\n',
        'concurrency:\n  group: neon-ephemeral-branch-capacity\n  cancel-in-progress: false\n',
        text,
    )

    # v6 action inputs: reject legacy names rather than silently carrying them.
    text = re.sub(r'(?m)^(\s*)username:', r'\1role:', text)
    text = re.sub(r'(?m)^(\s*)parent:', r'\1parent_branch:', text)

    if text != original:
        path.write_text(text)
        print(f'normalized {path}')
