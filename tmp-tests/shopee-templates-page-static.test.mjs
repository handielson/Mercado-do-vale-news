import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routeSource = readFileSync('routes/index.tsx', 'utf8');
const pageSource = readFileSync('pages/admin/settings/ShopeeTemplatesPage.tsx', 'utf8');
const shopeePageSource = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.match(routeSource, /ShopeeTemplatesPage/, 'routes should lazy-load ShopeeTemplatesPage');
assert.match(routeSource, /path:\s*"\/admin\/settings\/shopee\/templates"/, 'routes should expose Shopee templates page');

assert.match(pageSource, /Templates da Shopee/, 'page should have the expected title');
assert.match(pageSource, /Novo template/, 'page should allow creating templates');
assert.match(pageSource, /Titulo sugerido/, 'page should edit suggested title');
assert.match(pageSource, /Termos perigosos/, 'page should edit dangerous terms');
assert.match(pageSource, /shopeeTemplateService/, 'page should use template service');

assert.match(shopeePageSource, /\/admin\/settings\/shopee\/templates/, 'Shopee settings page should link to templates page');

console.log('shopee templates page static checks passed');
