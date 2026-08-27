---
title: Horse Lease Agreement Template: Full, Half and Free Lease Terms You Can Fill In
entry_id: draft-template-2026-09-09-horse-lease-agreement
content_type: template
cadence: on_demand
status: pending
scheduled_date: 2026-09-09
source_cluster: horse-lease-and-trial
source_page_id: what-should-be-included-in-a-horse-lease-agreement
slug: /drafts/2026-09-09/horse-lease-agreement-template/
review_status: pending
github_path: content/drafts/generated/2026-09-09__horse-lease-agreement-template.md
---
# Horse Lease Agreement Template: Full, Half and Free Lease Terms You Can Fill In

## Quick answer
A horse lease agreement is the document that splits a horse between two people without splitting the ownership. It has to answer four questions the parties usually assume are obvious: how much of the horse the lessee gets, who pays for what, who decides about veterinary care, and what happens if the horse is injured or the arrangement ends early. The builder below produces a full, half or free lease draft with those four settled.


## Why this document is worth doing properly
Leasing is how most riders get more horse than they can buy and how most owners keep a horse in work they cannot ride themselves. It is also the arrangement most likely to start on a handshake, because it usually starts between people who already know each other from the same barn.

That familiarity is exactly the problem. A lease that begins as a favour has no written answer to the question that eventually arrives: the horse needs six months off, or the lessee wants to take it to a show three states away, or the owner wants it back for a sale. Horse Legal Guide is the educational surface for Wise Covington, and this walkthrough sets out the clauses that keep a lease from turning a friendship into a claim.


## What this page is built to answer
This page is written against the following measured queries: horse lease agreement (720/mo, KD 12).

Search-volume and difficulty figures come from the evidence records in this repository and from the keyword packet cited alongside each query in data/system/template_briefs.json. Where this repository's own Search Console record disagrees with a keyword-tool volume for the same phrase, both numbers are recorded rather than reconciled, because they measure different things: one is what the tool estimates the market searches, the other is what this domain has actually been shown for.


## Build the document
Fill in what applies to your situation. Everything runs in your browser: nothing you type is sent anywhere, stored, or visible to anyone else. Anything you leave blank stays in [BRACKETS] in the output, so a half-finished document never reads as a finished one.

