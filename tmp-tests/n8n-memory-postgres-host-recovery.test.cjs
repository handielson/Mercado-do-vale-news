const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  MEMORY_NODE_NAMES,
  TARGET_HOST,
  WORKFLOW_ID,
  rewriteCredentialExport,
} = require('../scripts/n8n-memory-postgres-host-recovery.cjs');

const fixture = [{
  id: 'credential-1',
  name: 'Postgres account',
  type: 'postgres',
  data: {
    host: 'n8n_n8n-db',
    port: 5432,
    database: 'n8n',
    user: 'fixture-user',
    password: 'fixture-secret',
    ssl: 'disable',
  },
}];

const before = structuredClone(fixture);
const result = rewriteCredentialExport(fixture, 'credential-1');
assert.equal(result.changed, true);
assert.equal(result.previousHost, 'n8n_n8n-db');
assert.equal(result.targetHost, TARGET_HOST);
assert.equal(result.document[0].data.host, 'n8n-db');
assert.equal(result.document[0].data.password, before[0].data.password);
const restored = structuredClone(result.document);
restored[0].data.host = before[0].data.host;
assert.deepEqual(restored, before, 'Only the credential host may change');

const idempotent = rewriteCredentialExport(structuredClone(result.document), 'credential-1');
assert.equal(idempotent.changed, false);
assert.throws(() => rewriteCredentialExport([{ ...fixture[0], data: { ...fixture[0].data, host: 'unknown-db' } }], 'credential-1'), /Unexpected Postgres host/);
assert.throws(() => rewriteCredentialExport([{ ...fixture[0], type: 'mysql' }], 'credential-1'), /Credential type drift/);

assert.equal(WORKFLOW_ID, 'SkrkB4vyKVDnQ68t');
assert.deepEqual([...MEMORY_NODE_NAMES].sort(), ['Memoria Vendas', 'Memoria de contexto postggress'].sort());

const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'n8n-memory-postgres-host-recovery.cjs'), 'utf8');
assert.match(source, /export:credentials --id=/);
assert.match(source, /--decrypted --output=/);
assert.match(source, /import:credentials --input=/);
assert.match(source, /chmod 600/);
assert.match(source, /sha256sum/);
assert.match(source, /rm -f/);
assert.doesNotMatch(source, /retry.*execution|execute_workflow/i);

console.log('n8n memory Postgres host recovery checks passed.');
