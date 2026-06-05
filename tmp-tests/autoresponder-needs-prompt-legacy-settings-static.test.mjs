import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(file, 'utf8');

  assert.match(
    source,
    /const legacyPrompt = normalizeAutoresponderText\('Voce esta atras de celular novo\? Quer que eu mande a lista do que temos\? Ou deseja alguma outra coisa\?'\);/,
    `${file} must recognize the old ambiguous needs prompt`
  );
  assert.match(
    source,
    /if \(customPrompt && normalizedCustomPrompt !== legacyPrompt\) return \{ text: customPrompt, aiMeta: null \};/,
    `${file} must ignore the old ambiguous custom prompt and use the single-question fallback`
  );
}

console.log('autoresponder needs prompt legacy settings static checks passed');