```generator
{
  "id": "lease-agreement-builder",
  "title": "Horse lease agreement builder",
  "filename": "horse-lease-agreement",
  "fields": [
    {
      "name": "date",
      "label": "Agreement date",
      "type": "date",
      "prompt": "date"
    },
    {
      "name": "owner",
      "label": "Owner full legal name",
      "prompt": "owner name"
    },
    {
      "name": "owner_addr",
      "label": "Owner address",
      "prompt": "owner address"
    },
    {
      "name": "lessee",
      "label": "Lessee full legal name",
      "prompt": "lessee name"
    },
    {
      "name": "lessee_addr",
      "label": "Lessee address",
      "prompt": "lessee address"
    },
    {
      "name": "horse_name",
      "label": "Horse name",
      "prompt": "horse name"
    },
    {
      "name": "horse_desc",
      "label": "Age, breed, sex",
      "placeholder": "14-year-old Thoroughbred gelding",
      "prompt": "age, breed, sex"
    },
    {
      "name": "horse_id",
      "label": "Registration or microchip number",
      "prompt": "horse id"
    },
    {
      "name": "lease_type",
      "label": "Lease type",
      "type": "select",
      "options": [
        "",
        "full",
        "half",
        "quarter",
        "free (no lease fee)",
        "breeding"
      ],
      "prompt": "lease type"
    },
    {
      "name": "start",
      "label": "Start date",
      "type": "date",
      "prompt": "start date"
    },
    {
      "name": "end",
      "label": "End date",
      "type": "date",
      "prompt": "end date"
    },
    {
      "name": "renewal",
      "label": "At the end of the term",
      "type": "select",
      "options": [
        "",
        "the lease ends unless renewed in a signed writing",
        "the lease renews month to month until either party gives notice"
      ],
      "prompt": "renewal term"
    },
    {
      "name": "fee",
      "label": "Lease fee",
      "placeholder": "$450 per month",
      "prompt": "lease fee"
    },
    {
      "name": "schedule",
      "label": "Payment schedule",
      "placeholder": "monthly in advance on the 1st",
      "prompt": "payment schedule"
    },
    {
      "name": "use_scope",
      "label": "Permitted use",
      "placeholder": "flatwork, lessons and schooling over fences up to 2'6\"",
      "prompt": "use scope"
    },
    {
      "name": "days",
      "label": "Days of use",
      "placeholder": "Tuesday, Thursday and Saturday",
      "prompt": "days of use"
    },
    {
      "name": "location",
      "label": "Permitted location",
      "placeholder": "the facility named below and rated shows within 150 miles",
      "prompt": "permitted location"
    },
    {
      "name": "riders",
      "label": "Permitted riders",
      "placeholder": "Lessee and Lessee's regular trainer",
      "prompt": "permitted riders"
    },
    {
      "name": "excluded",
      "label": "Excluded activities",
      "placeholder": "cross-country schooling, hunting, breeding, use in any lesson programme",
      "prompt": "excluded activities"
    },
    {
      "name": "facility",
      "label": "Facility where the horse is kept",
      "prompt": "facility"
    },
    {
      "name": "board_payer",
      "label": "Board paid by",
      "type": "select",
      "options": [
        "",
        "Lessee",
        "Owner",
        "the parties equally"
      ],
      "prompt": "board payer"
    },
    {
      "name": "routine_vet",
      "label": "Routine vet paid by",
      "type": "select",
      "options": [
        "",
        "Lessee",
        "Owner",
        "the parties equally"
      ],
      "prompt": "routine vet payer"
    },
    {
      "name": "emergency_vet",
      "label": "Emergency vet paid by",
      "type": "select",
      "options": [
        "",
        "Owner",
        "Lessee",
        "the parties equally"
      ],
      "prompt": "emergency vet payer"
    },
    {
      "name": "farrier",
      "label": "Farrier paid by",
      "type": "select",
      "options": [
        "",
        "Lessee",
        "Owner",
        "the parties equally"
      ],
      "prompt": "farrier payer"
    },
    {
      "name": "routine_other",
      "label": "Dentistry and vaccinations paid by",
      "type": "select",
      "options": [
        "",
        "Owner",
        "Lessee",
        "the parties equally"
      ],
      "prompt": "routine other payer"
    },
    {
      "name": "supplements",
      "label": "Supplements paid by",
      "type": "select",
      "options": [
        "",
        "Lessee",
        "Owner",
        "the parties equally"
      ],
      "prompt": "supplement payer"
    },
    {
      "name": "shows",
      "label": "Shows, training and transport paid by",
      "type": "select",
      "options": [
        "",
        "Lessee",
        "Owner",
        "the parties equally"
      ],
      "prompt": "show payer"
    },
    {
      "name": "reimburse_days",
      "label": "Reimburse within (days)",
      "placeholder": "15",
      "prompt": "reimbursement days"
    },
    {
      "name": "emergency_window",
      "label": "Try to reach owner for",
      "placeholder": "60 minutes",
      "prompt": "emergency window"
    },
    {
      "name": "injury_notice",
      "label": "Notify owner of injury within (hours)",
      "placeholder": "24",
      "prompt": "injury notice hours"
    },
    {
      "name": "insurance_payer",
      "label": "Mortality / major medical carried by",
      "type": "select",
      "options": [
        "",
        "Owner",
        "Lessee",
        "the parties equally"
      ],
      "prompt": "insurance payer"
    },
    {
      "name": "insurance_amount",
      "label": "Insured value",
      "placeholder": "$25,000",
      "prompt": "insurance amount"
    },
    {
      "name": "insurance_interest",
      "label": "Lessee named as",
      "type": "select",
      "options": [
        "",
        "an additional insured",
        "a party with an insurable interest",
        "not named"
      ],
      "prompt": "insurance interest"
    },
    {
      "name": "liability_cover",
      "label": "Lessee liability coverage",
      "placeholder": "$1,000,000",
      "prompt": "liability coverage"
    },
    {
      "name": "layup_days",
      "label": "Lay-up trigger (consecutive days)",
      "placeholder": "14",
      "prompt": "layup days"
    },
    {
      "name": "layup_result",
      "label": "If the horse is laid up",
      "type": "select",
      "options": [
        "",
        "the lease fee is suspended until the Horse returns to work",
        "the lease term is extended by the lay-up period",
        "either party may terminate on 7 days' notice",
        "the lease fee continues unchanged"
      ],
      "prompt": "layup consequence"
    },
    {
      "name": "term_notice",
      "label": "Termination notice (days)",
      "placeholder": "30",
      "prompt": "termination notice days"
    },
    {
      "name": "default_days",
      "label": "Payment default after (days)",
      "placeholder": "10",
      "prompt": "default days"
    },
    {
      "name": "return_loc",
      "label": "Return location",
      "prompt": "return location"
    },
    {
      "name": "liability_standard",
      "label": "No indemnity for the other party's",
      "placeholder": "gross negligence or wilful misconduct",
      "prompt": "liability standard"
    },
    {
      "name": "state",
      "label": "Governing law state",
      "type": "select",
      "options": [
        "",
        "Alabama",
        "Alaska",
        "Arizona",
        "Arkansas",
        "California",
        "Colorado",
        "Connecticut",
        "Delaware",
        "Florida",
        "Georgia",
        "Hawaii",
        "Idaho",
        "Illinois",
        "Indiana",
        "Iowa",
        "Kansas",
        "Kentucky",
        "Louisiana",
        "Maine",
        "Maryland",
        "Massachusetts",
        "Michigan",
        "Minnesota",
        "Mississippi",
        "Missouri",
        "Montana",
        "Nebraska",
        "Nevada",
        "New Hampshire",
        "New Jersey",
        "New Mexico",
        "New York",
        "North Carolina",
        "North Dakota",
        "Ohio",
        "Oklahoma",
        "Oregon",
        "Pennsylvania",
        "Rhode Island",
        "South Carolina",
        "South Dakota",
        "Tennessee",
        "Texas",
        "Utah",
        "Vermont",
        "Virginia",
        "Washington",
        "West Virginia",
        "Wisconsin",
        "Wyoming",
        "District of Columbia"
      ],
      "prompt": "governing law state"
    }
  ],
  "body": "HORSE LEASE AGREEMENT\n\n1. PARTIES AND HORSE.\nThis Horse Lease Agreement is made on [[date]] between [[owner]] of [[owner_addr]] (\"Owner\") and [[lessee]] of [[lessee_addr]] (\"Lessee\") for the horse known as [[horse_name]], described as [[horse_desc]], registration or microchip number [[horse_id]] (the \"Horse\"). This is a [[lease_type]] lease. Ownership of the Horse remains with Owner at all times, and nothing in this Agreement transfers title.\n\n2. TERM AND FEE.\nThe term runs from [[start]] to [[end]], and at the end of the term [[renewal]]. Lessee shall pay Owner [[fee]], payable [[schedule]].\n\n3. SCOPE OF USE.\nLessee's use of the Horse is limited to [[use_scope]], on [[days]], at [[location]]. The Horse may not be ridden by any person other than [[riders]] without Owner's prior written consent. Permitted activities exclude [[excluded]].\n\n4. LOCATION AND COSTS.\nThe Horse shall be kept at [[facility]] and may not be relocated without Owner's prior written consent. Costs are allocated as follows - board: [[board_payer]]; routine veterinary care: [[routine_vet]]; emergency veterinary care: [[emergency_vet]]; farrier: [[farrier]]; dentistry and vaccinations: [[routine_other]]; supplements: [[supplements]]; shows, training and transport: [[shows]]. A party who advances the other's allocated cost shall be reimbursed within [[reimburse_days]] days of invoice.\n\n5. VETERINARY DECISIONS.\nOwner retains final authority over elective and non-emergency veterinary decisions, including surgery, joint injections and any procedure requiring general anaesthesia. In an emergency where Owner cannot be reached within [[emergency_window]], Lessee is authorised to obtain necessary emergency treatment and shall notify Owner as soon as practicable. Lessee shall notify Owner within [[injury_notice]] hours of any lameness, injury, illness, veterinary visit or change in the Horse's condition or workload.\n\n6. INSURANCE AND LAY-UP.\nMortality and major medical insurance shall be maintained by [[insurance_payer]] with coverage of at least [[insurance_amount]], and Lessee shall be named as [[insurance_interest]] where the policy permits. Lessee shall maintain personal liability coverage of at least [[liability_cover]]. If the Horse is unable to perform the permitted activities for more than [[layup_days]] consecutive days, [[layup_result]].\n\n7. TERMINATION AND RETURN.\nEither party may terminate on [[term_notice]] days' written notice. Owner may terminate immediately if the Horse is used outside the permitted scope, is not receiving the agreed care, or if payment is more than [[default_days]] days past due. On termination Lessee shall return the Horse to [[return_loc]] in condition comparable to its condition at the start of the lease, ordinary wear from permitted use excepted, together with all tack, blankets, equipment and records belonging to Owner. The parties shall document the Horse's condition in writing and by photograph at the start and end of the lease.\n\n8. LIABILITY AND GOVERNING LAW.\nLessee assumes the inherent risks of equine activities. Nothing in this Agreement requires either party to indemnify the other for that party's own [[liability_standard]]. This Agreement is governed by the law of [[state]], is the entire agreement between the parties regarding the lease of the Horse, and may be amended only in a writing signed by both.\n\n[INSERT YOUR STATE'S REQUIRED EQUINE ACTIVITY WARNING LANGUAGE HERE, VERBATIM, IF YOUR STATE PRESCRIBES ONE. DO NOT PARAPHRASE IT AND DO NOT COPY IT FROM ANOTHER STATE.]\n\nOWNER: ___________________________  DATE: __________\nPrinted name: [[owner]]\n\nLESSEE: __________________________  DATE: __________\nPrinted name: [[lessee]]\n\nThis document is a general educational template, not legal advice, and has not been reviewed against the law of any particular state. Have it reviewed before you rely on it."
}
```

