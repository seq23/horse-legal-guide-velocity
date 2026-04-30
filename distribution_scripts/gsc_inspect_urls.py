#!/usr/bin/env python3
import os, pathlib, sys

priority_file = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.build/distribution-priority-urls.txt')
site = os.environ.get('GSC_SITE_URL', '')
if not site:
    print('GSC_SITE_URL missing; skipping URL inspection.')
    sys.exit(0)
if not priority_file.exists():
    print(f'{priority_file} missing; skipping URL inspection.')
    sys.exit(0)
for line in priority_file.read_text().splitlines()[:20]:
    line = line.strip()
    if line:
        print(f'[non-blocking] Would request inspection for {line} via {site}')
