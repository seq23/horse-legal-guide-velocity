---
title: Horse Trainer Contract Template: Training Fees, Commissions, Show Costs and Exit Terms
entry_id: draft-template-2026-09-12-horse-trainer-contract
content_type: template
cadence: on_demand
status: pending
scheduled_date: 2026-09-12
source_cluster: boarding-training-and-barn-operations
source_page_id: what-should-be-included-in-a-training-agreement
slug: /drafts/2026-09-12/horse-trainer-contract-template/
review_status: pending
github_path: content/drafts/generated/2026-09-12__horse-trainer-contract-template.md
---
# Horse Trainer Contract Template: Training Fees, Commissions, Show Costs and Exit Terms

## Quick answer
A horse trainer contract sets out what the trainer is being paid to do, what counts as an extra, who pays show expenses, and what happens to commissions if a horse in the programme is sold. It is the agreement most often left verbal and most often the source of a bill nobody expected. The builder below drafts one with the commission and show-expense terms written down rather than assumed.


## Why this document is worth doing properly
Training relationships are professional relationships that behave like personal ones. The trainer is at the barn every day, the owner trusts their judgment about the horse, and the money moves in a rhythm that nobody writes down. That works for years and then does not, usually at the point where a horse is sold, a show bill arrives, or an owner moves to a different programme.

A training agreement is not a sign that the relationship has gone wrong. It is what makes it possible for the relationship to end without going wrong. Horse Legal Guide is the educational surface for Wise Covington, and this walkthrough covers the terms that most often turn out to have been assumed rather than agreed.


## What this page is built to answer
This page is written against the following measured queries: horse trainer contract (20/mo, KD 0).

Search-volume and difficulty figures come from the evidence records in this repository and from the keyword packet cited alongside each query in data/system/template_briefs.json. Where this repository's own Search Console record disagrees with a keyword-tool volume for the same phrase, both numbers are recorded rather than reconciled, because they measure different things: one is what the tool estimates the market searches, the other is what this domain has actually been shown for.


## Build the document
Fill in what applies to your situation. Everything runs in your browser: nothing you type is sent anywhere, stored, or visible to anyone else. Anything you leave blank stays in [BRACKETS] in the output, so a half-finished document never reads as a finished one.

