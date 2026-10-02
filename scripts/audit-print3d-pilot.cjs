const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function requireSafeFileName(name) {
  const normalized = String(name || '').trim();
  if (!normalized || normalized !== path.basename(normalized)) {
    throw new Error(`Nome de arquivo inválido no manifesto: ${name}`);
  }
  return normalized;
}

function auditPrint3dPilot({ manifestPath, sourceRoot }) {
  const resolvedManifest = path.resolve(manifestPath);
  const manifest = JSON.parse(fs.readFileSync(resolvedManifest, 'utf8'));
  const resolvedSourceRoot = path.resolve(sourceRoot);
  const files = Array.isArray(manifest.files) ? manifest.files : [];

  const fileResults = files.map((entry) => {
    const name = requireSafeFileName(entry.name);
    const filePath = path.join(resolvedSourceRoot, name);
    const exists = fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    const actualBytes = exists ? fs.statSync(filePath).size : null;
    const actualSha256 = exists ? sha256File(filePath) : null;
    return {
      name,
      exists,
      size_matches: exists && Number(entry.byte_size) === actualBytes,
      sha256_matches: exists && String(entry.sha256 || '').toLowerCase() === actualSha256,
      expected_bytes: Number(entry.byte_size),
      actual_bytes: actualBytes,
    };
  });

  const product = manifest.product_draft || {};
  const recipe = manifest.recipe_revision || {};
  const catalogDraftMissing = [];
  if (!String(product.name || '').trim()) catalogDraftMissing.push('nome');
  if (!String(product.sku || '').trim()) catalogDraftMissing.push('sku');
  if (product.sku_source !== 'central_system') catalogDraftMissing.push('sku originado no cadastro central');
  if (!String(product.category?.id || '').trim()) catalogDraftMissing.push('categoria');
  if (product.is_print3d !== true) catalogDraftMissing.push('marca de impressão 3D');
  const catalogVariants = Array.isArray(manifest.catalog_audit?.variants) ? manifest.catalog_audit.variants : [];
  if (product.is_parent === true && catalogVariants.length === 0) catalogDraftMissing.push('variantes vendáveis do cadastro central');
  if (catalogVariants.some(variant => !String(variant?.sku || '').trim() || !String(variant?.product_id || '').trim())) {
    catalogDraftMissing.push('SKU e ID central de todas as variantes');
  }

  const commercialMissing = [];
  if (product.price_source !== 'system_editable') commercialMissing.push('preço herdado do sistema com edição por oferta');
  if (!Number.isInteger(product.ready_stock_quantity) || product.ready_stock_quantity < 0) commercialMissing.push('quantidade pronta');
  if (product.is_parent === true) {
    if (product.preorder_enabled !== false) commercialMissing.push('produto pai sem encomenda direta');
  } else if (product.preorder_enabled !== true) commercialMissing.push('encomendas sempre habilitadas');
  if (product.production_days !== null) commercialMissing.push('prazo a combinar');
  if (product.preorder_limit !== null) commercialMissing.push('encomenda sem limite');
  if (product.print_file_required_before_publish !== true) commercialMissing.push('arquivo de impressão obrigatório antes da publicação');

  const productionMissing = [];
  if (!Number.isFinite(recipe.print_summary?.material_gramas) || recipe.print_summary.material_gramas <= 0) productionMissing.push('material total do lote');
  if (!Number.isFinite(recipe.print_summary?.tempo_impressao_minutos) || recipe.print_summary.tempo_impressao_minutos <= 0) productionMissing.push('tempo total do lote');
  if (recipe.print_summary && recipe.print_summary.confirmed !== true) productionMissing.push('confirmação dos totais calculados');
  if (!Array.isArray(recipe.filaments) || recipe.filaments.length === 0) productionMissing.push('filamentos');
  else if (recipe.filaments.some((filament) => filament?.confirmed !== true)) productionMissing.push('confirmação dos filamentos');
  if (!recipe.printer_profile) productionMissing.push('impressora e perfil');
  else if (recipe.printer_profile.confirmed !== true) productionMissing.push('confirmação da impressora e do perfil');

  const integrityOk = fileResults.length > 0 && fileResults.every((entry) => entry.exists && entry.size_matches && entry.sha256_matches);
  return {
    pilot_id: manifest.pilot_id || null,
    manifest: resolvedManifest,
    source_root: resolvedSourceRoot,
    integrity_ok: integrityOk,
    catalog_draft_ready: catalogDraftMissing.length === 0,
    commercial_ready: commercialMissing.length === 0,
    production_ready: productionMissing.length === 0 && integrityOk,
    activation_ready: catalogDraftMissing.length === 0 && commercialMissing.length === 0 && productionMissing.length === 0 && integrityOk,
    missing: {
      catalog_draft: catalogDraftMissing,
      commercial: commercialMissing,
      production: productionMissing,
    },
    files: fileResults,
  };
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--manifest' || key === '--source-root') values[key.slice(2)] = argv[index += 1];
  }
  if (!values.manifest || !values['source-root']) {
    throw new Error('Uso: node scripts/audit-print3d-pilot.cjs --manifest <manifest.json> --source-root <pasta dos arquivos>');
  }
  return { manifestPath: values.manifest, sourceRoot: values['source-root'] };
}

if (require.main === module) {
  try {
    const result = auditPrint3dPilot(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.integrity_ok) process.exitCode = 2;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = { auditPrint3dPilot };
