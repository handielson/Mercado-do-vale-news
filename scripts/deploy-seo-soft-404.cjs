'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const BASELINE = '2dd2059b';
const ENTRIES = ['server.js', 'vps_server.js', 'vps_server.cjs'];
const MODULE = 'services/legacyCatalogSeo.cjs';
const ANCHOR = "fastify.get('/api/seo-produto',";
const HOOK = "require('./services/legacyCatalogSeo.cjs').registerLegacyCatalogSeo(fastify, { pool });\n\n";
const LEGACY = [
  "    if (String(request.query?.legacy || '') === '1') {",
  '      const routeTarget = product.seo_route_target || product.slug || slug;',
  "      return reply.header('Cache-Control', 'no-store').code(301)",
  "        .header('Location', `${baseUrl}/produto/${encodeURIComponent(routeTarget)}`).send();",
  '    }',
].join('\n');
const normalize = value => value.replace(/\r\n/g, '\n');
function patch(source) {
  let result = normalize(source);
  if (result.split(ANCHOR).length !== 2) throw new Error('SEO route anchor drift');
  if (!result.includes(HOOK)) {
    if (result.includes('registerLegacyCatalogSeo')) throw new Error('SEO hook drift');
    result = result.replace(ANCHOR, HOOK + ANCHOR);
  }
  const start = result.indexOf(ANCHOR), end = result.indexOf('\n});', start);
  if (end < 0) throw new Error('SEO route closing drift');
  const block = result.slice(start, end);
  if (!block.includes('if (!product)') || !block.includes('.code(410)')) throw new Error('Missing product removal boundary');
  if (!block.includes(LEGACY)) {
    if (block.includes('request.query?.legacy')) throw new Error('Legacy redirect drift');
    const anchor = '    const baseUrl = buildSeoBaseUrl(request);';
    if (block.split(anchor).length !== 2) throw new Error('SEO base URL anchor drift');
    result = result.slice(0, start) + block.replace(anchor, anchor + '\n' + LEGACY) + result.slice(end);
  }
  return source.includes('\r\n') ? result.replace(/\n/g, '\r\n') : result;
}
async function deploySeoSoft404(options) {
  for (const entry of ENTRIES) {
    const before = execFileSync('git', ['show', BASELINE + ':' + entry], { cwd: options.root, encoding: 'utf8', maxBuffer: 15e6 });
    const current = fs.readFileSync(path.join(options.root, entry), 'utf8');
    if (normalize(patch(before)) !== normalize(current)) throw new Error('Unaccounted entry changes: ' + entry);
  }
  const moduleSource = fs.readFileSync(path.join(options.root, MODULE), 'utf8');
  await require('./deploy-product-read-privacy.cjs').deployProductReadPrivacy({
    ...options, files: [MODULE, ...ENTRIES], backupPrefix: 'seo-soft-404',
    patchFile: (source, file) => {
      if (file !== MODULE) return patch(source);
      if (source && normalize(source) !== normalize(moduleSource)) throw new Error('Remote SEO module drift');
      return moduleSource;
    },
  });
}
module.exports = { patch, deploySeoSoft404, BASELINE };
