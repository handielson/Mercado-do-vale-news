import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const modalSource = readFileSync('components/settings/ModelModal.tsx', 'utf8');
const importSource = readFileSync('components/settings/modelJsonImport.js', 'utf8');

assert.match(
    importSource,
    /MODEL_UNIT_FIELD_KEYS = new Set\(\['imei1', 'imei2', 'serial', 'color', 'ram', 'sku', 'storage'\]\)/,
    'ram, sku and storage must be treated as unit-level fields, not model template fields'
);

assert.match(
    modalSource,
    /\.filter\(field => !isModelUnitFieldKey\(field\.key\) && !isModelUnitFieldKey\(field\.label\)\)/,
    'model editor visible spec fields must hide unit-level fields'
);

assert.match(
    modalSource,
    /!isHiddenSpecKey\(key\) && !isModelUnitFieldKey\(key\)/,
    'model saves must sanitize unit-level template values'
);

assert.doesNotMatch(
    modalSource,
    /placeholder='[^']*"(?:ram|storage|sku)"[^']*'/,
    'JSON/IA placeholder must not suggest unit-level fields'
);

assert.match(modalSource, /'ram'/);
assert.match(modalSource, /'sku'/);
assert.match(modalSource, /'storage'/);

console.log('model-modal-unit-fields-static regression passed');
