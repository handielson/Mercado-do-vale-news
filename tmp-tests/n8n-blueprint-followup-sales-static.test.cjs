const assert = require('node:assert/strict');
const fs = require('node:fs');

const workflowPatch = fs.readFileSync('tmp-tests/n8n-fix-blueprint-followup-sales.cjs', 'utf8');
const preferences = fs.readFileSync('services/autoresponderCatalogPreferences.cjs', 'utf8');

assert.match(workflowPatch, /blueprint-followup-sales-v1/);
assert.match(workflowPatch, /requestedDeviceModelQuery/);
assert.match(workflowPatch, /specificModelBlueprintFollowupV1/);
assert.match(workflowPatch, /products\.length === 1/);
assert.match(workflowPatch, /blueprintImageUrl/);
assert.match(workflowPatch, /suppressRepeatedCatalogV342/);
assert.match(preferences, /ficha técnica/);
assert.match(preferences, /Algum modelo fez sentido para você/);
assert.match(preferences, /fechar a compra/);

console.log('n8n blueprint follow-up sales static checks passed');
