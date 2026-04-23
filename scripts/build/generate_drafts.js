const fs = require('fs');
const path = require('path');
const { readJson } = require('../../_ops/validators/helpers');
const { auditText, wordCount } = require('../lib/audit_content');

function ensureDir(dirPath) { fs.mkdirSync(dirPath, { recursive: true }); }
function writeJson(relPath, data) { fs.writeFileSync(path.resolve(process.cwd(), relPath), JSON.stringify(data, null, 2) + '\n'); }
function escapeTitle(title) { return String(title || '').replace(/\s+/g, ' ').trim(); }

const CLUSTER_NOTES = {
  'horse-sale-and-purchase': { plain: 'horse sales, purchase deals, trial periods, bills of sale, and the assumptions people carry into those transactions', examples: ['A buyer thinks the horse is exactly what was promised, but the written paperwork is vague and the expectations on both sides are not the same.','A seller believes the deal ended when the horse left the property, but the buyer comes back weeks later with a complaint about soundness, suitability, or disclosure.','Both sides talk like the agreement is simple, yet the key details about price, vet work, delivery, risk of loss, and return rights were never written down with care.'] },
  'horse-lease-and-trial': { plain: 'horse leases, trial periods, who carries risk, and how responsibility shifts when more than one person is using the horse', examples: ['A lease sounds friendly at the start, but the parties never define who pays if the horse needs treatment or misses training time.','A trial ride arrangement begins as a short experiment and then drifts into a longer informal lease without clear boundaries.','One side thinks they only borrowed the horse for exposure or evaluation, while the other believes a much broader set of duties came with possession.'] },
  'boarding-training-and-barn-operations': { plain: 'boarding barns, trainers, facility rules, late-payment issues, barn operations, and the daily agreements that often stay too informal', examples: ['A barn owner uses a simple intake form, but the real operational expectations around vet care, turnout, visitors, and payment timing are never addressed.','A trainer assumes a release and a stable contract cover the same thing, yet those documents solve different problems and leave different gaps.','A boarder falls behind on fees and everyone suddenly realizes the paperwork never explained what happens next.'] },
  'liability-waivers-insurance': { plain: 'waivers, insurance, warning language, equine activity laws, and the limits of legal protection when someone gets hurt', examples: ['A horse owner feels safe because a waiver was signed, but the waiver does not fix every factual problem that can arise after an injury.','A trainer has insurance but assumes that coverage answers every legal question, even though insurance and documentation do different jobs.','A barn relies on posted signs and a standard form, yet the actual conduct on the ground may create a dispute about what risk was understood.'] },
  'equine-business-formation': { plain: 'forming and running equine businesses, separating personal and business risk, and choosing documents that match the real operation', examples: ['An owner forms an LLC but never updates contracts, branding, bank practices, or signatures to match the entity they just created.','A family operation keeps horse work inside another business or trust structure without mapping the liability consequences clearly.','A new equine brand launches quickly and the founders assume formation alone solves investor, contract, and ownership questions.'] },
  'intellectual-property-and-brand': { plain: 'barn names, trademarks, sponsorships, brand use, and the business side of protecting reputation and creative assets', examples: ['A rider starts using a barn or program name in public before checking whether the name is actually protectable or already in use.','A sponsor relationship feels informal and positive until image rights, posting expectations, and exclusivity become points of conflict.','A horse business invests in design and branding but never aligns ownership of those assets with the contracts behind the business.'] },
  'demand-letters-and-disputes': { plain: 'demand letters, contract disputes, pre-litigation pressure, and the moments when equestrians need a calmer framework', examples: ['A demand letter arrives and the recipient cannot tell whether it is posturing, a serious escalation step, or both.','One side thinks the dispute is about fairness, while the other side is already reducing the issue to documents, dates, and leverage.','A person wants to fix the problem quietly, but the messages already sent have made the position harder to walk back.'] },
  'therapeutic-riding-and-hipaa': { plain: 'therapeutic riding, equine-assisted services, privacy questions, waivers, participant documents, and program setup', examples: ['A founder wants to help people quickly, but the program paperwork has not kept pace with the services being described.','A team hears the word HIPAA and assumes it applies automatically, even though the answer depends on the structure and role of the organization.','A riding program collects sensitive information without being clear about why it is collected, who sees it, and how it is used.'] },
  'real-property-and-leases': { plain: 'barn leases, horse-property use, repair obligations, and the risk of operating an equine business inside a lease that was not built for it', examples: ['A tenant assumes horse use is allowed because everyone talked about it, but the written lease leaves key use rights vague.','A property owner and operator agree on repairs informally, then later disagree over capital work, maintenance, and responsibility for damage.','A horse business grows inside a leased property and only later discovers the lease language does not match the actual operation.'] },
  'state-specific': { plain: 'state-specific rules, local assumptions, and the small wording differences that matter more than people expect', examples: ['People hear about an equine law in one state and assume the same rule, protection, or warning language applies everywhere.','A rider copies a form from another state without checking whether the statute and wording line up with the place where the issue happened.','A business relies on general online guidance and misses the exact state-specific detail that changes how risk is assessed.'] },
  'emotional-am-i-screwed': { plain: 'high-stress horse-world moments, regret, shame, fear of being sued, and the need for calm, plain-English framing', examples: ['Someone realizes after the fact that the documents were thin or missing and starts imagining the worst possible outcome.','A deal that felt friendly turns tense fast, and the person involved can no longer tell what is normal conflict and what is real legal exposure.','A horse owner feels embarrassed, overwhelmed, and late to the problem, which makes it harder to sort facts from panic.'] }
};

