---
title: Equine Bill of Sale Template: What It Proves, and a Builder That Fills It In
entry_id: draft-template-2026-09-08-equine-bill-of-sale
content_type: template
cadence: on_demand
status: pending
scheduled_date: 2026-09-08
source_cluster: horse-sale-and-purchase
source_page_id: what-should-be-included-in-a-horse-bill-of-sale
slug: /drafts/2026-09-08/equine-bill-of-sale-template/
review_status: pending
github_path: content/drafts/generated/2026-09-08__equine-bill-of-sale-template.md
---
# Equine Bill of Sale Template: What It Proves, and a Builder That Fills It In

## Quick answer
A bill of sale is the document that proves a horse changed hands: who sold, who bought, which horse, for how much, on what date, and on what terms. It is short, and its whole value is in being specific. The builder below produces a complete, signable draft, including the condition and disclosure language that is the part people most often leave out and most often argue about later.


## Why this document is worth doing properly
A bill of sale is not a formality. It is the piece of paper that answers, months later, the four questions that decide a horse sale dispute: was this horse sold, by whom, on what date, and subject to what promises. When it exists and is specific, most disagreements stop being legal problems. When it is a one-line receipt, the arguments have nowhere to land except memory.

The reason this document is worth building carefully is that horse sales move fast and emotionally. A buyer wants the horse before someone else takes it. A seller wants the horse gone before board runs another month. Both are reasonable, and both are the conditions under which people sign whatever is put in front of them. Horse Legal Guide is the educational surface for Wise Covington, and this walkthrough is built so that the fast version of the document is also the careful one.


## What this page is built to answer
This page is written against the following measured queries: equine bill of sale (1300/mo, KD 9); horse bill of sale (1300/mo, KD 17).

Search-volume and difficulty figures come from the evidence records in this repository and from the keyword packet cited alongside each query in data/system/template_briefs.json. Where this repository's own Search Console record disagrees with a keyword-tool volume for the same phrase, both numbers are recorded rather than reconciled, because they measure different things: one is what the tool estimates the market searches, the other is what this domain has actually been shown for.


## Build the document
Fill in what applies to your situation. Everything runs in your browser: nothing you type is sent anywhere, stored, or visible to anyone else. Anything you leave blank stays in [BRACKETS] in the output, so a half-finished document never reads as a finished one.

