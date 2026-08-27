---
title: Equine Liability Waiver Template: What a Release Can and Cannot Do
entry_id: draft-template-2026-09-11-equine-liability-waiver
content_type: template
cadence: on_demand
status: pending
scheduled_date: 2026-09-11
source_cluster: liability-waivers-insurance
source_page_id: what-should-be-included-in-a-liability-waiver
slug: /drafts/2026-09-11/equine-liability-waiver-template/
review_status: pending
github_path: content/drafts/generated/2026-09-11__equine-liability-waiver-template.md
---
# Equine Liability Waiver Template: What a Release Can and Cannot Do

## Quick answer
An equine liability waiver is a signed acknowledgement that horse activities carry inherent risk, combined with a release of certain claims against the facility or professional. It is worth having and it is not a force field: how far a release reaches, and whether it reaches at all where a minor or gross negligence is involved, is decided by each state's law. The builder below produces a release with the participant acknowledgements filled in and your state's required warning language left as a deliberate blank.


## Why this document is worth doing properly
Waivers occupy a strange place in the horse world. Everybody signs them, most people assume they end the conversation, and a great deal of what people believe about them is wrong in both directions. Some treat a waiver as complete protection. Others conclude that because waivers are sometimes set aside, they are worthless. Neither is right.

What a well-drafted release reliably does is document that the participant was told about the risks, understood them, and chose to take part anyway. That evidentiary function survives almost everywhere, even where the release of claims itself is limited. Horse Legal Guide is the educational surface for Wise Covington, and this walkthrough is written to help a barn or professional build a release that does that job properly, and to be honest about the parts that state law decides rather than the document.


## What this page is built to answer
This page is written against the following measured queries: equine liability waiver (140/mo, KD 0).

Search-volume and difficulty figures come from the evidence records in this repository and from the keyword packet cited alongside each query in data/system/template_briefs.json. Where this repository's own Search Console record disagrees with a keyword-tool volume for the same phrase, both numbers are recorded rather than reconciled, because they measure different things: one is what the tool estimates the market searches, the other is what this domain has actually been shown for.


## Build the document
Fill in what applies to your situation. Everything runs in your browser: nothing you type is sent anywhere, stored, or visible to anyone else. Anything you leave blank stays in [BRACKETS] in the output, so a half-finished document never reads as a finished one.

