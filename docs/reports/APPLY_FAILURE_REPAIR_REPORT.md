# Apply Failure Repair Report — 2026-06-23

## Final root cause

The local updater uses rsync exclusions that exclude any directory named `build`:

```bash
--exclude build
```

That exclusion does not only exclude a top-level build output folder. It also prevents updates under `scripts/build/` from being copied into the local repo during snapshot application.

The prior ZIP placed important admin/dashboard build changes under `scripts/build/`. Container validation passed because it validated the ZIP contents directly. Local updater validation failed because those `scripts/build/` changes were not applied to the target working repo.

## Repair

The release build entry point was moved outside any path named `build`:

```text
scripts/release/build_site_release.js
```

`package.json` now runs:

```bash
npm run build
# node scripts/release/build_site_release.js
```

The release build wrapper:

1. Runs the existing base static build at `scripts/build/build_site.js`.
2. Regenerates required admin source reports.
3. Writes owner admin exports under `dist/admin/`.
4. Writes `/admin/seo/` and `seo_dashboard.json`.
5. Re-runs distribution artifact prep.
6. Leaves validation to `npm run validate:all`.

## Added validation class

The repaired artifact was validated using an updater-exclusion simulation that mirrors the updater rsync behavior, including `--exclude build`.

This proves the ZIP still passes when `scripts/build/` changes are not copied into the target local repo.

## Passing proof

The simulated updater target passed:

```bash
npm ci
npm run validate:all
npm run ops:simulate-github-actions
npm run validate:github-actions-trace
```

Critical proof lines:

```text
Generated surface contract OK
Admin SEO dashboard OK
internal links valid
Meta presence OK
Workflow trace OK
GitHub Actions simulation trace: passed (8 passed, 0 warnings, 0 failed)
```

## Status

Repaired for the updater exclusion class that caused the failed local apply.
