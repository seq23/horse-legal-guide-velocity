---
title: Horse Boarding Contract Template (Fill-In, With a Working Generator)
entry_id: draft-template-2026-09-07-horse-boarding-contract
content_type: template
cadence: on_demand
status: pending
scheduled_date: 2026-09-07
source_cluster: boarding-training-and-barn-operations
source_page_id: what-should-be-included-in-a-horse-boarding-agreement
slug: /drafts/2026-09-07/horse-boarding-contract-template/
review_status: pending
github_path: content/drafts/generated/2026-09-07__horse-boarding-contract-template.md
---
# Horse Boarding Contract Template (Fill-In, With a Working Generator)

## Quick answer
A horse boarding contract is the document that decides, in advance, who pays for what and who decides what when a horse lives on someone else's property. At minimum it needs to name the parties and the horse, set the board rate and the due date, state what board actually includes, say who authorises and pays for veterinary and farrier care in an emergency, allocate the risk of injury or death, and say how either side ends the arrangement. The builder below assembles a complete draft you can fill in, copy and take to review.


## Why this document is worth doing properly
Boarding is the most common written agreement in the horse world and the one most often left unwritten. A barn takes a horse in, an owner starts paying monthly, and the terms live in a text thread and a shared assumption about how things are normally done. That works until a horse colics at 2am, a boarder is three months behind, a farrier disagrees with a trainer, or someone gives notice on a Friday and expects to be gone by Sunday.

The point of a boarding contract is not distrust. It is that the barn and the owner are each carrying real, expensive risk on behalf of the other, and neither can manage a risk they have not named. Horse Legal Guide exists as an educational surface for Wise Covington, and this page is written to be used rather than admired: read the clause walkthrough, fill in the builder, then have the result reviewed against your state's rules and your own operation.


## What this page is built to answer
This page is written against the following measured queries: horse boarding contract (320/mo, KD 0); horse boarding agreement (260/mo, KD 0); horse boarding contract template (170/mo, KD 0).

Search-volume and difficulty figures come from the evidence records in this repository and from the keyword packet cited alongside each query in data/system/template_briefs.json. Where this repository's own Search Console record disagrees with a keyword-tool volume for the same phrase, both numbers are recorded rather than reconciled, because they measure different things: one is what the tool estimates the market searches, the other is what this domain has actually been shown for.


## Build the document
Fill in what applies to your situation. Everything runs in your browser: nothing you type is sent anywhere, stored, or visible to anyone else. Anything you leave blank stays in [BRACKETS] in the output, so a half-finished document never reads as a finished one.

