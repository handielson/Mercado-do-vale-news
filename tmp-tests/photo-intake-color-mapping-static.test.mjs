import assert from 'node:assert/strict';
import fs from 'node:fs';

// Mapeamento de cor do cadastro por foto.
const server = fs.readFileSync(new URL('../services/smartphonePhotoIntakeServer.cjs', import.meta.url), 'utf8');
const card = fs.readFileSync(new URL('../components/products/photo-intake/PhotoIntakeReviewCard.tsx', import.meta.url), 'utf8');

assert.match(server, /const originalColor = String\(extracted\.color_original \|\| ''\)\.trim\(\);[\s\S]*const aliases = \[\.\.\.new Set\(\(originalColor \? \[originalColor\] : \[fallbackColor\]\)/, 'mapeamento gravado pela cor como veio da etiqueta (não pelo nome traduzido)');
assert.match(server, /await applyColorMappingToPendingIntakes\(intake, aliases, colorRows\[0\]\);/, 'mapeamento novo vale para a fila toda');
assert.match(server, /async function applyColorMappingToPendingIntakes[\s\S]*company_id <=> \? AND matched_color_id IS NULL[\s\S]*WHERE id=\? AND matched_color_id IS NULL/, 'só preenche aparelhos da mesma empresa ainda sem cor, sem sobrescrever escolha');
assert.match(card, /mergePhotoIntakeDraft\(/, 'retorno do servidor não apaga o que está na tela e não foi salvo');
assert.match(card, /guessCatalogColor\(colors, readColor\)/, 'cor vem sugerida pela palavra de cor da etiqueta');
assert.match(card, /intake\.matched_color_id \? null : guessCatalogColor/, 'cor já escolhida/mapeada não é trocada pela sugestão');

console.log('photo intake color mapping static test passed');
