// Fecha a leitura de aparelhos (units) para quem não é administrador.
// Antes: GET /units e GET /units/by-identifier/:q respondiam sem login (IMEI, custo, status),
// e o /vps-proxy do site acrescentava a chave interna nessas leituras para qualquer visitante.
// Depois: a rota exige chave interna ou login de administrador, e o proxy trata /units e /smartphone-* como sensíveis
// (o pré-cadastro por foto também respondia sem login pelo proxy) e os preços/custos por modelo.
const { deployProductReadPrivacy } = require('./deploy-product-read-privacy.cjs');

const ENTRIES = ['server.js', 'vps_server.js', 'vps_server.cjs'];
const ROUTES = [
  ["fastify.get('/units', async (req, reply) => {", "fastify.get('/units', { preHandler: requireSyncKeyOrAdmin }, async (req, reply) => {"],
  ["fastify.get('/units/by-identifier/:q', async (req, reply) => {", "fastify.get('/units/by-identifier/:q', { preHandler: requireSyncKeyOrAdmin }, async (req, reply) => {"],
];
const PROXY_OLD = "function isVpsProxySensitiveGetPath(proxyPath) {\n  return (\n    proxyPath.startsWith('/company-settings') ||";
const PROXY_NEW = "function isVpsProxySensitiveGetPath(proxyPath) {\n  return (\n    proxyPath.startsWith('/units') ||\n    proxyPath.startsWith('/company-settings') ||";
// Pré-cadastro por foto (IMEIs, fotos, custos), margens e cores mapeadas: também só para administrador pelo proxy.
const SMARTPHONE_OLD = "    proxyPath.startsWith('/units') ||\n";
const SMARTPHONE_NEW = "    proxyPath.startsWith('/units') ||\n    proxyPath.startsWith('/smartphone-') ||\n";
// Preços e custos por modelo (página de Modelos): só para administrador pelo proxy.
const MODEL_PRICES_OLD = "    proxyPath.startsWith('/smartphone-') ||\n";
const MODEL_PRICES_NEW = "    proxyPath.startsWith('/smartphone-') ||\n    proxyPath.startsWith('/models/price-summary') ||\n    /^\\/models\\/[^/?]+\\/smartphone-price-/.test(proxyPath) ||\n";

function patchUnitReadPrivacy(source) {
  let updated = String(source).replace(/\r\n/g, '\n');
  if (!/async function requireSyncKeyOrAdmin\(/.test(updated)) throw new Error('requireSyncKeyOrAdmin ausente');
  for (const [before, after] of ROUTES) {
    if (updated.includes(after)) continue;
    if (updated.split(before).length !== 2) throw new Error(`Âncora da rota ausente ou repetida: ${before.slice(0, 50)}`);
    updated = updated.replace(before, after);
  }
  if (!updated.includes(PROXY_NEW) && !updated.includes(SMARTPHONE_OLD)) {
    if (updated.split(PROXY_OLD).length !== 2) throw new Error('Âncora do proxy ausente ou repetida');
    updated = updated.replace(PROXY_OLD, PROXY_NEW);
  }
  if (!updated.includes(SMARTPHONE_NEW)) {
    if (updated.split(SMARTPHONE_OLD).length !== 2) throw new Error('Âncora /units do proxy ausente ou repetida');
    updated = updated.replace(SMARTPHONE_OLD, SMARTPHONE_NEW);
  }
  if (!updated.includes(MODEL_PRICES_NEW)) {
    if (updated.split(MODEL_PRICES_OLD).length !== 2) throw new Error('Âncora /smartphone- do proxy ausente ou repetida');
    updated = updated.replace(MODEL_PRICES_OLD, MODEL_PRICES_NEW);
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
