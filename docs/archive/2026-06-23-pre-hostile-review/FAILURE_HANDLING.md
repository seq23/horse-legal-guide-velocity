# FAILURE HANDLING

## If content fails validation
It should move to revision, not approval.

### Hard fail causes
- below 80% of word floor
- no internal links
- no canonical routing block

## If content is approved but does not publish
Check:
- final publish validation
- review status
- workflow logs

## If `/admin` looks wrong
Remember that `/admin` is the review surface for the scheduled editorial backlog.
It is not the full evergreen site map.
Then regenerate admin output after state changes.

## If a new VA is confused
Start them in:
1. `docs/README.md`
2. `docs/CONTENT_OPERATING_SYSTEM.md`
3. `docs/VA_ONBOARDING.md`

## If someone says a content family is missing because they cannot see it in `/admin`
Check whether they are talking about:
- evergreen repo-native families (FAQ / scenario / comparison)
- scheduled editorial backlog types (insight / article / whitepaper / deep_authority)
