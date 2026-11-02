import assert from 'node:assert/strict';
import fs from 'node:fs';

// Lista de produtos (parte 5): o card só consulta o que está na tela.
const card = fs.readFileSync(new URL('../components/products/ProductCard.tsx', import.meta.url), 'utf8');
const label = fs.readFileSync(new URL('../components/products/LabelPrintModal.tsx', import.meta.url), 'utf8');

assert.match(card, /function useNearViewport\(/);
assert.match(card, /rootMargin: '150% 0px'/);
assert.match(card, /ref=\{cardRef\}/);
assert.match(card, /if \(!isNearViewport\) return;\s*setVideoInfo/, 'vídeo só perto da tela');
assert.match(card, /if \(primary\) return \{ exists: false, url: null \};/, 'rota antiga de vídeo só se a principal falhar');
assert.match(card, /if \(!isNearViewport\) return \(\) => \{ isMounted = false; \};/, 'foto reserva só perto da tela');
assert.match(card, /if \(!showDetails\) return;\s*if \(!product\.track_inventory/, 'IMEIs só com detalhes abertos');
assert.match(card, /\{showDetails && <ProductPublicationChannels/, 'canais só com detalhes abertos');
assert.match(label, /if \(!isOpen\) return;\s*let cancelled = false;\s*labelPrintTemplatesService\.get\(\)/, 'modelos de etiqueta só ao abrir');
assert.match(label, /labelPrintTemplatesService\.get\(\)[\s\S]*?\}, \[isOpen\]\);/);

console.log('product card fewer requests static test passed');
