const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { auditPrint3dPilot } = require('../scripts/audit-print3d-pilot.cjs');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mdv-print3d-pilot-'));
const sourceRoot = path.join(directory, 'source');
fs.mkdirSync(sourceRoot);
const assetPath = path.join(sourceRoot, 'pilot.stl');
fs.writeFileSync(assetPath, 'modelo-piloto');
const sha256 = crypto.createHash('sha256').update('modelo-piloto').digest('hex');
const manifestPath = path.join(directory, 'manifest.json');

fs.writeFileSync(manifestPath, JSON.stringify({
  pilot_id: 'pilot-test',
  product_draft: {
    name: 'Produto piloto', sku: 'PILOT-001', sku_source: 'central_system', is_print3d: true,
    category: { id: 'category-1' }, price_source: null, storefront_price_cents: null,
    ready_stock_quantity: null, preorder_enabled: null, production_days: 3,
    preorder_limit: 10, print_file_required_before_publish: false,
  },
  recipe_revision: { print_summary: null, filaments: [], printer_profile: null },
  files: [{ name: 'pilot.stl', byte_size: 13, sha256 }],
}, null, 2));

const pending = auditPrint3dPilot({ manifestPath, sourceRoot });
assert.equal(pending.integrity_ok, true);
assert.equal(pending.catalog_draft_ready, true);
assert.equal(pending.commercial_ready, false);
assert.equal(pending.production_ready, false);
assert.equal(pending.activation_ready, false);
assert.deepEqual(pending.missing.catalog_draft, []);
assert.match(pending.missing.commercial.join(' '), /preço/);
assert.match(pending.missing.production.join(' '), /material total/);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.product_draft.price_source = 'system_editable';
manifest.product_draft.ready_stock_quantity = 11;
manifest.product_draft.preorder_enabled = true;
manifest.product_draft.production_days = null;
manifest.product_draft.preorder_limit = null;
manifest.product_draft.print_file_required_before_publish = true;
manifest.recipe_revision.print_summary = { material_gramas: 220, tempo_impressao_minutos: 360, confirmed: false };
manifest.recipe_revision.filaments = [{ material: 'PETG', color: 'preto', grams: 220, confirmed: false }];
manifest.recipe_revision.printer_profile = { printer: 'Bambu Lab A1', profile: '0.20mm Standard', confirmed: false };
fs.writeFileSync(manifestPath, JSON.stringify(manifest));

const unconfirmed = auditPrint3dPilot({ manifestPath, sourceRoot });
assert.equal(unconfirmed.production_ready, false);
assert.match(unconfirmed.missing.production.join(' '), /confirmação dos totais/);
assert.match(unconfirmed.missing.production.join(' '), /confirmação dos filamentos/);
assert.match(unconfirmed.missing.production.join(' '), /confirmação da impressora/);

manifest.recipe_revision.print_summary.confirmed = true;
manifest.recipe_revision.filaments[0].confirmed = true;
manifest.recipe_revision.printer_profile.confirmed = true;
fs.writeFileSync(manifestPath, JSON.stringify(manifest));

const ready = auditPrint3dPilot({ manifestPath, sourceRoot });
assert.equal(ready.activation_ready, true);

manifest.product_draft.is_parent = true;
manifest.product_draft.preorder_enabled = false;
fs.writeFileSync(manifestPath, JSON.stringify(manifest));
const parentReady = auditPrint3dPilot({ manifestPath, sourceRoot });
assert.equal(parentReady.commercial_ready, true);

manifest.product_draft.preorder_enabled = true;
fs.writeFileSync(manifestPath, JSON.stringify(manifest));
const parentWithPreorder = auditPrint3dPilot({ manifestPath, sourceRoot });
assert.equal(parentWithPreorder.commercial_ready, false);
assert.match(parentWithPreorder.missing.commercial.join(' '), /produto pai/);

manifest.product_draft.is_parent = false;
manifest.product_draft.preorder_enabled = true;
fs.writeFileSync(manifestPath, JSON.stringify(manifest));

fs.writeFileSync(assetPath, 'arquivo-alterado');
const changed = auditPrint3dPilot({ manifestPath, sourceRoot });
assert.equal(changed.integrity_ok, false);
assert.equal(changed.activation_ready, false);

assert.throws(() => {
  manifest.files[0].name = '../fora.stl';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  auditPrint3dPilot({ manifestPath, sourceRoot });
}, /Nome de arquivo inválido/);

fs.rmSync(directory, { recursive: true, force: true });
console.log('print3d pilot manifest: OK');