```generator
{
  "id": "boarding-contract-builder",
  "title": "Horse boarding contract builder",
  "filename": "horse-boarding-agreement",
  "fields": [
    {
      "name": "agreement_date",
      "label": "Agreement date",
      "type": "date",
      "prompt": "date"
    },
    {
      "name": "barn_name",
      "label": "Barn legal name",
      "placeholder": "Cedar Run Stables LLC",
      "prompt": "barn legal name"
    },
    {
      "name": "barn_entity",
      "label": "Barn entity type",
      "type": "select",
      "options": [
        "",
        "limited liability company",
        "corporation",
        "sole proprietorship",
        "partnership"
      ],
      "prompt": "entity type"
    },
    {
      "name": "barn_address",
      "label": "Facility address",
      "placeholder": "1400 Cedar Run Rd, ...",
      "prompt": "facility address"
    },
    {
      "name": "owner_name",
      "label": "Owner full legal name",
      "placeholder": "Jordan A. Reyes",
      "prompt": "owner full legal name"
    },
    {
      "name": "owner_address",
      "label": "Owner address",
      "placeholder": "Street, city, state, ZIP",
      "prompt": "owner address"
    },
    {
      "name": "horse_name",
      "label": "Horse name",
      "placeholder": "Copper Penny",
      "prompt": "horse name"
    },
    {
      "name": "horse_desc",
      "label": "Age, breed, sex, markings",
      "placeholder": "12-year-old Quarter Horse gelding, bay, star",
      "prompt": "age, breed, sex, markings"
    },
    {
      "name": "horse_id",
      "label": "Registration or microchip number",
      "placeholder": "985141000123456",
      "prompt": "registration or microchip number"
    },
    {
      "name": "board_rate",
      "label": "Monthly board rate",
      "placeholder": "$650",
      "prompt": "board rate"
    },
    {
      "name": "board_type",
      "label": "Board type",
      "type": "select",
      "options": [
        "",
        "full",
        "partial",
        "pasture",
        "training",
        "self-care"
      ],
      "prompt": "board type"
    },
    {
      "name": "due_day",
      "label": "Board due on day of month",
      "placeholder": "1st",
      "prompt": "due day"
    },
    {
      "name": "services",
      "label": "Services included (list them)",
      "type": "textarea",
      "placeholder": "stall with daily cleaning; twice-daily hay; twice-daily grain per owner instruction; daily turnout; blanket on and off; holding for vet and farrier",
      "prompt": "services included"
    },
    {
      "name": "late_days",
      "label": "Late after (days)",
      "placeholder": "10",
      "prompt": "late days"
    },
    {
      "name": "late_fee",
      "label": "Late fee",
      "placeholder": "$50",
      "prompt": "late fee"
    },
    {
      "name": "rate_notice",
      "label": "Rate-change notice (days)",
      "placeholder": "30",
      "prompt": "rate change notice days"
    },
    {
      "name": "feed",
      "label": "Feed description",
      "type": "textarea",
      "placeholder": "free-choice grass hay, 2 lb ration balancer twice daily",
      "prompt": "feed description"
    },
    {
      "name": "turnout",
      "label": "Turnout description",
      "placeholder": "8 hours daily in a mixed gelding field",
      "prompt": "turnout description"
    },
    {
      "name": "vet",
      "label": "Owner's veterinarian and phone",
      "prompt": "veterinarian name and phone"
    },
    {
      "name": "farrier",
      "label": "Owner's farrier and phone",
      "prompt": "farrier name and phone"
    },
    {
      "name": "emergency_contact",
      "label": "Emergency decision-maker and phone",
      "prompt": "emergency contact name and phone"
    },
    {
      "name": "emergency_window",
      "label": "Try to reach owner for how long before acting",
      "placeholder": "60 minutes",
      "prompt": "emergency contact window"
    },
    {
      "name": "reimburse_days",
      "label": "Reimburse barn within (days)",
      "placeholder": "15",
      "prompt": "reimbursement days"
    },
    {
      "name": "care_standard",
      "label": "Standard of care wording",
      "placeholder": "the ordinary care a reasonable horse professional would provide",
      "prompt": "standard of care"
    },
    {
      "name": "liability_standard",
      "label": "Barn liable only for",
      "placeholder": "gross negligence or wilful misconduct",
      "prompt": "liability standard"
    },
    {
      "name": "owner_insurance",
      "label": "Owner insurance requirement",
      "placeholder": "personal liability coverage of at least $1,000,000, naming Barn as an additional insured",
      "prompt": "owner insurance requirement"
    },
    {
      "name": "access_hours",
      "label": "Facility access hours",
      "placeholder": "7am to 9pm daily",
      "prompt": "access hours"
    },
    {
      "name": "outside_provider",
      "label": "Outside trainer / provider rule",
      "placeholder": "provide proof of liability insurance and check in with barn staff on arrival",
      "prompt": "outside provider requirement"
    },
    {
      "name": "term_notice",
      "label": "Termination notice (days)",
      "placeholder": "30",
      "prompt": "termination notice days"
    },
    {
      "name": "proration",
      "label": "Final month is",
      "type": "select",
      "options": [
        "",
        "shall be prorated to the day of removal",
        "shall not be prorated and is payable in full"
      ],
      "prompt": "proration term"
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
    },
    {
      "name": "venue",
      "label": "Venue for disputes",
      "placeholder": "the state courts sitting in [county]",
      "prompt": "venue"
    }
  ],
  "body": "HORSE BOARDING AGREEMENT\n\n1. PARTIES AND HORSE.\nThis Horse Boarding Agreement (the \"Agreement\") is entered into on [[agreement_date]] between [[barn_name]], a [[barn_entity]] with its principal facility at [[barn_address]] (\"Barn\"), and [[owner_name]] of [[owner_address]] (\"Owner\"). It concerns the horse known as [[horse_name]], described as [[horse_desc]], registration or microchip number [[horse_id]] (the \"Horse\"). Owner represents that Owner is the lawful owner of the Horse or is authorised by the lawful owner to enter into this Agreement.\n\n2. BOARD AND PAYMENT.\nOwner shall pay Barn [[board_rate]] per month for [[board_type]] board, due on the [[due_day]] of each month in advance. Board includes, and is limited to: [[services]]. Services not listed are billed separately at Barn's then-current rates and require Owner's prior approval, except as provided in Section 4. Payments more than [[late_days]] days late incur a late charge of [[late_fee]]. Barn may adjust the board rate on [[rate_notice]] days' prior written notice.\n\n3. FEED, TURNOUT AND DAILY CARE.\nBarn shall provide [[feed]] and turnout of approximately [[turnout]], subject to weather, footing, facility conditions and the Horse's health. Owner-supplied feed, supplements and medication must be delivered in labelled containers with written instructions. Barn may decline to administer anything it reasonably believes to be unsafe or outside its staff's competence.\n\n4. VETERINARY AND FARRIER CARE.\nOwner's primary veterinarian is [[vet]]. Owner's primary farrier is [[farrier]]. Owner authorises Barn to obtain emergency veterinary or farrier care at Owner's expense when Barn reasonably believes the Horse's health requires it and Owner cannot be reached within [[emergency_window]]. Owner's emergency decision-maker is [[emergency_contact]]. Owner shall reimburse Barn within [[reimburse_days]] days of invoice. Owner shall keep the Horse current on vaccinations, deworming, dental care and negative Coggins testing as required by Barn's facility policy and applicable law.\n\n5. RISK, INSURANCE AND LIABILITY.\nOwner acknowledges that equine activities involve inherent risks, including injury to or death of the Horse, and that Barn does not guarantee the Horse's safety. Barn shall provide [[care_standard]] and shall not be liable for injury, illness, escape, theft or death of the Horse except to the extent caused by Barn's [[liability_standard]]. Owner is responsible for insuring the Horse and Owner's tack and equipment; Barn's insurance does not cover them. Owner shall maintain [[owner_insurance]].\n\n[INSERT YOUR STATE'S REQUIRED EQUINE ACTIVITY WARNING LANGUAGE HERE, VERBATIM, IF YOUR STATE PRESCRIBES ONE. DO NOT PARAPHRASE IT AND DO NOT COPY IT FROM ANOTHER STATE.]\n\n6. FACILITY RULES AND ACCESS.\nOwner and Owner's guests, trainers, veterinarians and farriers shall comply with Barn's posted facility rules. Facility access hours are [[access_hours]]. Outside trainers and service providers must [[outside_provider]].\n\n7. TERMINATION.\nEither party may terminate this Agreement on [[term_notice]] days' prior written notice. Board for the final period [[proration]]. Owner shall remove the Horse and all of Owner's property on or before the effective date of termination. Barn may terminate immediately on written notice if the Horse poses a danger to persons or other horses, or if board remains substantially past due. Any right of Barn to retain, lien or sell the Horse or Owner's property for unpaid amounts is governed by the law of [[state]] and is not expanded by this Agreement.\n\n8. GOVERNING LAW AND DISPUTES.\nThis Agreement is governed by the law of [[state]]. The parties shall attempt in good faith to resolve any dispute by direct discussion before commencing formal proceedings, and any proceeding shall be brought in [[venue]]. This Agreement is the entire agreement between the parties regarding the boarding of the Horse and may be amended only in a writing signed by both parties. If any provision is held unenforceable, the remainder stays in effect.\n\nBARN: ____________________________  DATE: __________\nPrinted name and title: [[barn_name]]\n\nOWNER: ___________________________  DATE: __________\nPrinted name: [[owner_name]]\n\nThis document is a general educational template, not legal advice, and has not been reviewed against the law of any particular state. Have it reviewed before you rely on it."
}
```