```generator
{
  "id": "liability-waiver-builder",
  "title": "Equine liability release builder",
  "filename": "equine-liability-release",
  "fields": [
    {
      "name": "date",
      "label": "Date",
      "type": "date",
      "prompt": "date"
    },
    {
      "name": "participant",
      "label": "Participant full name",
      "prompt": "participant name"
    },
    {
      "name": "participant_addr",
      "label": "Participant address",
      "prompt": "participant address"
    },
    {
      "name": "facility",
      "label": "Facility legal name",
      "prompt": "facility name"
    },
    {
      "name": "facility_addr",
      "label": "Facility address",
      "prompt": "facility address"
    },
    {
      "name": "activity",
      "label": "Activity",
      "placeholder": "riding lessons, trail riding, horse handling and grooming",
      "prompt": "activity description"
    },
    {
      "name": "ability",
      "label": "Stated riding ability",
      "type": "select",
      "options": [
        "",
        "a beginner with no prior experience",
        "an advanced beginner",
        "an intermediate rider",
        "an experienced rider"
      ],
      "prompt": "ability level"
    },
    {
      "name": "medical",
      "label": "Medical disclosure",
      "type": "textarea",
      "placeholder": "none / asthma, carries an inhaler / previous concussion in 2025",
      "prompt": "medical disclosure"
    },
    {
      "name": "excluded",
      "label": "Release does NOT cover the released parties'",
      "type": "select",
      "options": [
        "",
        "gross negligence or wilful or wanton misconduct",
        "gross negligence, wilful misconduct, or any conduct that the governing state does not permit to be released"
      ],
      "prompt": "excluded conduct"
    },
    {
      "name": "minor",
      "label": "Participant is",
      "type": "select",
      "options": [
        "",
        "an adult signing for themselves.",
        "a minor, and this document is signed by a parent or legal guardian."
      ],
      "prompt": "minor clause"
    },
    {
      "name": "guardian",
      "label": "Parent or guardian name (if minor)",
      "prompt": "parent or guardian name"
    },
    {
      "name": "helmet",
      "label": "Helmet requirement",
      "type": "select",
      "options": [
        "",
        "an ASTM/SEI certified equestrian helmet",
        "a properly fitted equestrian helmet"
      ],
      "prompt": "helmet requirement"
    },
    {
      "name": "emergency",
      "label": "Emergency contact and phone",
      "prompt": "emergency contact"
    },
    {
      "name": "insurance_status",
      "label": "Participant",
      "type": "select",
      "options": [
        "",
        "confirms that Participant maintains",
        "confirms that Participant does not maintain"
      ],
      "prompt": "health insurance status"
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
  "body": "RELEASE, ASSUMPTION OF RISK AND WAIVER OF LIABILITY\nEQUINE ACTIVITIES\n\nRead this document carefully before signing. It affects your legal rights.\n\n1. PARTIES AND ACTIVITY.\nThis Release is entered into on [[date]] by [[participant]] of [[participant_addr]] (\"Participant\") in favour of [[facility]], its owners, officers, employees, agents, instructors, volunteers and horse owners (collectively, the \"Released Parties\"), in connection with [[activity]] at [[facility_addr]].\n\n2. ACKNOWLEDGEMENT OF INHERENT RISK.\nParticipant acknowledges that equine activities are inherently dangerous, and that horses may without warning or apparent cause bolt, buck, rear, bite, kick, strike, shy, stumble, fall, or react unpredictably to sounds, movements, objects, persons or other animals. Participant acknowledges the risk of serious injury, permanent disability and death arising from these activities, from collisions, from equipment failure, from terrain and footing conditions, and from the acts of other participants. Participant states that Participant's riding ability is [[ability]]. Participant has disclosed the following relevant medical conditions, medications, allergies or physical limitations: [[medical]].\n\n3. ASSUMPTION OF RISK AND RELEASE.\nParticipant voluntarily assumes all risks associated with the activity, whether known or unknown. To the fullest extent permitted by the law of [[state]], Participant releases the Released Parties from, and agrees not to sue them for, any claim arising from Participant's participation, except claims arising from the Released Parties' [[excluded]]. Participant understands that this release does not extend to conduct that the law of the governing state does not permit to be released.\n\n4. MINORS.\nParticipant is [[minor]] Where Participant is under the age of majority, the parent or legal guardian signing below, [[guardian]], represents that they have authority to do so, have read this document in full, and consent to the minor's participation. The parties acknowledge that the effect of a parent's signature on a minor's own claims is determined by the law of [[state]].\n\n5. SAFETY EQUIPMENT AND RULES.\nParticipant agrees to wear [[helmet]] and appropriate footwear at all times while mounted or handling horses, and to comply with all instructions given by the Released Parties and with the facility's posted rules. Participant acknowledges that failure to follow safety instructions materially increases the risk of injury.\n\n6. MEDICAL TREATMENT AND INSURANCE.\nParticipant authorises the Released Parties to obtain emergency medical treatment on Participant's behalf if Participant is unable to consent, and agrees that the cost of such treatment is Participant's responsibility. Participant's emergency contact is [[emergency]]. Participant [[insurance_status]] health insurance covering this activity, and acknowledges that the Released Parties do not provide medical or accident insurance for participants.\n\n7. SEVERABILITY AND GOVERNING LAW.\nIf any provision of this document is held unenforceable, the remaining provisions remain in effect and shall be enforced to the fullest extent permitted. This document is governed by the law of [[state]], is the entire agreement on this subject, and is binding on Participant's heirs, executors and assigns.\n\n[INSERT YOUR STATE'S REQUIRED EQUINE ACTIVITY WARNING LANGUAGE HERE, VERBATIM, IF YOUR STATE PRESCRIBES ONE. DO NOT PARAPHRASE IT AND DO NOT COPY IT FROM ANOTHER STATE. IN SOME STATES THIS LANGUAGE MUST ALSO APPEAR ON A POSTED SIGN AND IN A PARTICULAR TYPE SIZE.]\n\nI have read this document in full and I understand it.\n\nPARTICIPANT: _____________________  DATE: __________\nPrinted name: [[participant]]\n\nPARENT OR GUARDIAN (if Participant is a minor): _____________________  DATE: __________\nPrinted name: [[guardian]]\n\nThis document is a general educational template, not legal advice, and has not been reviewed against the law of any particular state. Releases are one of the areas where state law differs most. Have it reviewed before you use it."
}
```

