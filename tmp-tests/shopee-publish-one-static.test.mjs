import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parseCliArgs } from '../scripts/shopee-publish-one.ts';

const source = fs.readFileSync(new URL('../scripts/shopee-publish-one.ts', import.meta.url), 'utf8');

test('single publish CLI defaults to dry-run and requires one selector', () => {
  assert.deepEqual(parseCliArgs(['--sku', 'ABC']), {
    productId: '', sku: 'ABC', connectionId: '', execute: false, confirmSku: '', help: false,
  });
  assert.throws(() => parseCliArgs([]), /exatamente um seletor/i);
  assert.throws(() => parseCliArgs(['--sku', 'ABC', '--product-id', 'id']), /exatamente um seletor/i);
});

test('real publication has explicit confirmation and G-only guards', () => {
  assert.match(source, /--execute/);
  assert.match(source, /--confirm-sku/);
  assert.match(source, /nao publica na conta principal M/i);
  assert.match(source, /Seguranca contra duplicidade/i);
  assert.match(source, /NAO execute novamente/i);
});

test('successful publication verifies stock and persists a scoped link', () => {
  assert.match(source, /buildShopeeUpdateStockPayload/);
  assert.match(source, /get_item_base_info/);
  assert.match(source, /connection_id: ctx\.connectionId/);
  assert.match(source, /table-data\/shopee_products/);
});

test('single publication can clone a simple listing from the primary M account', () => {
  assert.match(source, /primaryLink/);
  assert.match(source, /get_item_base_info/);
  assert.match(source, /sourceItem\?\.attribute_list/);
  assert.match(source, /sourceItem\?\.description/);
  assert.match(source, /sourceItem\?\.dimension/);
  assert.match(source, /conta M \/ item/);
});

test('G publications set the confirmed Brazil origin attribute', () => {
  assert.match(source, /BRAZIL_ORIGIN_ATTRIBUTE/);
  assert.match(source, /attribute_id:\s*100037/);
  assert.match(source, /value_id:\s*6737/);
  assert.match(source, /original_value_name:\s*'Brasil'/);
  assert.match(source, /supportsBrazilOrigin\s*\?\s*'Brasil'/);
  assert.match(source, /validAttributeIds\.has\(BRAZIL_ORIGIN_ATTRIBUTE\.attribute_id\)/);
});

test('one-family publication preserves variation identity and verifies exact stock', () => {
  assert.match(source, /get_model_list/);
  assert.match(source, /init_tier_variation/);
  assert.match(source, /update_model/);
  assert.match(source, /matchShopeeModelsBySku/);
  assert.match(source, /modelAvailableStock\(remoteModel\) !== expectedStock/);
  assert.match(source, /shopee_model_id: model\?\.model_id/);
  assert.match(source, /Informe o SKU pai da familia/);
});

test('video is discovered from Synology, uploaded and confirmed after publication', () => {
  assert.match(source, /synology_video_base_url/);
  assert.match(source, /publicUrlExists/);
  assert.match(source, /action=upload_video/);
  assert.match(source, /video_upload_id/);
  assert.match(source, /waitForSavedVideo/);
  assert.match(source, /wait_for_result: false/);
  assert.match(source, /action=get_video_upload_result/);
  assert.match(source, /a Shopee nao confirmou o video/i);
});

test('video dispatcher timeout waits, checks duplicate and retries only once', () => {
  assert.match(source, /VIDEO_DISPATCHER_SETTLE_MS = 15000/);
  assert.match(source, /VIDEO_DISPATCHER_RETRY_MS = 30000/);
  assert.match(source, /get video dispatcher info fail/);
  assert.match(source, /refreshRemoteDuplicateIndex\(ctx\)/);
  assert.match(source, /item .* ja existe na G; reutilizando sem reenviar/);
  assert.match(source, /addItemWithVideoRetry/);
});

test('video upload can fall back to locally downloaded data', () => {
  assert.match(source, /downloadVideoAsDataUrl/);
  assert.match(source, /video_data_url/);
  assert.match(source, /40 \* 1024 \* 1024/);
});

test('clone revalidates required attributes and keeps video fallbacks', () => {
  assert.match(source, /validatedSourceAttributes/);
  assert.match(source, /safeRequiredAttributeDefaults/);
  assert.match(source, /invalidRegulatoryAttributeValues/);
  assert.match(source, /valor fora da lista oficial/);
  assert.match(source, /uploadFirstAvailableVideo/);
  assert.doesNotMatch(source, /Array\.from\(new Set\(\[\.\.\.explicit, \.\.\.generated, \.\.\.source\]\)\)\s*\.slice\(0, 1\)/);
});

test('source-backed variations avoid duplicate anchor links', () => {
  assert.match(source, /sourceFamilyLinks/);
  assert.match(source, /rootIsVariationModel/);
  assert.match(source, /O modelo .* do anuncio M nao possui produto local ativo vinculado/);
});

test('created variations wait for every model id and can be reconciled without republishing', () => {
  assert.match(source, /waitForExpectedModels/);
  assert.match(source, /reconcileExistingVariationPublication/);
  assert.match(source, /\[RECUPERADO\]/);
  assert.match(source, /products\?sku=/);
});
