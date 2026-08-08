# GitHub-authenticated admin controls

## Governance boundary

This capability is additive. The existing `/admin/` password gate, command generator, direct GitHub editing links, and GitHub workflow links remain available. GitHub authentication does not approve or publish anything by itself.

Every mutating button requires:

1. A GitHub OAuth identity.
2. Membership in `GITHUB_ADMIN_LOGINS`.
3. A same-origin request and CSRF token.
4. An allowlisted workflow action.
5. A browser confirmation.
6. A GitHub Actions receipt.

The browser never receives `GITHUB_ADMIN_TOKEN`, `GITHUB_OAUTH_CLIENT_SECRET`, or `ADMIN_SESSION_SECRET`.

## GitHub OAuth App

Create a GitHub OAuth App owned by the repository owner or organization.

- Homepage URL: `https://horselegalguide.com`
- Authorization callback URL: `https://horselegalguide.com/api/admin/github/callback`

Add its client ID and client secret to Cloudflare Pages production secrets:

- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`

The OAuth user token is used only to identify the operator. It is not used to modify the repository.

## Server workflow-dispatch token

Create a fine-grained GitHub token scoped only to `seq23/horse-legal-guide-velocity`.

Minimum repository permissions:

- Actions: read and write
- Metadata: read

When `GITHUB_ADMIN_REQUIRE_REPO_PERMISSION=true`, also give the token the permission required to read collaborator permissions.

Store the token only as the Cloudflare Pages secret `GITHUB_ADMIN_TOKEN`.

## Cloudflare Pages production variables

Required:

- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`
- `ADMIN_SESSION_SECRET` — a long random value of at least 32 bytes
- `GITHUB_ADMIN_TOKEN`
- `GITHUB_ADMIN_REPOSITORY=seq23/horse-legal-guide-velocity`
- `GITHUB_ADMIN_LOGINS` — comma-separated approved GitHub logins

Optional:

- `GITHUB_ADMIN_BRANCH=main`
- `GITHUB_ADMIN_REQUIRE_REPO_PERMISSION=false`

Deploy after adding the variables. `/agency/` and the mutating admin endpoints are then protected by the GitHub session.

## Verification

1. Open `/admin/` and confirm the original command-generation controls still work.
2. Select **Sign in with GitHub**.
3. Confirm an unlisted account is rejected.
4. Dispatch **Dry run selected action** and open the returned workflow link.
5. Confirm a receipt appears under `data/admin/action_receipts/`.
6. Confirm no content status changes during a dry run.
7. Dispatch self-heal/prevalidation and confirm all drafts remain pending unless the client separately approves them.
