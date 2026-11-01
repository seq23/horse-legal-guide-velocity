# Schedule

Every scheduled GitHub Actions job in this repo. Times are Central (America/Chicago): each
`schedule:` entry carries `timezone: America/Chicago`, which GitHub Actions honours, so the clock
change in March and November no longer moves a job. Rebalanced 1 Nov 2026 (owner-approved weekly
schedule); see the notes below for what moved.

| Job | Workflow | When | Cron |
|---|---|---|---|
| Agency Search Monitor | `agency-search-monitor.yml` | every day 09:17 CT | `17 9 * * *` |
| Approved Content Email | `approved-content-email.yml` | every day 09:17 CT | `17 9 * * *` |
| Draft Queue Refresh | `drafts-refresh.yml` | every day 06:15 CT | `15 6 * * *` |
| Editorial Continuity Sidecar | `editorial-continuity.yml` | Tue 04:10 CT | `10 4 * * 2` |
| Entity Backlink Watch | `entity-backlink-watch.yml` | Thu 07:00 CT | `0 7 * * 4` |
| Public Signal Processing | `public-signal-processing.yml` | Mon–Fri 08:30 CT | `30 8 * * 1-5` |
| Self-Heal Loop | `self-heal-loop.yml` | every day 07:41 CT | `41 7 * * *` |

## Notes

- Monday 04:00–08:00 CT is kept clear: this repo's Monday jobs moved to quiet early-morning
  slots Tuesday–Saturday on 1 Nov 2026.

## Moved on 1 Nov 2026
- Entity Backlink Watch: Monday → Thursday 07:00 CT.
- Editorial Continuity Sidecar: Monday → Tuesday 04:10 CT.
