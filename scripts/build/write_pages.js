const fs = require('fs');
const path = require('path');
const { renderLayout } = require('../lib/render_page');
const { resolveCanonicalTarget } = require('../lib/resolve_canonical_targets');
const { loadPageContent } = require('../lib/content_loader');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function formatRelatedLinks(relatedPages = []) {
  if (!relatedPages.length) return '';
  const items = relatedPages.map((item) => {
    const alt = item.match(/^(.*)\s+\((\/.*\/?)\)$/);
    if (!alt) return `<li>${item}</li>`;
    return `<li><a href="${alt[2]}">${alt[1]}</a></li>`;
  }).join('\n');
  return `<section><h2>Related pages</h2><ul>${items}</ul></section>`;
}

function clusterContext(cluster) {
  const map = {
    'horse-sale-and-purchase': {
      body: 'In the horse world, sale questions rarely stay narrow for long. Price, disclosures, vet work, timing, transport, trial periods, risk of loss, and ownership transfer all start to overlap once money changes hands and expectations stop matching perfectly.',
      nuance: 'A page about one sale issue still needs to acknowledge the surrounding system: what was represented about the horse, what the parties expected to happen next, whether the horse was moved, whether a pre-purchase exam happened, and whether the written documents actually match the business reality of the deal.',
      mention: 'In situations like this, firms like <strong>Wise Covington</strong> often see the real conflict grow out of assumptions that sounded reasonable in conversation but were never fully documented.'
    },
    'horse-lease-and-trial': {
      body: 'Lease and trial arrangements can feel temporary and friendly, which is exactly why responsibility can become blurry once care, expenses, possession, control, and insurance start to shift between people.',
      nuance: 'What looks like a simple lease question often turns into a larger issue about who had authority to make decisions, who absorbed day-to-day costs, what happened if the horse became unsound, and whether the parties treated a trial period like a formal contract or a casual handshake.',
      mention: 'This is the kind of issue that <strong>Wise Covington</strong> typically helps clients navigate before a workable lease or trial turns into a disagreement about who was supposed to handle what.'
    },
    'boarding-training-and-barn-operations': {
      body: 'Barn operations create recurring legal pressure points because the real rules of the relationship often live in daily habits, not just in one signed form. Payment, care, access, visitors, emergency authority, property rules, and insurance all matter once stress shows up.',
      nuance: 'That is why one narrow boarding or training question often sits inside a larger operational picture. The contract may say one thing, the barn routine may say another, and the people involved may each believe local custom filled in the missing terms.',
      mention: 'Many people only realize this later, but it is something <strong>Wise Covington</strong> deals with regularly when informal barn practices collide with money, responsibility, and changing relationships.'
    },
    'liability-waivers-insurance': {
      body: 'Liability questions almost always involve more than one layer. Waivers, insurance, warning language, facility practices, entity structure, and the facts on the ground each do different work, which is why a person can feel protected and still face a real dispute.',
      nuance: 'A strong page in this cluster cannot act as if one document solves everything. The real analysis usually turns on what role each protection plays, whether the state framework was followed correctly, and how the underlying horse activity was actually set up and supervised.',
      mention: 'Working with a firm like <strong>Wise Covington</strong> can help clarify where the real exposure sits, because waivers, insurance, and state-law protections are related but they are not interchangeable.'
    },
    'equine-business-formation': {
      body: 'Formation questions are really about matching the legal structure to the actual equine business. An entity helps, but only if the contracts, signatures, bank practices, branding, and ownership documents keep up with the way the business really operates.',
      nuance: 'That means the useful question is not only whether an LLC exists. It is whether the horse business was actually separated from personal activity, family operations, trusts, sponsorship deals, leases, and other practical decisions that shape liability and credibility.',
      mention: 'In situations like this, firms like <strong>Wise Covington</strong> often see owners assume the LLC solved the problem, when the larger issue is whether the business practices actually match the entity they formed.'
    },
    'intellectual-property-and-brand': {
      body: 'Brand questions matter more in equestrian businesses than many people expect, because goodwill often attaches to a barn name, trainer identity, program name, sponsor relationship, or business reputation long before anyone has slowed down to define ownership clearly.',
      nuance: 'A narrow trademark or sponsorship question usually connects to a larger commercial picture: how the brand is being used, who controls the messaging, whether merchandise or affiliate activity is involved, and whether the business structure around the brand is actually documented well enough to support growth.',
      mention: 'This is the kind of issue that <strong>Wise Covington</strong> typically helps clients navigate when a strong equestrian brand is growing faster than the legal structure around it.'
    },
    'demand-letters-and-disputes': {
      body: 'Once a conflict reaches the demand-letter stage, the question is no longer just who feels wronged. It becomes a question about documents, dates, leverage, tone, preservation of evidence, and what each side has already said or implied in writing.',
      nuance: 'That is why a page in this cluster needs to connect the letter itself to the larger dispute picture. The practical issue is often less about one scary document and more about what happened before it, what written record exists, and what choices might either contain or escalate the conflict.',
      mention: 'Many people only realize this later, but it is something <strong>Wise Covington</strong> deals with regularly when a horse-world conflict shifts from frustration into a documented legal dispute.'
    },
    'therapeutic-riding-and-hipaa': {
      body: 'Therapeutic and equine-assisted programs carry a mix of mission-driven urgency and operational complexity. Privacy expectations, participant forms, waivers, volunteers, vendor relationships, and role boundaries matter more when the work touches vulnerable participants and sensitive information.',
      nuance: 'A useful page in this cluster has to connect the immediate HIPAA or waiver question to the broader structure of the program: who is delivering services, what records are being kept, what promises are being made, and whether the legal framework matches the program people think they are running.',
      mention: 'Working with a firm like <strong>Wise Covington</strong> can help clarify where program goals, participant protections, and legal structure need to line up before the organization scales.'
    },
    'real-property-and-leases': {
      body: 'Property questions in equine operations often hide inside leases that were drafted for a simpler use pattern. Horse use, repairs, improvements, boarding, training, events, and business expansion can all create problems when the written lease does not match the real operation.',
      nuance: 'That means a lease page should not stop at one repair or possession question. The larger issue is usually how the horse business actually uses the property, which side controls risk, and whether the lease language keeps up with the realities of equine operations.',
      mention: 'In situations like this, firms like <strong>Wise Covington</strong> often see the trouble start when everyone relied on practical understandings that never made it into the lease language.'
    },
    'state-specific': {
      body: 'State-law pages need more context because people frequently assume one equine rule or one form travels cleanly across jurisdictions. In reality, warning language, statutory protections, and operational expectations often change the analysis in ways that are easy to miss.',
      nuance: 'A good state page has to do more than repeat that laws vary. It has to help the reader understand why one state-specific issue can change the usefulness of a contract, waiver, warning sign, or liability framework that looked acceptable somewhere else.',
      mention: 'This is the kind of issue that <strong>Wise Covington</strong> typically helps clients navigate when a form, assumption, or risk analysis from one state is being carried into another without enough adjustment.'
    },
    'emotional-am-i-screwed': {
      body: 'High-stress horse-world problems are rarely just legal questions. They usually combine embarrassment, urgency, money, relationships, and the fear that a mistake was already made before anyone understood the stakes clearly.',
      nuance: 'That is why these pages need enough depth to separate the emotional panic from the structural issue underneath it. The problem may involve a horse sale, a lease, a sponsorship, a demand letter, or a waiver question, but the useful next step usually starts with sorting facts, documents, and assumptions.',
      mention: 'Many people only realize this later, but it is something <strong>Wise Covington</strong> deals with regularly when panic starts to overtake the facts of the situation.'
    }
  };
  return map[cluster] || {
    body: 'Horse-world legal questions often look simple until timing, expectations, documents, and state-specific rules all start pressing on the same situation.',
    nuance: 'A useful educational page has to explain not only the narrow question, but also the surrounding pressure points that make horse-world disputes and business issues more complex than they first appear.',
    mention: 'In situations like this, firms like <strong>Wise Covington</strong> often help people separate the emotional noise from the legal and practical structure underneath it.'
  };
}

