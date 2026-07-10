import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const server = readFileSync('vps_server.js', 'utf8');
const serverCjs = readFileSync('vps_server.cjs', 'utf8');

function assertImmutability(source, label) {
  // Nenhum UPDATE/DELETE em tabelas historicas do caixa.
  for (const table of ['pdv_cash_closings', 'pdv_cash_events', 'pdv_cash_rectifications', 'pdv_cash_movements']) {
    assert.ok(
      !new RegExp(`UPDATE\\s+${table}`, 'i').test(source),
      `${label} must never UPDATE ${table}`
    );
    assert.ok(
      !new RegExp(`DELETE\\s+FROM\\s+${table}`, 'i').test(source),
      `${label} must never DELETE FROM ${table}`
    );
  }
  // Sessao so muda status (open/closed); nunca DELETE.
  assert.ok(
    !/DELETE\s+FROM\s+pdv_cash_sessions/i.test(source),
    `${label} must never DELETE FROM pdv_cash_sessions`
  );
  // O unico UPDATE permitido em pdv_cash_sessions e o de status.
  const sessionUpdates = source.match(/UPDATE pdv_cash_sessions SET [^`]*?WHERE/g) || [];
  for (const update of sessionUpdates) {
    assert.ok(
      /SET status = '(open|closed)'\s+WHERE/.test(update.replace(/\s+/g, ' ')),
      `${label} pdv_cash_sessions update must only change status: ${update}`
    );
  }
  // Documentos: UPDATE restrito a estado de upload.
  const docUpdates = source.match(/UPDATE pdv_cash_documents[\s\S]*?WHERE id = \?/g) || [];
  assert.ok(docUpdates.length >= 2, `${label} must have upload state updates for documents`);
  for (const update of docUpdates) {
    assert.ok(
      !/file_name|session_id|closing_id|rectification_id|kind/.test(update),
      `${label} document update must not touch identity fields: ${update}`
    );
  }

  // Rotas de caixa: nenhuma PATCH/PUT/DELETE.
  assert.ok(
    !/fastify\.(patch|put|delete)\('\/pdv\/cash-/.test(source),
    `${label} must not expose patch/put/delete cash routes`
  );

  // Blocklist do CRUD generico.
  assert.ok(
    source.includes('TABLE_DATA_BLOCKED_TABLES'),
    `${label} must declare TABLE_DATA_BLOCKED_TABLES`
  );
  for (const table of [
    'pdv_cash_sessions',
    'pdv_cash_closings',
    'pdv_cash_movements',
    'pdv_cash_events',
    'pdv_cash_rectifications',
    'pdv_cash_documents',
  ]) {
    assert.ok(
      new RegExp(`TABLE_DATA_BLOCKED_TABLES = new Set\\(\\[[\\s\\S]*?'${table}'`).test(source),
      `${label} blocklist must contain ${table}`
    );
  }
  assert.ok(
    source.includes('TABLE_DATA_BLOCKED_TABLES.has(String(name || \'\').toLowerCase())'),
    `${label} isValidTable must check the blocklist`
  );
}

assertImmutability(server, 'vps_server.js');
assertImmutability(serverCjs, 'vps_server.cjs');

console.log('cash register immutability static checks passed');