```generator
{
  "id": "trainer-contract-builder",
  "title": "Horse trainer contract builder",
  "filename": "horse-training-agreement",
  "fields": [
    {
      "name": "date",
      "label": "Agreement date",
      "type": "date",
      "prompt": "date"
    },
    {
      "name": "trainer",
      "label": "Trainer or business legal name",
      "prompt": "trainer name"
    },
    {
      "name": "trainer_addr",
      "label": "Trainer address",
      "prompt": "trainer address"
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
      "name": "horse_name",
      "label": "Horse name",
      "prompt": "horse name"
    },
    {
      "name": "horse_id",
      "label": "Registration or microchip number",
      "prompt": "horse id"
    },
    {
      "name": "services",
      "label": "Training services",
      "type": "textarea",
      "placeholder": "flatwork and gymnastic schooling toward 1.10m jumpers, show preparation and coaching",
      "prompt": "services"
    },
    {
      "name": "rides",
      "label": "Training rides per week",
      "placeholder": "4",
      "prompt": "rides per week"
    },
    {
      "name": "lessons",
      "label": "Owner lessons per month",
      "placeholder": "4",
      "prompt": "lessons per month"
    },
    {
      "name": "location",
      "label": "Training location",
      "prompt": "location"
    },
    {
      "name": "fee",
      "label": "Training fee",
      "placeholder": "$900",
      "prompt": "training fee"
    },
    {
      "name": "fee_period",
      "label": "Per",
      "type": "select",
      "options": [
        "",
        "month",
        "week",
        "ride"
      ],
      "prompt": "fee period"
    },
    {
      "name": "fee_due",
      "label": "Fee due",
      "placeholder": "on the 1st of each month in advance",
      "prompt": "fee due"
    },
    {
      "name": "approval_threshold",
      "label": "Prior approval needed above",
      "placeholder": "$250",
      "prompt": "approval threshold"
    },
    {
      "name": "excluded",
      "label": "Not included in the fee",
      "type": "textarea",
      "placeholder": "board, farrier, veterinary care, body work, clipping, show coaching, hauling",
      "prompt": "excluded services"
    },
    {
      "name": "layup_days",
      "label": "Lay-up trigger (consecutive days)",
      "placeholder": "14",
      "prompt": "layup days"
    },
    {
      "name": "layup_fee",
      "label": "During lay-up the training fee",
      "type": "select",
      "options": [
        "",
        "is suspended until the Horse returns to work",
        "is reduced by half",
        "continues unchanged"
      ],
      "prompt": "layup fee term"
    },
    {
      "name": "riders",
      "label": "Permitted training riders",
      "placeholder": "Trainer and Trainer's named assistant",
      "prompt": "permitted trainer riders"
    },
    {
      "name": "substitution",
      "label": "Trainer may substitute",
      "type": "select",
      "options": [
        "",
        "a qualified assistant, with notice to Owner",
        "a qualified assistant, only with Owner's prior consent",
        "no substitute rider"
      ],
      "prompt": "substitution term"
    },
    {
      "name": "sub_notice",
      "label": "Notice of extended absence",
      "placeholder": "7 days",
      "prompt": "substitution notice"
    },
    {
      "name": "show_costs",
      "label": "Owner pays which show costs",
      "type": "textarea",
      "placeholder": "entries, stall, shavings, hauling, grounds fees, braiding, grooming and Trainer's day fee",
      "prompt": "show costs"
    },
    {
      "name": "day_fee",
      "label": "Trainer day fee",
      "placeholder": "$120 per show day",
      "prompt": "day fee"
    },
    {
      "name": "travel_split",
      "label": "Trainer travel and lodging",
      "type": "select",
      "options": [
        "",
        "shared pro rata among Trainer's clients at that show",
        "paid by Trainer",
        "paid by Owner in full"
      ],
      "prompt": "travel split"
    },
    {
      "name": "cost_allocation",
      "label": "Shared show costs allocated",
      "type": "select",
      "options": [
        "",
        "equally per horse",
        "pro rata by the number of days each horse is at the show"
      ],
      "prompt": "cost allocation"
    },
    {
      "name": "show_threshold",
      "label": "Show approval needed above",
      "placeholder": "$2,000",
      "prompt": "show approval threshold"
    },
    {
      "name": "commission",
      "label": "Sale commission rate",
      "placeholder": "10%",
      "prompt": "commission rate"
    },
    {
      "name": "commission_scope",
      "label": "Commission applies",
      "type": "select",
      "options": [
        "",
        "to any sale of the Horse during the term, however the buyer is introduced",
        "only to a sale in which Trainer introduced the buyer or negotiated the sale"
      ],
      "prompt": "commission scope"
    },
    {
      "name": "tail_period",
      "label": "Post-termination tail",
      "placeholder": "90 days",
      "prompt": "tail period"
    },
    {
      "name": "tail_condition",
      "label": "Tail commission owed only if",
      "placeholder": "the buyer was introduced to the Horse by Trainer during the term",
      "prompt": "tail condition"
    },
    {
      "name": "purchase_commission",
      "label": "Commission if trainer helps owner buy",
      "placeholder": "10% of the purchase price, disclosed in writing to both sides",
      "prompt": "purchase commission"
    },
    {
      "name": "insurance_amount",
      "label": "Owner mortality / major medical",
      "placeholder": "$30,000",
      "prompt": "insurance amount"
    },
    {
      "name": "owner_liability",
      "label": "Owner liability coverage",
      "placeholder": "$1,000,000",
      "prompt": "owner liability coverage"
    },
    {
      "name": "trainer_liability",
      "label": "Trainer liability coverage",
      "placeholder": "$1,000,000",
      "prompt": "trainer liability coverage"
    },
    {
      "name": "care_standard",
      "label": "Trainer shall exercise",
      "placeholder": "the ordinary care a reasonable professional trainer would exercise",
      "prompt": "care standard"
    },
    {
      "name": "liability_standard",
      "label": "Trainer liable only for",
      "placeholder": "gross negligence or wilful misconduct",
      "prompt": "liability standard"
    },
    {
      "name": "emergency_window",
      "label": "Emergency contact window",
      "placeholder": "60 minutes",
      "prompt": "emergency window"
    },
    {
      "name": "start",
      "label": "Start date",
      "type": "date",
      "prompt": "start date"
    },
    {
      "name": "term_notice",
      "label": "Termination notice (days)",
      "placeholder": "30",
      "prompt": "termination notice"
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
  "body": "HORSE TRAINING AGREEMENT\n\n1. PARTIES, HORSE AND PROGRAMME.\nThis Training Agreement is made on [[date]] between [[trainer]] of [[trainer_addr]] (\"Trainer\") and [[owner]] of [[owner_addr]] (\"Owner\") for the horse known as [[horse_name]], registration or microchip number [[horse_id]] (the \"Horse\"). Trainer shall provide: [[services]]. The programme comprises approximately [[rides]] training rides per week and [[lessons]] lessons per month for Owner, at [[location]]. Trainer is an independent contractor and not an employee of Owner.\n\n2. FEE AND WHAT IT INCLUDES.\nOwner shall pay Trainer [[fee]] per [[fee_period]], due [[fee_due]]. The following are not included and are billed separately, with Owner's prior approval where the amount exceeds [[approval_threshold]]: [[excluded]]. If the Horse is unable to be worked for more than [[layup_days]] consecutive days, the training fee [[layup_fee]].\n\n3. RIDERS AND SUBSTITUTION.\nThe Horse shall be ridden in training by [[riders]]. Trainer may substitute [[substitution]] when Trainer is unavailable, and shall notify Owner within [[sub_notice]] of any extended absence affecting the Horse's programme.\n\n4. SHOW EXPENSES.\nOwner is responsible for: [[show_costs]]. Trainer's day fee is [[day_fee]]. Trainer's travel, lodging and meals at away shows are [[travel_split]]. Shared costs at a show are allocated among Trainer's clients [[cost_allocation]]. Owner's prior written approval is required before entering the Horse in any show with total expected costs exceeding [[show_threshold]].\n\n5. SALE COMMISSIONS AND DISCLOSURE.\nIf the Horse is sold during the term, Trainer shall receive a commission of [[commission]] of the gross sale price. This commission applies [[commission_scope]]. Trainer shall receive a commission on a sale completed within [[tail_period]] after termination only if [[tail_condition]]. Trainer shall disclose to Owner in writing any payment Trainer receives from a buyer, a buyer's agent or any other party in connection with a sale of the Horse, and shall not accept any such payment without Owner's prior written consent. If Trainer assists Owner in purchasing a horse, the commission shall be [[purchase_commission]].\n\n6. INSURANCE, CARE AND LIABILITY.\nOwner shall maintain mortality and major medical insurance on the Horse of at least [[insurance_amount]] and personal liability coverage of at least [[owner_liability]]. Trainer shall maintain care, custody and control coverage and commercial liability coverage of at least [[trainer_liability]], and shall provide a certificate of insurance on request. Trainer shall exercise [[care_standard]] and shall not be liable for injury, illness or death of the Horse except to the extent caused by Trainer's [[liability_standard]]. In an emergency where Owner cannot be reached within [[emergency_window]], Trainer is authorised to obtain veterinary care at Owner's expense.\n\n7. TERM AND TERMINATION.\nThis Agreement runs from [[start]] and continues until terminated by either party on [[term_notice]] days' written notice. On termination Owner shall pay all amounts accrued through the termination date, and Trainer shall deliver to Owner all of Owner's property together with the Horse's competition records, health records and any registry documents in Trainer's possession.\n\n8. GOVERNING LAW.\nThis Agreement is governed by the law of [[state]], is the entire agreement between the parties regarding the training of the Horse, and may be amended only in a writing signed by both parties.\n\nTRAINER: _________________________  DATE: __________\nPrinted name: [[trainer]]\n\nOWNER: ___________________________  DATE: __________\nPrinted name: [[owner]]\n\nThis document is a general educational template, not legal advice, and has not been reviewed against the law of any particular state. Have it reviewed before you rely on it."
}
```

