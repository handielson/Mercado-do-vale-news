import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(file, 'utf8');

  assert.match(
    source,
    /const isLegacyPrompt = normalizedCustomPrompt\.includes\('atras de celular novo'\)/,
    `${file} must recognize the old ambiguous needs prompt`
  );
  assert.match(
    source,
    /if \(customPrompt && !isLegacyPrompt\) return \{ text: customPrompt, aiMeta: null \};/,
    `${file} must ignore the old ambiguous custom prompt and use the single-question fallback`
  );
}

console.log('autoresponder needs prompt legacy settings static checks passed');
