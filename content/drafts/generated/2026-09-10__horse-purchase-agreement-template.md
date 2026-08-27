---
title: Horse Purchase Agreement Template: Deposits, Trials, Vettings and Fall-Through Terms
entry_id: draft-template-2026-09-10-horse-purchase-agreement
content_type: template
cadence: on_demand
status: pending
scheduled_date: 2026-09-10
source_cluster: horse-sale-and-purchase
source_page_id: what-should-be-included-in-a-horse-sale-contract
slug: /drafts/2026-09-10/horse-purchase-agreement-template/
review_status: pending
github_path: content/drafts/generated/2026-09-10__horse-purchase-agreement-template.md
---
# Horse Purchase Agreement Template: Deposits, Trials, Vettings and Fall-Through Terms

## Quick answer
A purchase agreement governs the part of a horse sale that happens before the horse moves: the deposit, the trial, the pre-purchase examination, the conditions each side has to meet, and what happens to the money if the deal falls through. A bill of sale records that a transfer happened; a purchase agreement decides whether it is going to. The builder below drafts one with the fall-through terms actually written down.


## Why this document is worth doing properly
Almost every horse sale that goes badly went badly in the gap between the handshake and the trailer. Somebody paid a deposit and then the vetting turned up a finding. Somebody took the horse on trial and it was hurt in week two. Somebody agreed a price and then a second buyer offered more. None of those are exotic events, and all of them are cheap to plan for and expensive to improvise.

A purchase agreement is the document for that gap. It is different from a bill of sale in the same way an offer is different from a receipt. Horse Legal Guide is the educational surface for Wise Covington, and this page is written to give buyers and sellers a version of that document they can actually complete, including the clauses that decide who keeps the deposit.


## What this page is built to answer
This page is written against the following measured queries: horse purchase agreement (70/mo, KD 2).

Search-volume and difficulty figures come from the evidence records in this repository and from the keyword packet cited alongside each query in data/system/template_briefs.json. Where this repository's own Search Console record disagrees with a keyword-tool volume for the same phrase, both numbers are recorded rather than reconciled, because they measure different things: one is what the tool estimates the market searches, the other is what this domain has actually been shown for.


## Build the document
Fill in what applies to your situation. Everything runs in your browser: nothing you type is sent anywhere, stored, or visible to anyone else. Anything you leave blank stays in [BRACKETS] in the output, so a half-finished document never reads as a finished one.