## What people often miss
The commission clause is the one that matters and the one most often absent. If a horse in a trainer's programme is sold, is the trainer owed a commission? On a sale the trainer did not arrange? On a sale that happens two months after the horse leaves the programme? All of those are answerable in advance in one sentence, and close to unanswerable afterwards.

The second is show expenses, which are not one line item but roughly a dozen: entries, stalls, shavings, hauling, day fees, braiding, grooms, coaching, the trainer's travel and lodging, and the split of those costs among several horses on the same trip. An agreement that says the owner pays show expenses has not said anything a bill can be checked against.

The third is what the training fee actually buys. Rides per week, lessons per month, who rides the horse when the trainer is away, whether an assistant may ride, and what happens to the fee when the horse is laid up or the owner is on holiday. These are the small recurring frictions that quietly accumulate into a decision to leave.


## The document, clause by clause
Each block below is the clause text the builder produces, followed by what it is actually for. Read them before you use the output.

### 1. Parties, horse and programme

> This Training Agreement is made on [DATE] between [TRAINER NAME] of [TRAINER ADDRESS] ("Trainer") and [OWNER NAME] of [OWNER ADDRESS] ("Owner") for the horse known as [HORSE NAME], registration or microchip number [HORSE ID] (the "Horse"). Trainer shall provide the following training services: [SERVICES], comprising approximately [RIDES PER WEEK] training rides per week and [LESSONS PER MONTH] lessons per month for Owner. The Horse shall be trained at [LOCATION]. Trainer is an independent contractor and not an employee of Owner.

