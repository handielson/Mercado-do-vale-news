// pdp-internal-specs-hidden-v1: a página do cliente não mostra controles internos do produto.
// Caso real (06/11): Xiaomi Pad 6 mostrava UNIT, PRODUCTION, MERCADO LIVRE [object Object],
// SHOPEE AUTO PUBLISH ENABLED e PRICE GROUP NETWORK em "Outras Características".
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isInternalSpecKey, isPublicSpecValue } from '../pages/store/publicSpecVisibility.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('chaves do print do Pad 6 são internas', () => {
  // Chaves exatas do specs do Pad 6 em produção (06/11): o grupo de preço é salvo como _price_group_network.
  for (const key of ['unit', 'production', 'mercado_livre', 'shopee_auto_publish_enabled', '_price_group_network', 'price_group_network', '_bling_name_sync']) {
    assert.equal(isInternalSpecKey(key), true, key);
  }
});

test('integrações e grupo de preço são internos por prefixo, em qualquer grafia', () => {
  for (const key of ['shopee_category_id', 'Mercado Livre Item', 'ml_listing_id', 'bling_id', 'tiktok_product_id', 'price_group_storage', 'PRICE_GROUP_NETWORK']) {
    assert.equal(isInternalSpecKey(key), true, key);
  }
});

test('specs real do Pad 6: sobra só a ficha técnica', () => {
  const specKeys = ['ram', 'slug', 'unit', 'color', 'versao', 'storage', 'version', 'keywords', 'meta_title', 'production', 'mercado_livre',
    'battery_health', '_bling_name_sync', 'meta_description', 'shopee_auto_publish_enabled', '_price_group_network', 'gpu', 'nfc', 'antutu',
    'peso_g', 'chipset', 'display', 'battery_mah', 'processador', 'resistencia', 'carregamento', 'tipo_de_tela', 'cam_selfie_mpx',
    'rede_operadora', 'tipo_de_display', 'cam_principal_mpx', 'celular_biometria', 'celular_fps_display', 'entrada_fone_de_ouvido',
    'celular_slot_para_cartao', 'celular_tipo_de_protecao_de_tela'];
  const internal = specKeys.filter(isInternalSpecKey);
  assert.deepEqual(internal, ['unit', 'production', 'mercado_livre', '_bling_name_sync', 'shopee_auto_publish_enabled', '_price_group_network']);
});

test('ficha técnica de verdade continua pública', () => {
  for (const key of ['ram', 'storage', 'color', 'celular_biometria', 'resistencia', 'peso_g', 'battery_mah', 'shopee_attribute_100123', 'celular_rede_operadora']) {
    assert.equal(isInternalSpecKey(key), false, key);
  }
});

test('objeto nunca vira "[object Object]"; true/false soltos ficam fora', () => {
  assert.equal(isPublicSpecValue({ item_id: 'MLB1' }), false);
  assert.equal(isPublicSpecValue('[object Object]'), false);
  assert.equal(isPublicSpecValue(false), false);
  assert.equal(isPublicSpecValue('false'), false);
  assert.equal(isPublicSpecValue(true), false);
  assert.equal(isPublicSpecValue('Não'), true);
  assert.equal(isPublicSpecValue('Tipo C'), true);
  assert.equal(isPublicSpecValue(490), true);
});

test('campo do template da categoria pode ser sim/não', () => {
  assert.equal(isPublicSpecValue(true, { fromTemplate: true }), true);
  assert.equal(isPublicSpecValue({ a: 1 }, { fromTemplate: true }), false);
});

test('a página do produto usa a regra antes de montar a ficha', () => {
  const page = fs.readFileSync(path.join(root, 'pages/store/PublicProductPage.tsx'), 'utf8');
  assert.match(page, /import \{ isInternalSpecKey, isPublicSpecValue \} from '\.\/publicSpecVisibility\.js';/);
  assert.match(page, /if \(isInternalSpecKey\(key\) \|\| !isPublicSpecValue\(value, \{ fromTemplate \}\)\) return;/);
  assert.match(page, /tryAddItem\(key, label, publicSpecs\[key\], true\);/, 'campos do template marcam fromTemplate');
});