```generator
{
  "id": "purchase-agreement-builder",
  "title": "Horse purchase agreement builder",
  "filename": "horse-purchase-agreement",
  "fields": [
    {
      "name": "date",
      "label": "Agreement date",
      "type": "date",
      "prompt": "date"
    },
    {
      "name": "seller",
      "label": "Seller full legal name",
      "prompt": "seller name"
    },
    {
      "name": "seller_addr",
      "label": "Seller address",
      "prompt": "seller address"
    },
    {
      "name": "buyer",
      "label": "Buyer full legal name",
      "prompt": "buyer name"
    },
    {
      "name": "buyer_addr",
      "label": "Buyer address",
      "prompt": "buyer address"
    },
    {
      "name": "horse_name",
      "label": "Horse name",
      "prompt": "horse name"
    },
    {
      "name": "horse_desc",
      "label": "Age, breed, sex",
      "prompt": "age, breed, sex"
    },
    {
      "name": "horse_id",
      "label": "Registration or microchip number",
      "prompt": "horse id"
    },
    {
      "name": "price",
      "label": "Purchase price",
      "placeholder": "$32,000",
      "prompt": "price"
    },
    {
      "name": "payment_terms",
      "label": "Payment terms",
      "placeholder": "deposit on signing, balance by wire at closing",
      "prompt": "payment terms"
    },
    {
      "name": "deposit",
      "label": "Deposit amount",
      "placeholder": "$3,200",
      "prompt": "deposit"
    },
    {
      "name": "deposit_treatment",
      "label": "Deposit is",
      "type": "select",
      "options": [
        "",
        "credited against the purchase price at closing",
        "held as liquidated damages if Buyer defaults"
      ],
      "prompt": "deposit treatment"
    },
    {
      "name": "refund_conditions",
      "label": "Refundable if",
      "type": "textarea",
      "placeholder": "the pre-purchase examination discloses a finding described below, or Seller fails to deliver clear title",
      "prompt": "refund conditions"
    },
    {
      "name": "nonrefund_conditions",
      "label": "Non-refundable if",
      "type": "textarea",
      "placeholder": "Buyer withdraws for any reason other than those listed above",
      "prompt": "non-refund conditions"
    },
    {
      "name": "deposit_holder",
      "label": "Deposit held by",
      "placeholder": "Seller / Buyer's trainer / an escrow account",
      "prompt": "deposit holder"
    },
    {
      "name": "commissions",
      "label": "Commission disclosure",
      "type": "textarea",
      "placeholder": "Seller pays a 10% commission to [agent]. Buyer pays no commission. No person is being paid by both parties.",
      "prompt": "commission disclosure"
    },
    {
      "name": "vetting_condition",
      "label": "This agreement is",
      "type": "select",
      "options": [
        "",
        "conditional on the satisfactory completion of",
        "not conditional on, but contemplates"
      ],
      "prompt": "vetting condition"
    },
    {
      "name": "vet",
      "label": "Examining veterinarian",
      "prompt": "examining vet"
    },
    {
      "name": "vet_deadline",
      "label": "Vetting completed by",
      "type": "date",
      "prompt": "vetting deadline"
    },
    {
      "name": "exam_scope",
      "label": "Exam scope",
      "placeholder": "clinical exam, flexions, and radiographs of front feet, hocks and stifles",
      "prompt": "exam scope"
    },
    {
      "name": "exam_payer",
      "label": "Exam cost paid by",
      "type": "select",
      "options": [
        "",
        "Buyer",
        "Seller",
        "the parties equally"
      ],
      "prompt": "exam cost payer"
    },
    {
      "name": "finding_standard",
      "label": "Buyer may walk if findings",
      "placeholder": "are material to the Horse's suitability for the intended use, in the written opinion of the examining veterinarian",
      "prompt": "finding standard"
    },
    {
      "name": "finding_days",
      "label": "Notice within (days) of the report",
      "placeholder": "3",
      "prompt": "finding notice days"
    },
    {
      "name": "finding_deposit",
      "label": "On that termination the deposit is",
      "type": "select",
      "options": [
        "",
        "refunded in full within 5 business days",
        "refunded less the cost of the examination"
      ],
      "prompt": "finding deposit outcome"
    },
    {
      "name": "trial_term",
      "label": "Trial",
      "type": "select",
      "options": [
        "",
        "shall have a trial period of 7 days",
        "shall have a trial period of 14 days",
        "shall have a trial period of 30 days",
        "shall have no trial period"
      ],
      "prompt": "trial term"
    },
    {
      "name": "trial_loc",
      "label": "Trial location",
      "prompt": "trial location"
    },
    {
      "name": "trial_riders",
      "label": "Trial riders",
      "prompt": "trial riders"
    },
    {
      "name": "trial_use",
      "label": "Trial use",
      "placeholder": "flatwork and lessons; no jumping over 2'9\"; no competition",
      "prompt": "trial use"
    },
    {
      "name": "trial_insurer",
      "label": "Trial insurance carried by",
      "type": "select",
      "options": [
        "",
        "Buyer",
        "Seller"
      ],
      "prompt": "trial insurer"
    },
    {
      "name": "trial_amount",
      "label": "Trial insured value",
      "placeholder": "the purchase price",
      "prompt": "trial insurance amount"
    },
    {
      "name": "trial_costs",
      "label": "Trial care costs paid by",
      "type": "select",
      "options": [
        "",
        "Buyer",
        "Seller"
      ],
      "prompt": "trial cost payer"
    },
    {
      "name": "trial_risk",
      "label": "Trial risk of loss rests with",
      "type": "select",
      "options": [
        "",
        "Buyer",
        "Seller"
      ],
      "prompt": "trial risk"
    },
    {
      "name": "disclosures",
      "label": "Seller disclosures",
      "type": "textarea",
      "prompt": "disclosures"
    },
    {
      "name": "condition",
      "label": "Condition term",
      "type": "select",
      "options": [
        "",
        "as-is, where-is, subject to the disclosures and representations above",
        "with the express warranties stated above and no others"
      ],
      "prompt": "condition term"
    },
    {
      "name": "closing_date",
      "label": "Closing date",
      "type": "date",
      "prompt": "closing date"
    },
    {
      "name": "documents",
      "label": "Documents at closing",
      "type": "textarea",
      "placeholder": "signed bill of sale, registration papers with signed transfer, current Coggins, vaccination and farrier records",
      "prompt": "documents"
    },
    {
      "name": "buyer_default",
      "label": "If buyer fails to close",
      "placeholder": "Seller may retain the deposit as liquidated damages and the Horse remains Seller's property",
      "prompt": "buyer default"
    },
    {
      "name": "seller_default",
      "label": "If seller fails to close",
      "placeholder": "Seller shall refund the deposit in full and reimburse Buyer's documented examination and transport costs",
      "prompt": "seller default"
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
  "body": "HORSE PURCHASE AGREEMENT\n\n1. PARTIES, HORSE AND PRICE.\nThis Horse Purchase Agreement is made on [[date]] between [[seller]] of [[seller_addr]] (\"Seller\") and [[buyer]] of [[buyer_addr]] (\"Buyer\") for the horse known as [[horse_name]], described as [[horse_desc]], registration or microchip number [[horse_id]] (the \"Horse\"), at a purchase price of [[price]], payable [[payment_terms]].\n\n2. DEPOSIT.\nBuyer shall pay a deposit of [[deposit]] on signing, which shall be [[deposit_treatment]]. The deposit is refundable if [[refund_conditions]]. The deposit is non-refundable if [[nonrefund_conditions]]. The deposit shall be held by [[deposit_holder]] until the earlier of closing or termination of this Agreement.\n\n3. COMMISSIONS AND DISCLOSURE.\n[[commissions]] Each party confirms that it has disclosed to the other any agent, trainer or intermediary receiving a payment from either side in connection with this transaction.\n\n4. PRE-PURCHASE EXAMINATION.\nThis Agreement is [[vetting_condition]] a pre-purchase veterinary examination performed by [[vet]], to be completed on or before [[vet_deadline]], with a scope of [[exam_scope]]. The cost shall be borne by [[exam_payer]]. If the examination discloses findings that [[finding_standard]], Buyer may terminate this Agreement by written notice within [[finding_days]] days of receiving the report, and the deposit shall be [[finding_deposit]].\n\n5. TRIAL PERIOD.\nBuyer [[trial_term]]. During any trial period the Horse shall be kept at [[trial_loc]], ridden only by [[trial_riders]], used only for [[trial_use]], and insured by [[trial_insurer]] with mortality and major medical coverage of at least [[trial_amount]]. Care costs during the trial shall be borne by [[trial_costs]]. Risk of loss during the trial rests with [[trial_risk]]. Buyer shall return the Horse in comparable condition if the sale does not complete.\n\n6. SELLER'S REPRESENTATIONS AND DISCLOSURES.\nSeller represents that Seller has good title, free of liens, board debt, training debt and co-ownership claims, and full authority to sell. Seller discloses the following about the Horse's history and condition: [[disclosures]]. Except as stated in this Agreement, the Horse is sold [[condition]].\n\n7. CLOSING AND DEFAULT.\nClosing shall occur on or before [[closing_date]], at which point Seller shall deliver a signed bill of sale and the following: [[documents]]. If Buyer fails to close for any reason other than a condition permitted above, [[buyer_default]]. If Seller fails to close, [[seller_default]].\n\n8. GOVERNING LAW.\nThis Agreement is governed by the law of [[state]], is the entire agreement between the parties regarding the purchase of the Horse, supersedes all prior discussions and advertisements, and may be amended only in a writing signed by both parties.\n\nSELLER: __________________________  DATE: __________\nPrinted name: [[seller]]\n\nBUYER: ___________________________  DATE: __________\nPrinted name: [[buyer]]\n\nThis document is a general educational template, not legal advice, and has not been reviewed against the law of any particular state. Have it reviewed before you rely on it."
}
```

