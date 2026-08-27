'use strict';
/**
 * Render a fill-in document generator from a ```generator fenced block.
 *
 * Why this exists: the money terms this repo does not cover - `horse boarding
 * contract`, `equine bill of sale`, `horse lease agreement` - are answered on
 * the live SERP almost entirely by downloadable files. The measured pulls for
 * `horse lease agreement` returned 7 downloadable files out of 8 results (a
 * university .doc, extension-service PDFs, and individual farms' own forms);
 * position 1 for `horse boarding agreement` is a single stable's PDF. There is
 * no generator, no fillable web tool, and no explainer-with-template anywhere
 * in those results. A page that is only more prose loses to a PDF that a person
 * can actually fill in. A page that fills the document in for them does not.
 *
 * So a draft in this queue may carry a generator spec, and this turns it into a
 * real working tool rather than a screenshot or a description of one.
 *
 * Safety properties this deliberately keeps:
 *  - Everything runs in the reader's browser. No network call, no storage, no
 *    analytics hook. Nothing a person types about a horse deal leaves the page.
 *  - The assembled text is built with textContent and never innerHTML, so a
 *    value typed into a field cannot become markup.
 *  - Field values are only ever substituted into the clause body; the clause
 *    body itself comes from the repo, never from the reader.
 *  - Every placeholder that is left blank renders as its bracketed prompt, so a
 *    half-finished document reads as visibly unfinished rather than as a
 *    complete contract with silent gaps. That is the failure mode that matters
 *    for legal-adjacent material.
 *
 * Placeholders in `body` use [[field_name]]. They deliberately do NOT use the
 * {{...}} form: scripts/quality/content_ops_common.js#unresolvedTokens treats
 * {{...}}, %%...%%, TODO and REPLACE_* as unresolved template tokens and hard
 * fails the draft, which is the correct behaviour for an unfinished draft and
 * the wrong behaviour for a tool whose whole job is to hold placeholders.
 */

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const TOOL_STYLE = `
.doc-tool{border:1px solid #d9c9b1;border-radius:14px;padding:18px 20px;margin:18px 0;background:#fffdf8}
.doc-tool h3{margin:0 0 4px}
.doc-tool .doc-tool-note{font-size:.86rem;color:#6d5f4c;margin:0 0 14px}
.doc-tool-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.doc-tool-field{display:flex;flex-direction:column;gap:4px}
.doc-tool-field label{font-size:.8rem;letter-spacing:.04em;text-transform:uppercase;color:#7a6a55}
.doc-tool-field input,.doc-tool-field select,.doc-tool-field textarea{font:inherit;padding:8px 10px;border:1px solid #d9c9b1;border-radius:9px;background:#fff;width:100%;box-sizing:border-box}
.doc-tool-actions{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 10px;align-items:center}
.doc-tool-actions button{font:inherit;cursor:pointer;padding:9px 16px;border-radius:9px;border:1px solid #7a4b18;background:#7a4b18;color:#fff}
.doc-tool-actions button.secondary{background:#fff;color:#7a4b18}
.doc-tool-status{font-size:.85rem;color:#6d5f4c}
.doc-tool-out{white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.86rem;line-height:1.55;background:#fbf6ec;border:1px solid #e4d7c5;border-radius:10px;padding:16px;max-height:460px;overflow:auto}
.doc-tool-unfilled{color:#8a3f2a}
`;

