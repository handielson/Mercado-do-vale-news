import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    buildSharedColorLines,
    normalizeSharedColors,
    stripSharedProductColorVariation,
} from '../utils/sharedMessageFormatting.js';

assert.equal(
    stripSharedProductColorVariation('Capa Case de Silicone Para Redmi 13C Cor:Amarelo', 'Amarelo'),
    'Capa Case de Silicone Para Redmi 13C',
    'the color variation must be removed from the shared product name',
);

assert.equal(
    stripSharedProductColorVariation('Capa Case de Silicone Para Redmi 13C - Amarelo', 'Amarelo'),
    'Capa Case de Silicone Para Redmi 13C',
    'a plain color suffix must also be removed when the structured color confirms it',
);

assert.deepEqual(
    normalizeSharedColors(['Amarelo', 'Azul Escuro', 'CIANO ESCURO', 'Lilás', 'Preto', 'PRETO', 'Verde Escuro']),
    ['Amarelo', 'Azul escuro', 'Ciano escuro', 'Lilás', 'Preto', 'Verde escuro'],
    'colors must use sentence case and remove duplicates',
);

assert.deepEqual(
    buildSharedColorLines(['Amarelo', 'Azul Escuro', 'CIANO ESCURO']),
    ['', '   🎨 Cores:', '   1. Amarelo', '   2. Azul escuro', '   3. Ciano escuro', ''],
    'colors must have blank lines before and after the numbered list',
);

const cartShareSource = readFileSync('utils/cartShareUtils.ts', 'utf8');
const catalogShareSource = readFileSync('utils/catalogMessageGenerator.ts', 'utf8');

for (const [name, source] of [
    ['cart budget', cartShareSource],
    ['catalog copy', catalogShareSource],
]) {
    assert.match(source, /stripSharedProductColorVariation/, `${name} must clean the product name`);
}

assert.match(catalogShareSource, /buildSharedColorLines/, 'catalog copy must print one color per numbered line');
assert.match(
    cartShareSource,
    /🎨 Cores: \$\{colors\.length > 0 \? colors\.join\(', '\) : 'Consultar'\}/,
    'site budget cards must keep colors on the compact n8n-style line',
);

console.log('shared budget message format checks passed');
