#!/usr/bin/env python3
import subprocess, sys
raise SystemExit(subprocess.run(["node","scripts/distribution/gsc_provider_ops.mjs","submit-sitemaps"]).returncode)