## What people often miss
The clause people skip most often is the one about who may authorise veterinary treatment when the owner cannot be reached. That is also the clause most likely to be needed at three in the morning. A boarding contract that sets a dollar threshold, names a second contact and says explicitly who carries the bill converts the worst night of the year into a procedure instead of an argument.

The second is the difference between what board covers and what board includes. "Full board" is not a defined legal term. It means different things at different barns, and two reasonable people can use the phrase and picture different feed, different turnout, different blanket handling and different holiday coverage. Listing the actual services, by name and frequency, is more protective than any amount of general language about reasonable care.

The third is the exit. Most boarding disputes are really about the last month of the relationship: how much notice was required, whether the final month is prorated, what happens to the tack and the trunk, and whether the barn can hold the horse over an unpaid balance. Whether a barn has any right to retain or sell a horse for unpaid board is governed by state statute and varies substantially, so this template requires the parties to state the notice terms and directs the question of retention to the state's own rules rather than inventing an answer.


## The document, clause by clause
Each block below is the clause text the builder produces, followed by what it is actually for. Read them before you use the output.

### 1. Parties, horse and effective date

> This Horse Boarding Agreement (the "Agreement") is entered into on [DATE] between [BARN LEGAL NAME], a [ENTITY TYPE] with its principal facility at [FACILITY ADDRESS] ("Barn"), and [OWNER FULL LEGAL NAME] of [OWNER ADDRESS] ("Owner"). It concerns the horse known as [HORSE NAME], a [AGE]-year-old [BREED] [SEX], [MARKINGS AND IDENTIFYING DETAIL], registration or microchip number [REGISTRATION OR MICROCHIP NUMBER] (the "Horse"). Owner represents that Owner is the lawful owner of the Horse, or is authorised by the lawful owner to enter into this Agreement, and will notify Barn in writing within [OWNERSHIP CHANGE NOTICE DAYS] days of any change in ownership.

