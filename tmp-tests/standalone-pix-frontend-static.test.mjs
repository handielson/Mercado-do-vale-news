import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(path, 'utf8');

const service = read('services/standalonePixService.ts');
const types = read('types/standalonePix.ts');
const adminPage = read('pages/admin/financial/StandalonePixPage.tsx');
const publicPage = read('pages/store/PublicPixPage.tsx');
const routes = read('routes/index.tsx');
const layout = read('layouts/AdminLayout.tsx');
const dashboard = read('components/admin/dashboard/AdminQuickAccessGrid.tsx');

for (const snippet of [
  "vpsClient.post<StandalonePixPayment>('/pix/standalone'",
  "vpsClient.get<{ data: StandalonePixPayment[] }>('/pix/standalone",
  "vpsClient.get<StandalonePixPayment>(`/pix/standalone/${encodeURIComponent(id)}/status`",
  "vpsClient.post<StandalonePixPayment>(`/pix/standalone/${encodeURIComponent(id)}/cancel`",
  "vpsClient.post<StandalonePixShareResponse>(`/pix/standalone/${encodeURIComponent(id)}/share-whatsapp`",
  "vpsClient.get<StandalonePixPayment>(`/pix/public/${encodeURIComponent(token)}`",
  "vpsClient.get<{ data: GoogleContactOption[] }>('/google-contacts/search",
]) {
  assert.ok(service.includes(snippet), `standalonePixService.ts must include ${snippet}`);
}

for (const snippet of [
  'StandalonePixPayment',
  'GoogleContactOption',
  'Cancelado por falta de pagamento',
  'Cancelado manualmente',
  'isStandalonePixPayable',
  'formatStandalonePixStatus',
]) {
  assert.ok(types.includes(snippet), `types/standalonePix.ts must include ${snippet}`);
}

for (const snippet of [
  'Pix Avulso',
  'Gerar Pix',
  'Copiar codigo Pix',
  'Copiar link publico',
  'Compartilhar no WhatsApp',
  'Cancelar Pix',
  'Exibir no display',
  'Cancelado por falta de pagamento',
  'pdvDisplayService.setActivePix',
  'standalonePixService.create',
  'standalonePixService.list',
  'standalonePixService.shareWhatsApp',
  'standalonePixService.cancel',
  'standalonePixService.searchGoogleContacts',
  'STANDALONE_PIX_STATUS_POLLING_MS',
  'pollCurrentPixStatus',
  "placeholder=\"87988032612\"",
  '+55',
  'Buscar cliente na agenda Google',
  'handleSelectGoogleContact',
]) {
  assert.ok(adminPage.includes(snippet), `StandalonePixPage.tsx must include ${snippet}`);
}

for (const snippet of [
  'useParams',
  'standalonePixService.getPublic',
  'STANDALONE_PIX_PUBLIC_POLLING_MS',
  'isStandalonePixPayable(pix)',
  'window.setInterval',
  'Pagamento aprovado',
  'Copiar codigo Pix',
  'Cancelado por falta de pagamento',
  'qr_code_base64',
  'Pix copia e cola',
]) {
  assert.ok(publicPage.includes(snippet), `PublicPixPage.tsx must include ${snippet}`);
}

assert.ok(routes.includes("const StandalonePixPage = lazy(() => import('../pages/admin/financial/StandalonePixPage'))"), 'routes must lazy load admin standalone pix page');
assert.ok(routes.includes("const PublicPixPage = lazy(() => import('../pages/store/PublicPixPage'))"), 'routes must lazy load public pix page');
assert.ok(routes.includes('path: "/admin/pix-avulso"'), 'routes must expose /admin/pix-avulso');
assert.ok(routes.includes('path: "/pix/:token"'), 'routes must expose /pix/:token');
assert.ok(layout.includes("to: '/admin/pix-avulso'"), 'AdminLayout must add Pix Avulso menu item');
assert.ok(dashboard.includes("label: 'Pix Avulso'"), 'dashboard must show Pix Avulso quick access');
assert.ok(dashboard.includes("path: '/admin/pix-avulso'"), 'dashboard Pix Avulso quick access must use the admin route');

console.log('standalone pix frontend static checks passed');
