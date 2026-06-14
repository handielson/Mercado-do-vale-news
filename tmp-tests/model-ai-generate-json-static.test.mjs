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
    /CREATE TABLE IF NOT EXISTS model_ai_generation_logs/,
    `${label} must create model_ai_generation_logs for observability`,
  );
}

console.log('model AI JSON generation static checks passed');
