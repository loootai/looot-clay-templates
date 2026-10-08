// Builds the HTML illustrations in illustrations/ from the recipe files. They are drawings of
// the fields to fill, made for this repo. They are not screenshots of Clay.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const escapeHtml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Marks each /Column token in a body so the drawing shows it as a column chip. */
const withChips = (text) => escapeHtml(text).replace(/\/([A-Z][A-Za-z]*(?: [A-Z][A-Za-z]*)*)/g, '<span class="chip">$1</span>');

const STYLE = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;background:#F4F6F2;color:#0B2E22;padding:28px;width:1100px}
.note{background:#FFF6D6;border:1px solid #E6C65A;color:#5C4A00;border-radius:8px;padding:10px 14px;font-size:14px;font-weight:600;margin-bottom:18px}
.panel{background:#fff;border:1px solid #D5DED7;border-radius:12px;padding:22px 24px}
h1{font-size:20px;margin-bottom:4px}
.sub{font-size:13px;color:#4A6A5C;margin-bottom:18px}
.row{display:grid;grid-template-columns:230px 1fr;gap:14px;padding:11px 0;border-top:1px solid #EDF1EE;align-items:start}
.label{font-size:13px;font-weight:700;color:#2F5546}
.value{font-size:13px}
.mono,pre{font-family:"JetBrains Mono",Menlo,Consolas,monospace;font-size:12.5px}
.box{background:#F7F9F7;border:1px solid #D5DED7;border-radius:8px;padding:8px 10px;display:inline-block}
pre{background:#0B2E22;color:#EAF4EE;border-radius:8px;padding:12px 14px;white-space:pre-wrap;line-height:1.5}
.chip{background:#12A06A;color:#fff;border-radius:5px;padding:1px 6px;font-weight:600;white-space:nowrap}
pre .chip{background:#5FD3A0;color:#0B2E22}
.kv{display:flex;gap:8px;margin-bottom:6px}
.pill{background:#E3F1EA;border:1px solid #BFE0CF;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600;color:#0B4A35}
.toggle{display:inline-block;width:34px;height:18px;border-radius:9px;background:#12A06A;position:relative;vertical-align:middle;margin-right:8px}
.toggle:after{content:"";position:absolute;right:2px;top:2px;width:14px;height:14px;border-radius:50%;background:#fff}
table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #D5DED7;font-size:12.5px}
th,td{border:1px solid #E1E8E3;padding:8px 10px;text-align:left;white-space:nowrap}
th{background:#F0F4F1;font-weight:700;color:#2F5546}
th.looot{background:#E3F1EA;color:#0B4A35}
td.muted{color:#8AA296}
`;

const page = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head>
<body><div class="note">Illustration made for this repo. It is not a screenshot of Clay, and Clay's own screen looks different.</div>
${body}
</body></html>
`;

const panel = (recipe) => {
  const headers = Object.entries(recipe.headerAccount.headers)
    .map(([key, value]) => `<div class="kv"><span class="box mono">${escapeHtml(key)}</span><span class="box mono">${escapeHtml(value)}</span></div>`)
    .join('');
  const query = Object.entries(recipe.queryString)
    .map(([key, value]) => `<div class="kv"><span class="box mono">${escapeHtml(key)}</span><span class="box mono">${escapeHtml(value)}</span></div>`)
    .join('');
  return page(
    `${recipe.title}: HTTP API column`,
    `<div class="panel">
<h1>HTTP API column: ${escapeHtml(recipe.columnName)}</h1>
<div class="sub">What to enter in each field of the HTTP API enrichment. Green chips are columns of your table, inserted with <span class="mono">/Column Name</span>.</div>
<div class="row"><div class="label">Method</div><div class="value"><span class="box mono">${recipe.method}</span></div></div>
<div class="row"><div class="label">API endpoint URL</div><div class="value"><span class="box mono">${escapeHtml(recipe.endpoint)}</span></div></div>
<div class="row"><div class="label">Query string parameters</div><div class="value">${query}</div></div>
<div class="row"><div class="label">JSON body</div><div class="value"><pre>${withChips(JSON.stringify(recipe.body, null, 2))}</pre></div></div>
<div class="row"><div class="label">Select header account</div><div class="value"><div style="margin-bottom:8px"><span class="pill">${escapeHtml(recipe.headerAccount.name)}</span> saved once under Add account</div>${headers}</div></div>
<div class="row"><div class="label">Field paths to return</div><div class="value">${recipe.fieldPaths.map((fieldPath) => `<span class="box mono" style="margin:0 6px 6px 0">${escapeHtml(fieldPath)}</span>`).join('')}</div></div>
<div class="row"><div class="label">Remove empty fields from request</div><div class="value"><span class="toggle"></span>On</div></div>
<div class="row"><div class="label">Rate limiting</div><div class="value">Request limit <span class="box mono">${recipe.rateLimit.requestLimit}</span> &nbsp; Duration (ms) <span class="box mono">${recipe.rateLimit.durationMs}</span></div></div>
<div class="row"><div class="label">Only run if</div><div class="value">${escapeHtml(recipe.runCondition)}</div></div>
</div>`,
  );
};

const table = () =>
  page(
    'A table with the three looot columns',
    `<div class="panel">
<h1>A table after the three columns ran</h1>
<div class="sub">Sample rows with made-up people on example.com. Shaded columns come from looot.</div>
<table>
<tr><th>First Name</th><th>Last Name</th><th>Company Domain</th><th class="looot">Work Email</th><th class="looot">Email Check</th><th class="looot">Email Status</th><th class="looot">Industry</th><th class="looot">Company Size</th><th class="looot">looot Cost</th></tr>
<tr><td>Jane</td><td>Doe</td><td>example.com</td><td>jane.doe@example.com</td><td>valid</td><td>valid</td><td>Software</td><td>51-200</td><td>$0.0069</td></tr>
<tr><td>Sam</td><td>Lee</td><td>example.org</td><td>sam.lee@example.org</td><td>risky</td><td>catch_all</td><td>Logistics</td><td>201-500</td><td>$0.0069</td></tr>
<tr><td>Ana</td><td>Ruiz</td><td>example.net</td><td class="muted">not found</td><td class="muted"></td><td class="muted">not run</td><td>Retail</td><td>11-50</td><td>$0.0019</td></tr>
</table>
</div>`,
  );

const files = (await readdir(path.join(ROOT, 'recipes'))).filter((name) => name.endsWith('.json') && !name.endsWith('.body.json'));
for (const name of files) {
  const recipe = JSON.parse(await readFile(path.join(ROOT, 'recipes', name), 'utf8'));
  await writeFile(path.join(ROOT, 'illustrations', name.replace('.json', '.html')), panel(recipe));
}
await writeFile(path.join(ROOT, 'illustrations', 'table.html'), table());
console.log(`built ${files.length + 1} illustrations`);