## What people often miss
The most common mistake is treating a release as one document doing one job, when it is really three: an acknowledgement of inherent risk, a release and covenant not to sue, and an indemnity. They are legally distinct, they are enforced differently, and a state may accept one and limit another. Drafting them as separate, clearly headed sections is more useful than folding them into a single paragraph, because a court reading it later can enforce what is enforceable without the whole thing standing or falling together.

The second is minors. A parent signing on behalf of a child is a different legal question from an adult signing for themselves, and states differ substantially on whether and how far a parent can release a child's own future claims. A release that treats a nine-year-old at a lesson barn the same way it treats an adult trail rider is not covering the situation it most needs to cover.

The third is that almost no state lets a release reach a facility's own gross negligence or wilful misconduct, and many limit ordinary negligence too. That is not a defect to be drafted around with broader language; broader language can make a release harder to enforce, not easier. The honest response is insurance, documented safe practice, and a release that asks for what it can actually have.


## The document, clause by clause
Each block below is the clause text the builder produces, followed by what it is actually for. Read them before you use the output.

### 1. Parties, activity and identification

> This Release and Assumption of Risk is entered into on [DATE] by [PARTICIPANT NAME] of [PARTICIPANT ADDRESS] ("Participant") in favour of [FACILITY NAME], its owners, officers, employees, agents, instructors, volunteers and horse owners (collectively "Released Parties"), in connection with [ACTIVITY DESCRIPTION] at [FACILITY ADDRESS].

Why it matters: Naming the released parties by category matters. A release running only to the facility does not protect the instructor, the volunteer or the owner of the lesson horse, and those are the people most often named alongside the barn.

### 2. Acknowledgement of inherent risk

> Participant acknowledges that equine activities are inherently dangerous, and that horses may without warning or apparent cause bolt, buck, rear, bite, kick, strike, shy, stumble, fall, or react unpredictably to sounds, movements, objects, persons or other animals. Participant acknowledges the risk of serious injury, permanent disability and death arising from these activities, from collisions, from equipment failure, from terrain and footing conditions, and from the acts of other participants. Participant states that Participant's riding ability is [ABILITY LEVEL] and that Participant has disclosed to the Released Parties any medical condition, medication, allergy or physical limitation relevant to participation, specifically: [MEDICAL DISCLOSURE].

Why it matters: This is the section that does the most reliable work. Specificity is what gives it force: a list of the actual ways a horse hurts people is far more persuasive evidence that a participant understood the risk than a sentence saying riding is dangerous.

### 3. Assumption of risk and release

> Participant voluntarily assumes all risks associated with the activity, whether known or unknown. To the fullest extent permitted by the law of [GOVERNING LAW STATE], Participant releases and agrees not to sue the Released Parties for any claim arising from Participant's participation, except claims arising from the Released Parties' [EXCLUDED CONDUCT]. Participant understands that this release does not extend to conduct that the law of the governing state does not permit to be released.

Why it matters: The last sentence is deliberate. A release that claims more than the state permits invites a court to find the whole clause overreaching. One that expressly stops at the legal limit is easier to enforce for everything up to that limit.

### 4. Minors and parental signature

> [MINOR CLAUSE] Where Participant is under the age of majority, the parent or legal guardian signing below represents that they have authority to do so, has read this document in full, and consents to the minor's participation. The parties acknowledge that the effect of a parent's signature on a minor's own claims is determined by the law of [GOVERNING LAW STATE].

Why it matters: The honest acknowledgement is better than an assertion. States differ substantially on whether a parent can release a child's future claims, and a form that quietly assumes the most favourable answer is a form that has not planned for the actual jurisdiction.

### 5. Helmets, footwear and safety rules

> Participant agrees to wear [HELMET REQUIREMENT] and appropriate footwear at all times while mounted or handling horses, and to comply with all instructions given by the Released Parties and with the facility's posted rules. Participant acknowledges that failure to follow safety instructions materially increases the risk of injury.

Why it matters: A helmet clause is not just risk management, it is often an insurance condition. Recording that the requirement was communicated and accepted is worth more than the clause itself.

### 6. Medical treatment authorisation and insurance

> Participant authorises the Released Parties to obtain emergency medical treatment on Participant's behalf if Participant is unable to consent, and agrees that the cost of such treatment is Participant's responsibility. Participant's emergency contact is [EMERGENCY CONTACT]. Participant [HEALTH INSURANCE STATUS] health insurance covering the activity and acknowledges that the Released Parties do not provide medical or accident insurance for participants.

