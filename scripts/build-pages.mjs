// Writes recipes/<slug>.md from recipes/<slug>.json, so the page and the data never drift.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const usd = (value) => (value === null ? 'not listed' : `$${value}`);

const NOTES = {
  'find-work-email': [
    'The email is in `normalized.fields.email`. `normalized.fields.check` is `valid`, `invalid`, `catch_all`, `risky` or `unknown`. A row where looot found nothing has no `normalized.fields.email`; the column stays empty.',
    'No domain? Replace `"domain": "/Company Domain"` with `"company": "/Company Name"`. A LinkedIn URL works too: `"linkedin_url": "/LinkedIn URL"`.',
    'One column for the name? Use `"name": "/Full Name"` in place of the two name fields.',
  ],
  'verify-email': [
    '`normalized.fields.status` is `valid`, `invalid`, `catch_all`, `risky` or `unknown`. `normalized.fields.deliverable` is `true` or `false`, and only present when the provider reports it.',
    'Run this column after the find column, on its Work Email output, and filter your send list on `valid`.',
  ],
  'enrich-company': [
    'The fixed fields are `name`, `domain`, `industry` and `size`. Everything else the provider returned is under `result`; add `result` to the field paths to see it.',
    'No domain? Use `"name": "/Company Name"` in place of the domain line.',
  ],
};

const page = (slug, recipe) => `# ${recipe.title} in Clay with looot

Adds a column that runs looot's \`${recipe.job}\` job for each row.

![Illustration of the HTTP API column settings, not a Clay screenshot](../illustrations/${slug}.png)

*Illustration made for this repo. It is not a screenshot of Clay.*

## Cost per row

Priced on ${recipe.price.pricedOn} from the public catalog (\`GET ${recipe.price.source}\`):

| | |
|---|---|
| Cheapest provider, per call | ${usd(recipe.price.cheapestPerCallUsd)} |
| Cheapest provider billed per result | ${usd(recipe.price.cheapestPerResultUsd)} |
| Providers looot can try | ${recipe.price.providers} |
| Cap in this recipe (\`fallback.maxCostUsd\`) | $${recipe.body.fallback.maxCostUsd} per row |

A row costs the price of the providers that ran. With fallback on, looot moves to the next provider when
one finds nothing, so a hard row can cost more than the cheapest price, never more than the cap. A failed
call costs nothing. Each row's real cost comes back in \`actualCost\`. Clay may also charge its own
credits for an HTTP API column; Clay's HTTP API page does not state a number, so check your plan.

## Columns your table needs

${recipe.inputColumns.map((column) => `- \`${column}\``).join('\n')}

Rename the \`/Column Name\` references in the body if your columns have other names.

## Settings

In your table: Add column, Add enrichment, HTTP API.

| Field | Value |
|---|---|
| Method | \`${recipe.method}\` |
| API endpoint URL | \`${recipe.endpoint}\` |
| Query string parameters | ${Object.entries(recipe.queryString).map(([key, value]) => `\`${key}\` = \`${value}\``).join(', ')} |
| Select header account | \`${recipe.headerAccount.name}\` (see [the README](../README.md#1-save-your-looot-token-once)) |
| Field paths to return | ${recipe.fieldPaths.map((fieldPath) => `\`${fieldPath}\``).join(', ')} |
| Remove empty fields from request | On |
| Rate limiting | Request limit \`${recipe.rateLimit.requestLimit}\`, Duration (ms) \`${recipe.rateLimit.durationMs}\` |
| Only run if | ${recipe.runCondition} |

JSON body, also in [\`${slug}.body.json\`](${slug}.body.json):

\`\`\`json
${JSON.stringify(recipe.body, null, 2)}
\`\`\`

## Map the answer to columns

| New column | Field path |
|---|---|
${Object.entries(recipe.outputColumns).map(([column, fieldPath]) => `| ${column} | \`${fieldPath}\` |`).join('\n')}

## Notes

${NOTES[slug].map((note) => `- ${note}`).join('\n')}
- The \`idempotencyKey\` is built from the row's own values. Running the same row again returns the first
  run and costs nothing. To force a fresh lookup, change the prefix, for example add \`-v2\`.
`;

const files = (await readdir(path.join(ROOT, 'recipes'))).filter((name) => name.endsWith('.json') && !name.endsWith('.body.json'));
for (const name of files) {
  const slug = name.replace('.json', '');
  await writeFile(path.join(ROOT, 'recipes', `${slug}.md`), page(slug, JSON.parse(await readFile(path.join(ROOT, 'recipes', name), 'utf8'))));
}
console.log(`built ${files.length} recipe pages`);