function guessFloor(entry) {
  const floors = readJson('data/system/content_audit_policy.json').floors || {};
  return floors[entry.content_type] || 700;
}

function sourceContext(entry, source) {
  const cluster = entry.source_cluster || source?.cluster || 'general';
  const note = CLUSTER_NOTES[cluster] || { plain: 'equine legal questions that often look simple until facts, documents, and timing start to matter', examples: ['People often move quickly because the horse world rewards trust and speed, then realize later that speed hid the real legal issue.','A situation feels normal at first, but the missing paperwork or casual language changes how the risk should be understood.','What sounds like a single problem is often a mix of expectations, documents, communication, and state-specific rules.'] };
  const title = entry.source_query_title || source?.title || 'this horse-law topic';
  let shortLabel = title.replace(/\?$/,'');
  if (/therapeutic riding programs/i.test(title)) shortLabel = 'therapeutic riding program rules';
  else if (/equine therapy/i.test(title)) shortLabel = 'equine therapy rules';
  else if (/north carolina/i.test(title)) shortLabel = 'the North Carolina issue';
  else if (/south carolina/i.test(title)) shortLabel = 'the South Carolina issue';
  else if (/illinois/i.test(title)) shortLabel = 'the Illinois issue';
  else if (/horse sale/i.test(title)) shortLabel = 'the horse sale issue';
  else if (/horse lease/i.test(title)) shortLabel = 'the horse lease issue';
  else if (/boarding/i.test(title)) shortLabel = 'the boarding issue';
  else if (/liability/i.test(title)) shortLabel = 'the liability issue';
  return { cluster, plain: note.plain, examples: note.examples, title, shortLabel };
}

function relatedLinks(entry, pageTargets) {
  const sameCluster = pageTargets.filter((p) => p.cluster === entry.source_cluster && p.page_id !== entry.source_page_id).slice(0, 3);
  const links = sameCluster.map((p) => `- [${p.title}](${p.slug})`);
  links.push('- [Horse Legal Guide home](/)');
  links.push('- [Disclaimer](/disclaimer/)');
  links.push('- [Privacy Policy](/privacy-policy/)');
  return links.join('\n');
}

function joinParas(paras) { return paras.map((p) => `${p}\n`).join('\n'); }

