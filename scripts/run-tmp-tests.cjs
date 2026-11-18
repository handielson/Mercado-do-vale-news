#!/usr/bin/env node
'use strict';
// Roda todos os tmp-tests/*.test.cjs de uma vez e deixa de fora, com o motivo, o que depende de algo
// que não vem no clone. Assim a suíte fica verde e qualquer falha nova chama atenção.
//   npm run test:tmp                 suíte inteira
//   MDV_N8N_SNAPSHOTS=1 npm run test:tmp   inclui os fluxos do n8n (precisa dos snapshots em .local/ ou nas variáveis MDV_*_SNAPSHOT)
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'tmp-tests');

const hasDocker = () => spawnSync('docker', ['--context', 'desktop-linux', 'info'], { stdio: 'ignore', timeout: 15000 }).status === 0;
const hasFfmpeg = () => { try { const bin = require('ffmpeg-static'); return Boolean(bin) && fs.existsSync(bin); } catch { return false; } };

const groups = [
  {
    name: 'n8n', why: 'precisa do fluxo do n8n exportado (.local/ ou MDV_*_SNAPSHOT); rode com MDV_N8N_SNAPSHOTS=1',
    enabled: () => process.env.MDV_N8N_SNAPSHOTS === '1',
    files: [
      'n8n-attendance-flow-contract.test.cjs',
      'n8n-attendance-multiturn.test.cjs',
      'n8n-attendance-policy-fixes.test.cjs',
      'n8n-attendance-recovery-fixes.test.cjs',
      'n8n-attendance-sales-fixes.test.cjs',
      'n8n-cheapest-intent-fillers.test.cjs',
      'n8n-cheapest-promo-accessory-fix.test.cjs',
      'n8n-delivery-intent-priority-static.test.cjs',
      'n8n-fix-photo-model-requests-0642.test.cjs',
      'n8n-gpt6-luna-migration.test.cjs',
      'n8n-installment-options-payjoy.test.cjs',
      'n8n-installment-table-clean.test.cjs',
      'n8n-meta-attendance-deploy.test.cjs',
      'n8n-meta-attendance-patch.test.cjs',
      'n8n-meta-catalog-intent-parity.test.cjs',
      'n8n-meta-multibrand-promos.test.cjs',
      'n8n-meta-parity-composition.test.cjs',
      'n8n-meta-payjoy-deploy.test.cjs',
      'n8n-meta-payjoy-images.test.cjs',
      'n8n-meta-sales-parity.test.cjs',
      'n8n-missing-prices-sequence-fix.test.cjs',
      'n8n-payjoy-approval.test.cjs',
      'n8n-payjoy-approved-list.test.cjs',
      'n8n-payjoy-availability-patch.test.cjs',
      'n8n-payjoy-contextual-intent.test.cjs',
      'n8n-payjoy-continuation.test.cjs',
      'n8n-payjoy-knowledge.test.cjs',
      'n8n-payjoy-link-continuity.test.cjs',
      'n8n-payjoy-spaced-context.test.cjs',
      'n8n-payjoy-workflow-patch.test.cjs',
      'n8n-photo-catalog-message-split.test.cjs',
      'n8n-sales-conversation-contract.test.cjs',
      'n8n-sales-end-to-end.test.cjs',
      'n8n-sales-list-nfc.test.cjs',
      'n8n-sales-model-configuration.test.cjs',
      'n8n-sales-option-color-photos.test.cjs',
      'n8n-sales-order-contract.test.cjs',
      'n8n-sales-price-revalidate.test.cjs',
      'n8n-sales-variant-contract.test.cjs',
      'n8n-smartphone-model-id-grouping.test.cjs',
      'n8n-unavailable-phone-full-catalog.test.cjs',
      'n8n-whatsapp-payjoy-images.test.cjs',
      'n8n-state-rebase-revision.test.cjs',
    ],
  },
  {
    name: 'docker', why: 'precisa do Docker Desktop com MySQL',
    enabled: hasDocker,
    files: ['bling-stock-webhook-queue.test.cjs', 'company-fiscal-mysql.test.cjs', 'external-stock-reconciliation-mysql.test.cjs'],
  },
  {
    name: 'ffmpeg', why: 'precisa do binário do ffmpeg-static (npm install sem --ignore-scripts)',
    enabled: hasFfmpeg,
    files: ['tiktok-shop-video-ratio.test.cjs'],
  },
  {
    name: 'loja3d', why: 'Loja 3D (3DMV / G-CODE) vai sair deste sistema',
    enabled: () => false,
    files: ['print3d-admin-mdv-isolation.test.cjs', 'print3d-deploy.test.cjs', 'print3d-google-client.test.cjs',
      'print3d-migrations-mysql.test.cjs', 'print3d-product-service-roundtrip.test.cjs', 'print3d-turnstile-browser.test.cjs'],
  },
];

const all = fs.readdirSync(dir).filter(f => f.endsWith('.test.cjs')).sort();
const left = new Map();
for (const group of groups) {
  const missing = group.files.filter(f => !all.includes(f));
  if (missing.length) console.warn(`[test:tmp] grupo ${group.name}: arquivos que não existem mais: ${missing.join(', ')}`);
  if (!group.enabled()) for (const f of group.files) left.set(f, group);
}
const files = all.filter(f => !left.has(f)).map(f => path.join('tmp-tests', f));
for (const group of groups) {
  const out = group.files.filter(f => left.get(f) === group).length;
  if (out) console.log(`[test:tmp] fora: ${out} de ${group.name} — ${group.why}`);
}
console.log(`[test:tmp] rodando ${files.length} de ${all.length} arquivos`);
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=8', ...files], { cwd: root, stdio: 'inherit' });
process.exit(result.status ?? 1);
