// Fecha a leitura de aparelhos (units) para quem não é administrador.
// Antes: GET /units e GET /units/by-identifier/:q respondiam sem login (IMEI, custo, status),
// e o /vps-proxy do site acrescentava a chave interna nessas leituras para qualquer visitante.
// Depois: a rota exige chave interna ou login de administrador, e o proxy trata /units como sensível.
const { deployProductReadPrivacy } = require('./deploy-product-read-privacy.cjs');

const ENTRIES = ['server.js', 'vps_server.js', 'vps_server.cjs'];
const ROUTES = [
  ["fastify.get('/units', async (req, reply) => {", "fastify.get('/units', { preHandler: requireSyncKeyOrAdmin }, async (req, reply) => {"],
  ["fastify.get('/units/by-identifier/:q', async (req, reply) => {", "fastify.get('/units/by-identifier/:q', { preHandler: requireSyncKeyOrAdmin }, async (req, reply) => {"],
];
const PROXY_OLD = "function isVpsProxySensitiveGetPath(proxyPath) {\n  return (\n    proxyPath.startsWith('/company-settings') ||";
const PROXY_NEW = "function isVpsProxySensitiveGetPath(proxyPath) {\n  return (\n    proxyPath.startsWith('/units') ||\n    proxyPath.startsWith('/company-settings') ||";

function patchUnitReadPrivacy(source) {
  let updated = String(source).replace(/\r\n/g, '\n');
  if (!/async function requireSyncKeyOrAdmin\(/.test(updated)) throw new Error('requireSyncKeyOrAdmin ausente');
  for (const [before, after] of ROUTES) {
    if (updated.includes(after)) continue;
    if (updated.split(before).length !== 2) throw new Error(`Âncora da rota ausente ou repetida: ${before.slice(0, 50)}`);
    updated = updated.replace(before, after);
  }
  if (!updated.includes(PROXY_NEW)) {
    if (updated.split(PROXY_OLD).length !== 2) throw new Error('Âncora do proxy ausente ou repetida');
    updated = updated.replace(PROXY_OLD, PROXY_NEW);
  }
  return String(source).includes('\r\n') ? updated.replace(/\n/g, '\r\n') : updated;
}

async function deployUnitReadPrivacy(options) {
  return deployProductReadPrivacy({
    ...options,
    files: ENTRIES,
    patchFile: original => patchUnitReadPrivacy(original),
    backupPrefix: 'unit-read-privacy',
  });
}

module.exports = { patchUnitReadPrivacy, deployUnitReadPrivacy };
