import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('tools/remote-image-audit-command.mjs', 'utf8');

assert.match(source, /\.avif/, 'remote audit must count existing AVIF derivatives');
assert.match(source, /base64 -d \| node/, 'remote audit command should avoid fragile node -e quoting');
