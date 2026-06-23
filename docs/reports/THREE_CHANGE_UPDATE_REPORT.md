# Three-Change Update Report — Hostile Review Revision

Status: revised after hostile review.

## Requested changes

1. Footer phrase now says: “The team behind Wise Covington has more than 30 years of equestrian and legal experience.”
2. `/admin/` no longer embeds or displays the plaintext password on initial page load; the reminder is populated only after successful unlock using the value entered by the operator.
3. Approved Content Email workflow added for Claire with LinkedIn / Twitter-X / Instagram copy.

## Hostile review fixes after first pass

- The first pass hid the password visually but still embedded it in generated `/admin/` HTML. This revision removes the plaintext password from generated admin HTML.
- The first pass could create social-copy links to `/drafts/...` paths that are not rendered into `dist`. This revision only emails approved pieces when a matching live `dist/.../index.html` page exists. Approved entries without live public pages are listed in the preview and skipped instead of sending broken social links.
- The approved-content email workflow now listens after both Admin Bulk Content Actions and Manual Publish.

## Truth boundary

SMTP delivery still requires GitHub repo secrets: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `SMTP_FROM`. Local dry-runs prove preview generation and link gating, not live SMTP delivery.
