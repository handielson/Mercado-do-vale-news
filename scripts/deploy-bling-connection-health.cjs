const fs = require('node:fs');
const path = require('node:path');
const { deployProductReadPrivacy } = require('./deploy-product-read-privacy.cjs');
const MODULE = 'services/blingConnectionHealth.cjs';
const ANCHOR = "fastify.all('/api/bling', handleBlingApiVps);";
const BLOCK = `const readBlingConnectionHealth = require('./services/blingConnectionHealth.cjs').createBlingConnectionHealth({
  getAuthHeader: () => getBlingProductDetailAuthHeaderVps({ headers: {} }),
});
fastify.get('/admin/bling/connection-status', { preHandler: requireAdminBearerToken }, async (_request, reply) => {
  reply.header('Cache-Control', 'no-store');
  return readBlingConnectionHealth();
});`;
function patchEntry(source) {
  const text = source.replace(/\r\n/g, '\n');
  if (text.includes(BLOCK)) return source;
  if (text.includes('/admin/bling/connection-status') || text.split(ANCHOR).length !== 2
    || !text.includes('async function getBlingProductDetailAuthHeaderVps(') || !text.includes('async function requireAdminBearerToken(')) throw Error('Unexpected Bling health deployment anchors');
  const updated = text.replace(ANCHOR, ANCHOR + '\n' + BLOCK);
  return source.includes('\r\n') ? updated.replace(/\n/g, '\r\n') : updated;
}
async function deployBlingConnectionHealth(options) {
  const moduleSource = fs.readFileSync(path.join(options.root, MODULE), 'utf8');
  return deployProductReadPrivacy({ ...options, files: [MODULE, 'server.js', 'vps_server.js', 'vps_server.cjs'], backupPrefix: 'bling-connection-health',
    patchFile(source, file) {
      if (file !== MODULE) return patchEntry(source);
      if (source && source.replace(/\r\n/g, '\n') !== moduleSource.replace(/\r\n/g, '\n')) throw Error('Remote Bling health module drift');
      return moduleSource;
    },
  });
}
module.exports = { deployBlingConnectionHealth, patchEntry };