```generator
{
  "id": "bill-of-sale-builder",
  "title": "Equine bill of sale builder",
  "filename": "equine-bill-of-sale",
  "fields": [
    {
      "name": "date",
      "label": "Effective date",
      "type": "date",
      "prompt": "effective date"
    },
    {
      "name": "seller",
      "label": "Seller full legal name",
      "prompt": "seller full legal name"
    },
    {
      "name": "seller_addr",
      "label": "Seller address",
      "prompt": "seller address"
    },
    {
      "name": "buyer",
      "label": "Buyer full legal name",
      "prompt": "buyer full legal name"
    },
    {
      "name": "buyer_addr",
      "label": "Buyer address",
      "prompt": "buyer address"
    },
    {
      "name": "price",
      "label": "Purchase price",
      "placeholder": "$18,500",
      "prompt": "purchase price"
    },
    {
      "name": "payment_terms",
      "label": "Payment terms",
      "placeholder": "paid in full at signing by wire transfer",
      "prompt": "payment terms"
    },
    {
      "name": "horse_name",
      "label": "Horse name",
      "prompt": "horse name"
    },
    {
      "name": "horse_desc",
      "label": "Age, breed, sex, colour, markings",
      "placeholder": "9-year-old Warmblood mare, dark bay, no white",
      "prompt": "age, breed, sex, colour, markings"
    },
    {
      "name": "registry",
      "label": "Registry",
      "placeholder": "AQHA / USEF / Oldenburg NA",
      "prompt": "registry"
    },
    {
      "name": "reg_no",
      "label": "Registration or passport number",
      "prompt": "registration number"
    },
    {
      "name": "microchip",
      "label": "Microchip number",
      "prompt": "microchip number"
    },
    {
      "name": "sire_dam",
      "label": "Sire and dam",
      "placeholder": "Sire: ... Dam: ...",
      "prompt": "sire and dam"
    },
    {
      "name": "disclosures",
      "label": "Seller disclosures (known history)",
      "type": "textarea",
      "placeholder": "prior left front suspensory injury treated in 2024, currently on no medication, cribs in a stall",
      "prompt": "seller disclosures"
    },
    {
      "name": "exam",
      "label": "Pre-purchase exam",
      "type": "select",
      "options": [
        "",
        "obtained a pre-purchase veterinary examination",
        "declined a pre-purchase veterinary examination",
        "obtained a limited pre-purchase examination without radiographs"
      ],
      "prompt": "exam status"
    },
    {
      "name": "condition",
      "label": "Condition term",
      "type": "select",
      "options": [
        "",
        "as-is, where-is",
        "as-is, where-is, subject to the disclosures above",
        "subject to a trial period as separately agreed in writing"
      ],
      "prompt": "condition term"
    },
    {
      "name": "risk_event",
      "label": "Risk of loss passes on",
      "type": "select",
      "options": [
        "",
        "payment in full",
        "physical delivery of the Horse to Buyer or Buyer's transporter",
        "the Horse leaving Seller's property"
      ],
      "prompt": "risk transfer event"
    },
    {
      "name": "delivery_loc",
      "label": "Delivery location",
      "prompt": "delivery location"
    },
    {
      "name": "delivery_date",
      "label": "Delivery date",
      "type": "date",
      "prompt": "delivery date"
    },
    {
      "name": "transport",
      "label": "Transport arranged and paid by",
      "type": "select",
      "options": [
        "",
        "Buyer",
        "Seller",
        "the parties equally"
      ],
      "prompt": "transport responsibility"
    },
    {
      "name": "documents",
      "label": "Documents to transfer",
      "type": "textarea",
      "placeholder": "registration papers with signed transfer, competition record, current Coggins, vaccination record, farrier record",
      "prompt": "documents to transfer"
    },
    {
      "name": "doc_date",
      "label": "Documents delivered by",
      "type": "date",
      "prompt": "document delivery date"
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
  "body": "BILL OF SALE - HORSE\n\n1. SALE.\nFor good and valuable consideration in the amount of [[price]], the receipt and sufficiency of which is acknowledged, [[seller]] of [[seller_addr]] (\"Seller\") sells, transfers and delivers to [[buyer]] of [[buyer_addr]] (\"Buyer\") all right, title and interest in the Horse described below, effective [[date]]. Payment terms: [[payment_terms]].\n\n2. THE HORSE.\nThe horse known as [[horse_name]], described as [[horse_desc]], registered with [[registry]] under number [[reg_no]], microchip number [[microchip]], [[sire_dam]] (the \"Horse\").\n\n3. SELLER'S REPRESENTATIONS.\nSeller represents and warrants that Seller is the lawful owner of the Horse; that the Horse is free of any lien, security interest, board debt, training debt, co-ownership claim or other encumbrance; and that Seller has full authority to sell. Seller further discloses: [[disclosures]].\n\n4. CONDITION AND EXAMINATION.\nBuyer has had the opportunity to inspect the Horse and to obtain a pre-purchase veterinary examination, and [[exam]]. Except for the representations expressly stated above, the Horse is sold [[condition]], and Seller makes no other warranty, express or implied, including any warranty of suitability for a particular purpose or discipline.\n\n5. RISK, DELIVERY AND DOCUMENTS.\nRisk of loss passes to Buyer upon [[risk_event]]. Delivery shall occur at [[delivery_loc]] on or before [[delivery_date]], with transport arranged and paid by [[transport]]. Seller shall deliver to Buyer on or before [[doc_date]] the following: [[documents]].\n\n6. GOVERNING LAW AND ENTIRE AGREEMENT.\nThis bill of sale is governed by the law of [[state]]. It is the entire agreement between the parties regarding the sale of the Horse and supersedes all prior discussions, advertisements and representations not expressly stated here. It may be amended only in a writing signed by both parties.\n\nSELLER: __________________________  DATE: __________\nPrinted name: [[seller]]\n\nBUYER: ___________________________  DATE: __________\nPrinted name: [[buyer]]\n\nThis document is a general educational template, not legal advice, and has not been reviewed against the law of any particular state. Have it reviewed before you rely on it."
}
```

