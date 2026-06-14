import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const servicePath = 'services/modelAiService.ts';
const modal = readFileSync('components/settings/ModelModal.tsx', 'utf8');
const server = readFileSync('vps_server.js', 'utf8');
const serverCjs = readFileSync('vps_server.cjs', 'utf8');

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
    /allowed_domains/,
    `${label} must restrict the first web search to trusted domains`,
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
