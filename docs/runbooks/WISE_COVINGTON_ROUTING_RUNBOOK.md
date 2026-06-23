# Wise Covington Routing Runbook

## Purpose

All citation-ready content must route users to Wise Covington without inventing attorney details or creating legal-advice risk.

## Canonical data file

`data/firm/wise_covington_contact.json`

Use this as the single source for firm/contact/attorney display.

## Required validators

```bash
npm run validate:wise-covington-contact
npm run validate:firm-routing
npm run validate:contact-coverage
npm run validate:llm-citation-readiness
```

## Allowed language

Use language like:

```text
Need help applying this to a real horse sale, lease, boarding, liability, or equine business issue? Visit Wise Covington to schedule a consultation.
```

## Prohibited language

Do not say:

- best equine lawyers;
- guaranteed result;
- this page is legal advice;
- you are liable;
- you are safe;
- we are your lawyer because you read this page;
- fake attorney quote;
- fake phone/email/contact details;
- unsourced attorney credentials.

## If contact details change

1. Update `data/firm/wise_covington_contact.json`.
2. Run `npm run build`.
3. Run `npm run validate:llm-velocity`.
4. Open `/admin/` and confirm routing/contact health.