## What people often miss
The clause that decides most disputes is the one about the deposit, and it needs three parts, not one: how much, what it is for, and under exactly which circumstances it is refundable. "Deposit to hold the horse" is not terms. A deposit that is refundable on a failed vetting but not on a change of mind is terms, and both people know where they stand from the first day.

The second is what "failed vetting" means. A pre-purchase examination does not pass or fail; it produces findings, and reasonable vets disagree about their significance. An agreement that makes the deposit refundable on a failed vetting without saying who decides and against what standard has simply relocated the argument. Naming the examining vet, the scope of the exam, and who bears the cost of it removes most of that.

The third is the trial period, which is where risk allocation matters most and is written least. During a trial the horse is in the buyer's possession and the seller's ownership. Who insures it, who pays for care, who may ride it, where it may go and what happens if it is injured all need answers before the trailer leaves.


## The document, clause by clause
Each block below is the clause text the builder produces, followed by what it is actually for. Read them before you use the output.

### 1. Parties, horse and purchase price

> This Horse Purchase Agreement is made on [DATE] between [SELLER NAME] of [SELLER ADDRESS] ("Seller") and [BUYER NAME] of [BUYER ADDRESS] ("Buyer") for the horse known as [HORSE NAME], a [AGE]-year-old [BREED] [SEX], registration or microchip number [HORSE ID] (the "Horse"), at a purchase price of [PRICE], payable [PAYMENT TERMS].

