import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const files = ['server.js', 'vps_server.cjs', 'vps_server.js'];

for (const file of files) {
  const source = readFileSync(resolve(root, file), 'utf8');

  assert.match(
    source,
    /const sqlJsonStr = \(v\) => String\(jsonStr\(v\) \|\| ''\)\.replace\(/,
    `${file} must keep migration JSON escaping separate from parameterized jsonStr`,
  );
  assert.match(
    source,
    /\$\{sqlJsonStr\(AUTORESPONDER_DEFAULT_CONVERSATION_FLOW_KEYWORDS\)\}/,
    `${file} must escape keyword JSON defaults in SQL literals`,
  );
  assert.match(
    source,
    /\$\{sqlJsonStr\(AUTORESPONDER_DEFAULT_CONVERSATION_FLOW_MESSAGES\)\}/,
    `${file} must escape message JSON defaults in SQL literals`,
  );
  assert.doesNotMatch(
    source,
    /\$\{jsonStr\(AUTORESPONDER_DEFAULT_CONVERSATION_FLOW_MESSAGES\)\}/,
    `${file} must not inject raw JSON strings with backslash escapes into SQL literals`,
  );
}

console.log('migration JSON SQL literal escaping is covered');
