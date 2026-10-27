'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ENTRIES = ['server.js', 'vps_server.js', 'vps_server.cjs'];
const MODULE = 'services/metaCatalogFeedServer.cjs';
const ANCHOR = "require('./services/legacyCatalogSeo.cjs').registerLegacyCatalogSeo(fastify, { pool });";
const HOOK = "require('./services/metaCatalogFeedServer.cjs').registerMetaCatalogFeed(fastify, { pool, comboStockSql, attachCatalogModelColorImages });";
function patch(source) {
  if (source.includes(HOOK)) return source;
  if (source.includes('registerMetaCatalogFeed') || source.split(ANCHOR).length !== 2
    || !source.includes('function comboStockSql(') || !source.includes('function attachCatalogModelColorImages(')) {
    throw new Error('Meta feed runtime anchors differ; deployment stopped.');
  }
  return source.replace(ANCHOR, ANCHOR + (source.includes('\r\n') ? '\r\n' : '\n') + HOOK);
}
async function deployMetaCatalogFeed(options) {
  if (!ENTRIES.some(file => options.apiProc.pm2_env?.pm_exec_path === options.appDir + '/' + file)) {
    throw new Error('Expected the current VPS runtime; deployment stopped.');
  }
  const moduleSource = fs.readFileSync(path.join(options.root, MODULE), 'utf8');
  await require('./deploy-product-read-privacy.cjs').deployProductReadPrivacy({
    ...options, files: [MODULE, ...ENTRIES], backupPrefix: 'meta-catalog-feed',
    patchFile: (source, file) => file === MODULE ? moduleSource : patch(source),
  });
}
module.exports = { patch, deployMetaCatalogFeed };