Why it matters: The independent contractor sentence is short and consequential. Whether it holds is a question of the actual working relationship rather than the label, but stating the parties' intention is where that analysis starts, and it has tax and insurance implications for both sides.

### 2. Training fee and what is included

> Owner shall pay Trainer [TRAINING FEE] per [FEE PERIOD], due [FEE DUE], for the services described above. The following are not included and are billed separately with Owner's prior approval where the amount exceeds [APPROVAL THRESHOLD]: [EXCLUDED SERVICES]. If the Horse is unable to be worked for more than [LAYUP DAYS] consecutive days, [LAYUP FEE TERM].

Why it matters: The approval threshold is the practical clause that prevents most billing disputes. It lets a trainer act on small things without a phone call and guarantees the owner a conversation before anything significant.

### 3. Riders and substitution

> The Horse shall be ridden in training by [PERMITTED TRAINER RIDERS]. Trainer may substitute [SUBSTITUTION TERM] when Trainer is unavailable. Trainer shall notify Owner within [SUBSTITUTION NOTICE] of any extended absence affecting the Horse's programme.

Why it matters: Owners often assume the person named on the agreement is the person riding the horse. Assistants riding client horses is normal, professional and completely fine; discovering it four months in without having been told is what causes the problem.

### 4. Show expenses and entries

> Owner is responsible for the following show-related costs: [SHOW COSTS]. Trainer's day fee is [DAY FEE] and Trainer's travel, lodging and meals at away shows are [TRAVEL SPLIT]. Shared costs at a show shall be allocated among Trainer's clients [COST ALLOCATION]. Owner's prior written approval is required before entering the Horse in any show with total expected costs exceeding [SHOW APPROVAL THRESHOLD].

Why it matters: The allocation sentence is the one people forget. When a trainer takes six horses to a show, how the hauling, the stalls and the trainer's hotel are divided among the six owners needs a stated method, not a monthly surprise.

### 5. Sale commissions

> If the Horse is sold during the term of this Agreement, Trainer shall receive a commission of [COMMISSION RATE] of the gross sale price. This commission [COMMISSION SCOPE]. Trainer shall receive a commission on a sale completed within [TAIL PERIOD] after termination of this Agreement only if [TAIL CONDITION]. Trainer shall disclose to Owner in writing any payment Trainer receives from a buyer, a buyer's agent, or any other party in connection with a sale of the Horse, and Trainer shall not accept any such payment without Owner's prior written consent. If Trainer assists Owner in purchasing a horse, the commission shall be [PURCHASE COMMISSION].

Why it matters: The disclosure sentence is the most important one in this agreement. Payments flowing to a trainer from the other side of a transaction are the single most damaging thing that surfaces after a horse deal, some states regulate it directly, and making it a written term means it is settled between these parties regardless of what the state rule turns out to be.

### 6. Care, insurance and liability

> Owner shall maintain mortality and major medical insurance on the Horse of at least [INSURANCE AMOUNT] and personal liability coverage of at least [OWNER LIABILITY COVERAGE]. Trainer shall maintain care, custody and control coverage and commercial liability coverage of at least [TRAINER LIABILITY COVERAGE], and shall provide a certificate of insurance on request. Trainer shall exercise [CARE STANDARD] and shall not be liable for injury, illness or death of the Horse except to the extent caused by Trainer's [LIABILITY STANDARD]. In an emergency where Owner cannot be reached within [EMERGENCY WINDOW], Trainer is authorised to obtain veterinary care at Owner's expense.

