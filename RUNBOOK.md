# RUNBOOK

The single operator runbook for this repo (`horse-legal-guide-velocity`). Referenced from `AGENTS.md`'s repo-local authority list.

## How to send a decision (approve, needs changes, or revoke)

**Where:** `/admin/` on the deployed site. The page itself walks through these same five steps in its "Send your decisions" card - this section points at it rather than re-describing it, so the two never drift apart.

- **Open `/admin/`** and enter the admin password (shown in the panel once you're in; the value itself lives in `data/system/config.json`'s `admin_password_plaintext` field - this is a convenience gate only, not real security, so don't put confidential matter details in it).
- **Find the draft(s).** Use the filter tiles (All drafts / Waiting for you / Overdue / Approved / Needs changes / Revoked) or the filter bar (status, type, topic, ready) to narrow the queue. Click **Date**, **Draft**, or **Status** in the table header to sort by that column - click again to reverse the order. The queue opens sorted **oldest publish date first**, so anything overdue is already at the top without you doing anything.
- **Step 1 - pick the drafts.** Three controls, each doing a different job - they are not interchangeable:

  | Control | What it actually selects |
  |---|---|
  | **Select everything waiting on this page (N)** | Every draft anywhere in the queue whose status is "Waiting for you" - not just what's currently on screen. This is the one to reach for first: "show me what needs me." |
  | **Select visible page** | Only the rows currently rendered on your screen (this pagination page). Its scope changes as you page through or refilter the table - that's why it always shows its own count. |
  | **Clear selected** | Only appears once something is selected, and always names how many it's about to clear. |

- **Step 2 - choose your decision**, in the "Send your decisions" card:

  | Button | Effect |
  |---|---|
  | **Approve selected** | Marks the ticked drafts approved. If their scheduled date has already passed, they publish. |
  | **Send "needs changes"** | Sends the ticked drafts back for revision. Nothing publishes. |
  | **Send "revoke this one"** | **Revokes** the ticked drafts (see "How revoke actually works" below). Not yet live: it never publishes. Already live: it comes down. |

- **Step 3 - a new browser tab opens on github.com** with a pre-filled request (a GitHub Issue) - the drafts and your decision are already filled in. **Nothing has been sent yet at this point.**
- **Step 4 - click "Submit new issue" on that page.** This is the step people miss, and it's the one that actually sends your decision - closing the tab without submitting sends nothing.
- **Step 5 - it is applied automatically within a few minutes.** See "What happens automatically" below for how to confirm.
- If a decision would take down a **currently-live** article, a confirmation dialog names it before the request tab even opens - e.g. *"This will take down 1 article that is currently live: [title]. It will be unpublished, not deleted - approving it again later restores it with nothing lost."*
- You need only a **free GitHub account**, signed in in that tab. You do not need to know Git, the command line, or have any special role on the repository to submit the request.

### On an individual draft page

Every queued draft also has its own page under `/admin/drafts/`, reachable from `/admin/`'s "Read this draft" links or `/admin/drafts/` directly. It carries the same three decision buttons, scaled down for a single draft rather than a bulk queue - no numbered walkthrough, just one line per control:

- **Approve** - opens a pre-filled GitHub request; applies automatically within a few minutes once you click "Submit new issue" there.
- **Needs changes** - same request, marked for revision. Nothing publishes.
- **Revoke this one** - same request, marked to revoke. If the draft is currently live, this takes it down (unpublished, not deleted); approving it again later restores it with nothing lost.

It also shows **"No decision sent yet"** until you act, and the exact path it would publish at if approved.

**The publish path shown differs by content type, not by page** - `/insights/<date>/…` for a short article, `/articles/<date>/…` for a full article, `/whitepapers/`, `/authority/`, `/templates/` for the rest (`scripts/build/write_editorial_pages.js`'s `section()`). Both the preview page and the actual publish step call that same function, so the path shown is always the one the piece will actually use - two drafts of different content types legitimately showing two different path schemes on their own preview pages is correct, not a mismatch.

**"Edit the content calendar in GitHub"**, further down the same card, opens `data/system/editorial_backlog.json` in GitHub's editor, deep-linked to that entry's own line where possible. That is the **schedule and status** record, not the article's writing - there is no separate "edit the draft's prose" link on this page; the rendered article below the decision card already shows the writing in full.

## How revoke actually works ("Revoke this one")

"Revoke this one" is a **revoke**, not a permanent verdict, and not a delete:

- **Not yet live:** the draft simply stays unapproved. It never publishes.
- **Already live:** the article is unpublished - taken off the live site on the next automatic rebuild - but nothing is destroyed. The draft file and its full decision history (when it was approved, when it was revoked, whether it had been live) stay intact.
- **It returns to status "Waiting for you"**, not a separate terminal status - so it appears back in the ordinary queue and is picked up by "Select everything waiting" without you needing to know to look anywhere else. The fact that it was revoked is **not lost**: it carries a quiet note on its row, **"Previously live, revoked - approve again to restore"**, and counts under the **Revoked** filter tile - a real, visible record of what happened, just not a status that blocks it from being found again.
- **A later "Approve selected" restores it with nothing lost.** Revoking does not block a future approval the way older systems sometimes treat a rejection as final.

This is why the round trip **approve → live → revoke → down → approve → live** works cleanly: each step is real, and none of them destroy anything the step before it created.

## Executive assistant

For someone helping with publishing who is **not an owner** and does not hold a role on this GitHub repository. Its own labelled, visually subordinate area - on `/admin/` after the "Send your decisions" card, and on each individual draft page after the "Your decision" card:

- **Email an approval / Email "needs changes" / Email "revoke this one"** - each drafts an email, addressed to the configured recipient (`data/system/config.json`'s `owner_review_email`, currently `claire@wisecovington.com` - a single recipient, no CC or BCC by design), naming the selected drafts.
- **These only draft an email. They publish nothing by themselves.** Someone with a GitHub account still has to take the real GitHub-request action (steps 1-5 above) before anything changes.
- If no recipient is configured, the page says so plainly on the button itself instead of silently opening a blank `To:` field.

## What happens automatically after you submit

- **The request starts within moments** of you clicking "Submit new issue" - it is triggered by the issue itself (`.github/workflows/admin-decision-issue.yml`, `on: issues: opened`), not by a schedule.
- It **checks that your GitHub account actually has write access to the repository.** Anyone can submit a request (the repo is public), but only an authorized account's request is applied - everyone else gets a reply on their own issue explaining that, and nothing changes.
- If you're authorized, it runs the same approve/revoke/needs-changes step `/admin/`'s own automation always used, rebuilds the site, and pushes to `main`. (Internally this is still `approve_many.js` / `reject_many.js` / `mark_many_needs_revision.js` and the GitHub issue still carries `Action: reject` for a revoke - "Revoke this one" is a display label only, so renaming it on the page never risked breaking this wiring.)
- **Typically live within a few minutes** of submitting - GitHub Actions starts immediately, and the site deploys automatically once the run finishes.
- **The GitHub issue closes itself** with a comment saying what happened - applied, or why not. That comment is the definitive record of what your decision actually did.
- **A notification email follows automatically**, addressed to the configured recipient - see "Email notifications" below. It is a downstream record, not part of applying the decision.

## How to confirm it actually worked

**Check the live URL, not just `/admin/`.** That mismatch - `/admin/` looking fine while nothing was actually live - is exactly what went wrong on 2026-09-03.

- **The live site:** `https://horselegalguide.com/articles/` (or `/insights/`, `/whitepapers/`, `/authority/`, `/templates/` depending on content type - see "On an individual draft page" above) - an approved piece should appear here once its scheduled date has arrived, and a revoked piece should be gone from here.
- **The GitHub issue you submitted** - it should be closed, with a comment saying "Applied" (or explaining why not).
- **`/admin/`'s "Approved" / "Revoked" counts** - these should also change, once you reload the page after the site rebuilds. This confirms the record, not the actual reader-facing page - check the live URL first.
- **Cloudflare's edge cache can lag behind a takedown.** `horselegalguide.com`'s pages are served `cache-control: public, s-maxage=604800` (7 days), and a Cloudflare Pages deploy does not always purge every edge location immediately - confirmed 2026-09-03: the direct deployment URL (`https://horse-legal-guide-velocity.pages.dev/...`) correctly 404'd on a revoked article while `horselegalguide.com` intermittently still served a stale cached 200 from some edge nodes for a period afterward. If a page you just revoked still loads on the custom domain after confirming it is gone from `/admin/` and from the `.pages.dev` URL, that is this cache lag, not a broken revoke - it can be cleared from the Cloudflare dashboard (Caching → Configuration → Purge Cache, or purge the specific URL) if it does not clear on its own. See "Cache purge on revoke" below for what would be needed to automate this.

## What each status in `/admin/` means

| Status shown | Meaning |
|---|---|
| **Waiting for you** | Nobody has decided yet, or a "Revoke this one" decision returned it here (see the row's own "Previously live, revoked" note and the **Revoked** filter tile for that history). |
| **Approved** | You said yes. Goes live once its scheduled date arrives. |
| **Needs changes** | Sent back; will not publish until re-approved. |

The **"Overdue"** tile is separate from status - it counts drafts whose scheduled date has already passed. An overdue draft that is also "Waiting for you" is exactly the kind of thing to look at first. The **"Revoked"** tile is also separate from status - it counts every draft that has ever been revoked from live (`revoked_from_live`), regardless of its current status, so the history stays visible even after it goes back to "Waiting for you".

## Email notifications

One mechanism, `scripts/social/send_approved_content_email.py`, sends a decision-notification email addressed to the recipient configured in `data/system/config.json`'s `owner_review_email` (currently `claire@wisecovington.com`) whenever a **real event** happens, no matter which route produced it:

- **On approval** - names the piece and its scheduled publish date, even if it is not due yet.
- **On go-live** - the piece is now live; includes the link and ready-to-post copy for LinkedIn, Twitter/X, and Instagram.
- **On revoke** - names the piece and states plainly whether it **was live** at the time.

It is triggered by `.github/workflows/approved-content-email.yml`'s `workflow_run` hook on **Admin Bulk Content Actions**, **Manual Publish**, and **Admin Decision Issue** completing successfully - the same GitHub-issue route every reviewer uses is one of those three, so a decision applied automatically by the issue consumer produces the same email as any other route. It also runs on a daily schedule as a backstop.

- **Single recipient, no CC or BCC**, by explicit owner instruction.
- **A missing `SMTP_PASSWORD` secret is a NAMED STOP**, not a failure: `scripts/social/email_credential_gate.mjs` prints `NAMED_STOP: EMAIL_DELIVERY_DISABLED_MISSING_CREDENTIAL` and exits 0. The preview (`reports/approved-content-email-preview.md`) is still generated either way.
- **No email may gate anything.** A missing credential, a send failure, or GitHub's own delivery hiccups never block or reverse a publication, an approval, or a revoke - the email lane runs strictly after the real event already happened.
- **GitHub's own issue-comment notifications are separate** from this email and are never suppressed, duplicated, or replaced by it.

## Cache purge on revoke (not yet built - what it would need)

Today, a revoke correctly updates the record, stops the page from being rendered, and removes it from the freshly-deployed `dist/`. What it does **not** do is reach into Cloudflare's edge cache - see the cache-lag note above. Repo-owned purge-on-revoke would need:

- **A Cloudflare API token** with the zone's **Cache Purge** permission, added as a GitHub Actions secret (e.g. `CLOUDFLARE_API_TOKEN`). Not a value this repo or an agent working in it should generate or guess - only the account owner can create one with the right scope.
- **The zone ID** for `horselegalguide.com` (`376d976e8beceb16c2f1728b2be1f8cf`) - not secret, safe to keep in a workflow file directly.
- A small step in `.github/workflows/admin-decision-issue.yml`, after the existing "Commit applied decision" step, that purges by specific URL (never "purge everything") for whatever this decision affected - following the same gated, `continue-on-error`, NAMED-STOP-when-missing pattern this repo already uses for the SMTP credential (`scripts/social/email_credential_gate.mjs`), so an unset token degrades to a clear named stop rather than a build failure, and a purge failure never blocks or reverses the decision it followed.

This is a real gap worth closing for a legal-content client site - a revoke should mean "down everywhere," not "down at origin, pending edge propagation." It has not been built because it needs an owner-supplied credential; this section is what to hand whoever sets it up.

## What is NOT required of you

- **A failed or silent notification email never blocks publishing.** It runs *after* an approval, go-live, or revoke completes, as a separate, downstream notification - it does not gate the decision, the build, or the deploy in either direction. If that email lane is red, or SMTP isn't configured, your decision still takes effect on schedule.
- **You do not need to touch Git, the command line, or GitHub Actions directly.** The GitHub-issue step above is the entire mechanism.

## When it does not work

| Symptom | Likely cause | Where to look |
|---|---|---|
| The GitHub tab shows "Sign in to GitHub" | You're not logged into github.com in that browser | Log in, then reopen the request from `/admin/` |
| The issue closed with "does not currently have write access" | Your GitHub account isn't an authorized collaborator on this repo | Ask the repo owner to add you as a collaborator, or have them submit the request instead |
| The issue closed with "could not be read automatically" | The issue's `Action:` / `IDs:` lines were edited by hand after opening | Reopen the request from `/admin/` instead of editing the GitHub issue directly |
| The issue closed with "could not be applied cleanly" | Self-heal, prevalidation, the action itself, or the rebuild/validate step failed | The linked GitHub Actions run in that comment names the exact failing step |
| The article is approved but still not live after its scheduled date | This is a Rule 0 defect class this repo actively guards against | `npm run validate:admin-approval-live` (`_ops/validators/validate_admin_approval_reaches_live.js`) hard-fails the build the moment this happens - it does not stay silently green. Check the most recent CI run for that failure. |
| A revoked article is still showing as live in `dist/` or `/admin/` | Same Rule 0 guard, other direction | `npm run validate:admin-approval-live` also hard-fails if a revoked entry is still in the live set - check the most recent CI run. |
| A revoked article still loads on `horselegalguide.com` after `/admin/` and the `.pages.dev` deployment both confirm it is gone | Cloudflare edge cache lag, not a broken revoke | See "How to confirm it actually worked" and "Cache purge on revoke" above |
| An article genuinely shouldn't publish (a content or legal-review reason, not a mechanical one) | That's a deliberate decision, not a bug | Use "Send 'needs changes'" or "Send 'revoke this one'" - both are named, visible stops in `/admin/`'s own status, never a silent non-publish |
| No decision-notification email arrived | Either nothing new happened, or `SMTP_PASSWORD` (or another SMTP secret) is unset | Check `reports/approved-content-email-preview.md` and the most recent "Approved Content Email" Actions run for `NAMED_STOP: EMAIL_DELIVERY_DISABLED_MISSING_CREDENTIAL` |

## Files this runbook describes

- `/admin/` page source: `scripts/release/build_site_release.js` (`writeAdminIndex`)
- Per-draft preview / decision surface: `scripts/build/write_draft_previews.js`
- Shared issue-URL generator both surfaces call: `scripts/lib/decision_issue_client.js`
- Issue-consuming workflow: `.github/workflows/admin-decision-issue.yml`
- Issue-body parser: `scripts/admin/parse_decision_issue.js`
- Approval/revoke/needs-changes scripts it runs: `scripts/admin/approve_many.js`, `scripts/admin/reject_many.js`, `scripts/admin/mark_many_needs_revision.js`, shared logic in `scripts/admin/_common.js`
- Live-reachability and revoke-takedown guard (both directions): `_ops/validators/validate_admin_approval_reaches_live.js`
- UI-wiring regression guard, including per-draft-page structure: `_ops/validators/validate_admin_ui_dispatches_approvals.js`
- Notification lane (decoupled from publishing): `.github/workflows/approved-content-email.yml`, `scripts/social/send_approved_content_email.py`, `scripts/social/email_credential_gate.mjs`
