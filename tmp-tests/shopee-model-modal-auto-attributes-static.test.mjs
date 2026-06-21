/**
 * shopee-model-modal-auto-attributes-static.test.mjs
 *
 * Protecao contra regressao para a feature de auto-carga de atributos Shopee
 * no cadastro de modelos (ModelModal.tsx).
 *
 * Falha se:
 *   - shopeeAttributeResolver.js deixar de exportar as funcoes esperadas;
 *   - ModelModal.tsx deixar de importar do helper;
 *   - ModelModal.tsx deixar de chamar /api/shopee-catalog?action=attributes;
 *   - ModelModal.tsx deixar de ter useEffect reativo a shopeeCategoryId;
 *   - ModelModal.tsx deixar de usar buildShopeeAttributeDefaultsPayload.
 *
 * Uso:
 *   node tmp-tests/shopee-model-modal-auto-attributes-static.test.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

let checks = 0;
let passed = 0;
let failed = 0;

function check(label, condition, detail) {
    checks++;
    if (condition) {
        passed++;
        console.log(`  ✅ ${label}`);
    } else {
        failed++;
        console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
    }
}

// ─── 1. shopeeAttributeResolver.js exports ────────────────────────────────────

console.log('\n📦 shopeeAttributeResolver.js');

const resolverPath = resolve(ROOT, 'pages/admin/settings/shopeeAttributeResolver.js');
const resolverSrc = readFileSync(resolverPath, 'utf8');

check('exports normalizeShopeeAttributes',
    /export\s+function\s+normalizeShopeeAttributes/.test(resolverSrc));
check('exports extractShopeeAttributeTree',
    /export\s+function\s+extractShopeeAttributeTree/.test(resolverSrc));
check('exports buildShopeeAttributeDefaultsPayload',
    /export\s+function\s+buildShopeeAttributeDefaultsPayload/.test(resolverSrc));
check('exports summarizeShopeeAttributes',
    /export\s+function\s+summarizeShopeeAttributes/.test(resolverSrc));
check('exports translateShopeeText',
    /export\s+function\s+translateShopeeText/.test(resolverSrc));
check('exports normalizeLookupText',
    /export\s+function\s+normalizeLookupText/.test(resolverSrc));
check('exports ensureWarrantyTypeOptions',
    /export\s+function\s+ensureWarrantyTypeOptions/.test(resolverSrc));
check('reexports buildShopeeTemplateAttributeValues from shopeeFieldTemplates',
    /buildShopeeTemplateAttributeValues/.test(resolverSrc) &&
    /shopeeFieldTemplates/.test(resolverSrc));
check('reexports resolveShopeeFieldTemplate from shopeeFieldTemplates',
    /resolveShopeeFieldTemplate/.test(resolverSrc) &&
    /shopeeFieldTemplates/.test(resolverSrc));

// JSDoc typedefs
check('JSDoc typedef ShopeeAttributeField',
    /@typedef\s*\{Object\}\s*ShopeeAttributeField/.test(resolverSrc));
check('JSDoc typedef ShopeeAttributeOption',
    /@typedef\s*\{Object\}\s*ShopeeAttributeOption/.test(resolverSrc));

// ─── 2. ModelModal.tsx imports and logic ───────────────────────────────────────

console.log('\n📦 ModelModal.tsx');

const modalPath = resolve(ROOT, 'components/settings/ModelModal.tsx');
const modalSrc = readFileSync(modalPath, 'utf8');

check('imports from shopeeAttributeResolver.js',
    modalSrc.includes("shopeeAttributeResolver.js"));
check('imports normalizeShopeeAttributes',
    /normalizeShopeeAttributes/.test(modalSrc));
check('imports buildShopeeAttributeDefaultsPayload',
    /buildShopeeAttributeDefaultsPayload/.test(modalSrc));
check('imports summarizeShopeeAttributes',
    /summarizeShopeeAttributes/.test(modalSrc));
check('declares ShopeeAttributeField type locally',
    /type ShopeeAttributeField\s*=\s*\{/.test(modalSrc));

// Check that it fetches attributes from shopee-catalog
check('fetches /api/shopee-catalog?action=attributes',
    /\/api\/shopee-catalog\?action=attributes/.test(modalSrc));
check('passes category_id parameter',
    /category_id=\$\{/.test(modalSrc));

// Check useEffect reacting to shopeeCategoryId
check('has useEffect that triggers on shopeeCategoryId change',
    /useEffect\(\s*\(\)\s*=>\s*\{/.test(modalSrc) &&
    /shopeeCategoryId/.test(modalSrc) &&
    /loadShopeeAttributes/.test(modalSrc));

// Check the attribute defaults payload builder is called
check('calls buildShopeeAttributeDefaultsPayload',
    /buildShopeeAttributeDefaultsPayload/.test(modalSrc));
check('passes product ref with name and brand',
    /\{\s*name\s*,?\s*brand\s*:/.test(modalSrc) || /productRef/.test(modalSrc));

// Check loading/error/fields state
check('declares shopeeAttributeFields state',
    /shopeeAttributeFields/.test(modalSrc));
check('declares shopeeAttributesLoading state',
    /shopeeAttributesLoading/.test(modalSrc));
check('declares shopeeAttributesError state',
    /shopeeAttributesError/.test(modalSrc));
check('has loadShopeeAttributes function',
    /loadShopeeAttributes/.test(modalSrc));
check('has handleReloadShopeeAttributes handler',
    /handleReloadShopeeAttributes/.test(modalSrc));

// Check UI elements in the Shopee tab
check('shows loading spinner for attributes',
    /Buscando atributos da categoria/.test(modalSrc));
check('shows Reload button',
    /Recarregar/.test(modalSrc));
check('shows attribute summary badges',
    /obrigat/.test(modalSrc)); // "obrigatórios" (portuguese)
check('shows filled count badge',
    /preenchidos/.test(modalSrc));

// ─── 3. ShopeePage.tsx untouched ──────────────────────────────────────────────

console.log('\n📦 ShopeePage.tsx (untouched)');

const shopeePagePath = resolve(ROOT, 'pages/admin/settings/ShopeePage.tsx');
const shopeePageSrc = readFileSync(shopeePagePath, 'utf8');

check('ShopeePage.tsx does NOT import from shopeeAttributeResolver',
    !shopeePageSrc.includes('shopeeAttributeResolver'));
check('ShopeePage.tsx still has local normalizeShopeeAttributes',
    /function normalizeShopeeAttributes/.test(shopeePageSrc));
check('ShopeePage.tsx still has local extractShopeeAttributeTree',
    /function extractShopeeAttributeTree/.test(shopeePageSrc));

// ─── Result ──────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(60)}`);
console.log(`Total: ${checks} | Passou: ${passed} | Falhou: ${failed}`);
if (failed > 0) {
    console.log('\n⚠️  TESTE FALHOU — rever os checks acima.');
    process.exit(1);
} else {
    console.log('\n✅ Todos os checks passaram.');
    process.exit(0);
}
