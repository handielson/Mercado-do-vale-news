import assert from 'node:assert/strict';
import fs from 'node:fs';

const cjs = fs.readFileSync('vps_server.cjs', 'utf8');
const js = fs.readFileSync('vps_server.js', 'utf8');
const patch = fs.readFileSync('tmp-tests/n8n-fix-model-facts-source.cjs', 'utf8');

assert.equal(cjs, js, 'vps_server.cjs and vps_server.js must stay identical');
for (const source of [cjs, js]) {
  assert.match(source, /include_model_specs === 'true'/);
  assert.match(source, /SELECT m\.template_values FROM models m WHERE m\.id = products\.model_id/);
  assert.match(source, /includeModelSpecs \? \{ model_template_values: parsePublicJson/);
}
assert.match(patch, /sales-model-template-facts-source-v2/);
assert.match(patch, /Object\.keys\(modelSpecsV2\)\.length > 0 \? modelSpecsV2 : variationSpecsV2/);
assert.match(patch, /include_model_specs/);
assert.match(patch, /variationConflictSuppressed: true/);

console.log('n8n model facts source static checks passed');
