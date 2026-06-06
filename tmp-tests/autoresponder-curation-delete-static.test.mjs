import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/AutoResponderPage.tsx', 'utf8');
const service = readFileSync('services/autoResponderService.ts', 'utf8');
const serverFiles = ['server.js', 'vps_server.cjs', 'vps_server.js'];

assert.match(
  service,
  /deleteUnanswered:\s*\(question:\s*string\)[\s\S]*vpsClient\.delete(?:<[^>]+>)?\([\s\S]*\/autoresponder\/unanswered/,
  'autoResponderService must expose deleteUnanswered through the VPS API',
);

assert.match(
  page,
  /const deleteUnansweredQuestion = async \(question: AutoResponderUnansweredQuestion\)/,
  'AutoResponderPage must define an async curation delete action',
);

assert.match(
  page,
  /await autoResponderService\.deleteUnanswered\(question\.question\)/,
  'curation delete action must call autoResponderService.deleteUnanswered',
);

assert.match(
  page,
  /onClick=\{\(\) => deleteUnansweredQuestion\(question\)\}/,
  'curation row delete button must call deleteUnansweredQuestion',
);

assert.ok(page.includes('Excluir'), 'curation row must render an Excluir action');

for (const file of serverFiles) {
  const source = readFileSync(file, 'utf8');
  assert.match(
    source,
    /fastify\.delete\('\/autoresponder\/unanswered'/,
    `${file} must expose DELETE /autoresponder/unanswered`,
  );
  assert.match(
    source,
    /const question = String\(req\.query\?\.question \|\| ''\)\.trim\(\)/,
    `${file} must read the unanswered question from the query string`,
  );
  assert.match(
    source,
    /DELETE FROM autoresponder_logs[\s\S]*WHERE intent = 'fallback'[\s\S]*AND question = \?/,
    `${file} must delete fallback log rows for the selected curation question`,
  );
}

console.log('autoresponder curation delete static checks passed');
