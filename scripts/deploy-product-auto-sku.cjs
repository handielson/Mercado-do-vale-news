'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { deployProductReadPrivacy } = require('./deploy-product-read-privacy.cjs');
const MODULE = 'services/productSku.cjs';
const START = "fastify.post('/products/batch',";
const OLD = '      await withSmartphonePriceWrite(pool, p, async (priceDb, controlledProduct) => {';
const HOOK = "      await require('./services/productSku.cjs').withProductSku(pool, p, async (skuDb) => {";
const NEW = HOOK + '\n      await withSmartphonePriceWrite(skuDb, p, async (priceDb, controlledProduct) => {';
const END = '      }, { transactional: true });\n      results.upserted++;';
const NEW_END = '      }, { transactional: true });\n      });\n      results.upserted++;';
function patchEntry(source) {
  const normalized = source.replace(/\r\n/g, '\n');
  const start = normalized.indexOf(START);
  const end = normalized.indexOf('\n  return results;\n});', start);
  if (start < 0 || end < 0 || normalized.split(START).length !== 2) throw new Error('Unexpected product batch route');
  const block = normalized.slice(start, end);
  if (block.includes(HOOK)) {
    if (block.split(NEW).length !== 2 || block.split(NEW_END).length !== 2 || block.includes(OLD)) throw new Error('Unexpected existing SKU hook');
    return source;
  }
  if (block.includes('withProductSku') || block.split(OLD).length !== 2 || block.split(END).length !== 2) throw new Error('Unexpected product batch write anchors');
  const updated = normalized.slice(0, start) + block.replace(OLD, NEW).replace(END, NEW_END) + normalized.slice(end);
  return source.includes('\r\n') ? updated.replace(/\n/g, '\r\n') : updated;
}
async function deployProductAutoSku(options) {
  const moduleSource = fs.readFileSync(path.join(options.root, MODULE), 'utf8');
  await deployProductReadPrivacy({ ...options, files: [MODULE, 'server.js', 'vps_server.js', 'vps_server.cjs'], backupPrefix: 'product-auto-sku',
    patchFile(source, file) {
      if (file !== MODULE) return patchEntry(source);
      if (source && source.replace(/\r\n/g, '\n') !== moduleSource.replace(/\r\n/g, '\n')) throw new Error('Remote SKU module differs; refusing overwrite');
      return moduleSource;
    },
  });
}
module.exports = { patchEntry, deployProductAutoSku };
