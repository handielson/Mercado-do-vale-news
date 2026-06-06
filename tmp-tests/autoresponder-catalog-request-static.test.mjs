import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readBotWhatsappDoc } from '../tools/autoresponder-bot-doc.cjs';

const serverFiles = ['vps_server.cjs', 'vps_server.js'];

for (const fileName of serverFiles) {
  const source = readFileSync(fileName, 'utf8');

  assert.ok(source.includes('isAutoresponderCatalogRequest'), `${fileName} must detect generic catalog requests`);
  assert.ok(source.includes('detectAutoresponderGenericDeviceCatalogFamily'), `${fileName} must detect generic device catalog requests before listing products`);
  assert.ok(source.includes('isAutoresponderGenericPhoneCatalogRequest'), `${fileName} must preserve generic phone catalog detection compatibility`);
  assert.ok(source.includes('buildAutoresponderPhoneCatalogRefinementPrompt'), `${fileName} must ask for refinement on generic phone catalog requests`);
  assert.ok(source.includes('buildAutoresponderDeviceCatalogRefinementPrompt'), `${fileName} must ask for refinement on generic tablets and receivers too`);
  assert.ok(source.includes('Temos tablets disponiveis sim.'), `${fileName} must refine broad tablet requests`);
  assert.ok(source.includes('Temos receptores disponiveis sim.'), `${fileName} must refine broad receiver requests`);
  assert.ok(source.includes('catalog_phone_refinement'), `${fileName} must log generic phone refinement replies distinctly`);
  assert.ok(source.includes('catalog_device_refinement'), `${fileName} must log generic tablet and receiver refinement replies distinctly`);
  assert.ok(
    source.includes('Se quiser receber a lista dos disponiveis, responda "lista".'),
    `${fileName} must offer an explicit list opt-in for generic phone requests`
  );
  const webhookIndex = source.indexOf("url: '/autoresponder-webhook'");
  const genericDeviceIndex = source.indexOf('detectAutoresponderGenericDeviceCatalogFamily(message)', webhookIndex);
  const genericCatalogIndex = source.indexOf('if (isAutoresponderCatalogRequest(message))', genericDeviceIndex);
  assert.ok(
    webhookIndex >= 0 && genericDeviceIndex > webhookIndex && genericDeviceIndex < genericCatalogIndex,
    `${fileName} must ask refinement before the regular generic category catalog flow`
  );
  assert.ok(source.includes('findAutoresponderCatalogCategoryForMessage'), `${fileName} must map catalog requests to a category`);
  assert.ok(source.includes("intent: 'catalog_category'"), `${fileName} must log category catalog replies distinctly`);
  assert.ok(source.includes("source: 'category'"), `${fileName} must preserve category pagination context`);
  assert.ok(source.includes("pagination.source === 'category'"), `${fileName} must paginate catalog category replies`);
  assert.ok(source.includes("intent: 'more_products_exhausted'"), `${fileName} must not run a fresh product search when 'mais' has no next page`);
  assert.ok(source.includes('formatAutoresponderProductDescriptionLine'), `${fileName} must include a short description in product details when available`);
  assert.ok(source.includes('findAutoresponderProductVariations'), `${fileName} must fetch related product variations for details`);
  assert.ok(source.includes('formatAutoresponderProductVariationsBlock'), `${fileName} must format variations and colors in details`);
  assert.ok(!source.includes('lines.push(`SKU: ${product.sku}`)'), `${fileName} must not show SKU in customer-facing product details`);
  assert.ok(source.includes('formatAutoresponderProductCardLine'), `${fileName} must format catalog cards with the WhatsApp sales pattern`);
  assert.ok(source.includes('formatAutoresponderProductCardPaymentLine'), `${fileName} must show card installment total in catalog cards`);
  assert.ok(source.includes('function getAutoresponderInitialProductPageSize'), `${fileName} must centralize the initial product page size`);
  assert.ok(source.includes('const pageSize = getAutoresponderInitialProductPageSize();'), `${fileName} must keep initial product replies short`);
  assert.ok(
    source.includes('vamos ficar com qual deles hoje? quer ver a lista completa?'),
    `${fileName} must ask the customer to choose or request the complete list`
  );
  assert.ok(source.includes('calculateAutoresponderInstallmentOptions(priceCents, 12)'), `${fileName} must calculate 12x installment options for catalog cards`);
  assert.ok(source.includes('💰'), `${fileName} must show cash price in the requested pattern`);
  assert.ok(source.includes('💳'), `${fileName} must show card installment in the requested pattern`);
  assert.ok(source.includes('🎨'), `${fileName} must show colors in the requested pattern`);
  assert.ok(source.includes('AUTORESPONDER_AI_SYSTEM_PROMPT'), `${fileName} must define a strict AI system prompt`);
  assert.ok(source.includes('PROIBIDO'), `${fileName} must explicitly forbid answers outside system data`);
  assert.ok(!source.includes('formatAutoresponderReplies([greetingText, needsPrompt.text], settings, false)'), `${fileName} greeting test reply must not add a needs prompt after greeting`);
  assert.ok(!source.includes('formatAutoresponderReplies([greetingText, needsPromptText], settings, false)'), `${fileName} webhook greeting must not add a needs prompt after greeting`);
  assert.ok(!source.includes('formatAutoresponderReplies([greetingText, categoryListText], settings, false)'), `${fileName} greeting test reply must not list categories as response 2`);
  assert.ok(source.includes('extractAutoresponderBudgetCents'), `${fileName} must understand customer budget messages`);
  assert.ok(source.includes('findAutoresponderProductsByCategoryBudget'), `${fileName} must answer budget requests from VPS category products`);
  assert.ok(source.includes("intent: 'catalog_budget'"), `${fileName} must log budget catalog replies distinctly`);
}

const checklist = readBotWhatsappDoc();
assert.ok(checklist.includes('Busca generica de celulares com refinamento'), 'Bot_Whatsapp.md must document generic phone refinement progress');
assert.ok(checklist.includes('tmp-tests/autoresponder-catalog-request-static.test.mjs'), 'Bot_Whatsapp.md must mention the catalog request static test');

console.log('autoresponder catalog request static checks passed');