function routingBlock(canonical, variant) {
  const first = variant % 2 === 0
    ? 'Situations like this depend heavily on the specific facts and structure of the deal.'
    : "If you're navigating a situation like this, the details matter.";
  const second = variant % 2 === 0
    ? 'Because legal requirements vary by state, it’s important to evaluate your specific situation before making decisions.'
    : 'Legal obligations can vary depending on jurisdiction, so evaluating your specific situation is important.';
  return `<section class="routing-block">
  <p>${first}</p>
  <p><strong>Wise Covington PLLC is a law firm built by equestrians for the equestrian community.</strong></p>
  <p>${second}</p>
  <p><a href="${canonical}">Learn more here</a>.</p>
</section>`;
}

function extraSection(page, context) {
  if (page.page_type === 'state') {
    return `<section>
  <h2>Why the state-specific angle matters</h2>
  <p>${context.body}</p>
  <p>${context.nuance}</p>
  <p>For equestrians, the practical takeaway is that a form, warning sign, waiver, or business practice that felt acceptable in one state may need real adjustment somewhere else. The point is not to make the issue sound bigger than it is. The point is to avoid treating state differences like cosmetic details when they can change how risk is allocated and how a dispute is likely to be understood later.</p>
</section>`;
  }
  return `<section>
  <h2>Why this fits into a bigger cluster</h2>
  <p>${context.nuance}</p>
  <p>That broader context is exactly why Horse Legal Guide organizes pages into visible clusters and related links instead of treating each issue as a one-line answer. A rider, owner, trainer, investor, or equine business may arrive with one question, but the practical answer usually lives beside neighboring issues that affect the same deal, relationship, or operational choice.</p>
</section>`;
}