const TOOL_SCRIPT = `
(function(){
  function boot(root){
    var spec;
    try { spec = JSON.parse(root.querySelector('script[type="application/json"]').textContent); }
    catch (e) { return; }
    var out = root.querySelector('.doc-tool-out');
    var status = root.querySelector('.doc-tool-status');
    var inputs = Array.prototype.slice.call(root.querySelectorAll('[data-field]'));
    function values(){
      var v = {};
      inputs.forEach(function(el){ v[el.getAttribute('data-field')] = (el.value || '').trim(); });
      return v;
    }
    function assemble(){
      var v = values(), missing = 0;
      var text = String(spec.body || '').replace(/\\[\\[([a-z0-9_]+)\\]\\]/gi, function(whole, key){
        var field = (spec.fields || []).filter(function(f){ return f.name === key; })[0];
        var val = v[key];
        if (val) return val;
        missing++;
        return '[' + ((field && field.prompt) || (field && field.label) || key).toUpperCase() + ']';
      });
      return { text: text, missing: missing };
    }
    function render(){
      var r = assemble();
      out.textContent = r.text;
      status.textContent = r.missing === 0
        ? 'All fields filled. Read every clause before you use it, and have it reviewed for your state.'
        : r.missing + ' placeholder' + (r.missing === 1 ? '' : 's') + ' still unfilled - they stay in [BRACKETS] so nothing reads as finished when it is not.';
    }
    inputs.forEach(function(el){ el.addEventListener('input', render); el.addEventListener('change', render); });
    var copy = root.querySelector('[data-action="copy"]');
    if (copy) copy.addEventListener('click', function(){
      var text = assemble().text;
      function done(ok){ status.textContent = ok ? 'Copied to your clipboard.' : 'Copy failed - select the text below and copy it manually.'; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function(){ done(true); }, function(){ done(false); });
      } else { done(false); }
    });
    var dl = root.querySelector('[data-action="download"]');
    if (dl) dl.addEventListener('click', function(){
      var blob = new Blob([assemble().text], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = (spec.filename || 'document') + '.txt';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    });
    var reset = root.querySelector('[data-action="reset"]');
    if (reset) reset.addEventListener('click', function(){
      inputs.forEach(function(el){ el.value = el.tagName === 'SELECT' ? el.options[0].value : ''; });
      render();
    });
    render();
  }
  var roots = document.querySelectorAll('.doc-tool');
  for (var i = 0; i < roots.length; i++) boot(roots[i]);
})();
`;

function renderField(field, index) {
  const id = `f-${esc(field.name)}-${index}`;
  const label = `<label for="${id}">${esc(field.label || field.name)}</label>`;
  if (field.type === 'select') {
    const options = (field.options || []).map((opt) => `<option value="${esc(opt)}">${esc(opt || field.placeholder || 'Select')}</option>`).join('');
    return `<div class="doc-tool-field">${label}<select id="${id}" data-field="${esc(field.name)}">${options}</select></div>`;
  }
  if (field.type === 'textarea') {
    return `<div class="doc-tool-field">${label}<textarea id="${id}" rows="3" data-field="${esc(field.name)}" placeholder="${esc(field.placeholder || '')}"></textarea></div>`;
  }
  const type = field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text';
  return `<div class="doc-tool-field">${label}<input id="${id}" type="${type}" data-field="${esc(field.name)}" placeholder="${esc(field.placeholder || '')}"></div>`;
}

/**
 * `spec` is the parsed contents of a ```generator fence.
 * Returns a self-contained block of HTML. Callers must emit TOOL_ASSETS once
 * per page (renderToolAssets()).
 */
function renderDocumentTool(spec, index = 0) {
  if (!spec || !Array.isArray(spec.fields) || !spec.body) {
    throw new Error('render_document_tool: generator spec needs fields[] and body');
  }
  const fields = spec.fields.map((field, i) => renderField(field, `${index}-${i}`)).join('');
  const payload = JSON.stringify({ body: spec.body, fields: spec.fields.map((f) => ({ name: f.name, label: f.label, prompt: f.prompt })), filename: spec.filename || 'document' })
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  return `<div class="doc-tool" data-doc-tool="${esc(spec.id || `tool-${index}`)}">
<h3>${esc(spec.title || 'Fill-in document builder')}</h3>
<p class="doc-tool-note">${esc(spec.note || 'Fill in what you know. The document rebuilds as you type, entirely in your browser - nothing you type is sent anywhere or saved. Anything you leave blank stays in [BRACKETS] so an unfinished document never reads as a finished one.')}</p>
<div class="doc-tool-grid">${fields}</div>
<div class="doc-tool-actions">
<button type="button" data-action="copy">Copy the text</button>
<button type="button" class="secondary" data-action="download">Download as .txt</button>
<button type="button" class="secondary" data-action="reset">Clear</button>
<span class="doc-tool-status"></span>
</div>
<pre class="doc-tool-out" aria-live="polite"></pre>
<script type="application/json">${payload}</script>
</div>`;
}

function renderToolAssets() {
  return `<style>${TOOL_STYLE}</style><script>${TOOL_SCRIPT}</script>`;
}

module.exports = { renderDocumentTool, renderToolAssets };