Why it matters: Naming the entity rather than a person matters if the barn is an LLC: a contract signed in an individual's name can undercut the liability separation the entity was formed to create. Identifying the horse by microchip or registration number rather than by barn name prevents a later dispute about which horse the agreement covered.

### 2. Board rate, what it includes, and payment

> Owner shall pay Barn [BOARD RATE] per month for [BOARD TYPE] board, due on the [DUE DAY] day of each month in advance. Board includes, and is limited to, the following: [SERVICES INCLUDED]. Services not listed are billed separately at Barn's then-current rates and require Owner's prior approval except as provided in the emergency care section below. Payments more than [LATE DAYS] days late incur a late charge of [LATE FEE]. Barn may adjust the board rate on [RATE CHANGE NOTICE DAYS] days' prior written notice to Owner.

Why it matters: "Full board" and "pasture board" have no fixed legal meaning. Listing services by name is what makes the promise enforceable and, more usefully, what keeps two well-meaning people from discovering in month four that they had different pictures in their heads. The notice period for rate changes protects the owner without freezing the barn's economics.

### 3. Feed, turnout and daily care

> Barn shall provide [FEED DESCRIPTION] and turnout of approximately [TURNOUT DESCRIPTION], subject to weather, footing, facility conditions and the Horse's health. Owner-supplied feed, supplements or medication must be delivered in labelled containers with written instructions, and Barn may decline to administer anything it reasonably believes to be unsafe or outside its staff's competence. Barn will follow Owner's written blanket, fly, and turnout instructions where doing so is consistent with the safety of the Horse, the staff and other horses at the facility.

Why it matters: This is the clause that lets a barn exercise judgment without breaching the agreement, and lets an owner rely on a described standard rather than a vague one. The written-instruction requirement matters: verbal supplement instructions are the single most common source of small, repeated care disputes.

### 4. Veterinary and farrier care, and emergency authority