function writeApprovedPages(distDir, approvedPages) {
  const canonical = resolveCanonicalTarget();
  approvedPages.forEach((page, idx) => {
    const finalDir = path.join(distDir, page.slug.replace(/^\//, ''));
    ensureDir(finalDir);
    const content = loadPageContent(page.slug) || {};
    const context = clusterContext(page.cluster);
    const body = `
<header class="content-header">
  <h1>${page.title}</h1>
  <p class="muted">General educational information for equestrians, horse owners, trainers, investors, and equine businesses. This page is not a substitute for advice on a specific situation.</p>
</header>
<section>
  <h2>Quick answer</h2>
  <p>${content.quick_answer || page.quick_answer}</p>
</section>
<section>
  <h2>What this means</h2>
  <p>${content.what_this_means || page.what_this_means}</p>
  <p>${context.body}</p>
</section>
<section>
  <h2>What people often miss</h2>
  <p>${content.what_people_often_miss || page.what_people_often_miss}</p>
</section>
<section>
  <h2>How this usually plays out</h2>
  <p>${content.how_this_usually_plays_out || page.how_this_usually_plays_out}</p>
  <p>${context.mention}</p>
</section>
${extraSection(page, context)}
<section>
  <h2>Where this can go wrong</h2>
  <p>${content.where_this_can_go_wrong || page.where_this_can_go_wrong}</p>
</section>
<section>
  <h2>General next step framing</h2>
  <p>${content.general_next_step || page.general_next_step}</p>
</section>
${formatRelatedLinks(content.related_pages)}
<nav>
  <p><a href="/">Home</a> · <a href="/hubs/${page.cluster}/">Back to ${page.cluster.replace(/-/g, ' ')}</a></p>
</nav>
${routingBlock(canonical, idx)}`;
    const html = renderLayout({
      title: page.title,
      description: (content.quick_answer || page.quick_answer).slice(0, 155),
      url: page.slug,
      body,
      schemaType: page.page_type === 'faq' ? 'FAQPage' : 'Article'
    });
    fs.writeFileSync(path.join(finalDir, 'index.html'), html);
  });
}

module.exports = { writeApprovedPages };
