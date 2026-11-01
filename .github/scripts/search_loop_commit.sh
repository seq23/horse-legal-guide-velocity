#!/usr/bin/env bash
# Commit helper for the search-loop caller (.github/workflows/search-loop.yml).
# The engine's own pages and ledger (questions/, data/search-loop/, _redirects)
# are committed first; dist/ is then rebuilt on top of the newest main and
# committed separately, so a dist/ written by another workflow in the meantime
# never turns into a rebase conflict: on a rejected push the dist commit is
# dropped, the source commit is rebased and dist/ is rebuilt.
set -uo pipefail
branch="${GITHUB_REF_NAME:-main}"
node scripts/search_loop/mirror_site.js --clean
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A questions data/search-loop _redirects 2>/dev/null
if git diff --cached --quiet; then echo "search-loop: nothing to commit"; exit 0; fi
git commit -q -m "${COMMIT_MESSAGE:-search loop: daily pages, checks and ledger}"
git reset -q --hard HEAD   # drop the build churn left by the setup build
for i in 1 2 3 4 5; do
  git fetch -q origin "$branch"
  if ! git rebase -q "origin/$branch"; then
    git rebase --abort
    echo "NAMED STOP [PUSH_CONFLICT] the search-loop source commit does not rebase onto $branch; the next run redoes today's work" >&2
    exit 9
  fi
  npm run build >/dev/null || { echo "NAMED STOP [SITE_BUILD_FAILED] npm run build failed after folding the question pages" >&2; exit 9; }
  git add -A dist .build data _ops/reports reports
  git diff --cached --quiet || git commit -q -m "search loop: rebuild dist with question pages"
  if git push -q origin "HEAD:$branch"; then echo "search-loop: pushed (attempt $i)"; exit 0; fi
  # Rejected: drop the dist commit (if one was made) and try again on the newest main.
  if [ "$(git log -1 --format=%s)" = "search loop: rebuild dist with question pages" ]; then git reset -q --hard HEAD~1; fi
  sleep $((i * 10))
done
echo "NAMED STOP [PUSH_FAILED] five push attempts failed" >&2
exit 9