## What people often miss
The first thing people miss is that a lease is a transfer of possession without a transfer of ownership, and that every cost and decision therefore has to be assigned deliberately. Board, routine vet, emergency vet, farrier, dentistry, chiropractic, supplements, show fees, training, insurance and transport are all separate lines, and "we'll split things" is not a term. The builder makes each one a field precisely because each one is a separate argument waiting to happen.

The second is the injury question. If the horse is hurt while in the lessee's care, is the lease suspended, extended, terminated, or does the lessee keep paying? All four are defensible answers and the parties need to pick one before it matters. Silence here converts an unlucky event into a dispute about fairness.

The third is scope. A half lease that does not say which days, which disciplines, which arenas, whether jumping is permitted, what height, whether the horse may leave the property and whether anyone else may ride is not really a half lease. It is two people with different pictures and a shared calendar.


## The document, clause by clause
Each block below is the clause text the builder produces, followed by what it is actually for. Read them before you use the output.

### 1. Parties, horse and lease type

> This Horse Lease Agreement is made on [DATE] between [OWNER NAME] of [OWNER ADDRESS] ("Owner") and [LESSEE NAME] of [LESSEE ADDRESS] ("Lessee") for the horse known as [HORSE NAME], a [AGE]-year-old [BREED] [SEX], registration or microchip number [HORSE ID] (the "Horse"). This is a [LEASE TYPE] lease. Ownership of the Horse remains with Owner at all times, and nothing in this Agreement transfers title.

