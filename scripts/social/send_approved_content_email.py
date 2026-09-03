#!/usr/bin/env python3
"""Email Claire approved Horse Legal Guide content links and platform-ready social copy.

This script is intentionally dependency-free so GitHub Actions can run it with
Python stdlib only. It sends only approved entries that have not already been
recorded in data/social/approved_content_email_state.json, unless --force-resend
is passed.
"""
from __future__ import annotations

import argparse
import email.message
import glob
import json
import os
import re
import smtplib
import ssl
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

ROOT = Path.cwd()
BACKLOG_PATH = ROOT / "data/system/editorial_backlog.json"
STATE_PATH = ROOT / "data/social/approved_content_email_state.json"
PREVIEW_PATH = ROOT / "reports/approved-content-email-preview.md"
DEFAULT_RECIPIENT = "claire@wisecovington.com"
DEFAULT_SITE = "https://horselegalguide.com"


def read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)
        handle.write("\n")


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "approved-content"


def parse_frontmatter(text: str) -> Tuple[Dict[str, str], str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---", 4)
    if end == -1:
        return {}, text
    raw = text[4:end].strip().splitlines()
    body = text[end + 4 :].lstrip()
    meta: Dict[str, str] = {}
    for line in raw:
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        meta[key.strip()] = value.strip().strip('"').strip("'")
    return meta, body


def load_draft_index() -> Dict[str, Dict[str, str]]:
    out: Dict[str, Dict[str, str]] = {}
    for filename in glob.glob(str(ROOT / "content/drafts/generated/*.md")):
        path = Path(filename)
        text = path.read_text(encoding="utf-8")
        meta, body = parse_frontmatter(text)
        entry_id = meta.get("entry_id")
        if not entry_id:
            continue
        heading = ""
        for line in body.splitlines():
            if line.startswith("# "):
                heading = line[2:].strip()
                break
        out[entry_id] = {
            "path": str(path.relative_to(ROOT)),
            "title": meta.get("title") or heading,
            "slug": meta.get("slug") or "",
            "content_type": meta.get("content_type") or "",
            "source_cluster": meta.get("source_cluster") or "",
            "scheduled_date": meta.get("scheduled_date") or meta.get("date") or "",
        }
    return out


def normalize_candidate_url(site_domain: str, candidate: Any) -> str:
    if not candidate:
        return ""
    value = str(candidate).strip()
    if not value:
        return ""
    if value.startswith("http://") or value.startswith("https://"):
        return value
    if not value.startswith("/"):
        value = "/" + value
    return site_domain.rstrip("/") + value


def path_from_site_url(site_domain: str, url: str) -> str:
    base = site_domain.rstrip("/")
    if url.startswith(base):
        path_value = url[len(base):] or "/"
    elif url.startswith("/"):
        path_value = url
    else:
        return ""
    path_value = path_value.split("#", 1)[0].split("?", 1)[0]
    if path_value == "/":
        return "index.html"
    return path_value.strip("/").rstrip("/") + "/index.html"


def dist_path_exists(site_domain: str, url: str) -> bool:
    rel = path_from_site_url(site_domain, url)
    if not rel:
        return False
    return (ROOT / "dist" / rel).exists()


def resolve_live_public_url(site_domain: str, entry: Dict[str, Any], draft_meta: Dict[str, str]) -> Optional[str]:
    candidates = [
        entry.get("public_url"),
        entry.get("live_url"),
        entry.get("url"),
        entry.get("preview_url"),
        draft_meta.get("slug"),
    ]
    title = draft_meta.get("title") or entry.get("title") or entry.get("entry_id") or "approved-content"
    date = draft_meta.get("scheduled_date") or entry.get("date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    candidates.append(f"/drafts/{date}/{slugify(str(title))}/")
    for candidate in candidates:
        url = normalize_candidate_url(site_domain, candidate)
        if not url:
            continue
        # For social/email copy, do not send links to local draft routes unless that route actually exists in dist.
        if dist_path_exists(site_domain, url):
            return url
    return None


def short_context(entry: Dict[str, Any], draft_meta: Dict[str, str]) -> str:
    cluster = (entry.get("source_cluster") or draft_meta.get("source_cluster") or "equine law").replace("-", " ")
    ctype = (entry.get("content_type") or draft_meta.get("content_type") or "guide").replace("_", " ")
    return f"A new {ctype} in the {cluster} lane is ready to share."


def social_copy(title: str, url: str, context: str) -> Dict[str, str]:
    linkedin = (
        f"New on Horse Legal Guide: {title}\n\n"
        f"{context} This plain-English resource is designed to help horse owners, trainers, riders, and equine businesses spot key legal pressure points before a situation becomes harder to unwind.\n\n"
        f"Read it here: {url}\n\n"
        "Horse Legal Guide is an educational resource connected to Wise Covington PLLC."
    )
    twitter = (
        f"New on Horse Legal Guide: {title}\n\n"
        f"Plain-English equine legal education from Wise Covington.\n{url}"
    )
    instagram = (
        f"New on Horse Legal Guide 🐴⚖️\n\n"
        f"{title}\n\n"
        "This guide helps horse owners, riders, trainers, and equine businesses understand practical legal pressure points before a situation gets harder to unwind.\n\n"
        f"Read it here: {url}\n\n"
        "#EquineLaw #HorseBusiness #HorseLegalGuide #WiseCovington"
    )
    return {"linkedin": linkedin, "twitter": twitter, "instagram": instagram}


def select_entries(backlog: List[Dict[str, Any]], sent: Dict[str, Any], ids: Optional[List[str]], force_resend: bool) -> List[Dict[str, Any]]:
    wanted = set(ids or [])
    sent_ids = set(sent.get("sent_entry_ids", []))
    out: List[Dict[str, Any]] = []
    for entry in backlog:
        entry_id = str(entry.get("entry_id") or "")
        if ids and entry_id not in wanted:
            continue
        approved = entry.get("status") == "approved" or entry.get("review_status") == "approved"
        if not approved:
            continue
        if not force_resend and entry_id in sent_ids:
            continue
        out.append(entry)
    return out


def select_new_approvals(
    backlog: List[Dict[str, Any]], sent: Dict[str, Any], ids: Optional[List[str]], force_resend: bool
) -> List[Dict[str, Any]]:
    """Entries that just became approved, regardless of whether they are live yet.

    This is a distinct event from "went live" below: an entry can be approved
    today and not be due (and so not render) until a future scheduled date.
    Notifying only at go-live would mean an approval that has not reached its
    date yet never produces any notice at all until days or weeks later - the
    approval itself, the thing Claire actually decided, would be invisible.
    """
    wanted = set(ids or [])
    notified = set(sent.get("approval_notified_entry_ids", []))
    out: List[Dict[str, Any]] = []
    for entry in backlog:
        entry_id = str(entry.get("entry_id") or "")
        if ids and entry_id not in wanted:
            continue
        approved = entry.get("status") == "approved" or entry.get("review_status") == "approved"
        if not approved:
            continue
        if not force_resend and entry_id in notified:
            continue
        out.append(entry)
    return out


def select_new_revokes(
    backlog: List[Dict[str, Any]], sent: Dict[str, Any], ids: Optional[List[str]], force_resend: bool
) -> List[Dict[str, Any]]:
    """Entries most recently marked "not this one" (scripts/admin/_common.js
    rejectEntry) that have not already been notified for THIS revoke.

    Keyed by entry_id + rejected_at rather than entry_id alone: "not this one"
    is a revoke, not a one-time terminal state (see rejectEntry's docstring) -
    an entry can be approved, revoked, re-approved, and revoked again, and each
    distinct revoke deserves its own notice.
    """
    wanted = set(ids or [])
    notified = set(sent.get("revoke_notified_keys", []))
    out: List[Dict[str, Any]] = []
    for entry in backlog:
        entry_id = str(entry.get("entry_id") or "")
        if ids and entry_id not in wanted:
            continue
        rejected = entry.get("status") == "rejected" or entry.get("review_status") == "rejected"
        rejected_at = entry.get("rejected_at")
        if not rejected or not rejected_at:
            continue
        key = f"{entry_id}:{rejected_at}"
        if not force_resend and key in notified:
            continue
        out.append(entry)
    return out


def render_markdown(
    packages: List[Dict[str, Any]],
    recipient: str,
    skipped_not_live: Optional[List[Dict[str, str]]] = None,
    new_approvals: Optional[List[Dict[str, Any]]] = None,
    new_revokes: Optional[List[Dict[str, Any]]] = None,
) -> str:
    lines = [
        "# Horse Legal Guide: content decisions",
        "",
        f"Recipient: {recipient}",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
    ]
    if new_approvals:
        lines.extend(["", "## Newly approved", "", "Each of these was just approved. It goes live automatically once its scheduled date arrives - no further action needed."])
        for item in new_approvals:
            lines.append(f"- **{item['title']}** (`{item['entry_id']}`) - scheduled {item.get('publish_date') or 'unscheduled'}")
    if packages:
        lines.extend(["", "## Newly live - ready to share", "", "Each piece below is now live, with a link and ready-to-post copy for LinkedIn, Twitter/X, and Instagram."])
        for idx, item in enumerate(packages, 1):
            copy = item["copy"]
            lines.extend([
                "",
                f"### {idx}. {item['title']}",
                "",
                f"Link: {item['url']}",
                f"Entry ID: `{item['entry_id']}`",
                "",
                "#### LinkedIn",
                copy["linkedin"],
                "",
                "#### Twitter / X",
                copy["twitter"],
                "",
                "#### Instagram",
                copy["instagram"],
            ])
    if new_revokes:
        lines.extend(["", "## Revoked (\"not this one\")", "", "Each of these was just marked \"not this one\". Nothing was deleted - approving again restores it with nothing lost."])
        for item in new_revokes:
            was_live = "it WAS live and has now been taken down" if item.get("revoked_from_live") else "it was not live, so nothing changed on the site"
            lines.append(f"- **{item['title']}** (`{item['entry_id']}`) - {was_live}")
    if skipped_not_live:
        lines.extend(["", "## Approved but not emailed yet", "", "These approved entries were skipped because no matching live `dist/.../index.html` page exists yet:"])
        for item in skipped_not_live:
            lines.append(f"- `{item['entry_id']}` — {item['title']}")
    if not packages and not new_approvals and not new_revokes:
        lines.extend(["", "No new approval, go-live, or revoke to report."])
    return "\n".join(lines).strip() + "\n"


REQUIRED_SMTP_VARS = ["SMTP_HOST", "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_FROM"]


def missing_smtp_vars() -> List[str]:
    """Which credentials the transport needs and does not have.

    SMTP_PASSWORD is not in this repository's secrets - SMTP_FROM, SMTP_HOST,
    SMTP_PORT and SMTP_USERNAME are - so send_email() has returned False on every
    scheduled run since the workflow was added, main() returned 0 anyway, and the
    daily job has been green while sending nothing. This is the only mechanism
    that tells the client anything is waiting, and the approval queue has not
    moved in 17 weeks. A missing credential is a fault with a name, not a
    successful no-op.
    """
    return [name for name in REQUIRED_SMTP_VARS if not os.environ.get(name)]


def send_email(subject: str, markdown_body: str, recipient: str) -> bool:
    missing = missing_smtp_vars()
    if missing:
        print(f"SMTP not configured; preview written only. Missing: {', '.join(missing)}")
        return False
    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "587"))
    username = os.environ["SMTP_USERNAME"]
    password = os.environ["SMTP_PASSWORD"]
    sender = os.environ["SMTP_FROM"]
    msg = email.message.EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = recipient
    msg.set_content(markdown_body)
    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context()) as smtp:
            smtp.login(username, password)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(host, port) as smtp:
            smtp.starttls(context=ssl.create_default_context())
            smtp.login(username, password)
            smtp.send_message(msg)
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--recipient", default=os.environ.get("APPROVED_CONTENT_EMAIL_TO", DEFAULT_RECIPIENT))
    parser.add_argument("--site-domain", default=os.environ.get("SITE_DOMAIN", DEFAULT_SITE))
    parser.add_argument("--ids", nargs="*", default=None)
    parser.add_argument("--force-resend", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    backlog = read_json(BACKLOG_PATH, [])
    if not isinstance(backlog, list):
        raise SystemExit("data/system/editorial_backlog.json must be a list")
    state = read_json(
        STATE_PATH,
        {"sent_entry_ids": [], "sent_log": [], "approval_notified_entry_ids": [], "revoke_notified_keys": []},
    )
    draft_index = load_draft_index()

    # Three distinct real events, each fires its own notice in the same run
    # regardless of which route produced it (a bulk-action workflow dispatch,
    # a manual publish, or - the route this was missing - a decision applied
    # automatically by .github/workflows/admin-decision-issue.yml consuming a
    # GitHub issue). This script has no idea which of those triggered it and
    # does not need to: it only diffs current backlog state against what was
    # already notified, so an approval or revoke applied by any route produces
    # the same email as one applied by a button on /admin/.
    selected = select_entries(backlog, state, args.ids, args.force_resend)
    packages: List[Dict[str, Any]] = []
    skipped_not_live: List[Dict[str, str]] = []
    for entry in selected:
        entry_id = str(entry.get("entry_id") or "")
        draft_meta = draft_index.get(entry_id, {})
        title = str(entry.get("title") or draft_meta.get("title") or entry_id)
        url = resolve_live_public_url(args.site_domain, entry, draft_meta)
        if not url:
            skipped_not_live.append({"entry_id": entry_id, "title": title})
            continue
        context = short_context(entry, draft_meta)
        packages.append({
            "entry_id": entry_id,
            "title": title,
            "url": url,
            "copy": social_copy(title, url, context),
        })

    new_approvals_raw = select_new_approvals(backlog, state, args.ids, args.force_resend)
    new_approvals = [
        {
            "entry_id": str(entry.get("entry_id") or ""),
            "title": str(entry.get("title") or draft_index.get(str(entry.get("entry_id") or ""), {}).get("title") or entry.get("entry_id")),
            "publish_date": entry.get("publish_date") or entry.get("date"),
        }
        for entry in new_approvals_raw
    ]

    new_revokes_raw = select_new_revokes(backlog, state, args.ids, args.force_resend)
    new_revokes = [
        {
            "entry_id": str(entry.get("entry_id") or ""),
            "title": str(entry.get("title") or draft_index.get(str(entry.get("entry_id") or ""), {}).get("title") or entry.get("entry_id")),
            "revoked_from_live": bool(entry.get("revoked_from_live")),
            "rejected_at": entry.get("rejected_at"),
        }
        for entry in new_revokes_raw
    ]

    missing = missing_smtp_vars()
    nothing_to_report = not packages and not new_approvals and not new_revokes

    if nothing_to_report:
        markdown_body = render_markdown([], args.recipient, skipped_not_live, [], [])
        PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
        PREVIEW_PATH.write_text(markdown_body, encoding="utf-8")
        print("No new approval, go-live, or revoke needed an email.")
        if skipped_not_live:
            print(f"Skipped {len(skipped_not_live)} approved item(s) without live public URLs.")
        # An empty queue of new decisions is a legitimate stop and gets a name.
        # A missing credential is not, and is reported even when there was
        # nothing to send - otherwise the fault stays invisible until the day
        # it matters.
        print("NAMED_STOP: NOTHING_TO_NOTIFY - no new approval, go-live, or revoke is waiting to be emailed. "
              "Nothing to send is a correct resting state for a client repo where approval is manual.")
        if missing and not args.dry_run:
            print(f"NAMED_FAILURE: EMAIL_DELIVERY_DISABLED_MISSING_CREDENTIAL - missing {', '.join(missing)}. "
                  "This job cannot deliver mail at all, so its green runs have proved nothing. "
                  "Add the missing secret(s) in repository settings; do not invent a value.", file=sys.stderr)
            return 2
        return 0

    markdown_body = render_markdown(packages, args.recipient, skipped_not_live, new_approvals, new_revokes)
    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW_PATH.write_text(markdown_body, encoding="utf-8")

    subject_parts = []
    if new_approvals:
        subject_parts.append(f"{len(new_approvals)} approved")
    if packages:
        subject_parts.append(f"{len(packages)} live")
    if new_revokes:
        subject_parts.append(f"{len(new_revokes)} revoked")
    subject = "Horse Legal Guide: " + ", ".join(subject_parts)

    if missing and not args.dry_run:
        print(f"NAMED_FAILURE: EMAIL_DELIVERY_DISABLED_MISSING_CREDENTIAL - {len(packages) + len(new_approvals) + len(new_revokes)} item(s) are ready "
              f"to send and cannot be delivered because {', '.join(missing)} is not set. Preview written to "
              f"{PREVIEW_PATH}. Add the missing secret(s) in repository settings; do not invent a value.", file=sys.stderr)
        return 2
    sent = False if args.dry_run else send_email(subject, markdown_body, args.recipient)
    if sent:
        sent_ids = list(dict.fromkeys([*(state.get("sent_entry_ids") or []), *[item["entry_id"] for item in packages]]))
        approval_notified = list(dict.fromkeys([*(state.get("approval_notified_entry_ids") or []), *[item["entry_id"] for item in new_approvals]]))
        revoke_notified = list(dict.fromkeys([
            *(state.get("revoke_notified_keys") or []),
            *[f"{item['entry_id']}:{item['rejected_at']}" for item in new_revokes if item.get("rejected_at")],
        ]))
        sent_log = list(state.get("sent_log") or [])
        sent_log.append({
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "recipient": args.recipient,
            "entry_ids": [item["entry_id"] for item in packages],
            "newly_approved_entry_ids": [item["entry_id"] for item in new_approvals],
            "revoked_entry_ids": [item["entry_id"] for item in new_revokes],
            "count": len(packages) + len(new_approvals) + len(new_revokes),
        })
        write_json(STATE_PATH, {
            "sent_entry_ids": sent_ids,
            "approval_notified_entry_ids": approval_notified,
            "revoke_notified_keys": revoke_notified,
            "sent_log": sent_log[-100:],
        })
        print(f"Sent decision-notification email to {args.recipient}: {subject}.")
    else:
        print(f"Preview generated at {PREVIEW_PATH}. Email was not sent.")
        if args.dry_run:
            print("NAMED_STOP: DRY_RUN_PREVIEW_ONLY - sending was disabled by --dry-run.")
        else:
            print("NAMED_FAILURE: EMAIL_SEND_FAILED - the transport was configured but did not deliver.", file=sys.stderr)
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
