import assert from 'node:assert/strict';
import fs from 'node:fs';

const productList = fs.readFileSync(new URL('../pages/admin/products/ProductListPage.tsx', import.meta.url), 'utf8');
const quickAccess = fs.readFileSync(new URL('../components/admin/dashboard/AdminQuickAccessGrid.tsx', import.meta.url), 'utf8');
const routes = fs.readFileSync(new URL('../routes/index.tsx', import.meta.url), 'utf8');
const intakePage = fs.readFileSync(new URL('../pages/admin/products/SmartphonePhotoIntakePage.tsx', import.meta.url), 'utf8');
const reviewCard = fs.readFileSync(new URL('../components/products/photo-intake/PhotoIntakeReviewCard.tsx', import.meta.url), 'utf8');

assert.match(productList, /photo-intake[\s\S]*Smartphones por Foto/, 'Produtos deve exibir acesso ao cadastro por foto');
assert.match(quickAccess, /Smartphones por Foto[\s\S]*\/admin\/products\/photo-intake/, 'Dashboard deve exibir acesso rápido');
assert.match(routes, /path:\s*["']\/admin\/products\/photo-intake["']/, 'rota administrativa deve continuar publicada');
assert.match(intakePage, /colorService\.listActive\(\)[\s\S]*colorService\.refreshActive\(\)[\s\S]*colors=\{colors\}/, 'tela deve carregar e atualizar as cores estruturadas');
assert.match(reviewCard, /Cor do sistema[\s\S]*matched_color_id[\s\S]*Cadastrar nova cor/, 'conferência deve permitir mapear ou cadastrar a cor');
assert.doesNotMatch(reviewCard, /key: 'detected_color', label: 'Cor'/, 'cor não deve continuar como campo de texto livre');

console.log('smartphone photo intake navigation static test passed');