## What people often miss
The most consequential line in a bill of sale is usually the one describing the horse's condition and what was and was not represented. "Sold as-is" is not magic language and does not, by itself, resolve every later claim; how far it reaches depends on state law and on what was actually said and shown before the sale. What it does do reliably is force both people to be explicit at the moment when being explicit is still cheap.

The second is timing. The bill of sale should say when risk of loss passes, when title passes and when possession passes, because those three can genuinely be different moments. A horse that colics in a trailer on the way home is a very different conversation depending on which of those had already happened.

The third is the paperwork that travels with the horse. Registration papers, a passport or competition record, health documents, and a negative Coggins are often assumed to be included and often are not delivered. Listing them by name, with a date by which they are to be transferred, prevents a sale from being ninety percent complete for six months.


## The document, clause by clause
Each block below is the clause text the builder produces, followed by what it is actually for. Read them before you use the output.

### 1. Parties and consideration

> For good and valuable consideration in the amount of [PURCHASE PRICE], the receipt and sufficiency of which is acknowledged, [SELLER FULL LEGAL NAME] of [SELLER ADDRESS] ("Seller") sells, transfers and delivers to [BUYER FULL LEGAL NAME] of [BUYER ADDRESS] ("Buyer") all right, title and interest in the horse described below, effective [EFFECTIVE DATE].

Why it matters: The price belongs in the document even when both people would rather it were private: it is what makes the transfer provable as a sale rather than a loan, a lease, a gift or a partnership, all of which are things people later claim it was.

### 2. Description of the horse

> The horse known as [HORSE NAME], a [AGE]-year-old [BREED] [SEX], colour [COLOUR], with markings [MARKINGS], registration or passport number [REGISTRATION NUMBER] with [REGISTRY], microchip number [MICROCHIP NUMBER], sire [SIRE], dam [DAM] (the "Horse").

Why it matters: Barn names change; registered names and microchip numbers do not. A horse identified only by its barn name is a horse that can be confused with another one in a dispute, at a border, or at a registry.

### 3. Seller's representations

> Seller represents and warrants that Seller is the lawful owner of the Horse, that the Horse is free of any lien, security interest, board debt, training debt, co-ownership claim or other encumbrance, and that Seller has full authority to sell. Seller further represents: [SELLER DISCLOSURES].

Why it matters: The encumbrance representation is the one that matters most and is left out most. A horse can carry an unpaid board balance, a trainer's commission claim, or a syndicate interest that the buyer knows nothing about. The disclosure line is where known history goes: prior injuries, surgeries, medications, vices, and anything the seller has been told by a vet.

### 4. Condition, examination and as-is terms

> Buyer has had the opportunity to inspect the Horse and to obtain a pre-purchase veterinary examination. Buyer [EXAM STATUS]. Except for the representations expressly stated in this bill of sale, the Horse is sold [CONDITION TERM], and Seller makes no other warranty, express or implied, including any warranty of suitability for a particular purpose or discipline.

Why it matters: Whether and how far a disclaimer of implied warranties operates is a question of state law, and no template can settle it for you. What the clause does do is record whether a pre-purchase exam happened, which is very often the single most useful fact in a later dispute.

### 5. Risk of loss, delivery and documents

> Risk of loss passes to Buyer on [RISK TRANSFER EVENT]. Delivery shall occur at [DELIVERY LOCATION] on or before [DELIVERY DATE], with transport arranged and paid by [TRANSPORT RESPONSIBILITY]. Seller shall deliver to Buyer, on or before [DOCUMENT DELIVERY DATE], the following: [DOCUMENTS TO TRANSFER].

Why it matters: Separating title, risk and possession into named events is the whole point of this clause. Most "who pays for the vet bill from the first week" arguments are really arguments about which of these three had already happened.

### 6. Governing law and entire agreement

