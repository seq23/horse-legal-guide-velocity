#!/usr/bin/env python3
import json, os, pathlib, sys

CONFIG_PATH = pathlib.Path('distribution.config.json')
if not CONFIG_PATH.exists():
    print('distribution.config.json missing; skipping GSC sitemap submission.')
    sys.exit(0)

config = json.loads(CONFIG_PATH.read_text())
site = os.environ.get('GSC_SITE_URL', config.get('gsc_site_url', ''))
if not site:
    print('GSC_SITE_URL missing; skipping sitemap submission.')
    sys.exit(0)

for sitemap in config.get('sitemaps', []):
    print(f'[non-blocking] Would submit sitemap {sitemap} to {site}')