Why it matters: The last sentence looks redundant and is not. Long free leases in particular can drift into a shared belief that the horse now belongs to the rider who has had it for four years, especially if the horse is at the rider's barn under the rider's name.

### 2. Term, fee and lease scope

> The lease term runs from [START DATE] to [END DATE], and [RENEWAL TERM]. Lessee shall pay Owner [LEASE FEE] payable [PAYMENT SCHEDULE]. Lessee's use of the Horse is limited to [USE SCOPE], on [DAYS OF USE], at [PERMITTED LOCATION]. The Horse may not be ridden by any person other than [PERMITTED RIDERS] without Owner's prior written consent. Permitted activities exclude [EXCLUDED ACTIVITIES].

Why it matters: Scope is what separates a full, half and free lease from one another. It is also what an insurer will ask about. Naming permitted riders is not distrust; it is the difference between a covered accident and an uncovered one under many policies.

### 3. Location, care and who pays

> The Horse shall be kept at [FACILITY] and may not be relocated without Owner's prior written consent. Costs are allocated as follows: board [BOARD PAYER]; routine veterinary care [ROUTINE VET PAYER]; emergency veterinary care [EMERGENCY VET PAYER]; farrier [FARRIER PAYER]; dentistry and vaccinations [ROUTINE OTHER PAYER]; supplements and feed additives [SUPPLEMENT PAYER]; show entries, training and transport [SHOW PAYER]. Each party shall pay its allocated costs directly where practicable and shall reimburse the other within [REIMBURSEMENT DAYS] days of invoice otherwise.

