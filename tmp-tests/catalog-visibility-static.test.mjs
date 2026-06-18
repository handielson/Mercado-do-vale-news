import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(file, 'utf8');

const productTypes = read('types/product.ts');
const vpsApi = read('services/vpsApiService.ts');
const catalogService = read('services/catalogService.ts');
const catalogConfigService = read('services/catalogConfigService.ts');
const productCard = read('components/products/ProductCard.tsx');
const vpsServer = read('vps_server.js');
const publicProductPage = read('pages/store/PublicProductPage.tsx');
const catalogMessage = read('utils/catalogMessageGenerator.ts');
const catalogPdf = read('utils/catalogPDFGenerator.ts');

function assertMatch(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

function assertIncludes(source, snippet, message) {
  if (!source.includes(snippet)) throw new Error(message);
}

assertMatch(productTypes, /hide_from_catalog\?:\s*boolean/, 'Product types must expose hide_from_catalog.');

assertMatch(vpsServer, /addColumnIfMissing\(\s*['"]products['"]\s*,\s*['"]hide_from_catalog['"]/, 'VPS startup must add products.hide_from_catalog when missing.');
assertMatch(vpsServer, /hide_from_catalog,\s*meta_title/, 'VPS product SELECT columns must include hide_from_catalog.');
assertMatch(vpsServer, /fastify\.patch\('\/products\/:id\/catalog-visibility'[\s\S]*hide_from_catalog/, 'VPS must expose a focused catalog visibility PATCH endpoint.');
assertMatch(vpsServer, /fastify\.get\('\/pdv\/product-search'[\s\S]*status = 'active'[\s\S]*ORDER BY name ASC/, 'PDV product search must stay status-based and not depend on catalog visibility.');

assertMatch(vpsApi, /updateProductCatalogVisibility\(\s*id:\s*string,\s*hide_from_catalog:\s*boolean/, 'Client API must expose updateProductCatalogVisibility.');
assertIncludes(vpsApi, "/products/${id}/catalog-visibility", 'Client API must call the focused catalog visibility endpoint.');

assertMatch(catalogService, /removeHiddenCatalogProducts[\s\S]*!product\.hide_from_catalog/, 'Catalog service must filter hide_from_catalog products.');
assertMatch(catalogConfigService, /product\.hide_from_catalog[\s\S]*return false/, 'Catalog visibility rules must reject hide_from_catalog products.');
assertMatch(catalogMessage, /filterCatalogVisibleProducts[\s\S]*!product\.hide_from_catalog/, 'Catalog messages must exclude hide_from_catalog products.');
assertMatch(catalogPdf, /filterCatalogVisibleProducts[\s\S]*!product\.hide_from_catalog/, 'Catalog PDFs must exclude hide_from_catalog products.');
assertMatch(publicProductPage, /data\.hide_from_catalog[\s\S]*Not found/, 'Public product page must not render a direct hidden product URL.');

assertMatch(productCard, /EyeOff,\s*Loader2|Loader2,\s*EyeOff|Eye,\s*EyeOff|EyeOff,\s*Eye/, 'Admin product card must import eye icons.');
assertMatch(productCard, /handleToggleCatalogVisibility[\s\S]*updateProductCatalogVisibility/, 'Admin product card must toggle catalog visibility through the focused endpoint.');
assertIncludes(productCard, 'Oculto no site', 'Admin product card must show a visible hidden-from-site badge.');

console.log('catalog visibility static checks passed');
