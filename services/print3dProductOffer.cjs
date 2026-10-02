'use strict';

const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const invalid = (message) => Object.assign(new Error(message), { statusCode: 400 });
const optionalNumber = value => value == null || typeof value === 'string' && value.trim() === '' ? null : Number(value);

function normalizeFlag(value, field) {
  if (value === undefined || value === null) return null;
  if (value === true || value === 1) return 1;
  if (value === false || value === 0) return 0;
  throw invalid(`${field} deve ser verdadeiro ou falso.`);
}

function normalizePrint3dProductOffer(input) {
  const body = input || {};
  const isPrint3d = normalizeFlag(body.is_print3d, 'Produto 3D');
  const preorderEnabled = normalizeFlag(body.print3d_preorder_enabled, 'Aceitar encomendas');
  const isParent = body.is_parent === true || body.is_parent === 1;
  const limit = optionalNumber(body.print3d_preorder_limit);
  const days = optionalNumber(body.production_days);
  if (has(body, 'print3d_preorder_limit') && limit !== null && (!Number.isSafeInteger(limit) || limit < 1 || limit > 10000)) {
    throw invalid('O limite sob encomenda deve ficar entre 1 e 10000 unidades.');
  }
  if (has(body, 'production_days') && days !== null && (!Number.isSafeInteger(days) || days < 0 || days > 365)) {
    throw invalid('O prazo de produção deve ficar entre 0 e 365 dias úteis.');
  }
  if (isPrint3d === 1) {
    if (isParent) {
      body.print3d_preorder_enabled = false;
      body.print3d_preorder_limit = null;
      body.production_days = null;
      return { isPrint3d: 1, preorderEnabled: 0, limit: null, days: null };
    }
    if (body.track_inventory !== true && body.track_inventory !== 1) throw invalid('Mantenha o controle de estoque ativo para encomendas 3D.');
    if (body.is_virtual === true || body.is_virtual === 1) {
      throw invalid('Encomenda 3D exige uma variante física vendável.');
    }
    body.print3d_preorder_enabled = true;
    body.print3d_preorder_limit = null;
    body.production_days = null;
    return { isPrint3d: 1, preorderEnabled: 1, limit: null, days: null };
  }
  if (preorderEnabled === 1) {
    throw invalid('Marque o produto como impressão 3D antes de aceitar encomendas.');
  }
  return { isPrint3d, preorderEnabled, limit, days };
}

function applyPrint3dProductPolicy(input) {
  normalizePrint3dProductOffer(input);
  return input;
}

module.exports = { normalizePrint3dProductOffer, applyPrint3dProductPolicy };