Why it matters: Splitting costs by category rather than by percentage is what stops the monthly reconciliation from becoming a negotiation. It also makes the arrangement legible to a third party, which matters if the barn is billing one of you and being paid by the other.

### 4. Veterinary decisions and emergency authority

> Owner retains final authority over elective and non-emergency veterinary decisions, including surgery, joint injections, and any procedure requiring general anaesthesia. In an emergency where Owner cannot be reached within [EMERGENCY WINDOW], Lessee is authorised to obtain necessary emergency treatment, and shall notify Owner as soon as practicable. Emergency costs are borne by [EMERGENCY VET PAYER]. Lessee shall notify Owner within [INJURY NOTICE HOURS] hours of any lameness, injury, illness, veterinary visit or change in the Horse's condition or workload.

Why it matters: This is the clause that most often does not exist and most often needs to. The notification duty matters as much as the authority: an owner who learns about a three-week lameness after the fact has lost the ability to make the decision that was theirs to make.

### 5. Insurance, injury and what happens next

> Mortality and major medical insurance on the Horse shall be maintained by [INSURANCE PAYER], with coverage of at least [INSURANCE AMOUNT], and Lessee shall be named as [INSURANCE INTEREST] where the policy permits. Lessee shall maintain personal liability coverage of at least [LIABILITY COVERAGE]. If the Horse becomes unable to perform the permitted activities for more than [LAYUP DAYS] consecutive days, [LAYUP CONSEQUENCE].

Why it matters: The lay-up consequence is the single most useful clause in a horse lease and the one most often absent. Suspending the fee, extending the term, terminating, or continuing unchanged are all workable; having no answer is not.

### 6. Return, early termination and condition

> Either party may terminate on [TERMINATION NOTICE DAYS] days' written notice. Owner may terminate immediately if the Horse is being used outside the permitted scope, is not receiving the agreed care, or if payment is more than [DEFAULT DAYS] days past due. On termination Lessee shall return the Horse to [RETURN LOCATION] in condition comparable to its condition at the start of the lease, ordinary wear from permitted use excepted, together with all tack, blankets, equipment and records belonging to Owner. The parties shall document the Horse's condition in writing and by photograph at the start and end of the lease.

Why it matters: The start-and-end condition record costs ten minutes and resolves the argument that otherwise has no evidence on either side. Do it even when the lease is between friends. Especially then.

### 7. Liability, governing law and entire agreement

> Lessee assumes the inherent risks of equine activities. Nothing in this Agreement requires either party to indemnify the other for that party's own [LIABILITY STANDARD]. This Agreement is governed by the law of [GOVERNING LAW STATE], is the entire agreement between the parties regarding the lease of the Horse, and may be amended only in a writing signed by both. [STATE-REQUIRED EQUINE ACTIVITY WARNING LANGUAGE - INSERT YOUR STATE'S CURRENT STATUTORY TEXT VERBATIM IF YOUR STATE PRESCRIBES ONE]

Why it matters: Leases frequently cross state lines when a rider moves the horse to school or to a trainer. Naming the governing state, and getting the warning language right for the state where the horse actually lives, is not boilerplate in that situation.


