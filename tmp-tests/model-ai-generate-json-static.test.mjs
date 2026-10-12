import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const servicePath = 'services/modelAiService.ts';
const modal = readFileSync('components/settings/ModelModal.tsx', 'utf8');
const server = readFileSync('vps_server.js', 'utf8');
const serverCjs = readFileSync('vps_server.cjs', 'utf8');

// Execute the actual React initializer/effect bodies to reproduce full or blocked browser storage.
const initializer = modal.match(/const \[trustedSourceLinksText, setTrustedSourceLinksText\] = useState\(\(\) => \{([\s\S]*?)\n    \}\);/)?.[1];
const effectEnd = modal.indexOf('    }, [trustedSourceLinksText]);');
const effectStart = modal.lastIndexOf('useEffect(() => {', effectEnd);
const persistence = modal.slice(effectStart + 'useEffect(() => {'.length, effectEnd);
assert.ok(initializer && effectStart >= 0, 'trusted-source storage guards must remain testable');
const key = 'mdv.modelAi.trustedSourceLinks';
const context = { TRUSTED_SOURCE_LINKS_STORAGE_KEY: key, DEFAULT_TRUSTED_SOURCE_LINKS: 'default-links', trustedSourceLinksText: 'edited-links' };
const readPreference = window => vm.runInNewContext(`(() => {${initializer}})()`, { ...context, window });
const persistPreference = window => vm.runInNewContext(`(() => {${persistence}})()`, { ...context, window });
assert.equal(readPreference(undefined), 'default-links');
assert.equal(readPreference({ localStorage: { getItem: () => 'saved-links' } }), 'saved-links');
const blockedStorage = { get localStorage() { throw new Error('SecurityError'); } };
assert.equal(readPreference(blockedStorage), 'default-links');
assert.doesNotThrow(() => persistPreference(blockedStorage));
let quotaWrites = 0;
assert.doesNotThrow(() => persistPreference({ localStorage: {
  getItem: () => null,
  setItem() { quotaWrites++; throw Object.assign(new Error('Full'), { name: 'QuotaExceededError' }); },
} }));
assert.equal(quotaWrites, 1, 'full storage may attempt one write but must never crash the modal');
let unchangedWrites = 0;
persistPreference({ localStorage: { getItem: () => 'edited-links', setItem() { unchangedWrites++; } } });
assert.equal(unchangedWrites, 0, 'opening an unchanged preference must not consume storage');
let saved;
persistPreference({ localStorage: { getItem: () => 'old-links', setItem(k, value) { saved = [k, value]; } } });
assert.deepEqual(saved, [key, 'edited-links'], 'available storage must still persist edits');

assert.equal(existsSync(servicePath), true, 'model AI service must exist');

const service = readFileSync(servicePath, 'utf8');

assert.match(
  service,
  /export async function generateModelJsonWithAi/,
  'frontend must expose generateModelJsonWithAi',
);

assert.match(
  service,
  /vpsClient\.post<ModelAiGenerateResult>\('\/models\/generate-json', input\)/,
  'model AI service must call POST /models/generate-json through VPS client',
);

assert.match(
  service,
  /trustedSourceLinks\?: string\[\]/,
  'model AI service must accept trusted source links',
);

assert.match(
  service,
  /sourceContext\?: string/,
  'model AI service must accept internal source context such as Bling descriptions',
);

assert.match(
  modal,
  /import\s+\{\s*generateModelJsonWithAi\s*\}\s+from\s+['"]\.\.\/\.\.\/services\/modelAiService['"]/,
  'ModelModal must import the model AI generation service',
);

assert.match(
  modal,
  /const \[generatingModelJson, setGeneratingModelJson\] = useState\(false\)/,
  'ModelModal must track generation loading state',
);

assert.match(
  modal,
  /const handleGenerateModelJson = async \(\) =>[\s\S]*await generateModelJsonWithAi\(/,
  'ModelModal must call generateModelJsonWithAi from the JSON tab',
);

assert.match(
  modal,
  /onClick=\{handleGenerateModelJson\}[\s\S]*Pesquisar e preencher pelo sistema/,
  'JSON tab must expose the internal search/fill action',
);

assert.match(
  modal,
  /const \[trustedSourceLinksText, setTrustedSourceLinksText\] = useState/,
  'ModelModal must track trusted source links text',
);

assert.match(
  modal,
  /Sites confiaveis para pesquisa/,
  'JSON tab must expose a trusted source links field',
);

assert.match(
  modal,
  /JSON \/ IA/,
  'ModelModal JSON tab must clearly mention AI so the trusted source field is discoverable',
);

assert.match(
  modal,
  /Sites confiaveis para pesquisa[\s\S]*Prompt de cadastro completo/,
  'Trusted source links must appear before the large prompt textarea in the JSON tab',
);

assert.match(
  modal,
  /trustedSourceLinks:\s*parseTrustedSourceLinks\(trustedSourceLinksText\)/,
  'ModelModal must send trusted source links to the model AI endpoint',
);

assert.match(
  modal,
  /buildModelAiBlingSourceContext/,
  'ModelModal must build source context from linked product/Bling descriptions',
);

assert.match(
  modal,
  /sourceContext,\s*\n\s*\}\)/,
  'ModelModal must send Bling/local source context to the model AI endpoint',
);