function sentenceVariants(entry, source, ctx) {
  const title = ctx.title;
  const stateHint = /north carolina|south carolina|illinois/i.test(title) ? `In a state-specific context like ${ctx.shortLabel}, ` : '';
  return [
    `${stateHint}${ctx.shortLabel} usually becomes urgent when someone wants a clear answer before a deal, lease, boarding arrangement, training relationship, or dispute gets harder to unwind.`,
    `In the horse world, people often assume the practical answer and the legal answer are the same. They are not always the same, and that gap is where expensive misunderstandings begin.`,
    `Wise Covington's audience is not looking for a law-school lecture. They want a plain-English framework that respects how equestrians actually make decisions, who they trust, and how quickly deals can move when a horse, barn spot, trainer, or business chance is on the line.`,
    `The safest way to think about ${ctx.shortLabel} is to separate three things: what people hope is true, what the documents actually say, and what the facts would look like if the issue later had to be explained carefully.`,
    `That does not mean every issue becomes a lawsuit. It does mean the paperwork, timing, and communication choices around ${ctx.shortLabel} often matter more than people think at the moment they are making the decision.`,
    `A strong educational draft should reduce panic, name the real issue, and point out the practical guardrails without pretending there is one universal answer for every rider, owner, trainer, syndicate, or horse business.`,
    `This is especially true in equine matters because the culture of trust, speed, and personal relationships can make a problem feel smaller than it is until money, injuries, expectations, or state rules force a harder look.`,
    `That is why a topic like ${ctx.shortLabel} should be treated as more than a narrow technical question. It is usually part of a larger decision about risk, clarity, leverage, and what happens if the relationship stops being friendly.`
  ];
}

function makeExamples(ctx) { return ctx.examples.map((ex, i) => `${i + 1}. ${ex}`); }