> This bill of sale is governed by the law of [GOVERNING LAW STATE]. It is the entire agreement between the parties regarding the sale of the Horse and supersedes all prior discussions, advertisements and representations not expressly stated here. It may be amended only in a writing signed by both parties.

Why it matters: The "supersedes prior advertisements" phrase does real work in horse sales, where the sale listing, the video and the text messages are often more expansive than anyone intends the contract to be. It is also the reason to make sure anything genuinely relied on is written into the disclosures.


## Clause map
| Line in the document | What it proves later | Cost of leaving it out |
| --- | --- | --- |
| Price and payment terms | That this was a sale, not a lease, loan, gift or partnership | The nature of the transaction itself becomes arguable |
| Microchip or registration number | Which horse the document covers | Identity disputes at a registry, a border or in court |
| Free-of-encumbrance representation | That no board, training or co-ownership claim rides along | Buyer inherits someone else's unpaid balance |
| Disclosures | What the seller actually said about history and condition | Every later problem becomes a question of what was known |
| Pre-purchase exam recorded | Whether the buyer looked, and how thoroughly | The single most useful fact in a soundness dispute is missing |
| Risk of loss event | Who owned the risk at the moment something went wrong | A trailer-ride colic has no clear owner |
| Documents and transfer date | That papers were part of the deal and when they were due | A sale stays ninety percent finished indefinitely |


## What varies by state, and how to check it
This template is written to be generally usable and is deliberately not state-specific. Equine law is one of the areas where state-to-state variation is widest, and a document that guesses at a state rule is more dangerous than one that leaves the space open. The items below are the ones to confirm for the state where the horse actually is, before you rely on the document.

- Whether your state requires a brand inspection, health certificate or negative Coggins for the sale or transport of a horse, and who is responsible for obtaining it.
- How your state treats disclaimers of implied warranties in a sale of goods between these particular parties, which can differ between private sellers and dealers.
- Whether your state has any equine-specific sale disclosure statute or a rule about agent and trainer commissions being disclosed to both sides.
- Whether sales tax applies to a horse sale in your state and who is responsible for remitting it.
- What your registry, not the state, requires for a transfer of registration to be recognised.

Where a state prescribes warning language, the template leaves a clearly marked blank for it rather than supplying a paraphrase. Statutory warning wording is prescribed wording: an approximation of it, or the right words from the wrong state, can create the appearance of compliance without the substance of it.


## Frequently asked questions
### Is there a difference between an equine bill of sale and a horse bill of sale?

No. The two phrases describe the same document and are searched at similar volumes; "equine" is simply the term more common in professional and registry contexts. Use whichever word your registry or buyer uses and keep the contents identical.

### Do I need a bill of sale if I also have a purchase agreement?

They do different jobs. A purchase agreement sets out the terms of a deal that is going to happen, including trial periods, deposits, conditions and what happens if it falls through. A bill of sale records that the transfer actually happened. Many sales use both, with the bill of sale signed at delivery.

### Does "sold as-is" protect a seller completely?

No, and treating it as a complete answer is a common and expensive mistake. How far a disclaimer reaches is a matter of state law and of what was actually represented before the sale. The reliable value of the clause is that it forces the condition conversation to happen in writing.

### What if the horse's registration papers are not available at signing?

Say so in the document, name a date by which they will be delivered, and say what happens if they are not. An open-ended promise to send papers later is one of the most common unresolved ends of a horse sale.

### Does a bill of sale need to be notarised?

Notarisation is not usually what makes a bill of sale effective, but some registries and some states have their own requirements, and notarisation can make a signature much harder to dispute later. Check your registry's transfer rules and ask about your state before deciding to skip it.


## Related links
- [What Should Be Included in a Horse Bill of Sale?](/faq/what-should-be-included-in-a-horse-bill-of-sale/)
- [Bill of Sale vs Transfer-of-Ownership Clause](/compare/bill-of-sale-vs-transfer-of-ownership-clause/)
- [As-Is Clause vs Disclosure Clause in a Horse Sale](/compare/as-is-clause-vs-disclosure-clause-in-a-horse-sale/)
- [Do I Need a Contract to Sell a Horse?](/faq/do-i-need-a-contract-to-sell-a-horse/)
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
