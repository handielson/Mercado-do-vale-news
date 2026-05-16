import assert from 'node:assert/strict';
import { buildComboStockDeductionTargets } from '../services/blingComboStock';

const fixedAndChoice = buildComboStockDeductionTargets(
    [
        { id: 'pelicula-3d', quantity: 1, component_type: 'fixed' },
        { id: 'capa-roxo', quantity: 1, component_type: 'choice_group', group_key: 'cor' },
        { id: 'capa-preto', quantity: 1, component_type: 'choice_group', group_key: 'cor' },
    ],
    2,
    [{ group_key: 'cor', quantity: 1, option: { id: 'capa-roxo' } }]
);

assert.deepEqual(fixedAndChoice, [
    { productId: 'pelicula-3d', quantity: 2 },
    { productId: 'capa-roxo', quantity: 2 },
]);

const legacyChildId = buildComboStockDeductionTargets(
    [{ child_id: 'produto-filho', quantity: 2, component_type: 'fixed' }],
    3
);

assert.deepEqual(legacyChildId, [
    { productId: 'produto-filho', quantity: 6 },
]);

const duplicateTargets = buildComboStockDeductionTargets(
    [
        { id: 'cabo-usb', quantity: 1, component_type: 'fixed' },
        { id: 'cabo-usb', quantity: 2, component_type: 'fixed' },
    ],
    2
);

assert.deepEqual(duplicateTargets, [
    { productId: 'cabo-usb', quantity: 6 },
]);

console.log('bling combo stock target tests passed');
