# Approved Content Email Runbook

## Purpose

Send Claire approved Horse Legal Guide content links with ready-to-post LinkedIn, Twitter/X, and Instagram copy.

Recipient: `claire@wisecovington.com`

## Workflow

GitHub Actions workflow:

`Approved Content Email` → `.github/workflows/approved-content-email.yml`

The workflow runs:

- manually through `workflow_dispatch`;
- after the `Admin Bulk Content Actions` workflow completes successfully;
- once daily as a safety sweep.

## What it sends

For each approved content item that has not already been emailed, the workflow sends:

- the content title;
- the Horse Legal Guide link;
- LinkedIn-ready copy;
- Twitter/X-ready copy;
- Instagram-ready copy.

The sent-entry record is stored in:

`data/social/approved_content_email_state.json`

This prevents duplicate emails for the same approved content piece.

## Required GitHub Secrets

Email sending requires SMTP secrets in the GitHub repo:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM`

If SMTP secrets are missing, the workflow still creates a preview artifact but does not send an email.

## Manual run

Go to GitHub Actions → **Approved Content Email** → **Run workflow**.

Optional inputs:

- `ids`: space-separated approved `entry_id` values;
- `force_resend`: set to `true` to resend already emailed entries;
- `dry_run`: set to `true` to generate the preview artifact without sending.

## Safety boundary

This workflow only emails content already marked `approved`. It does not approve content, reject content, edit content, or publish content.
