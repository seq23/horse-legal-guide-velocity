# Ingestion Compliance Rules

Status: active
Audience: Owner + Day-0 VA

## Core rule

Store the fact that a question pattern exists. Do not store or republish someone else's post.

## Safe model

public source metadata → short excerpt if needed → normalized query → cluster → mapped page target → original educational content

## Unsafe model

scrape posts → store comments → rewrite user stories → publish as page content

## Legal-advice guardrail

All public answers must remain general educational information. They must not imply legal advice, an attorney-client relationship, guaranteed outcome, or state-specific advice without review.

## Privacy stripping

The system rejects or strips emails, phone numbers, usernames, address-like strings, and other identifying details. If a VA sees a private person, barn, dispute party, or financial/legal detail that identifies someone, stop and escalate.

## Platform red flags

Stop if the source requires login, is a private group, has CAPTCHA barriers, forbids automated access, contains private messages, or would require copying a thread.
