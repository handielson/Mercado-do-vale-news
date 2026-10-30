'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const {patchWorkflow: patchMultibrand} = require('./n8n-meta-multibrand-promos.cjs');
const {patchWorkflow: patchCatalogIntent} = require('./n8n-meta-catalog-intent-parity.cjs');
const {patchWorkflow: patchSales} = require('./n8n-meta-sales-parity.cjs');

function patchWorkflow(workflow) {
  return patchSales(patchCatalogIntent(patchMultibrand(workflow)));
}

module.exports = {patchWorkflow};

if (require.main === module) {
  const [sourcePath, destinationPath] = process.argv.slice(2);
  assert.ok(sourcePath && destinationPath, 'Usage: node scripts/build-n8n-meta-parity.cjs source.private.json .local/candidate.private.json');
  assert.ok(destinationPath.replace(/\\/g, '/').includes('/.local/'), 'Candidate must stay in .local');
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  fs.writeFileSync(destinationPath, JSON.stringify(patchWorkflow(source), null, 2), {flag:'wx', mode:0o600});
  console.log('Candidate written to ' + destinationPath);
}
