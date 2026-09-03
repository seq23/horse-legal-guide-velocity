# RUNBOOK

The single operator runbook for this repo (`horse-legal-guide-velocity`). Referenced from `AGENTS.md`'s repo-local authority list.

## How to send a decision (approve, needs changes, or not this one)

**Where:** `/admin/` on the deployed site. The page itself walks through these same five steps in its "Send your decisions" card - this section points at it rather than re-describing it, so the two never drift apart.

- **Open `/admin/`** and enter the admin password (shown in the panel once you're in; the value itself lives in `data/system/config.json`'s `admin_password_plaintext` field - this is a convenience gate only, not real security, so don't put confidential matter details in it).
- **Find the draft(s).** Use the filter tiles (All drafts / Waiting for you / Overdue / Approved / Needs changes / Not this one) or the filter bar (status, type, topic) to narrow the queue. Click **Date**, **Draft**, or **Status** in the table header to sort by that column - click again to reverse the order. The queue opens sorted **oldest publish date first**, so anything overdue is already at the top without you doing anything.
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
  | **Send "not this one"** | **Revokes** the ticked drafts (see "How 'not this one' actually works" below). Not yet live: it never publishes. Already live: it comes down. |

- **Step 3 - a new browser tab opens on github.com** with a pre-filled request (a GitHub Issue) - the drafts and your decision are already filled in. **Nothing has been sent yet at this point.**
- **Step 4 - click "Submit new issue" on that page.** This is the step people miss, and it's the one that actually sends your decision - closing the tab without submitting sends nothing.
- **Step 5 - it is applied automatically within a few minutes.** See "What happens automatically" below for how to confirm.
- If a decision would take down a **currently-live** article, a confirmation dialog names it before the request tab even opens - e.g. *"This will take down 1 article that is currently live: [title]. It will be unpublished, not deleted - approving it again later restores it with nothing lost."*
- You need only a **free GitHub account**, signed in in that tab. You do not need to know Git, the command line, or have any special role on the repository to submit the request.

## How "not this one" actually works (revoke, not delete)

"Not this one" is a **revoke**, not a permanent verdict:

- **Not yet live:** the draft simply stays unapproved. It never publishes.
- **Already live:** the article is unpublished - taken off the live site on the next automatic rebuild - but nothing is destroyed. The draft file, its backlog record, and its full decision history (when it was approved, when it was revoked, whether it had been live) all stay intact.
- **A later "Approve selected" restores it with nothing lost.** Revoking does not block a future approval the way older systems sometimes treat a rejection as final.

This is why the round trip **approve → live → revoke → down → approve → live** works cleanly: each step is real, and none of them destroy anything the step before it created.

## Executive assistant

For someone helping with publishing who is **not an owner** and does not hold a role on this GitHub repository. Under the "Send your decisions" card, in its own **"Executive assistant"** area:

- **Email an approval / Email "needs changes" / Email "not this one"** - each drafts an email, addressed to the configured recipient (`data/system/config.json`'s `owner_review_email`, currently `claire@wisecovington.com` - a single recipient, no CC or BCC by design), naming the selected drafts.
- **These only draft an email. They publish nothing by themselves.** Someone with a GitHub account still has to take the real GitHub-request action (steps 1-5 above) before anything changes.
- If no recipient is configured, the page says so plainly on the button itself instead of silently opening a blank `To:` field.

## What happens automatically after you submit

- **The request starts within moments** of you clicking "Submit new issue" - it is triggered by the issue itself (`.github/workflows/admin-decision-issue.yml`, `on: issues: opened`), not by a schedule.
- It **checks that your GitHub account actually has write access to the repository.** Anyone can submit a request (the repo is public), but only an authorized account's request is applied - everyone else gets a reply on their own issue explaining that, and nothing changes.
- If you're authorized, it runs the same approve/reject/needs-changes step `/admin/`'s own automation always used, rebuilds the site, and pushes to `main`.
- **Typically live within a few minutes** of submitting - GitHub Actions starts immediately, and the site deploys automatically once the run finishes.
- **The GitHub issue closes itself** with a comment saying what happened - applied, or why not. That comment is the definitive record of what your decision actually did.
- **A notification email follows automatically**, addressed to the configured recipient - see "Email notifications" below. It is a downstream record, not part of applying the decision.

## How to confirm it actually worked

**Check the live URL, not just `/admin/`.** That mismatch - `/admin/` looking fine while nothing was actually live - is exactly what went wrong on 2026-09-03.

- **The live site:** `https://horselegalguide.com/articles/` (or `/insights/`, `/whitepapers/`, `/authority/` for other content types) - an approved piece should appear here once its scheduled date has arrived, and a revoked piece should be gone from here.
- **The GitHub issue you submitted** - it should be closed, with a comment saying "Applied" (or explaining why not).
- **`/admin/`'s "Approved" / "Not this one" counts** - these should also change, once you reload the page after the site rebuilds. This confirms the record, not the actual reader-facing page - check the live URL first.

## What each status in `/admin/` means

| Status shown | Meaning |
|---|---|
| **Waiting for you** | Nobody has decided yet. |
| **Approved** | You said yes. Goes live once its scheduled date arrives. |
| **Needs changes** | Sent back; will not publish until re-approved. |
| **Not this one** | Revoked. Not currently live. Approving it again restores it with nothing lost (see above). |

The **"Overdue"** tile is separate from status - it counts drafts whose scheduled date has already passed. An overdue draft that is also "Waiting for you" is exactly the kind of thing to look at first.

## Email notifications

One mechanism, `scripts/social/send_approved_content_email.py`, sends a decision-notification email addressed to the recipient configured in `data/system/config.json`'s `owner_review_email` (currently `claire@wisecovington.com`) whenever a **real event** happens, no matter which route produced it:

- **On approval** - names the piece and its scheduled publish date, even if it is not due yet.
- **On go-live** - the piece is now live; includes the link and ready-to-post copy for LinkedIn, Twitter/X, and Instagram.
- **On revoke** ("not this one") - names the piece and states plainly whether it **was live** at the time.

It is triggered by `.github/workflows/approved-content-email.yml`'s `workflow_run` hook on **Admin Bulk Content Actions**, **Manual Publish**, and **Admin Decision Issue** completing successfully - the same GitHub-issue route every reviewer uses is one of those three, so a decision applied automatically by the issue consumer produces the same email as any other route. It also runs on a daily schedule as a backstop.

- **Single recipient, no CC or BCC**, by explicit owner instruction.
- **A missing `SMTP_PASSWORD` secret is a NAMED STOP**, not a failure: `scripts/social/email_credential_gate.mjs` prints `NAMED_STOP: EMAIL_DELIVERY_DISABLED_MISSING_CREDENTIAL` and exits 0. The preview (`reports/approved-content-email-preview.md`) is still generated either way.
- **No email may gate anything.** A missing credential, a send failure, or GitHub's own delivery hiccups never block or reverse a publication, an approval, or a revoke - the email lane runs strictly after the real event already happened.
- **GitHub's own issue-comment notifications are separate** from this email and are never suppressed, duplicated, or replaced by it.

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
| A revoked article is still showing as live | Same Rule 0 guard, other direction | `npm run validate:admin-approval-live` also hard-fails if a revoked entry is still in the live set - check the most recent CI run. |
| An article genuinely shouldn't publish (a content or legal-review reason, not a mechanical one) | That's a deliberate decision, not a bug | Use "Send 'needs changes'" or "Send 'not this one'" - both are named, visible stops in `/admin/`'s own status, never a silent non-publish |
| No decision-notification email arrived | Either nothing new happened, or `SMTP_PASSWORD` (or another SMTP secret) is unset | Check `reports/approved-content-email-preview.md` and the most recent "Approved Content Email" Actions run for `NAMED_STOP: EMAIL_DELIVERY_DISABLED_MISSING_CREDENTIAL` |

## Files this runbook describes

- `/admin/` page source: `scripts/release/build_site_release.js` (`writeAdminIndex`)
- Per-draft preview / decision surface: `scripts/build/write_draft_previews.js`
- Shared issue-URL generator both surfaces call: `scripts/lib/decision_issue_client.js`
- Issue-consuming workflow: `.github/workflows/admin-decision-issue.yml`
- Issue-body parser: `scripts/admin/parse_decision_issue.js`
- Approval/revoke/needs-changes scripts it runs: `scripts/admin/approve_many.js`, `scripts/admin/reject_many.js`, `scripts/admin/mark_many_needs_revision.js`, shared logic in `scripts/admin/_common.js`
- Live-reachability and revoke-takedown guard (both directions): `_ops/validators/validate_admin_approval_reaches_live.js`
- UI-wiring regression guard: `_ops/validators/validate_admin_ui_dispatches_approvals.js`
- Notification lane (decoupled from publishing): `.github/workflows/approved-content-email.yml`, `scripts/social/send_approved_content_email.py`, `scripts/social/email_credential_gate.mjs`
