# RUNBOOK

The single operator runbook for this repo (`horse-legal-guide-velocity`). Referenced from `AGENTS.md`'s repo-local authority list.

## How to approve an article (or send it back)

**Where:** `/admin/` on the deployed site.

- **Open `/admin/`** and enter the admin password (shown in the panel once you're in; the value itself lives in `data/system/config.json`'s `admin_password_plaintext` field — this is a convenience gate only, not real security, so don't put confidential matter details in it).
- **Find the draft(s).** Use the filter tiles (All drafts / Waiting for you / Overdue / Approved / Needs changes / Not this one) or the filter bar (status, type, topic, sort) to narrow the queue.
- **Tick the checkbox** on each draft you're deciding on. Use "Select visible page" or "Select everything waiting on this page" to tick in bulk.
- **Click one decision button**, in the "Send your decisions" card:

| Button | Effect |
|---|---|
| **Approve selected** | Marks the ticked drafts approved. If their scheduled date has already passed, they publish. |
| **Send "needs changes"** | Sends the ticked drafts back for revision. Nothing publishes. |
| **Send "not this one"** | Rejects the ticked drafts. Nothing publishes, and they stop showing as due. |

- **A confirmation dialog appears** — click OK.
- **A new browser tab opens on github.com** with a pre-filled request (a GitHub Issue) — the drafts and your decision are already filled in. **Click "Submit new issue" on that page.** This step is the one that actually sends your decision — closing the tab without submitting sends nothing.
- You need only a **free GitHub account**, signed in in that tab. You do not need to know Git, the command line, or have any special role on the repository to submit the request.

**No GitHub account?** Use the "Email an approval" / "Email 'needs changes'" / "Email 'not this one'" links instead, further down the same card. These only draft an email — **nothing publishes from an email**; someone with a GitHub account still has to act on it.

## What happens automatically after you submit

- **The request starts within moments** of you clicking "Submit new issue" — it is triggered by the issue itself (`.github/workflows/admin-decision-issue.yml`, `on: issues: opened`), not by a schedule.
- It **checks that your GitHub account actually has write access to the repository.** Anyone can submit a request (the repo is public), but only an authorized account's request is applied — everyone else gets a reply on their own issue explaining that, and nothing changes.
- If you're authorized, it runs the same approve/reject/needs-changes step `/admin/`'s own automation always used, rebuilds the site, and pushes to `main`.
- **Typically live within a few minutes** of submitting — GitHub Actions starts immediately, and the site deploys automatically once the run finishes.
- **The GitHub issue closes itself** with a comment saying what happened — applied, or why not. That comment is the definitive record of what your decision actually did.

## How to confirm it actually worked

**Check the live URL, not just `/admin/`.** That mismatch — `/admin/` looking fine while nothing was actually live — is exactly what went wrong on 2026-09-03.

- **The live site:** `https://horselegalguide.com/articles/` (or `/insights/`, `/whitepapers/`, `/authority/` for other content types) — the approved piece should appear here once its scheduled date has arrived.
- **The GitHub issue you submitted** — it should be closed, with a comment saying "Applied" (or explaining why not).
- **`/admin/`'s "Approved" count** — this should also go up, once you reload the page after the site rebuilds. This confirms the record, not the actual reader-facing page — check the live URL first.

## What each status in `/admin/` means

| Status shown | Meaning |
|---|---|
| **Waiting for you** | Nobody has decided yet. |
| **Approved** | You said yes. Goes live once its scheduled date arrives. |
| **Needs changes** | Sent back; will not publish until re-approved. |
| **Not this one** | Rejected; will not publish. |

The **"Overdue"** tile is separate from status — it counts drafts whose scheduled date has already passed. An overdue draft that is also "Waiting for you" is exactly the kind of thing to look at first.

## What is NOT required of you

- **A failed or silent approval-notification email never blocks publishing.** `.github/workflows/approved-content-email.yml` (which emails Claire a copy of newly-approved content) runs *after* an approval or publish completes, as a separate, downstream notification — it does not gate the approval, the build, or the deploy in either direction. If that email lane is red, or SMTP isn't configured, your approved article still goes live on schedule.
- **You do not need to touch Git, the command line, or GitHub Actions directly.** The GitHub-issue step above is the entire mechanism.

## When it does not work

| Symptom | Likely cause | Where to look |
|---|---|---|
| The GitHub tab shows "Sign in to GitHub" | You're not logged into github.com in that browser | Log in, then reopen the request from `/admin/` |
| The issue closed with "does not currently have write access" | Your GitHub account isn't an authorized collaborator on this repo | Ask the repo owner to add you as a collaborator, or have them submit the request instead |
| The issue closed with "could not be read automatically" | The issue's `Action:` / `IDs:` lines were edited by hand after opening | Reopen the request from `/admin/` instead of editing the GitHub issue directly |
| The issue closed with "could not be applied cleanly" | Self-heal, prevalidation, the approval script, or the rebuild/validate step failed | The linked GitHub Actions run in that comment names the exact failing step |
| The article is approved but still not live after its scheduled date | This is a Rule 0 defect class this repo actively guards against | `npm run validate:admin-approval-live` (`_ops/validators/validate_admin_approval_reaches_live.js`) hard-fails the build the moment this happens — it does not stay silently green. Check the most recent CI run for that failure. |
| An article genuinely shouldn't publish (a content or legal-review reason, not a mechanical one) | That's a deliberate decision, not a bug | Use "Send 'needs changes'" or "Send 'not this one'" — both are named, visible stops in `/admin/`'s own status, never a silent non-publish |

## Files this runbook describes

- `/admin/` page source: `scripts/release/build_site_release.js` (`writeAdminIndex`)
- Issue-consuming workflow: `.github/workflows/admin-decision-issue.yml`
- Issue-body parser: `scripts/admin/parse_decision_issue.js`
- Approval/rejection scripts it runs: `scripts/admin/approve_many.js`, `scripts/admin/reject_many.js`, `scripts/admin/mark_many_needs_revision.js`
- Live-reachability guard: `_ops/validators/validate_admin_approval_reaches_live.js`
- UI-wiring regression guard: `_ops/validators/validate_admin_ui_dispatches_approvals.js`
- Notification lane (decoupled from publishing): `.github/workflows/approved-content-email.yml`
