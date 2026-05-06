import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runnerPath = path.join(root, 'tmp-tests', 'autoresponder-vps-curation-end-to-end.cjs');
const docPath = path.join(root, 'Bot_Whatsapp.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(fs.existsSync(runnerPath), 'curation end-to-end VPS runner must exist');

const runner = fs.readFileSync(runnerPath, 'utf8');
const doc = fs.readFileSync(docPath, 'utf8');

[
  'readLocalEnv',
  'VITE_VPS_SYNC_KEY',
  'SYNC_SECRET',
  'https://api.xiaomipetrolina.com.br',
  "admin('/autoresponder/rules/from-question', 'POST'",
  "admin('/autoresponder/rules'",
  "admin(`/autoresponder/rules/${created.id}`, 'DELETE')",
  'cleanup',
  'created',
  'confirmed_in_list',
  'deleted',
].forEach((token) => {
  assert(runner.includes(token), `curation runner must include ${token}`);
});

assert(
  doc.includes('- [x] Curadoria → criar resposta funciona end-to-end'),
  'Bot_Whatsapp.md must mark curation end-to-end checklist item'
);

console.log('autoresponder curation end-to-end static checks passed');