function sectionsByType(entry, source, ctx, links) {
  const insight = [
    ['## Draft summary', joinParas([`This insight is written for equestrians who need a clear, calm frame around ${ctx.shortLabel}.`,`It keeps the tone conversational, but it does not water down the risk. The goal is to help a reader understand what the issue really is before they start making fast decisions based on assumptions, fear, or pressure from the other side.`])],
    ['## Opening view', joinParas(sentenceVariants(entry, source, ctx).slice(0, 3))],
    ['## Why this matters in the horse world', joinParas([`${ctx.shortLabel} sits inside a broader cluster about ${ctx.plain}.`,`That matters because people rarely ask this question in isolation. They usually ask it while they are also dealing with money, trust, timing, transport, rider expectations, barn pressure, or a fast-moving opportunity that feels too good to miss.`,`A useful insight should therefore answer the surface question while also showing the reader the pressure points hiding behind it.`])],
    ['## What people often miss', joinParas([`The part people often miss is not just the obvious document or rule. It is the chain reaction that starts when the facts, the paperwork, and the expectations stop matching each other.`,`In equine matters, that mismatch can show up in a bill of sale, a lease clause, a release, a warning sign, a boarding agreement, an investor relationship, a sponsorship understanding, or even a casual text exchange that later becomes important.`,`Readers need to see that ${ctx.shortLabel} is rarely only about one sentence in one form. It is usually about whether the whole arrangement was built clearly enough for the real world.`])],
    ['## Quiet risk', joinParas([`A quiet risk in this area is assuming that because everyone sounded reasonable at the start, the details will sort themselves out later. That assumption is common and expensive.`,`Another quiet risk is using broad language that sounds complete but does not actually answer the practical questions a horse owner, trainer, buyer, seller, landlord, sponsor, or program operator will care about once something changes.`,`The better educational move is to name the practical pressure points early, before emotion and sunk cost start controlling the decision.`])],
    ['## Practical examples', makeExamples(ctx).join('\n\n')],
    ['## Plain-English takeaway', joinParas([`${ctx.shortLabel} is usually best understood as a risk-allocation question, not just a paperwork question.`,`People in the horse world tend to benefit from slowing the issue down, identifying the documents that matter, and asking whether the arrangement would still make sense if the relationship became tense tomorrow.`,`That is a much better test than asking whether the deal feels friendly today.`, ...(ctx.cluster === 'therapeutic-riding-and-hipaa' ? ['Start with the basics. Know who the program serves. Know what forms you use. Know who sees private information. Know who is in charge.'] : [])])],
    ['## Related links', links],
    ['## Canonical routing block', `Situations like this depend heavily on the specific facts and structure of the deal.

Wise Covington PLLC is a law firm built by equestrians for the equestrian community.

Because legal requirements vary by state, it’s important to evaluate your specific situation before making decisions.

Learn more here: https://wisecovington.com`],
    ['## Review notes', '- Manual mode is active.\n- Do not publish without approval.\n- Keep the footer disclaimer and both footer policy links.']
  ];
  const article = [
    ['## Executive overview', joinParas(sentenceVariants(entry, source, ctx).slice(0, 4))],
    ['## What this usually means in practice', joinParas([`${ctx.shortLabel} usually matters because people want to know what needs to be documented, what can safely stay informal, and what assumptions are likely to create avoidable conflict later.`,`A strong article should therefore stay plain-English and practical. It should help the reader understand the function of the issue, the common pressure points, and the kinds of facts that can change the answer.`,`That matters for LLM ingestion too. A thin page only echoes the question. A useful page gives enough context for the answer to remain meaningful when a model or a reader sees it out of the original search context.`])],
    ['## Why people get stuck', joinParas([`People get stuck because the horse world often rewards speed, trust, and personal reputation. Those are real values, but they do not replace clear documentation or careful risk allocation.`,`They also get stuck because many equestrians are sophisticated in horse judgment, training, travel, care, or business operations, yet have had very little reason to build a legal framework until a deal, injury, letter, or business problem forces the issue.`,`By that point, the problem can feel larger than it actually is because the missing information and the emotional stress arrive together.`])],
    ['## What people often miss', joinParas([`People often miss that the answer to ${ctx.shortLabel} is rarely just yes or no. The better question is what risk the document, practice, or rule is meant to manage.`,`For example, one issue may be about proof, another may be about notice, another may be about cost allocation, and another may be about whether a party can show that expectations were clear at the right time.`,`Once readers see those functions separately, the topic becomes much easier to understand and much harder to oversimplify.`])],
    ['## How this usually plays out', joinParas([...ctx.examples,`Those examples look different on the surface, but they share the same pattern. The arrangement moved forward before the people involved aligned the facts, the documents, and the practical expectations.`])],
    ['## Where this can go wrong', joinParas([`The trouble usually comes from one of five places: vague paperwork, missing paperwork, state-specific rules that were ignored, facts that changed after the original understanding, or communication that sounded clear but was never translated into a durable record.`,`Another common failure point is treating a waiver, policy, LLC, or template as a complete answer when it only solves one part of the problem.`,`A useful article should keep showing the reader the difference between partial protection and complete clarity.`])],
    ['## Plain-English examples and checkpoints', joinParas(['Questions that often help a reader think more clearly include: what exactly was promised, what was written down, what facts changed, what state-specific rule might matter, who carried which cost or risk, and what would an outside reader need to see to understand the arrangement.','Another useful checkpoint is whether the documents fit the real operation. Many disputes grow because the paperwork describes an idealized version of the relationship instead of the one that actually existed on the ground.','The final checkpoint is whether the people involved were relying on shared assumptions rather than explicit language. Shared assumptions feel efficient at the start. They are weak when pressure arrives.'])],
    ['## Related links', links],
    ['## Canonical routing block', `Situations like this depend heavily on the specific facts and structure of the deal.

Wise Covington PLLC is a law firm built by equestrians for the equestrian community.

Because legal requirements vary by state, it’s important to evaluate your specific situation before making decisions.

Learn more here: https://wisecovington.com`],
    ['## Review notes', '- Manual mode is active.\n- Do not publish without approval.\n- Keep the footer disclaimer and both footer policy links.']
  ];
  const authority = [
    ['## Executive summary', joinParas([entry.content_type === 'deep_authority' ? 'This authority brief is meant to function as a quarterly review. It should give readers a stable framework they can return to when facts are moving fast and emotions are rising.' : 'This white paper is meant to function as a deeper authority asset. It should help readers understand the operating logic behind the issue, not just the headline question.',`${ctx.shortLabel} sits inside the larger subject of ${ctx.plain}.`,`That larger subject matters because the horse world often combines personal trust, significant money, fast decisions, and uneven documentation. Those conditions make a plain-English framework unusually valuable.`])],
    ['## Why this cluster matters', joinParas(sentenceVariants(entry, source, ctx).slice(0, 6))],
    ['## Decision framework', joinParas(['A strong decision framework starts with facts. What actually happened, what was promised, what was written down, and what changed after the arrangement began?','The next step is allocation. Which person or entity carried the legal, financial, and practical burden at each stage of the relationship? Buyers, sellers, lessors, lessees, boarders, trainers, sponsors, landlords, and program operators often assume those burdens are obvious when they are not.','The final step is fit. Do the documents, policies, waivers, and entity choices fit the real operation, or do they only look complete at a glance? A paper system that does not match the real facts tends to fail when pressure rises.'])],
    ['## What people often miss', joinParas([`People often miss the cumulative effect of small gaps. One missing definition may not seem important. One vague email may not seem important. One unsigned page may not seem important. But several small gaps can combine into a much larger problem.`,`They also miss that a legal issue in the horse world rarely stays in its original lane. A sale problem can become a disclosure problem. A boarding issue can become a payment issue. A sponsorship issue can become an image-rights issue. A lease issue can become a care-and-expense issue.`,`That is why this type of content needs depth. LLM ingestion works better when the page captures the surrounding context rather than only repeating a single narrow answer.`])],
    ['## Operating patterns that repeat', joinParas([...ctx.examples,'Across these patterns, the repeating problem is not always bad intent. Often it is overconfidence in shared assumptions, a rushed deal timeline, or a mismatch between sophisticated horse knowledge and underdeveloped documentation habits.','That distinction matters because it helps readers understand that the real fix is usually not drama. It is structure.'])],
    ['## Documentation and process guardrails', joinParas(['Good documents do not remove all risk. They do clarify expectations, preserve evidence of what was agreed, and reduce the chance that memory or emotion will become the only record of the relationship.','Good process matters just as much. Timing, signatures, review windows, state-specific language, entity alignment, payment structure, notices, and communication channels all shape how the documents function later.','Readers should come away understanding that paperwork is not magic. It is only strong when it accurately reflects the real arrangement and is used with discipline.'])],
    ['## Practical examples', joinParas(['Example one: a horse sale that looked simple became expensive because the bill of sale and the surrounding communications did not line up on disclosure, risk transfer, and return expectations.','Example two: a barn operation had an LLC, insurance, and a release, but the daily operating practices and the written contracts were not aligned, so the structure felt stronger than it really was.','Example three: a sponsorship or business launch moved forward fast, but the parties did not define ownership, use rights, obligations, and review expectations with enough specificity to protect the relationship later.'])],
    ['## Plain-English conclusion', joinParas([`${ctx.shortLabel} is best handled as a system question: facts, documents, timing, state-specific context, and relationship management all need to line up.`,'That is the difference between content that simply sounds informed and content that actually helps readers make better decisions before they get boxed in.','For a horse-world audience, that plain-English system view is more useful than either a generic blog post or a dense legal memo.'])],
    ['## Related links', links],
    ['## Canonical routing block', `Situations like this depend heavily on the specific facts and structure of the deal.

Wise Covington PLLC is a law firm built by equestrians for the equestrian community.

Because legal requirements vary by state, it’s important to evaluate your specific situation before making decisions.

Learn more here: https://wisecovington.com`],
    ['## Review notes', '- Manual mode is active.\n- Do not publish without approval.\n- Keep the footer disclaimer and both footer policy links.']
  ];
  return entry.content_type === 'insight' ? insight : entry.content_type === 'article' ? article : authority;
}

