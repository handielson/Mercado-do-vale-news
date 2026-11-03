import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const modal = readFileSync('components/settings/ModelModal.tsx', 'utf8');
// Bug 03/11/2026: escolher "Versão" no modelo e salvar voltava vazio (template_values sem versao).
assert.match(modal, /model-versao-save-v1/);
assert.match(modal, /const visibleSpecAliases = new Set\(visibleSpecFields\.flatMap/, 'aliases dos campos visiveis');
assert.match(modal, /\.filter\(alias => !visibleSpecAliases\.has\(normalizeFieldAlias\(alias\)\)\)/, 'alias de campo visivel nao e removido no salvar');
console.log('model versao save static checks passed');