Why it matters: The payment terms line carries more weight here than in a bill of sale, because a purchase agreement often contemplates money moving in stages: deposit, balance on vetting, balance on delivery.

### 2. Deposit and refundability

> Buyer shall pay a deposit of [DEPOSIT] on signing, which shall be [DEPOSIT TREATMENT]. The deposit is refundable if [REFUND CONDITIONS], and is non-refundable if [NON-REFUND CONDITIONS]. The deposit shall be held by [DEPOSIT HOLDER] until the earlier of closing or termination of this Agreement.

Why it matters: Naming the holder is not paranoia; a deposit sitting in a trainer's account with no written instruction about when it releases is a common and entirely avoidable source of conflict, particularly where the trainer is also taking a commission.

### 3. Commissions and dual agency

> The following commissions or fees are payable in connection with this sale: [COMMISSION DISCLOSURE]. Each party confirms that it has disclosed to the other any agent, trainer or intermediary who is receiving a payment from either side in connection with this transaction.

Why it matters: Undisclosed commissions and agents being paid by both sides are among the most damaging things that surface after a horse sale. Some states regulate this directly. Writing it into the agreement makes the disclosure a term rather than an assumption, whatever the state rule turns out to be.

### 4. Pre-purchase examination

> This Agreement is [VETTING CONDITION] a pre-purchase veterinary examination performed by [EXAMINING VET], to be completed on or before [VETTING DEADLINE], with a scope of [EXAM SCOPE]. The cost of the examination shall be borne by [EXAM COST PAYER]. If the examination discloses findings that [FINDING STANDARD], Buyer may terminate this Agreement by written notice within [FINDING NOTICE DAYS] days of receiving the report, and the deposit shall be [FINDING DEPOSIT OUTCOME].

Why it matters: This is the clause with the sharpest edges. Naming the vet, the scope, the deadline and the standard for walking away turns a subjective disagreement into a defined process. Note the scope field: a flexion-only exam and a full radiographic series are very different transactions.

### 5. Trial period

> Buyer [TRIAL TERM]. During any trial period the Horse shall be kept at [TRIAL LOCATION], ridden only by [TRIAL RIDERS], used only for [TRIAL USE], and insured by [TRIAL INSURER] with mortality and major medical coverage of at least [TRIAL INSURANCE AMOUNT]. Care costs during the trial shall be borne by [TRIAL COST PAYER]. Risk of loss during the trial rests with [TRIAL RISK]. Buyer shall return the Horse in comparable condition if the sale does not complete.

Why it matters: A trial is the only period in a horse sale when possession and ownership are deliberately split, and it is therefore the period with the least default law to fall back on. Everything in this clause needs an answer before the horse ships.

### 6. Seller's representations and disclosures

> Seller represents that Seller has good title, free of liens, board debt, training debt and co-ownership claims, and full authority to sell. Seller discloses the following about the Horse's history and condition: [DISCLOSURES]. Except as stated in this Agreement, the Horse is sold [CONDITION TERM].

