'use strict';
// bling-token-columns-text-v1: tokens do Bling não cabem em VARCHAR(500); o boot alarga para TEXT.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  test(`${file}: boot alarga os tokens do Bling para TEXT`, () => {
    const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.match(src, /const BLING_TOKEN_TEXT_COLUMNS = \['bling_access_token', 'bling_refresh_token'\];/);
    const fn = src.slice(src.indexOf('async function ensureBlingTokenColumnsAreText()'), src.indexOf('async function ensureOrderPaymentStatusSupportsRefunded()'));
    assert.match(fn, /INFORMATION_SCHEMA\.COLUMNS/);
    assert.match(fn, /\['text', 'mediumtext', 'longtext'\]\.includes/, 'idempotente: não altera se já for TEXT');
    assert.match(fn, /MODIFY COLUMN \\`\$\{columnName\}\\` TEXT \$\{nullableSql\}/, 'mantém a nulidade');
    assert.match(src, /try \{ await ensureBlingTokenColumnsAreText\(\); \}\s*catch \(error\) \{ console\.error\('\[migration\] bling token columns:', error\.message\); \}/, 'falha não derruba o boot');
  });
}

test('migração idempotente: só altera colunas que não são TEXT, preservando NULL', async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'vps_server.js'), 'utf8');
  const body = src.slice(src.indexOf('const BLING_TOKEN_TEXT_COLUMNS'), src.indexOf('async function ensureOrderPaymentStatusSupportsRefunded()'));
  const columns = { bling_access_token: { DATA_TYPE: 'varchar', IS_NULLABLE: 'YES' }, bling_refresh_token: { DATA_TYPE: 'text', IS_NULLABLE: 'YES' } };
  const alters = [];
  const pool = { query: async (sql, args) => {
    if (sql.includes('INFORMATION_SCHEMA')) return [[columns[args[0]]]];
    alters.push(sql); return [{}];
  } };
  const run = new Function('pool', 'console', `${body}; return ensureBlingTokenColumnsAreText();`);
  await run(pool, { log() {}, error() {} });
  assert.deepEqual(alters, ['ALTER TABLE `company_settings` MODIFY COLUMN `bling_access_token` TEXT NULL']);
});
