import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('Pexels selection requires review and applies an approved photo to the current artwork', async () => {
  const source = await readFile(new URL('../pages/admin/settings/marketing/MarketingScenePanel.tsx', import.meta.url), 'utf8');

  assert.match(source, /disabled=\{!selected\.length \|\| !reviewed\}/);
  assert.match(source, /marketingScenes\.import\(selected, true\)/);
  assert.match(source, /await choose\(approved\[0\], productId\)/);
  assert.match(source, /Cenário aprovado e aplicado à prévia/);
});
