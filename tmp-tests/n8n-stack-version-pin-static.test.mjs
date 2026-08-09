import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('scripts/pin-n8n-stack-version.cjs', 'utf8');
assert.match(source, /docker\.n8n\.io\/n8nio\/n8n:\$\{VERSION\}/, 'must pin the main n8n image');
assert.match(source, /n8nio\/runners:\$\{VERSION\}/, 'must pin the runner to the same version');
assert.match(source, /scale \$\{RUNNER_SERVICE\}=0[\s\S]*scale \$\{N8N_SERVICE\}=0/, 'must stop runner before n8n');
assert.match(source, /scale \$\{N8N_SERVICE\}=1[\s\S]*scale \$\{RUNNER_SERVICE\}=1/, 'must start n8n before runner');
assert.match(source, /prependListener/, 'must fail validation if the known crash remains');
assert.doesNotMatch(source, /:latest/, 'must not restore mutable latest tags');
console.log('n8n stack version pin static checks passed');
