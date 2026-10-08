import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (file) => JSON.parse(await readFile(path.join(ROOT, file), 'utf8'));
const slugs = (await readdir(path.join(ROOT, 'recipes'))).filter((name) => name.endsWith('.json') && !name.endsWith('.body.json')).map((name) => name.replace('.json', ''));
const recipes = Object.fromEntries(await Promise.all(slugs.map(async (slug) => [slug, await readJson(`recipes/${slug}.json`)])));

// The fields POST /v1/runs accepts, from RunRequest in https://api.looot.ai/openapi.json.
const RUN_REQUEST_KEYS = ['endpointId', 'input', 'idempotencyKey', 'output', 'wait', 'fallback'];
const FALLBACK_KEYS = ['enabled', 'maxAttempts', 'maxCostUsd', 'prefer', 'exclude', 'stopAtFirstMiss'];
// The shared input names looot maps to each provider (docs.looot.ai/concepts/job-inputs).
const CANONICAL_INPUTS = ['email', 'url', 'domain', 'name', 'first_name', 'last_name', 'company', 'linkedin_url', 'phone'];
// Normalized fields per job (docs.looot.ai/concepts/normalized-output).
const NORMALIZED_FIELDS = {
  'people.email.find': ['email', 'check'],
  'people.email.verify': ['email', 'status', 'deliverable'],
  'company.enrich': ['name', 'domain', 'industry', 'size'],
};
const columnTokens = (text) => [...text.matchAll(/\/([A-Z][A-Za-z]*(?: [A-Z][A-Za-z]*)*)/g)].map((match) => match[1]);

test('there are three recipes', () => {
  assert.deepEqual(slugs.sort(), ['enrich-company', 'find-work-email', 'verify-email']);
});

for (const slug of slugs) {
  const recipe = recipes[slug];

  test(`${slug}: the request is POST https://api.looot.ai/v1/runs with a bearer header account`, () => {
    assert.equal(recipe.method, 'POST');
    assert.equal(recipe.endpoint, 'https://api.looot.ai/v1/runs');
    const wait = Number(recipe.queryString.wait);
    assert.ok(wait >= 0 && wait <= 60, 'wait is within 0-60 seconds');
    assert.match(recipe.headerAccount.headers.Authorization, /^Bearer <your looot agent token>$/, 'the token is a placeholder');
    assert.equal(recipe.removeEmptyFields, true);
  });

  test(`${slug}: the body only uses RunRequest fields and runs the recipe's job`, () => {
    for (const key of Object.keys(recipe.body)) assert.ok(RUN_REQUEST_KEYS.includes(key), `${key} is a RunRequest field`);
    assert.equal(recipe.body.endpointId, `job:${recipe.job}`);
    assert.ok(recipe.body.idempotencyKey.length > 0);
    for (const key of Object.keys(recipe.body.fallback)) assert.ok(FALLBACK_KEYS.includes(key), `${key} is a fallback field`);
    assert.ok(recipe.body.fallback.maxCostUsd > 0 && recipe.body.fallback.maxCostUsd <= 100);
    for (const key of Object.keys(recipe.body.input)) assert.ok(CANONICAL_INPUTS.includes(key), `${key} is a shared job input`);
  });

  test(`${slug}: every column in the body is a listed input column, and the key changes with each of them`, () => {
    const inBody = new Set(columnTokens(JSON.stringify(recipe.body.input)));
    assert.deepEqual([...inBody].sort(), [...recipe.inputColumns].sort());
    const inKey = new Set(columnTokens(recipe.body.idempotencyKey));
    assert.deepEqual([...inKey].sort(), [...recipe.inputColumns].sort(), 'a different row gives a different idempotency key');
    for (const value of Object.values(recipe.body.input)) assert.match(value, /^\/[A-Z]/, 'string inputs are quoted column references');
  });

  test(`${slug}: the copy-paste body file matches the recipe`, async () => {
    assert.deepEqual(await readJson(`recipes/${slug}.body.json`), recipe.body);
  });

  test(`${slug}: field paths read normalized fields this job has`, () => {
    const allowed = [...NORMALIZED_FIELDS[recipe.job].map((field) => `normalized.fields.${field}`), 'status', 'actualCost', 'runId', 'outcome', 'servedProviderId'];
    for (const fieldPath of recipe.fieldPaths) assert.ok(allowed.includes(fieldPath), `${fieldPath} exists on a ${recipe.job} run`);
    for (const fieldPath of Object.values(recipe.outputColumns)) assert.ok(recipe.fieldPaths.includes(fieldPath), `${fieldPath} is returned`);
  });

  test(`${slug}: the recipe page and the illustration exist and carry the body`, async () => {
    const page = await readFile(path.join(ROOT, 'recipes', `${slug}.md`), 'utf8');
    assert.ok(page.includes(JSON.stringify(recipe.body, null, 2)), 'the page shows the exact body');
    assert.ok(page.includes(`illustrations/${slug}.png`));
    const html = await readFile(path.join(ROOT, 'illustrations', `${slug}.html`), 'utf8');
    assert.ok(html.includes('It is not a screenshot of Clay'));
    assert.ok((await readFile(path.join(ROOT, 'illustrations', `${slug}.png`))).length > 10000);
  });
}

test('prices match the public looot catalog (run with npm run test:live)', { skip: !process.env.LOOOT_CHECK_CATALOG }, async () => {
  const response = await fetch('https://api.looot.ai/v1/catalog/overview?depth=jobs');
  assert.equal(response.status, 200);
  const overview = await response.json();
  const jobs = new Map(overview.categories.flatMap((category) => category.platforms.flatMap((platform) => platform.jobs)).map((job) => [job.id, job]));
  for (const recipe of Object.values(recipes)) {
    const job = jobs.get(recipe.job);
    assert.ok(job, `${recipe.job} is in the catalog`);
    assert.ok(job.runnableCount > 0, `${recipe.job} has a runnable provider`);
    assert.equal(job.cheapestPerCall, recipe.price.cheapestPerCallUsd, `${recipe.job} cheapest per call`);
    assert.equal(job.cheapestPerResult, recipe.price.cheapestPerResultUsd, `${recipe.job} cheapest per result`);
    assert.equal(job.providerCount, recipe.price.providers, `${recipe.job} provider count`);
  }
});