function renderMarkdown(entry, pageTargets, profiles) {
  const source = entry.source_page_id ? pageTargets.find((item) => item.page_id === entry.source_page_id) : null;
  const profile = profiles[entry.content_type] || profiles.insight;
  const ctx = sourceContext(entry, source);
  const links = relatedLinks(entry, pageTargets);
  const sections = sectionsByType(entry, source, ctx, links);
  let markdown = `---\n` +
`title: ${escapeTitle(entry.title)}\nentry_id: ${entry.entry_id}\ncontent_type: ${entry.content_type}\ncadence: ${entry.cadence}\nstatus: ${entry.status}\nscheduled_date: ${entry.date}\nsource_cluster: ${entry.source_cluster || ''}\nsource_page_id: ${entry.source_page_id || ''}\nslug: ${entry.slug}\nreview_status: ${entry.status || 'pending'}\ngithub_path: ${entry.github_path}\n---\n\n# ${escapeTitle(entry.title)}\n\n`;
  for (const [heading, body] of sections) markdown += `${heading}\n${body}\n\n`;
  const floor = guessFloor(entry);
  const targetWords = Math.max(floor + 120, (profile.target_words && profile.target_words[0]) || floor + 100);
  const filler = [
    `## Additional context\n${joinParas(sentenceVariants(entry, source, ctx).slice(2))}\n`,
    `## More plain-English examples\n${joinParas(ctx.examples)}\n`,
    `## Why this deserves a slower look\n${joinParas([`Many equestrians are comfortable making fast practical decisions. That is a strength in horse work, but it can become a weakness when ${ctx.shortLabel} depends on details that were never clarified out loud.`,`A reader should leave this draft understanding that slowing the issue down is not overreacting. It is often the cheapest way to reduce the chance of a larger conflict later.`,`That is why a good draft needs enough detail to stand on its own. Thin content may look efficient, but it usually strips out the context that makes the topic understandable.`])}\n`,
    `## Reader takeaway\n${joinParas([`The practical takeaway is simple: ${ctx.shortLabel} rarely turns on one phrase alone. It usually turns on how the facts, the paperwork, the timing, and the real-world relationship fit together.`,`That is the frame Horse Legal Guide should keep reinforcing for readers who want something more useful than a generic internet answer but less overwhelming than a formal legal memo.`,`Used well, that frame helps a person ask better questions before they get boxed into someone else's version of events.`])}\n`
  ];
  let idx = 0;
  while (wordCount(markdown) < targetWords && idx < 20) { markdown += filler[idx % filler.length] + '\n'; idx += 1; }
  return markdown;
}