Why it matters: The disclosure field should be filled in generously. A seller who writes down what is known is in a substantially better position than one who said the same things out loud, and a buyer who receives it in writing has what they need to make a real decision.

### 7. Closing, documents and failure to close

> Closing shall occur on or before [CLOSING DATE], at which point Seller shall deliver a signed bill of sale and the following documents: [DOCUMENTS]. If Buyer fails to close for any reason other than a condition permitted above, [BUYER DEFAULT]. If Seller fails to close, [SELLER DEFAULT]. This Agreement is governed by the law of [GOVERNING LAW STATE], is the entire agreement between the parties, and may be amended only in a signed writing.

Why it matters: Two default clauses instead of one. Most templates handle the buyer walking away and ignore the seller who takes a better offer during the trial, which is at least as common.


## Clause map
| Stage of the deal | The term that governs it | The dispute it prevents |
| --- | --- | --- |
| Money down | Deposit amount, holder, refund and non-refund conditions | "It was to hold the horse" against "it was non-refundable" |
| Who is being paid | Commission and dual-agency disclosure | An agent paid by both sides surfacing after closing |
| The vetting | Named vet, scope, deadline, standard for walking away | Findings that neither side agreed in advance were disqualifying |
| The trial | Location, riders, use, insurance, costs, risk of loss | A horse injured in week two with no allocated risk |
| Closing | Date, documents, and a default clause for each side | A seller taking a better offer mid-trial with no consequence |


## What varies by state, and how to check it
This template is written to be generally usable and is deliberately not state-specific. Equine law is one of the areas where state-to-state variation is widest, and a document that guesses at a state rule is more dangerous than one that leaves the space open. The items below are the ones to confirm for the state where the horse actually is, before you rely on the document.

- Whether your state regulates agent or trainer commissions in horse sales, including any requirement that dual agency be disclosed in writing.
- How your state treats a deposit described as liquidated damages, since some limit what can be retained.
- Whether your state requires a health certificate, negative Coggins or brand inspection to move the horse for a trial as well as for the sale.
- How your state's rules on disclaimers of implied warranties apply between these particular parties.
- Which state's law will realistically govern if buyer, seller and horse are in three different states, and whether the venue clause matches.

Where a state prescribes warning language, the template leaves a clearly marked blank for it rather than supplying a paraphrase. Statutory warning wording is prescribed wording: an approximation of it, or the right words from the wrong state, can create the appearance of compliance without the substance of it.


## Frequently asked questions
### What is the difference between a horse purchase agreement and a bill of sale?

A purchase agreement governs the period before the horse changes hands: deposits, trials, vettings, conditions and what happens if the deal collapses. A bill of sale records that the transfer happened. Many sales use both, with the purchase agreement signed first and the bill of sale signed at delivery.

### Is a deposit on a horse refundable?

Only on the terms the agreement sets out. There is no general default, which is why the agreement needs to name the refundable and non-refundable circumstances separately rather than describing the money as "a deposit" and leaving it there.

### What counts as failing a pre-purchase exam?

Nothing, unless the agreement defines it. A pre-purchase examination produces findings, not a pass or a fail, and reasonable veterinarians differ on their significance. Name the standard, the examining vet and the deadline in advance.

### Who insures a horse during a trial period?

Whoever the agreement says, and it should say. During a trial the horse is in the buyer's possession and the seller's ownership, which is the one arrangement with the least default law behind it and the most room for a bad surprise.

### Do I need a purchase agreement for a low-priced horse?

The value of the document is not proportional to the price. A four-figure horse can produce the same trial injury, the same vetting disagreement and the same disputed deposit as a six-figure one, and the parties in a smaller sale are less likely to have anything else in writing.


## Related links
- [What Should Be Included in a Horse Sale Contract?](/faq/what-should-be-included-in-a-horse-sale-contract/)
- [Do I Need a Contract to Buy a Horse?](/faq/do-i-need-a-contract-to-buy-a-horse/)
- [As-Is Clause vs Disclosure Clause in a Horse Sale](/compare/as-is-clause-vs-disclosure-clause-in-a-horse-sale/)
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
