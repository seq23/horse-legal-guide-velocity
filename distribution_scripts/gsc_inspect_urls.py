#!/usr/bin/env python3
import os, subprocess, sys
if len(sys.argv)>1: os.environ["GSC_INSPECTION_FILE"]=sys.argv[1]
raise SystemExit(subprocess.run(["node","scripts/distribution/gsc_provider_ops.mjs","inspect"]).returncode)
