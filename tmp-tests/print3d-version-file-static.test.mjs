import assert from 'node:assert/strict';
import fs from 'node:fs';

const config = fs.readFileSync(new URL('../vite.print3d.config.ts', import.meta.url), 'utf8');

assert.match(config, /name:\s*['"]print3d-version-file['"]/);
assert.match(config, /fileName:\s*['"]VERSION\.json['"]/);
assert.match(config, /public\/VERSION\.json/);
assert.doesNotMatch(config, /publicDir:\s*['"][^'"]+['"]/, 'A Loja 3D não deve copiar outro diretório público inteiro.');

console.log('print3d-version-file-static ok');