Why it matters: Care, custody and control coverage is the specific product that responds when a horse in a professional's care is hurt, and it is genuinely common for a training agreement to require insurance without naming the kind that matters here.

### 7. Term, termination and what leaves with the horse

> This Agreement runs from [START DATE] and continues until terminated by either party on [TERMINATION NOTICE] days' written notice. On termination, Owner shall pay all amounts accrued through the termination date, and Trainer shall deliver to Owner all of Owner's property, together with the Horse's competition records, health records, and any registry documents in Trainer's possession. This Agreement is governed by the law of [GOVERNING LAW STATE] and may be amended only in a writing signed by both parties.

Why it matters: The records sentence looks minor and prevents a specific, common and genuinely obstructive situation: a horse leaving a programme without its show record, its papers or its veterinary history.


## Clause map
| Term | The question it answers | The bill or dispute it prevents |
| --- | --- | --- |
| Fee and exclusions | What the training fee actually buys | A monthly invoice with items the owner did not expect |
| Approval threshold | How much a trainer may spend without asking | Every small decision either delayed or disputed |
| Permitted riders | Who is actually riding the horse | An owner discovering an assistant rides it, months later |
| Show cost allocation | How a shared trip is divided among clients | Six owners with six different views of one hotel bill |
| Commission and tail | Whether a sale owes the trainer, and for how long after | A horse sold weeks after leaving the programme |
| Payment disclosure | Whether the trainer may take money from the other side | The most damaging thing that surfaces after a horse deal |
| Records on exit | What leaves with the horse | A horse arriving at a new barn with no papers or history |


## What varies by state, and how to check it
This template is written to be generally usable and is deliberately not state-specific. Equine law is one of the areas where state-to-state variation is widest, and a document that guesses at a state rule is more dangerous than one that leaves the space open. The items below are the ones to confirm for the state where the horse actually is, before you rely on the document.

- Whether your state regulates equine sale commissions or dual agency, including any written disclosure requirement.
- Whether your state's tests for independent contractor status match how the training relationship actually operates day to day.
- Whether your state prescribes equine activity warning language that a training agreement must carry.
- Whether a trainer in your state has any lien for unpaid training fees, and what notice it requires.
- What your insurer requires: care, custody and control coverage is a distinct product from general liability and is the one that responds to a horse hurt in a professional's care.

Where a state prescribes warning language, the template leaves a clearly marked blank for it rather than supplying a paraphrase. Statutory warning wording is prescribed wording: an approximation of it, or the right words from the wrong state, can create the appearance of compliance without the substance of it.


## Frequently asked questions
### Does a trainer get a commission if the owner sells the horse privately?

Only if the agreement says so. Both answers are common in practice, which is exactly why leaving it unsaid is the problem. Decide whether the commission attaches to any sale during the term or only to sales the trainer arranged, and write that down.

### Can a trainer take a commission from the buyer as well as the seller?

Some states regulate this directly and it is one of the fastest ways for a professional relationship to end badly. The safe position, and the one this template takes, is that any payment from the other side must be disclosed in writing and accepted only with the owner's prior consent.

### What should a training agreement say about show expenses?

More than "owner pays show expenses". List the categories, state the trainer's day fee, say how the trainer's travel is handled, and state the method for splitting shared costs among the horses on the trip.

### Is a trainer an employee or an independent contractor?

The label in the agreement is a starting point, not the answer. The classification turns on how the relationship actually works, and it has real tax and insurance consequences for both sides. Worth asking about if the trainer works predominantly for one owner.

### What happens to the training fee if the horse is laid up?

Whatever the agreement says. Suspending it, halving it or continuing it are all workable; the version that causes trouble is the one where nobody decided and the invoice arrives anyway.


## Related links
- [What Should Be Included in a Training Agreement?](/boarding/what-should-be-included-in-a-training-agreement/)
- [Boarding Agreement vs Training Agreement](/compare/boarding-agreement-vs-training-agreement/)
- [What Liability Does a Trainer Have?](/boarding/what-liability-does-a-trainer-have/)
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