assert.match(
  modal,
  /model_id:\s*model\.id[\s\S]*description/,
  'ModelModal must fetch linked model products so their Bling descriptions can guide JSON generation',
);

for (const [label, source] of [['vps_server.js', server], ['vps_server.cjs', serverCjs]]) {
  assert.match(
    source,
    /fastify\.post\('\/models\/generate-json', \{ preHandler: requireSyncKey \}, async \(req, reply\) =>/,
    `${label} must expose POST /models/generate-json`,
  );

  assert.match(
    source,
    /https:\/\/api\.openai\.com\/v1\/responses/,
    `${label} must call the OpenAI Responses API`,
  );

  assert.match(
    source,
    /sanitizeTrustedSourceLinks/,
    `${label} must sanitize trusted source links before using them`,
  );

  assert.match(
    source,
    /buildModelAiWebSearchTools\(\{ allowedDomains: trustedDomains \}\)/,
    `${label} must build a trusted-domain web search pass`,
  );

  assert.match(
    source,
    /buildModelAiWebSearchTools\(\{ allowedDomains: \[\] \}\)/,
    `${label} must keep an external web search fallback`,
  );

  assert.match(
    source,
    /isModelAiSmartphoneRequest/,
    `${label} must only restrict searches to phone sites when the request is smartphone-related`,
  );

  assert.match(
    source,
    /useTrustedOnlyPass\s*=\s*trustedDomains\.length > 0 && isModelAiSmartphoneRequest\(req\.body\)/,
    `${label} must avoid limiting non-smartphone products to smartphone trusted domains`,
  );

  assert.match(
    source,
    /consulte varias fontes independentes/,
    `${label} must ask broad web search to use multiple independent sources`,
  );

  assert.match(
    source,
    /allowed_domains/,
    `${label} must restrict the first web search to trusted domains`,
  );

  assert.match(
    source,
    /sanitizeModelAiSourceContext/,
    `${label} must sanitize internal Bling/local source context before sending it to AI`,
  );

  assert.match(
    source,
    /Contexto interno prioritario do Bling\/local/,
    `${label} must inject Bling/local source context into the model AI prompt`,
  );

  assert.match(
    source,
    /\$\{prompt\}\$\{sourceContextText\}\$\{trustedSourcesText\}/,
    `${label} must send source context before trusted/external web search sources`,
  );

  assert.match(
    source,
    /max_output_tokens:\s*5000/,
    `${label} must allow enough output tokens for complete model descriptions`,
  );

  assert.match(
    source,
    /AbortSignal\.timeout\(75000\)/,
    `${label} must allow more time for broader model research`,
  );

  assert.match(
    source,
    /verbosity:\s*['"]medium['"]/,
    `${label} must not force terse GPT-5 JSON descriptions`,
  );

  const generationRoute = source.match(/fastify\.post\('\/models\/generate-json'[\s\S]*?fastify\.get\('\/models\/:id'/)?.[0] || '';
  assert.ok(generationRoute, `${label} must keep the model AI generation route before /models/:id`);

  assert.doesNotMatch(
    generationRoute,
    /reasoning\s*=\s*\{\s*effort:\s*['"]minimal['"]\s*\}/,
    `${label} must not use GPT-5 minimal reasoning with web_search because OpenAI rejects that combination`,
  );

  assert.match(
    source,
    /CREATE TABLE IF NOT EXISTS model_ai_generation_logs/,
    `${label} must create model_ai_generation_logs for observability`,
  );
}

console.log('model AI JSON generation static checks passed');
