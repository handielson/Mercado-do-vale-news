const fs = require('node:fs');
const path = require('node:path');
const { deployProductReadPrivacy } = require('./deploy-product-read-privacy.cjs');
const ENTRIES = ['server.js', 'vps_server.js', 'vps_server.cjs'];
const MODULE = 'services/print3dMaterialsServer.cjs';
const HOOK = "require('./services/print3dMaterialsServer.cjs').registerPrint3dMaterialRoutes(fastify, { pool, requireAdminBearerToken });";
const ANCHOR = "fastify.get('/admin/preferences/:key', { preHandler: requireSyncKeyOrAdmin }, async (req, reply) => {";
function patchEntry(source) {
  let value = source.replace(/\r\n/g, '\n');
  if (value.includes(HOOK)) {
    if (value.split(HOOK).length !== 2) throw new Error('Duplicate materials hook');
    return source;
  }
  if (value.includes('registerPrint3dMaterialRoutes') || value.split(ANCHOR).length !== 2) {
    throw new Error('Unexpected materials hook or preferences anchor');
  }
  value = value.replace(ANCHOR, HOOK + '\n\n' + ANCHOR);
  return source.includes('\r\n') ? value.replace(/\n/g, '\r\n') : value;
}
async function deployPrint3dMaterials(options) {
  const moduleSource = fs.readFileSync(path.join(options.root, MODULE), 'utf8');
  await deployProductReadPrivacy({ ...options, files: [MODULE, ...ENTRIES], backupPrefix: 'print3d-materials',
    patchFile(source, file) {
      if (file !== MODULE) return patchEntry(source);
      if (source && source.replace(/\r\n/g, '\n') !== moduleSource.replace(/\r\n/g, '\n')) {
        throw new Error('Remote materials module differs; refusing overwrite');
      }
      return moduleSource;
    },
  });
}
module.exports = { patchEntry, deployPrint3dMaterials };