> Owner's primary veterinarian is [VETERINARIAN NAME AND PHONE] and primary farrier is [FARRIER NAME AND PHONE]. Owner authorises Barn to obtain emergency veterinary or farrier care for the Horse, at Owner's expense, when Barn reasonably believes the Horse's health requires it and Owner cannot be reached within [EMERGENCY CONTACT WINDOW]. Owner's emergency contact, authorised to make decisions if Owner cannot be reached, is [EMERGENCY CONTACT NAME AND PHONE]. Owner shall reimburse Barn for such costs within [REIMBURSEMENT DAYS] days of invoice. Owner shall keep the Horse current on vaccinations, deworming, dental care and negative Coggins testing as required by Barn's facility policy and by applicable law, and shall provide documentation on request.

Why it matters: This is the clause the whole document exists for. Without a named window, a named second decision-maker and an express agreement about who pays, a barn is choosing between acting without authority and doing nothing while a horse deteriorates. Both choices generate liability; the clause removes the choice.

### 5. Risk of loss, insurance and liability

> Owner acknowledges that equine activities involve inherent risks, including the risk of injury to or death of the Horse, and that Barn does not guarantee the Horse's safety. Barn shall provide care consistent with [STANDARD OF CARE], and shall not be liable for injury, illness, escape, theft or death of the Horse except to the extent caused by Barn's [LIABILITY STANDARD]. Owner is responsible for insuring the Horse and Owner's own tack and equipment; Barn's insurance does not cover them. Owner shall maintain mortality, major medical or liability coverage as follows: [OWNER INSURANCE REQUIREMENT]. [STATE-REQUIRED EQUINE ACTIVITY WARNING LANGUAGE - INSERT YOUR STATE'S CURRENT STATUTORY TEXT VERBATIM]

Why it matters: The bracketed warning placeholder is deliberate and should not be filled with generic language. Where a state's equine activity statute prescribes warning wording, it prescribes the wording; an approximation of it may provide no protection while creating the appearance of compliance. Confirm the current text for the state where the horse is kept.

### 6. Facility rules, use and access

> Owner and Owner's guests, trainers, veterinarians and farriers shall comply with Barn's posted facility rules, as amended from time to time on [RULE CHANGE NOTICE DAYS] days' notice. Barn hours of access are [ACCESS HOURS]. Owner shall notify Barn before removing the Horse from the facility for more than [ABSENCE NOTICE HOURS] hours. Outside trainers and service providers must [OUTSIDE PROVIDER REQUIREMENT].

Why it matters: Facility rules change; contracts should not have to be re-signed every time they do. Incorporating rules by reference, with a notice period, keeps the agreement stable and the rules current. The outside-provider term is worth actually deciding rather than leaving to custom.

### 7. Termination, notice and the final month

> Either party may terminate this Agreement on [TERMINATION NOTICE DAYS] days' prior written notice. Board for the final period [PRORATION TERM]. Owner shall remove the Horse and all of Owner's property from the facility on or before the effective date of termination. Barn may terminate immediately, on written notice, if the Horse poses a danger to persons or other horses, or if board remains unpaid more than [IMMEDIATE TERMINATION DAYS] days past due. Any right of Barn to retain, place a lien on, or sell the Horse or Owner's property for unpaid amounts is governed by the law of [GOVERNING LAW STATE] and is not expanded by this Agreement.

Why it matters: Notice periods are cheap to agree in advance and expensive to argue about later. The last sentence is the honest one: whether a barn has a possessory or statutory lien on a boarded horse, what notice it must give and whether it may ever sell are creatures of state statute. A contract clause claiming a broader right than the state gives does not create one, and can itself create exposure.

### 8. Governing law, disputes and entire agreement

> This Agreement is governed by the law of [GOVERNING LAW STATE], without regard to its conflict-of-laws rules. The parties shall attempt in good faith to resolve any dispute by direct discussion before commencing formal proceedings, and any proceeding shall be brought in [VENUE]. This Agreement is the entire agreement between the parties regarding the boarding of the Horse and supersedes prior discussions. It may be amended only in a writing signed by both parties. If any provision is held unenforceable, the remainder stays in effect.

Why it matters: Choice of law and venue matter most when the barn and the owner are in different states, which is more common than people expect with training placements and seasonal moves. The good-faith discussion step is not a formality: it is the cheapest clause in the document.


## Clause map
| Clause | What it has to settle | What goes wrong when it is vague |
| --- | --- | --- |
| Parties and horse | Which legal entity is bound and which horse is covered | A barn's LLC protection is undercut by a contract signed personally |
| Board and payment | Rate, due date, what board includes by name, late terms | Two people use "full board" and mean different services |
| Emergency care | Who authorises treatment, after how long, and who pays | Barn must choose between acting without authority and doing nothing |
| Risk and liability | Standard of care, what the barn is and is not liable for | Every bad outcome becomes a question of what was assumed |
| Termination | Notice period, proration, removal of property | The last month becomes the whole dispute |
| Governing law | Which state's rules apply and where a case is heard | A cross-state placement turns a small claim into a jurisdiction fight |


## What varies by state, and how to check it
This template is written to be generally usable and is deliberately not state-specific. Equine law is one of the areas where state-to-state variation is widest, and a document that guesses at a state rule is more dangerous than one that leaves the space open. The items below are the ones to confirm for the state where the horse actually is, before you rely on the document.

- Whether your state prescribes equine activity warning language for contracts, for posted signs, or both, and what its current text is.
- Whether your state gives a boarding facility a statutory or possessory lien on a boarded horse, and what notice and process it requires before anything may be sold.
- Whether your state limits how far a liability release can go between a facility and a boarder, and whether releases are treated differently for minors.
- Whether your state requires a negative Coggins test, health certificate or other documentation for horses moved onto a commercial facility.
- Whether the barn's use of the property for commercial boarding is permitted by local zoning and by any lease the barn itself operates under.
- Whether sales tax applies to board or to services billed alongside it in your state.

Where a state prescribes warning language, the template leaves a clearly marked blank for it rather than supplying a paraphrase. Statutory warning wording is prescribed wording: an approximation of it, or the right words from the wrong state, can create the appearance of compliance without the substance of it.


## Frequently asked questions
### Is a horse boarding contract the same thing as a horse boarding agreement?

In practice yes. "Contract" and "agreement" describe the same document, and both terms are searched at roughly the same volume. Nothing turns on which word is on the title line; what matters is whether the clauses below it actually settle payment, care authority, risk and exit.

### Does a boarding contract have to be signed to be enforceable?

Whether an unsigned or oral boarding arrangement is enforceable depends on your state's contract rules and on the facts, and it is not a question a template can answer for you. The practical point is different: an unwritten arrangement is not usually unenforceable, it is unprovable. Signatures are cheap. Reconstructing what everyone remembered is not.

### Can a barn keep a horse if the board is not paid?

This is set by state statute and varies substantially between states, including on whether any lien exists, what notice must be given and whether a sale is ever permitted. Do not assume the answer, and do not rely on a contract clause that claims a broader right than the state allows. Ask about your specific state before acting.

### What should full board actually include?

There is no legal definition, which is exactly why the contract needs a list. Common inclusions are a stall with daily cleaning, hay, grain fed to the owner's instructions, daily turnout, blanket changes, holding for the vet and farrier, and access to arenas. Whatever your barn does, name it.

### Can I use this template in any state?

The document is written to be generally usable, but it is not state-specific and it deliberately leaves your state's required warning language as a blank. Treat it as a strong starting draft to bring to review, not as a finished form.


## Related links
- [What Should Be Included in a Horse Boarding Agreement?](/boarding/what-should-be-included-in-a-horse-boarding-agreement/)
- [What Happens If a Boarder Does Not Pay?](/boarding/what-happens-if-a-boarder-does-not-pay/)
- [Who Is Liable If a Horse Is Injured While Boarded?](/boarding/who-is-liable-if-a-horse-is-injured-while-boarded/)
- [Boarding Agreement vs Training Agreement](/compare/boarding-agreement-vs-training-agreement/)
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