## Clause map
| Lease term | Decision it forces | What happens if it is missing |
| --- | --- | --- |
| Lease type and scope | How much horse, which days, which activities | Two people share a calendar and a different understanding |
| Cost allocation by category | Who pays each separate line, not a percentage | Every month becomes a reconciliation negotiation |
| Vet decision authority | Who decides electives, who may act in an emergency | Owner learns about a major decision after it was made |
| Injury notification window | How fast the owner has to be told | A three-week lameness surfaces at the end of the lease |
| Lay-up consequence | Fee suspended, term extended, or lease ends | An unlucky injury becomes a fairness argument |
| Start and end condition record | Documented state of the horse on both dates | Neither side has evidence about how the horse came back |


## What varies by state, and how to check it
This template is written to be generally usable and is deliberately not state-specific. Equine law is one of the areas where state-to-state variation is widest, and a document that guesses at a state rule is more dangerous than one that leaves the space open. The items below are the ones to confirm for the state where the horse actually is, before you rely on the document.

- Whether your state prescribes equine activity warning language, and whether a lease counts as a document that must carry it.
- How your state treats liability releases between an owner and a lessee, and whether a minor lessee changes the analysis.
- Whether the barn where the horse is kept requires its own agreement with the lessee, separate from this lease.
- What your insurer requires: many equine policies condition coverage on named riders, named activities and a written lease, and a lease that contradicts the policy can void it.
- Whether the lease crosses state lines in practice, because the state where the horse actually lives is often the one whose rules will matter most.

Where a state prescribes warning language, the template leaves a clearly marked blank for it rather than supplying a paraphrase. Statutory warning wording is prescribed wording: an approximation of it, or the right words from the wrong state, can create the appearance of compliance without the substance of it.


## Frequently asked questions
### What is the difference between a full lease, a half lease and a free lease?

A full lease usually gives the lessee exclusive use and most of the costs. A half lease splits use and costs between the lessee and the owner or another rider. A free lease usually means no lease fee, with the lessee covering the horse's expenses instead. None of the three is a legal category, which is why the agreement has to define the split rather than rely on the label.

### Who pays the vet bill on a leased horse?

Whoever the agreement says. There is no default that applies across arrangements, and the common practice of splitting routine costs to the lessee and emergency costs to the owner is a convention, not a rule. Assign each category explicitly.

### Can the owner take the horse back during the lease?

Only on the terms the agreement sets out. That is precisely why the termination clause matters: without one, an owner who wants the horse back mid-term and a lessee who has planned a show season around it have no shared answer.

### Does a horse lease need to be in writing?

Whether an oral lease is enforceable depends on your state's rules and on the length of the term. The practical answer does not depend on the state: an oral lease of a live animal shared between two households is close to impossible to prove, and the cost of writing it down is one evening.

### What happens if the horse is injured while the lessee has it?

That is the lay-up clause, and it is the reason to have one. Suspending the fee, extending the term, allowing early termination, or continuing unchanged are all workable answers. Choose one in advance.


## Related links
- [What Should Be Included in a Horse Lease Agreement?](/leases/what-should-be-included-in-a-horse-lease-agreement/)
- [Full Lease vs Half Lease](/compare/full-lease-vs-half-lease/)
- [Who Pays Vet Bills on a Leased Horse?](/leases/who-pays-vet-bills-on-a-leased-horse/)
- [Horse Legal Guide home](/)
- [Horse Legal Guide home](/)
- [Disclaimer](/disclaimer/)
- [Privacy Policy](/privacy-policy/)


## Canonical routing block
A template gets you a clear starting draft. It does not tell you how your state treats the clause that matters most in your situation, and it cannot read the facts of a deal that has already started to go wrong.

Wise Covington PLLC is a law firm built by equestrians for the equestrian community.

Because legal requirements vary by state, it’s important to evaluate your specific situation before making decisions.

Learn more here: https://wisecovington.com

## Educational boundary
This page and the document it generates are educational only. They are not legal advice, do not apply the law of any state to any particular set of facts, and do not create an attorney-client relationship. No statement here should be treated as a description of the law in your state. Have the document reviewed by a lawyer licensed where the horse is kept before you rely on it.

## Review notes
- Manual mode is active.
- Do not publish without approval.
- Keep the footer disclaimer and both footer policy links.
- Legal review needed before approval: confirm the clause set against the reviewing attorney’s own precedents, and confirm that leaving the state warning language as a blank is the position the firm wants to take publicly.