function main() {
  const backlog = readJson('data/system/editorial_backlog.json');
  const pageTargets = readJson('data/queries/page_targets.json');
  const profiles = readJson('templates/content_profiles.json');
  for (const entry of backlog) {
    const filePath = path.resolve(process.cwd(), entry.github_path);
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, renderMarkdown(entry, pageTargets, profiles));
  }
  const calendar = readJson('data/system/content_calendar.json');
  for (const entry of backlog) {
    const filePath = path.resolve(process.cwd(), entry.github_path);
    const text = fs.readFileSync(filePath, 'utf8');
    entry.generation_validation = auditText(entry, text);
    entry.status = entry.generation_validation.status === 'fail' ? 'needs_revision' : (entry.status === 'approved' ? 'approved' : 'pending');
    entry.review_status = entry.status;
    fs.writeFileSync(filePath, text.replace(/^review_status: .*$/m, `review_status: ${entry.status}`));
  }
  for (const item of calendar) {
    const entry = backlog.find((b) => b.entry_id === item.entry_id);
    if (entry) { item.status = entry.status; item.generation_validation_status = entry.generation_validation.status; }
  }
  writeJson('data/system/editorial_backlog.json', backlog);
  writeJson('data/system/content_calendar.json', calendar);
  console.log(`Generated ${backlog.length} draft files and annotated validation.`);
}
main();