Why it matters: The insurance sentence prevents a common and genuine misunderstanding: participants often believe that a facility's liability policy pays their medical bills after a fall. It generally does not, and saying so in advance is fairer than discovering it afterwards.

### 7. Severability, governing law and state warning

> If any provision of this document is held unenforceable, the remaining provisions remain in effect and shall be enforced to the fullest extent permitted. This document is governed by the law of [GOVERNING LAW STATE], is the entire agreement on this subject, and is binding on Participant's heirs, executors and assigns. Participant confirms having read this document in full before signing. [STATE-REQUIRED EQUINE ACTIVITY WARNING LANGUAGE - INSERT YOUR STATE'S CURRENT STATUTORY TEXT VERBATIM IF YOUR STATE PRESCRIBES ONE]

Why it matters: Severability is doing serious work here, because a release is the kind of document where one clause reaching too far can otherwise take the rest with it.


## Risk matrix
| What the document does | How reliably it holds | What it depends on |
| --- | --- | --- |
| Records that risks were disclosed and understood | Strong almost everywhere | Specificity of the risk description and proof it was read |
| Releases claims for ordinary negligence | Varies by state | State law on pre-injury releases and how the clause is drafted |
| Releases claims for gross negligence or wilful misconduct | Generally not available | Nearly all states decline to enforce this |
| Releases a minor's own future claims by parent signature | Highly state-dependent | Whether the state permits parental pre-injury release |
| Indemnity from participant back to facility | Varies, often narrower than the release | State law and whether the clause is separately stated |
| Satisfies a statutory equine activity warning requirement | Only if the exact required text is used | Your state's current statutory wording and placement rules |


## What varies by state, and how to check it
This template is written to be generally usable and is deliberately not state-specific. Equine law is one of the areas where state-to-state variation is widest, and a document that guesses at a state rule is more dangerous than one that leaves the space open. The items below are the ones to confirm for the state where the horse actually is, before you rely on the document.

- Whether your state has an equine activity liability statute, what warning text it prescribes, and whether that text must appear in contracts, on signs, or both.
- Whether your state prescribes a minimum type size or placement for the warning, since some do.
- Whether your state enforces pre-injury releases of ordinary negligence in a recreational or instructional setting.
- Whether a parent in your state can release a minor's own future claims, which is one of the most variable questions in this area.
- What your liability insurer requires the release to say, because an insurer's conditions can be stricter than the statute.
- Whether the release needs to be re-signed periodically, per session, or per season under your policy or your state's practice.

Where a state prescribes warning language, the template leaves a clearly marked blank for it rather than supplying a paraphrase. Statutory warning wording is prescribed wording: an approximation of it, or the right words from the wrong state, can create the appearance of compliance without the substance of it.


## Frequently asked questions
### Does an equine liability waiver actually protect a barn?

Partly, and the honest answer is that it protects less than most people assume and more than sceptics assume. It reliably documents that the participant was told the risks and accepted them. How far it releases claims is a question of state law, and no waiver in any state reliably releases gross negligence or wilful misconduct.

### Is a waiver signed by a parent enough for a child?

It depends heavily on the state, and this is one of the widest splits in the area. Some states permit a parent to release a minor's future claims and some do not. Ask specifically about your state before relying on a parent's signature for a lesson programme or camp.

### Do I still need insurance if everyone signs a waiver?

Yes. A waiver and an insurance policy do different jobs. A waiver aims to prevent or limit a claim; insurance pays for one that proceeds anyway, including the cost of defending a claim that is ultimately unsuccessful. Treating either as a substitute for the other is a common and expensive error.

### What is the difference between a waiver and a release?

In everyday use the words are interchangeable, and most documents titled either way contain the same three parts: an acknowledgement of risk, a release of claims, and sometimes an indemnity. It is more useful to check which of those three your document actually contains than to worry about the title.

### Does posting an equine activity sign do the same thing as a signed waiver?

They are separate requirements in states that have them, and one does not substitute for the other. Where a statute requires posted signage, it usually specifies the wording and often the size and placement. Where it requires contract language, it usually specifies that too. Check both.


## Related links
- [What Should Be Included in a Liability Waiver?](/liability/what-should-be-included-in-a-liability-waiver/)
- [Waiver vs Release](/compare/waiver-vs-release/)
- [Does a Waiver Protect Me If Someone Is Injured?](/liability/does-a-waiver-protect-me-if-someone-is-injured/)
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
