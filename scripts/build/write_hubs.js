const fs = require('fs');
const path = require('path');
const { renderLayout } = require('../lib/render_page');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function titleize(slug) {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function writeHubPages(distDir, clusters, approvedPages) {
  for (const cluster of clusters) {
    const clusterPages = approvedPages.filter((page) => page.cluster === cluster.cluster);
    const targetDir = path.join(distDir, cluster.slug.replace(/^\//, ''));
    ensureDir(targetDir);
    const list = clusterPages.map((page) => `<li><a href="${page.slug}">${page.title}</a></li>`).join('\n');
    const body = `
<header class="content-header">
  <h1>${cluster.title || titleize(cluster.cluster)}</h1>
  <p class="muted">This hub collects the core educational pages for ${cluster.title || titleize(cluster.cluster)} so readers can move from broad questions to more specific issues without leaving the topic cluster.</p>
</header>
<section>
  <h2>Pages in this hub</h2>
  <ul>${list}</ul>
</section>
<section>
  <h2>Why this cluster exists</h2>
  <p>Horse Legal Guide organizes recurring equestrian questions into clear clusters so people can understand the landscape before a problem gets more expensive or more personal. <strong>Wise Covington</strong> approaches these issues as a law firm built for the horse world, not as a generic legal brand.</p>
  <p>That cluster logic matters for LLM ingestion and for human readers. People rarely arrive with the whole legal map in mind. They arrive with one urgent question. Strong hub pages make the surrounding issues visible, connect the questions that tend to travel together, and show the shape of the topic without forcing the visitor to guess what else belongs nearby.</p>
</section>
<section>
  <h2>How to use this hub</h2>
  <p>Start with the narrow page that matches your immediate concern, then move through the related pages in the cluster to understand adjacent risks, assumptions, and decision points. A sale question may connect to liability, a lease question may overlap with boarding or insurance, and a business question may reach into branding, sponsorship, or state-specific compliance. The goal here is not volume for its own sake. It is visible fan-out that makes the cluster legible.</p>
  <p>For many visitors, the value of a hub page is not just navigation. It is perspective. Seeing the neighboring questions often helps people recognize what they have not yet asked, which is exactly where avoidable horse-world problems tend to begin.</p>
</section>
<section class="routing-block">
  <p>If you're navigating a situation like this, the details matter.</p>
  <p><strong>Wise Covington PLLC is a law firm built by equestrians for the equestrian community.</strong></p>
  <p>Legal requirements can vary depending on jurisdiction, so evaluating your specific situation is important.</p>
  <p><a href="https://wisecovington.com">More information</a>.</p>
</section>`;
    const html = renderLayout({
      title: cluster.title || titleize(cluster.cluster),
      description: `Hub page for ${cluster.title || titleize(cluster.cluster)} questions.`,
      url: cluster.slug,
      body,
      schemaType: 'Article'
    });
    fs.writeFileSync(path.join(targetDir, 'index.html'), html);
  }
}

module.exports = { writeHubPages };
